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
 * Devuelve los slots disponibles para los próximos 25 días
 * Excluye:
 *  - días bloqueados (bloqueos.hora = NULL)
 *  - horas concretas bloqueadas (bloqueos.hora = HH:MM)
 *  - slots con cita ya confirmada
 *  - días que ya alcanzaron el máximo de citas (sábado 1, resto 2)
 *  - domingos u otros días para los que no haya slots en la plantilla
 */
export async function obtenerSlotsDisponibles() {
  const hoy = new Date();
  // Empezamos desde mañana (el filtro +5 días lo aplica agenda.js después)
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() + 1);
  // Hasta 25 días adelante
  const hasta = new Date(hoy);
  hasta.setDate(hoy.getDate() + 25);

  // 1. Traer slots activos de la plantilla
  const slots = await supa('slots?activo=eq.true&order=dia_semana,hora');

  // 2. Traer bloqueos en el rango — incluye campo hora
  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = hasta.toISOString().split('T')[0];
  const bloqueos = await supa(
    `bloqueos?fecha=gte.${desdeStr}&fecha=lte.${hastaStr}&select=fecha,hora`
  );

  // Día entero bloqueado: cuando hora=NULL
  const diasBloqueadosCompletos = new Set(
    bloqueos.filter(b => b.hora === null).map(b => b.fecha)
  );
  // Bloqueos puntuales por hora: Set de "YYYY-MM-DD_HH:MM:SS"
  const slotsBloqueados = new Set(
    bloqueos.filter(b => b.hora !== null).map(b => `${b.fecha}_${b.hora}`)
  );

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

    // Saltar días bloqueados completos
    if (!diasBloqueadosCompletos.has(fechaStr)) {
      // Límite de citas por día (sábado: 1, resto: 2)
      const maxCitas = diaSemana === 6 ? 1 : 2;
      const citasHoy = citasPorDia[fechaStr] || 0;

      if (citasHoy < maxCitas) {
        // Slots de este día de semana desde la plantilla
        const slotsHoy = slots.filter(s => s.dia_semana === diaSemana);

        slotsHoy.forEach(slot => {
          const slotKey = `${fechaStr}_${slot.hora}`;
          const citasEnSlot = citasPorSlot[slotKey] || 0;

          // Excluir si hay cita en ese slot o si está bloqueado puntualmente
          if (citasEnSlot === 0 && !slotsBloqueados.has(slotKey)) {
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
   ADMIN — PLANTILLA DE SLOTS (horario semanal base)
   ════════════════════════════════════════════ */

/**
 * Devuelve toda la plantilla de slots, ordenada por día y hora.
 * Incluye los inactivos (el panel admin los muestra en gris).
 */
export async function obtenerPlantilla() {
  return supa('slots?order=dia_semana,hora');
}

/**
 * Añade un nuevo slot a la plantilla.
 * Si ya existe un slot con mismo día y hora, devuelve el existente (no duplica).
 */
export async function añadirSlotPlantilla(dia_semana, hora) {
  // Evitar duplicados
  const existentes = await supa(
    `slots?dia_semana=eq.${dia_semana}&hora=eq.${hora}`
  );
  if (existentes && existentes.length > 0) {
    return existentes[0];
  }
  const [creado] = await supa('slots', 'POST', {
    dia_semana,
    hora,
    activo: true,
  });
  return creado;
}

/**
 * Elimina un slot de la plantilla por id.
 */
export async function eliminarSlotPlantilla(id) {
  await supa(`slots?id=eq.${id}`, 'DELETE');
}

/**
 * Activa o desactiva un slot sin borrarlo.
 * Útil para "pausar" temporalmente una franja sin perder el dato.
 */
export async function toggleSlotActivo(id, activo) {
  await supa(`slots?id=eq.${id}`, 'PATCH', { activo });
}

/* ════════════════════════════════════════════
   ADMIN — BLOQUEOS
   ════════════════════════════════════════════ */

/**
 * Crea un bloqueo.
 * Si hora es null → bloquea el día entero.
 * Si hora tiene valor (HH:MM o HH:MM:SS) → bloquea solo esa hora concreta.
 */
export async function bloquearDia(fecha, motivo = '', hora = null) {
  const body = { fecha, motivo };
  if (hora) {
    // Normalizar a HH:MM:SS
    body.hora = hora.length === 5 ? `${hora}:00` : hora;
  }
  await supa('bloqueos', 'POST', body);
}

/**
 * Elimina un bloqueo por id (la forma más precisa — el admin panel lista bloqueos
 * con su id y usa este).
 */
export async function eliminarBloqueo(id) {
  await supa(`bloqueos?id=eq.${id}`, 'DELETE');
}

/**
 * Elimina todos los bloqueos de un día (sin especificar hora).
 * Se mantiene por compatibilidad con lógica antigua.
 */
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
    `citas?fecha=gte.${hoy}&estado=neq.cancelada&order=fecha,hora&select=*,clientes(nombre,telefono,zona,perros(nombre,raza,edad,problematica))`
  );
}

/**
 * Como obtenerCitasAdmin, pero además trae el texto reportado por el cliente
 * desde la tabla `conversaciones`. El panel admin lo muestra bajo cada cita.
 */
export async function obtenerCitasAdminConReportado() {
  const hoy = new Date().toISOString().split('T')[0];
  const citas = await supa(
    `citas?fecha=gte.${hoy}&estado=neq.cancelada&order=fecha,hora&select=*,clientes(nombre,telefono,zona,perros(nombre,raza,edad,problematica))`
  );

  if (!citas || citas.length === 0) return [];

  const ids = citas.map(c => c.id).join(',');
  const conversaciones = await supa(
    `conversaciones?cita_id=in.(${ids})&select=cita_id,turnos`
  );

  const reportadoPorCita = {};
  (conversaciones || []).forEach(conv => {
    const turnos = Array.isArray(conv.turnos) ? conv.turnos : [];
    const mensajesCliente = turnos
      .filter(t => t.rol === 'cliente')
      .slice(0, 4)
      .map(t => t.texto);
    const ordenadosPorLongitud = mensajesCliente
      .slice()
      .sort((a, b) => (b?.length || 0) - (a?.length || 0));
    reportadoPorCita[conv.cita_id] =
      ordenadosPorLongitud.slice(0, 2).join(' · ').slice(0, 400) || null;
  });

  return citas.map(cita => ({
    ...cita,
    reportado: reportadoPorCita[cita.id] || null,
  }));
}

export async function confirmarCita(citaId) {
  await supa(`citas?id=eq.${citaId}`, 'PATCH', { estado: 'confirmada' });
}

export async function cancelarCita(citaId) {
  await supa(`citas?id=eq.${citaId}`, 'PATCH', { estado: 'cancelada' });
}
