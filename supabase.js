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

export async function obtenerSlotsDisponibles() {
  const hoy = new Date();
  const desde = new Date(hoy);
  const hasta = new Date(hoy);
  hasta.setDate(hoy.getDate() + 25);

  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = hasta.toISOString().split('T')[0];

  // Llamada a la RPC: la antelación de 3 días la aplica la propia RPC
  const slots = await supa(
    `rpc/get_available_slots`,
    'POST',
    {
      p_desde: desdeStr,
      p_hasta: hastaStr,
      p_min_dias_antelacion: 3
    }
  );

  // La RPC devuelve: { fecha, hora, dia_semana }
  // Transformamos al formato que espera agenda.js: { fecha, hora, dia_semana, label }
  return (slots || []).map(s => {
    const fechaObj = new Date(s.fecha + 'T00:00:00');
    return {
      fecha: s.fecha,
      hora: typeof s.hora === 'string' ? s.hora.substring(0, 5) : s.hora,
      dia_semana: s.dia_semana,
      label: formatearFecha(fechaObj),
    };
  });
}

function formatearFecha(fecha) {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[fecha.getDay()]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
}

/* ════════════════════════════════════════════
   ADMIN — PLANTILLA DE SLOTS
   ════════════════════════════════════════════ */

export async function obtenerPlantilla() {
  return supa('slots?order=dia_semana,hora');
}

export async function añadirSlotPlantilla(dia_semana, hora) {
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

export async function eliminarSlotPlantilla(id) {
  await supa(`slots?id=eq.${id}`, 'DELETE');
}

export async function toggleSlotActivo(id, activo) {
  await supa(`slots?id=eq.${id}`, 'PATCH', { activo });
}

/* ════════════════════════════════════════════
   ADMIN — BLOQUEOS
   ════════════════════════════════════════════ */

export async function bloquearDia(fecha, motivo = '', hora = null) {
  const body = { fecha, motivo };
  if (hora) {
    body.hora = hora.length === 5 ? `${hora}:00` : hora;
  }
  await supa('bloqueos', 'POST', body);
}

export async function eliminarBloqueo(id) {
  await supa(`bloqueos?id=eq.${id}`, 'DELETE');
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
    `citas?fecha=gte.${hoy}&order=fecha,hora&select=*,clientes(nombre,telefono,zona,perros(nombre,raza,edad,problematica))`
  );
}

export async function obtenerCitasAdminConReportado() {
  const hoy = new Date().toISOString().split('T')[0];
  const citas = await supa(
    `citas?fecha=gte.${hoy}&order=fecha,hora&select=*,clientes(nombre,telefono,zona,perros(nombre,raza,edad,problematica))`
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

/**
 * Cambia el estado de una cita a 'realizada'. Se usa cuando Charly
 * marca desde el admin que ya dio la clase. No borra la fila — solo
 * cambia el estado para distinguirla visualmente en el panel y en el
 * feed iCalendar (✅ vs 🟡).
 */
export async function marcarCitaRealizada(citaId) {
  await supa(`citas?id=eq.${citaId}`, 'PATCH', { estado: 'realizada' });
}

/**
 * Borra una cita por completo (DELETE). Usado en el admin cuando
 * Charly quiere quitar del calendario una cita ya realizada o
 * cancelada que no necesita seguir viendo.
 */
export async function eliminarCita(citaId) {
  await supa(`citas?id=eq.${citaId}`, 'DELETE');
}

/**
 * Crea cliente + perro + cita + bloqueo en una sola operación
 * coordinada. Pensado para el botón "+ Cita manual" del admin
 * (caso Vicky cerrando clases por fuera del flujo de Victoria).
 *
 * Recibe:
 *   datos = {
 *     cliente: { nombre, telefono },
 *     perro:   { nombre, raza, edad_meses, peso_kg, es_ppp, problematica },
 *     cita:    { fecha, hora, modalidad, zona, notas }
 *   }
 *
 * Devuelve { ok: true, clienteId, perroId, citaId } o
 *          { ok: false, error: string }.
 *
 * Si falla en cliente/perro/cita intenta rollback de lo creado hasta
 * ese punto. Si falla solo el bloqueo, la cita queda igual (no se
 * rollbackea — el bloqueo se puede recrear a mano si hace falta).
 */
export async function crearCitaManual(datos) {
  const { cliente, perro, cita } = datos || {};
  if (!cliente?.nombre || !cliente?.telefono) {
    return { ok: false, error: 'Faltan datos de cliente' };
  }
  if (!perro?.nombre) {
    return { ok: false, error: 'Falta nombre del perro' };
  }
  if (!cita?.fecha || !cita?.hora) {
    return { ok: false, error: 'Falta fecha u hora' };
  }

  const horaCompleta = cita.hora.length === 5 ? `${cita.hora}:00` : cita.hora;

  let clienteId = null;
  let perroId = null;
  let citaId = null;

  try {
    // 1) Cliente
    const clienteBody = {
      nombre:   cliente.nombre,
      telefono: cliente.telefono,
      estado:   'consulta',
    };
    if (cita.zona) clienteBody.zona = cita.zona;
    const clienteResp = await supa('clientes', 'POST', clienteBody);
    clienteId = clienteResp?.[0]?.id;
    if (!clienteId) throw new Error('No se pudo crear el cliente');

    // 2) Perro
    const perroBody = { cliente_id: clienteId, nombre: perro.nombre };
    if (perro.raza)                 perroBody.raza = perro.raza;
    if (perro.edad_meses != null)   perroBody.edad_meses = perro.edad_meses;
    if (perro.peso_kg != null)      perroBody.peso_kg = perro.peso_kg;
    if (perro.es_ppp)               perroBody.es_ppp = true;
    if (perro.problematica)         perroBody.problematica = perro.problematica;
    const perroResp = await supa('perros', 'POST', perroBody);
    perroId = perroResp?.[0]?.id;
    if (!perroId) throw new Error('No se pudo crear el perro');

    // 3) Cita
    const citaBody = {
      cliente_id: clienteId,
      fecha:      cita.fecha,
      hora:       horaCompleta,
      estado:     'confirmada',
      confirmada: true,
    };
    if (cita.modalidad) citaBody.modalidad = cita.modalidad;
    if (cita.zona)      citaBody.zona = cita.zona;
    if (cita.notas)     citaBody.notas = cita.notas;
    const citaResp = await supa('citas', 'POST', citaBody);
    citaId = citaResp?.[0]?.id;
    if (!citaId) throw new Error('No se pudo crear la cita');

    // 4) Bloqueo — formato "Auto: cita {uuid}" para que el admin lo
    // resuelva a "Auto: cita de {nombre}" automáticamente.
    try {
      await supa('bloqueos', 'POST', {
        fecha:  cita.fecha,
        hora:   horaCompleta,
        motivo: `Auto: cita ${citaId}`,
      });
    } catch (bloqErr) {
      console.warn('Cita creada pero falló crear bloqueo:', bloqErr);
    }

    return { ok: true, clienteId, perroId, citaId };
  } catch (err) {
    console.error('Error en crearCitaManual:', err);
    // Rollback en orden inverso de lo que sí se creó
    try { if (citaId)    await supa(`citas?id=eq.${citaId}`,       'DELETE'); }
    catch (e) { console.warn('rollback cita falló:', e); }
    try { if (perroId)   await supa(`perros?id=eq.${perroId}`,     'DELETE'); }
    catch (e) { console.warn('rollback perro falló:', e); }
    try { if (clienteId) await supa(`clientes?id=eq.${clienteId}`, 'DELETE'); }
    catch (e) { console.warn('rollback cliente falló:', e); }
    return { ok: false, error: err.message };
  }
}

/**
 * Dado un array de UUIDs de citas, devuelve un mapa
 * { [uuid]: nombreCliente } para que el admin pueda mostrar
 * nombres en lugar de UUIDs.
 */
export async function obtenerNombresCitasPorIds(citaIds) {
  if (!citaIds || citaIds.length === 0) return {};
  const ids = citaIds.join(',');
  const citas = await supa(
    `citas?id=in.(${ids})&select=id,clientes(nombre)`
  );
  const mapa = {};
  (citas || []).forEach(c => {
    if (c.clientes?.nombre) {
      mapa[c.id] = c.clientes.nombre;
    }
  });
  return mapa;
}

/* ════════════════════════════════════════════
   ADMIN — ESTADÍSTICAS
   ════════════════════════════════════════════ */

export async function obtenerSesionesParaStats(desde, hasta) {
  try {
    return await supa(
      `sesiones?inicio=gte.${desde}&inicio=lte.${hasta}&es_prueba=eq.false&order=inicio.desc`
    );
  } catch (err) {
    console.error('Error al obtener sesiones para stats:', err);
    return [];
  }
}
