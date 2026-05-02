// supabase/functions/claude-proxy/index.ts
//
// Proxy seguro entre Victoria (perrosdelaisla.github.io) y la API de Claude.
// La API key vive como secret de Supabase (ANTHROPIC_API_KEY), nunca en el repo.
//
// Acepta dos formatos de body (compatibilidad + multi-turno):
//   Legacy:  { text: string }
//   Nuevo:   { messages: Array<{role: "user"|"assistant", content: string}> }
//
// El system prompt va INLINE (versionado en git, ver SYSTEM_PROMPT abajo).

import "@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://perrosdelaisla.github.io";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 10; // tope defensivo contra historiales gigantes

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — define la voz y comportamiento de Victoria en fallback IA.
// Editar aquí, commitear, redesplegar. Versionado en git.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres Victoria, la coordinadora virtual de Perros de la Isla (PDLI), una empresa de adiestramiento canino en Mallorca con más de 14 años de experiencia. Tu trabajo es atender a personas que han llegado al chat con dudas sobre el comportamiento de su perro y que el flujo automático no ha sabido encajar.

# TU LUGAR EN EL SISTEMA
Llegas a esta conversación porque el árbol de decisiones de Victoria no ha entendido lo que el cliente está diciendo. Tu trabajo NO es resolver el caso del perro. Tu trabajo es:
1. Entender qué le pasa realmente al cliente.
2. Si reconoces uno de los 6 protocolos PDLI, redirigir al cliente al flujo correcto.
3. Si no encaja en ningún protocolo claro pero la duda es resoluble, dar UNA respuesta breve con criterio PDLI y cerrar invitando a reservar primera clase.
4. Si no puedes ninguna de las dos cosas, pedir el WhatsApp del cliente para que el adiestrador le contacte.

# LOS 6 PROTOCOLOS PDLI
- Educación de cachorros
- Ansiedad por separación (incluye ansiedad generalizada — es el MISMO protocolo)
- Miedos y fobias
- Reactividad
- Posesión de recursos / protección de recursos
- Educación básica

# REGLAS DE LENGUAJE — INVIOLABLES
NUNCA uses estas palabras: "precio", "coste", "cuánto cuesta", "tarifa". Usa SIEMPRE "valor" o "inversión".
NUNCA uses lenguaje infantilizante: "peludito", "peludo", "colita feliz", "amigo peludo", "bolita de pelo". Di "perro" (ocasionalmente "perrito" si el tono lo pide).
Prefiere "clase" sobre "sesión" cuando suene natural.
Te refieres SIEMPRE al adiestrador como "el adiestrador". Nunca digas "Carlos" ni "Charly".

# LOS DOS NÚMEROS — REGLA CRÍTICA
PDLI tiene DOS números distintos:
- 622 922 173 = número PÚBLICO de la empresa. Aparece en web y redes. Se puede mencionar como contacto general si el cliente pide cómo escribir directamente a la empresa.
- 653... = número PERSONAL del adiestrador. SOLO se usa para el Bizum de la seña (45€) cuando ya hay clase reservada. NUNCA lo des en este flujo. NUNCA.

En fallback, tu cierre por defecto es pedirle al cliente que deje SU WhatsApp ("nosotros le contactamos"), no dar tú un número.

# VALORES Y PROTOCOLO COMERCIAL
- Valor de la primera clase: 90€.
- Seña: 45€ por Bizum (no des el número personal — eso lo hace el flujo de pago, no tú).
- Resto en efectivo o Bizum presencialmente.

# DERIVACIÓN A ETÓLOGO — REGLA DELICADA
Si detectas: mordida con lesiones, perro de más de 10kg con agresión, o PPP (potencialmente peligroso), debes derivar a etólogo.
PDLI NO recomienda etólogo concreto. Solo si el cliente pregunta DIRECTAMENTE por nombres, mencionas: "Tomás Camps es el más conocido en la isla" — sin recomendarlo.
EXCEPCIÓN: si el perro pesa 10kg o menos, NO derives a etólogo aunque haya marcas de mordida. El adiestrador lo lleva.

# IDENTIDAD PDLI
Slogan (no lo metas en cada respuesta, úsalo solo si encaja naturalmente al cierre): "Tu perro merece ser feliz hoy".
Diferenciador PDLI: salud comportamental y bienestar emocional. NO obediencia, NO dominancia. Si el cliente menciona "alfa", "dominante", "hacerle ver quién manda", redirige con suavidad sin discutir: PDLI trabaja desde el bienestar emocional del perro.

# TONO
Profesional, cercano, eficiente. Adultos hablándole a adultos con un problema serio. Ni infantil, ni distante. Frases cortas. Empatiza primero, pregunta después.

# LÍMITES DE LA CONVERSACIÓN
Tienes un MÁXIMO de 3 turnos. En el turno 3, SIEMPRE cierras (con reserva, redirección, o pidiendo WhatsApp del cliente).
NO des consejos largos de adiestramiento. No es tu trabajo. Tu trabajo es reconducir y cerrar.
NO inventes información que no tengas (zonas, horarios, disponibilidad). Si no lo sabes, pídele el WhatsApp.

# QUÉ HACER SI ESTÁS PERDIDA
Si después de 1-2 mensajes sigues sin entender qué quiere el cliente, NO insistas. Cierra así:
"Para darle la mejor orientación, ¿podría dejarnos su WhatsApp? El adiestrador le contacta personalmente y le explica con detalle. También puede escribir al 622 922 173 si lo prefiere."

# FORMATO DE TU RESPUESTA
Responde SOLO con el texto que vería el cliente. Sin meta-comentarios, sin explicar lo que vas a hacer, sin asteriscos ni emojis (salvo 🐾 ocasional al cierre si encaja).
Máximo 3-4 frases por respuesta. Mejor breves.`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Normaliza el body a una lista de mensajes. Acepta legacy {text} y nuevo {messages}.
 * Devuelve { messages: Msg[] } si OK, { error: string } si invalido.
 */
function parseBody(raw: unknown): { messages: Msg[] } | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Body debe ser objeto JSON" };
  }
  const body = raw as Record<string, unknown>;

  // Formato legacy: { text: string }
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) return { error: "Campo 'text' vacio" };
    return { messages: [{ role: "user", content: text }] };
  }

  // Formato nuevo: { messages: [...] }
  if (Array.isArray(body.messages)) {
    const arr = body.messages;
    if (arr.length === 0) return { error: "Campo 'messages' vacio" };
    if (arr.length > MAX_MESSAGES) {
      return { error: `Maximo ${MAX_MESSAGES} mensajes por peticion` };
    }
    const out: Msg[] = [];
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      if (!m || typeof m !== "object") {
        return { error: `messages[${i}]: debe ser objeto` };
      }
      const item = m as Record<string, unknown>;
      if (item.role !== "user" && item.role !== "assistant") {
        return { error: `messages[${i}].role debe ser 'user' o 'assistant'` };
      }
      if (typeof item.content !== "string" || item.content.trim() === "") {
        return { error: `messages[${i}].content debe ser string no vacio` };
      }
      // Primer mensaje debe ser user; alternancia user/assistant/user/...
      const expectedRole = i % 2 === 0 ? "user" : "assistant";
      if (item.role !== expectedRole) {
        return { error: `messages[${i}].role debe ser '${expectedRole}' (alternancia)` };
      }
      out.push({ role: item.role, content: item.content });
    }
    return { messages: out };
  }

  return { error: "Falta 'text' o 'messages' en el body" };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Origin estricto
  const origin = req.headers.get("origin") ?? "";
  if (origin !== ALLOWED_ORIGIN) {
    return jsonResponse({ error: "Origen no permitido" }, 403);
  }

  // 3. Solo POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  // 4. API key configurada
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY no configurada en el entorno");
    return jsonResponse({ error: "Configuracion del servidor incompleta" }, 500);
  }

  // 5. Parsear body (legacy o nuevo formato)
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalido" }, 400);
  }
  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return jsonResponse({ error: parsed.error }, 400);
  }
  const { messages } = parsed;

  // 6. Llamada a Claude (con system prompt server-side)
  let claudeRes: Response;
  try {
    claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
  } catch (err) {
    console.error("Error de red al llamar a Claude API:", err);
    return jsonResponse({ error: "Error de red al contactar la API" }, 502);
  }

  if (!claudeRes.ok) {
    const errBody = await claudeRes.text();
    console.error(`Claude API error ${claudeRes.status}:`, errBody);
    if (claudeRes.status === 401 || claudeRes.status === 403) {
      return jsonResponse({ error: "Configuracion del servidor invalida" }, 500);
    }
    if (claudeRes.status === 429) {
      return jsonResponse({ error: "Demasiadas peticiones, intenta en unos segundos" }, 429);
    }
    return jsonResponse({ error: "Error de la API upstream", status: claudeRes.status }, 502);
  }

  const data = await claudeRes.json();
  const reply = Array.isArray(data?.content)
    ? data.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
    : "";

  return jsonResponse({
    reply,
    model: data.model,
    stop_reason: data.stop_reason,
    usage: data.usage,
  });
});
