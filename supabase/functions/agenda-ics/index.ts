// supabase/functions/agenda-ics/index.ts
//
// Feed iCalendar (RFC 5545) público con la agenda de Charly:
//   - citas (rango: hoy → hoy+90 días, excluyendo canceladas)
//   - bloqueos manuales (excluyendo los autogenerados con prefijo "Auto:")
//
// Pensado para que Charly suscriba la URL en Google Calendar y vea
// citas y bloqueos en su calendario, junto al resto de su vida.
//
// Endpoint público (verify_jwt=false). No expone más datos que los que
// el adiestrador necesita ver antes de cada clase: nombre del cliente,
// del perro, edad/peso, problemática, modalidad, zona, estado y teléfono.

import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DURACION_MIN = 90;
const HORIZONTE_DIAS = 90;

// VTIMEZONE para Europe/Madrid (España peninsular).
// Reglas EU: DST empieza último domingo de marzo 02:00 CET → CEST,
// termina último domingo de octubre 03:00 CEST → CET.
const VTIMEZONE_MADRID = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

// ── Helpers ─────────────────────────────────────────────────────────────────

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

// Escape de tipo TEXT según RFC 5545 §3.3.11
function escapeText(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// Plegado de líneas >75 octetos (RFC 5545 §3.1). Trabajamos a nivel de byte
// para contar UTF-8 correctamente, pero cortamos en frontera de codepoint.
function foldLine(line: string): string {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // Primera línea: 75 octetos. Continuaciones: 74 (la línea física
    // total es " " + 74 = 75).
    const limit = chunks.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // Retroceder si caemos a mitad de un codepoint UTF-8
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(dec.decode(bytes.slice(start, end)));
    start = end;
  }
  return chunks.map((c, i) => (i === 0 ? c : " " + c)).join("\r\n");
}

// "YYYY-MM-DD" en Europe/Madrid para una Date dada
function madridDate(d: Date): string {
  // en-CA produce YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// "YYYY-MM-DD" + n días (operando en UTC con offset de mediodía para
// evitar saltos de DST)
function addDays(fechaIso: string, n: number): string {
  const d = new Date(fechaIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return madridDate(d);
}

// "2026-05-15" + "10:30:00" → "20260515T103000" (formato local TZID)
function fmtLocalDateTime(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split("-");
  const [hh, mm] = hora.split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

// "2026-05-15" → "20260515"
function fmtDate(fecha: string): string {
  return fecha.replaceAll("-", "");
}

// "2026-05-15" → "20260516" (día siguiente; DTEND exclusivo en all-day)
function fmtDatePlus1(fecha: string): string {
  return fmtDate(addDays(fecha, 1));
}

// Suma minutos a un par fecha+hora locales y devuelve el formato local
function fmtLocalPlusMin(fecha: string, hora: string, min: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  dt.setUTCMinutes(dt.getUTCMinutes() + min);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
         `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`;
}

// DTSTAMP en UTC ahora — requerido en cada VEVENT
function nowDtstamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
         `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function pgrest(path: string): Promise<unknown[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`PostgREST ${path} → ${r.status}: ${txt}`);
  }
  return r.json();
}

// ── Handler ─────────────────────────────────────────────────────────────────

interface Cita {
  id: string;
  fecha: string;
  hora: string;
  estado: string;
  modalidad: string | null;
  zona: string | null;
  sena_pagada: boolean | null;
  protocolo: string | null;
  clientes: {
    nombre: string | null;
    telefono: string | null;
    perros: Array<{
      nombre: string | null;
      edad: string | null;
      peso_kg: number | null;
      problematica: string | null;
    }> | null;
  } | null;
}

interface Bloqueo {
  id: string;
  fecha: string;
  hora: string | null;
  motivo: string | null;
}

Deno.serve(async (_req: Request) => {
  const hoy = madridDate(new Date());
  const limite = addDays(hoy, HORIZONTE_DIAS);
  const dtstamp = nowDtstamp();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Perros de la Isla//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Perros de la Isla",
    "X-WR-TIMEZONE:Europe/Madrid",
    VTIMEZONE_MADRID,
  ];

  // 1) Citas con cliente y perro embebidos
  try {
    const citasPath =
      `citas?select=id,fecha,hora,estado,modalidad,zona,sena_pagada,protocolo,` +
      `clientes(nombre,telefono,perros(nombre,edad,peso_kg,problematica))` +
      `&fecha=gte.${hoy}&fecha=lte.${limite}` +
      `&estado=neq.cancelada&cliente_id=not.is.null` +
      `&order=fecha.asc,hora.asc`;
    const citas = (await pgrest(citasPath)) as Cita[];

    for (const c of citas) {
      const cliente = c.clientes;
      if (!cliente) continue;
      const perro = cliente.perros?.[0] ?? null;

      const dtstart = fmtLocalDateTime(c.fecha, c.hora);
      const dtend = fmtLocalPlusMin(c.fecha, c.hora, DURACION_MIN);

      const summary = `🐾 ${cliente.nombre ?? "Cliente"} — ${perro?.nombre ?? "Perro"}`;

      const desc: string[] = [];
      if (cliente.telefono) desc.push(`Tel: ${cliente.telefono}`);
      if (perro) {
        const partes = [
          perro.nombre,
          perro.edad,
          perro.peso_kg != null ? `${perro.peso_kg} kg` : null,
        ].filter(Boolean);
        if (partes.length) desc.push(`Perro: ${partes.join(" · ")}`);
        if (perro.problematica) desc.push(`Problemática: ${perro.problematica}`);
      }
      const modZona = [c.modalidad, c.zona].filter(Boolean).join(" · ");
      if (modZona) desc.push(`Modalidad: ${modZona}`);
      let estadoTxt = `Estado: ${c.estado}`;
      if (c.sena_pagada) estadoTxt += " · seña pagada";
      desc.push(estadoTxt);
      if (c.protocolo) desc.push(`Protocolo: ${c.protocolo}`);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:cita-${c.id}@perrosdelaisla`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;TZID=Europe/Madrid:${dtstart}`);
      lines.push(`DTEND;TZID=Europe/Madrid:${dtend}`);
      lines.push(`SUMMARY:${escapeText(summary)}`);
      lines.push(`DESCRIPTION:${escapeText(desc.join("\n"))}`);
      if (c.zona) lines.push(`LOCATION:${escapeText(c.zona)}`);
      lines.push("END:VEVENT");
    }
  } catch (e) {
    console.error("agenda-ics: error leyendo citas:", e);
  }

  // 2) Bloqueos manuales (excluye Auto:* generados por el sistema)
  try {
    // PostgREST: motivo IS NULL OR motivo NOT LIKE 'Auto:%'
    const bloqPath =
      `bloqueos?select=id,fecha,hora,motivo` +
      `&fecha=gte.${hoy}&fecha=lte.${limite}` +
      `&or=(motivo.is.null,motivo.not.like.Auto:*)` +
      `&order=fecha.asc`;
    const bloqueos = (await pgrest(bloqPath)) as Bloqueo[];

    for (const b of bloqueos) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:bloqueo-${b.id}@perrosdelaisla`);
      lines.push(`DTSTAMP:${dtstamp}`);

      if (!b.hora) {
        // Día completo
        lines.push(`DTSTART;VALUE=DATE:${fmtDate(b.fecha)}`);
        lines.push(`DTEND;VALUE=DATE:${fmtDatePlus1(b.fecha)}`);
        lines.push(`SUMMARY:${escapeText("⛔ " + (b.motivo || "Día bloqueado"))}`);
      } else {
        // Slot puntual
        lines.push(`DTSTART;TZID=Europe/Madrid:${fmtLocalDateTime(b.fecha, b.hora)}`);
        lines.push(`DTEND;TZID=Europe/Madrid:${fmtLocalPlusMin(b.fecha, b.hora, DURACION_MIN)}`);
        lines.push(`SUMMARY:${escapeText("⛔ " + (b.motivo || "Slot bloqueado"))}`);
      }
      lines.push("END:VEVENT");
    }
  } catch (e) {
    console.error("agenda-ics: error leyendo bloqueos:", e);
  }

  lines.push("END:VCALENDAR");

  // El VTIMEZONE viene como bloque multilínea — explotarlo antes de plegar
  const ics = lines
    .flatMap((l) => l.split("\r\n"))
    .map(foldLine)
    .join("\r\n") + "\r\n";

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
