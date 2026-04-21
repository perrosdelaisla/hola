/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   supabase.js — Conexión y operaciones BD
   ═══════════════════════════════════════════ */

const SUPA_URL = 'https://sydzfwwiruxqaxojymdz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjAwODAsImV4cCI6MjA5MjMzNjA4MH0.0SpunQTuSwYaAjzWEDQivZy7971-Tf3CX2KxAEo8Nuw';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation'
};

/* ── HELPER FETCH ── */
async function supa(path, method = 'GET', body = null) {
  const opts = { method, headers: { ...HEADERS } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(SUPA_URL + '/rest/v1/' + path, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

/* ════════════════════════════════════════════
   SLOTS Y DISPONIBILIDAD
   ════════════════════════════════════════════ */

/**
 * Devuelve los slots disponibles para los próximos 7 días
 * Excluye: días bloqueados, slots ya con 2 citas confirmadas
 */
export async function obtenerSlotsDisponibles() {
  const hoy = new Date();
  // Empezamos desde mañana
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() + 1);
  // Hasta 14 días adelante
  const hasta = new Date(hoy);
  hasta.setDate(hoy.getDate() + 14);

  // 1. Traer slots activos
  const slots = await supa('slots?activo=eq.true&order=dia_semana,hora');

  // 2. Traer bloqueos en el rango
  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = hasta.toISOString().split('T')[0];
  const bloqueos = await supa(
    `bloqueos?fecha=gte.${desdeStr}&fecha=lte.${hastaStr}&select=fecha`
  );
  const diasBloqueados = new Set(bloqueos.map(b => b.fecha));

  // 3. Traer citas confirmadas en el rango
  const citas = await supa(
    `citas?fecha=gte.${desdeStr}&fecha=lte.${hastaStr}&estado=neq.cancelada&select=fecha,hora`
  );

  // Contar citas por día
  const citasPorDia = {};
  citas.forEach(c => {
    citasPorDia[c.fecha] = (citasPorDia[c.fecha] || 0) + 1;
  });

  // Contar citas por slot específico
  const citasPorSlot = {};
  citas.forEach(c => {
    const key = `${c.fecha}_${c.hora}`;
    citasPorSlot[key] = (citasPorSlot[key] || 0) + 1;
  });

  // 4. Generar slots disponibles
  const disponibles = [];
  const cursor = new Date(desde);

  while (cursor <= hasta) {
    const diaSemana = cursor.getDay(); // 0=dom, 1=lun ... 6=sab
    const fechaStr = cursor.toISOString().split('T')[0];

    // Saltar domingos y días bloqueados
    if (diaSemana !== 0 && !diasBloqueados.has(fechaStr)) {
      // Límite de citas por día (sábado: 1, resto: 2)
      const maxCitas = diaSemana === 6 ? 1 : 2;
      const citasHoy = citasPorDia[fechaStr] || 0;

      if (citasHoy < maxCitas) {
        // Slots de este día de semana
        const slotsHoy = slots.filter(s => s.dia_semana === diaSemana);

        slotsHoy.forEach(slot => {
          const slotKey = `${fechaStr}_${slot.hora}`;
          const citasEnSlot = citasPorSlot[slotKey] || 0;

          if (citasEnSlot === 0) {
            disponibles.push({
              fecha: fechaStr,
              hora: slot.hora.substring(0, 5), // "10:30"
              dia_semana: diaSemana,
              label: formatearFecha(cursor),
            });
          }
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return disponibles;
}

function formatearFecha(fecha) {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[fecha.getDay()]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
}

/* ════════════════════════════════════════════
   GUARDAR RESERVA COMPLETA
   ════════════════════════════════════════════ */

/**
 * Guarda cliente, perros y cita en Supabase
 * Devuelve el id de la cita creada
 */
export async function guardarReserva({ cliente, perros, cita }) {
  // 1. Insertar cliente
  const [clienteCreado] = await supa('clientes', 'POST', {
    nombre:    cliente.nombre,
    telefono:  cliente.telefono,
    email:     cliente.email || null,
    direccion: cliente.direccion || null,
    zona:      cliente.zona || null,
  });

  const clienteId = clienteCreado.id;

  // 2. Insertar perros
  for (const perro of perros) {
    await supa('perros', 'POST', {
      cliente_id:   clienteId,
      nombre:       perro.nombre,
      raza:         perro.raza || null,
      edad:         perro.edad || null,
      problematica: perro.problematica || null,
      descripcion:  perro.descripcion || null,
      metodo_previo: perro.metodoPrevio || null,
    });
  }

  // 3. Insertar cita
  const [citaCreada] = await supa('citas', 'POST', {
    cliente_id:    clienteId,
    fecha:         cita.fecha,
    hora:          cita.hora + ':00',
    estado:        'pendiente',
    sena_pagada:   false,
    metodo_pago:   cita.metodoPago || null,
    protocolo:     cita.protocolo || null,
    notas:         cita.notas || null,
  });

  return { citaId: citaCreada.id, clienteId };
}

/**
 * Marca la seña como pagada y sube URL del comprobante
 */
export async function confirmarSena(citaId, metodoPago, comprobanteUrl = null) {
  await supa(`citas?id=eq.${citaId}`, 'PATCH', {
    sena_pagada:     true,
    metodo_pago:     metodoPago,
    comprobante_url: comprobanteUrl,
    estado:          'pendiente', // Carlos confirma manualmente
  });
}

/* ════════════════════════════════════════════
   ADMIN — BLOQUEOS
   ════════════════════════════════════════════ */

export async function bloquearDia(fecha, motivo = '') {
  await supa('bloqueos', 'POST', { fecha, motivo });
}

export async function desbloquearDia(fecha) {
  await supa(`bloqueos?fecha=eq.${fecha}`, 'DELETE');
}

export async function obtenerBloqueos() {
  const hoy = new Date().toISOString().split('T')[0];
  return supa(`bloqueos?fecha=gte.${hoy}&order=fecha`);
}

/* ════════════════════════════════════════════
   ADMIN — CITAS
   ════════════════════════════════════════════ */

export async function obtenerCitasAdmin() {
  const hoy = new Date().toISOString().split('T')[0];
  return supa(
    `citas?fecha=gte.${hoy}&order=fecha,hora&select=*,clientes(nombre,telefono,zona),perros(nombre,raza,edad,problematica)`
  );
}

export async function confirmarCita(citaId) {
  await supa(`citas?id=eq.${citaId}`, 'PATCH', { estado: 'confirmada' });
}

export async function cancelarCita(citaId) {
  await supa(`citas?id=eq.${citaId}`, 'PATCH', { estado: 'cancelada' });
}
