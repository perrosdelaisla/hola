/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Panel Admin
   admin.js — Lógica de las 4 pestañas
   ═══════════════════════════════════════════ */

import {
  obtenerPlantilla,
  añadirSlotPlantilla,
  eliminarSlotPlantilla,
  toggleSlotActivo,
  obtenerBloqueos,
  bloquearDia,
  eliminarBloqueo,
  obtenerCitasAdminConReportado,
  confirmarCita,
  cancelarCita,
  obtenerSesionesParaStats,
} from '../supabase.js';

/* ── CONFIG ── */

const PASSWORD = 'Perotti01';
const STORAGE_KEY = 'pdli_admin_logged';

/* ── DOM REFS ── */

const $ = (id) => document.getElementById(id);

/* ── LOGIN ── */

function checkLogin() {
  if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
    mostrarPanel();
  } else {
    mostrarLogin();
  }
}

function mostrarLogin() {
  $('login-screen').classList.remove('hidden');
  $('panel').classList.add('hidden');
  $('login-input').focus();
}

function mostrarPanel() {
  $('login-screen').classList.add('hidden');
  $('panel').classList.remove('hidden');
  cargarPestañaActiva();
}

function intentarLogin() {
  const pass = $('login-input').value;
  if (pass === PASSWORD) {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    $('login-error').textContent = '';
    $('login-input').value = '';
    mostrarPanel();
  } else {
    $('login-error').textContent = 'Contraseña incorrecta';
    $('login-input').value = '';
    $('login-input').focus();
  }
}

function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
  mostrarLogin();
}

/* ── TABS ── */

function configurarTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      $(`tab-${tabId}`).classList.add('active');
      cargarPestañaActiva();
    });
  });
}

function cargarPestañaActiva() {
  // Inicializar swipe la primera vez (idempotente: el guard _swipeIniciado evita doble init)
  if (!_swipeIniciado) {
    inicializarSwipe();
    hookClicksTabsParaSwipe();
  }
  const tabActiva = document.querySelector('.tab.active')?.dataset.tab || 'plantilla';
  if (tabActiva === 'plantilla')     cargarPlantilla();
  if (tabActiva === 'bloqueos')      cargarBloqueos();
  if (tabActiva === 'citas')         cargarCitas();
  if (tabActiva === 'estadisticas')  cargarEstadisticas();
}

/* ── PLANTILLA ── */

const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // Lun primero, Dom al final

async function cargarPlantilla() {
  const cont = $('plantilla-grid');
  cont.innerHTML = '<div class="loading">Cargando plantilla...</div>';

  try {
    const slots = await obtenerPlantilla();
    cont.innerHTML = '';

    ORDEN_DIAS.forEach(dia => {
      const diaDiv = document.createElement('div');
      diaDiv.className = 'plantilla-day';

      const nombreDia = document.createElement('div');
      nombreDia.className = 'plantilla-day-name';
      nombreDia.textContent = DIAS_NOMBRE[dia];
      diaDiv.appendChild(nombreDia);

      const slotsDiv = document.createElement('div');
      slotsDiv.className = 'plantilla-slots';

      const slotsDelDia = slots.filter(s => s.dia_semana === dia);

      if (slotsDelDia.length === 0) {
        const vacio = document.createElement('span');
        vacio.className = 'plantilla-empty';
        vacio.textContent = 'Sin horarios';
        slotsDiv.appendChild(vacio);
      } else {
        slotsDelDia.forEach(s => {
          const slotBtn = document.createElement('span');
          slotBtn.className = 'plantilla-slot' + (s.activo ? ' activo' : '');
          slotBtn.title = s.activo ? 'Activo — click para desactivar' : 'Inactivo — click para activar';

          const horaTxt = document.createElement('span');
          horaTxt.textContent = s.hora.substring(0, 5);
          slotBtn.appendChild(horaTxt);

          const del = document.createElement('span');
          del.className = 'del';
          del.textContent = '×';
          del.title = 'Eliminar este slot';
          del.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`¿Eliminar definitivamente ${DIAS_NOMBRE[dia]} ${s.hora.substring(0,5)}?`)) return;
            await eliminarSlotPlantilla(s.id);
            cargarPlantilla();
          });
          slotBtn.appendChild(del);

          slotBtn.addEventListener('click', async () => {
            await toggleSlotActivo(s.id, !s.activo);
            cargarPlantilla();
          });

          slotsDiv.appendChild(slotBtn);
        });
      }

      diaDiv.appendChild(slotsDiv);
      cont.appendChild(diaDiv);
    });
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<div class="empty-state">Error al cargar. Revisa la consola.</div>';
  }
}

/* ── MODAL AÑADIR HORA ── */

function configurarModalAddHora() {
  $('btn-add-hora').addEventListener('click', () => {
    $('modal-hora').value = '';
    $('modal-add-hora').classList.remove('hidden');
  });

  $('modal-cancel').addEventListener('click', () => {
    $('modal-add-hora').classList.add('hidden');
  });

  $('modal-save').addEventListener('click', async () => {
    const dia = parseInt($('modal-dia').value, 10);
    const hora = $('modal-hora').value;
    if (!hora) {
      alert('Indica una hora');
      return;
    }
    try {
      await añadirSlotPlantilla(dia, hora + ':00');
      $('modal-add-hora').classList.add('hidden');
      cargarPlantilla();
    } catch (err) {
      console.error(err);
      alert('Error al añadir el slot');
    }
  });
}

/* ── BLOQUEOS ── */

async function cargarBloqueos() {
  await llenarDropdownHoras();

  const lista = $('bloqueos-list');
  lista.innerHTML = '<li class="loading">Cargando bloqueos...</li>';

  try {
    const bloqueos = await obtenerBloqueos();
    lista.innerHTML = '';

    if (!bloqueos || bloqueos.length === 0) {
      lista.innerHTML = '<li class="empty-state">No hay bloqueos activos</li>';
      return;
    }

    bloqueos.forEach(b => {
      const li = document.createElement('li');
      li.className = 'bloqueo-item';

      const info = document.createElement('div');
      info.className = 'bloqueo-info';

      const fechaDiv = document.createElement('div');
      fechaDiv.className = 'bloqueo-fecha';
      fechaDiv.textContent = formatearFechaLarga(b.fecha) +
        (b.hora ? ` · ${b.hora.substring(0,5)}` : ' · todo el día');
      info.appendChild(fechaDiv);

      if (b.motivo) {
        const motivoDiv = document.createElement('div');
        motivoDiv.className = 'bloqueo-motivo';
        motivoDiv.textContent = b.motivo;
        info.appendChild(motivoDiv);
      }

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-small danger';
      btnDel.textContent = 'Eliminar';
      btnDel.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este bloqueo?')) return;
        await eliminarBloqueo(b.id);
        cargarBloqueos();
      });

      li.appendChild(info);
      li.appendChild(btnDel);
      lista.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    lista.innerHTML = '<li class="empty-state">Error al cargar. Revisa la consola.</li>';
  }
}

async function llenarDropdownHoras() {
  const sel = $('bloq-hora');
  while (sel.options.length > 1) sel.remove(1);

  try {
    const slots = await obtenerPlantilla();
    const horas = [...new Set(slots.map(s => s.hora.substring(0, 5)))].sort();
    horas.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error('Error al llenar dropdown horas:', err);
  }
}

function configurarFormBloqueo() {
  $('btn-bloquear').addEventListener('click', async () => {
    const fecha = $('bloq-fecha').value;
    const hora = $('bloq-hora').value || null;
    const motivo = $('bloq-motivo').value.trim();

    if (!fecha) {
      alert('Indica una fecha');
      return;
    }

    try {
      await bloquearDia(fecha, motivo, hora);
      $('bloq-fecha').value = '';
      $('bloq-hora').value = '';
      $('bloq-motivo').value = '';
      cargarBloqueos();
    } catch (err) {
      console.error(err);
      alert('Error al crear el bloqueo');
    }
  });
}

/* ── CITAS ── */

async function cargarCitas() {
  const lista = $('citas-list');
  lista.innerHTML = '<li class="loading">Cargando citas...</li>';

  try {
    const citas = await obtenerCitasAdminConReportado();
    lista.innerHTML = '';

    if (!citas || citas.length === 0) {
      lista.innerHTML = '<li class="empty-state">No hay citas próximas</li>';
      return;
    }

    citas.forEach(c => {
      const li = document.createElement('li');
      li.className = 'cita-item';

      const horaTxt = (c.hora || '').substring(0, 5);
      const estadoClase = (c.estado || 'pendiente').toLowerCase();

      const top = document.createElement('div');
      top.className = 'cita-top';

      const fechaSpan = document.createElement('div');
      fechaSpan.className = 'cita-fecha';
      fechaSpan.textContent = `${formatearFechaLarga(c.fecha)} · ${horaTxt}`;
      top.appendChild(fechaSpan);

      const estadoSpan = document.createElement('span');
      estadoSpan.className = `cita-estado ${estadoClase}`;
      estadoSpan.textContent = c.estado || 'pendiente';
      top.appendChild(estadoSpan);

      li.appendChild(top);

      const clienteDiv = document.createElement('div');
      clienteDiv.className = 'cita-cliente';
      clienteDiv.textContent = `${c.clientes?.nombre ?? '—'} · ${c.clientes?.telefono ?? '—'}`;
      li.appendChild(clienteDiv);

      const perrosArr = c.clientes?.perros ?? [];
      const perroTxt = (perrosArr.length > 0)
        ? `${perrosArr[0].nombre} (${perrosArr[0].raza || '—'})`
        : '—';
      const perroDiv = document.createElement('div');
      perroDiv.className = 'cita-perro';
      perroDiv.textContent = `🐕 ${perroTxt}`;
      li.appendChild(perroDiv);

      const zonaDiv = document.createElement('div');
      zonaDiv.className = 'cita-zona';
      zonaDiv.textContent = `📍 ${c.clientes?.zona ?? c.zona ?? '—'} · ${c.modalidad ?? '—'}`;
      li.appendChild(zonaDiv);

      if (c.protocolo || (c.cuadros_detectados && c.cuadros_detectados.length > 0)) {
        const protoDiv = document.createElement('div');
        protoDiv.className = 'cita-protocolo';
        protoDiv.textContent = c.protocolo ??
          (c.cuadros_detectados ? c.cuadros_detectados.join(' + ') : '—');
        li.appendChild(protoDiv);
      }

      if (c.reportado) {
        const repDiv = document.createElement('div');
        repDiv.className = 'cita-reportado';
        const label = document.createElement('span');
        label.className = 'cita-reportado-label';
        label.textContent = 'Reportado por el cliente';
        repDiv.appendChild(label);
        const repTxt = document.createElement('span');
        repTxt.textContent = `"${c.reportado}"`;
        repDiv.appendChild(repTxt);
        li.appendChild(repDiv);
      }

      const actions = document.createElement('div');
      actions.className = 'cita-actions';

      if (estadoClase === 'pendiente') {
        const btnConfirmar = document.createElement('button');
        btnConfirmar.className = 'btn-small';
        btnConfirmar.textContent = '✅ Confirmar';
        btnConfirmar.addEventListener('click', async () => {
          await confirmarCita(c.id);
          cargarCitas();
        });
        actions.appendChild(btnConfirmar);
      }

      if (estadoClase !== 'cancelada') {
        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn-small danger';
        btnCancelar.textContent = '❌ Cancelar';
        btnCancelar.addEventListener('click', async () => {
          if (!confirm('¿Cancelar esta cita?')) return;
          await cancelarCita(c.id);
          cargarCitas();
        });
        actions.appendChild(btnCancelar);
      }

      li.appendChild(actions);
      lista.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    lista.innerHTML = '<li class="empty-state">Error al cargar. Revisa la consola.</li>';
  }
}

/* ═══════════════════════════════════════════
   ESTADÍSTICAS
   ═══════════════════════════════════════════ */

// Instancias Chart.js — se destruyen antes de re-renderizar
let _chartTema      = null;
let _chartModalidad = null;
let _chartCanal     = null;

// Período activo: "mes" o "ano"
let _statsPeriodo = 'mes';

// Guard: los listeners de sub-pestañas solo se conectan una vez
let _statsIniciado = false;

/**
 * Punto de entrada — se llama al activar la pestaña Estadísticas.
 */
async function cargarEstadisticas() {
  // Conectar sub-pestañas solo la primera vez
  if (!_statsIniciado) {
    _statsIniciado = true;
    document.querySelectorAll('.stats-periodo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stats-periodo-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _statsPeriodo = btn.dataset.periodo;
        _cargarDatosStats();
      });
    });
  }

  await _cargarDatosStats();
}

/**
 * Calcula el rango de fechas y carga las sesiones de Supabase.
 */
async function _cargarDatosStats() {
  const ahora = new Date();
  let desde;

  if (_statsPeriodo === 'mes') {
    desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  } else {
    desde = new Date(ahora.getFullYear(), 0, 1).toISOString();
  }
  const hasta = ahora.toISOString();

  // Estado de carga en KPIs
  ['kpi-sesiones', 'kpi-precios', 'kpi-citas', 'kpi-tasa'].forEach(id => {
    const el = $(id);
    if (el) el.textContent = '…';
  });
  const embudo = $('stats-embudo');
  if (embudo) embudo.innerHTML = '<p class="stats-vacio">Cargando datos…</p>';

  try {
    const sesiones = await obtenerSesionesParaStats(desde, hasta);
    renderizarKPIs(sesiones);
    renderizarEmbudo(sesiones);
    renderizarDesgloseTema(sesiones);
    renderizarDesgloseModalidad(sesiones);
    renderizarDesgloseCanal(sesiones);
    renderizarMetricasFinales(sesiones);
  } catch (err) {
    console.error('Error al cargar estadísticas:', err);
    if (embudo) embudo.innerHTML = '<p class="stats-vacio">Error al cargar datos. Revisa la consola.</p>';
  }
}

/**
 * Renderiza los 4 KPIs superiores.
 */
function renderizarKPIs(sesiones) {
  const total   = sesiones.length;
  const precios = sesiones.filter(s => s.vio_precio).length;
  const citas   = sesiones.filter(s => s.cita_confirmada).length;
  const tasa    = total > 0 ? ((citas / total) * 100).toFixed(1) + '%' : '—';

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('kpi-sesiones', total   || '0');
  set('kpi-precios',  precios || '0');
  set('kpi-citas',    citas   || '0');
  set('kpi-tasa',     tasa);
}

/**
 * Renderiza el embudo de 7 pasos con barras horizontales.
 */
function renderizarEmbudo(sesiones) {
  const contenedor = $('stats-embudo');
  if (!contenedor) return;

  // Pasos s4 en adelante = el cliente llegó a describir el problema
  const PASOS_S4 = ['s4','s5','s6','s7','s8','s9','s10','s11','s12'];

  const pasos = [
    { label: 'Iniciaron conversación',  n: sesiones.length },
    { label: 'Dieron datos del perro',  n: sesiones.filter(s => PASOS_S4.includes(s.paso_maximo_alcanzado)).length },
    { label: 'Vieron mensaje clave',    n: sesiones.filter(s => s.vio_mensaje_principal).length },
    { label: 'Vieron precios',          n: sesiones.filter(s => s.vio_precio).length },
    { label: 'Abrieron agenda',         n: sesiones.filter(s => s.abrio_agenda).length },
    { label: 'Eligieron horario',       n: sesiones.filter(s => s.eligio_slot).length },
    { label: 'Confirmaron cita',        n: sesiones.filter(s => s.cita_confirmada).length },
  ];

  if (pasos[0].n === 0) {
    contenedor.innerHTML = '<p class="stats-vacio">Aún no hay datos en este período.</p>';
    return;
  }

  const base = pasos[0].n;

  // Retención respecto al paso anterior
  const retenciones = pasos.map((p, i) => {
    if (i === 0) return null;
    const prev = pasos[i - 1].n;
    return prev > 0 ? Math.round((p.n / prev) * 100) : 0;
  });

  // Detectar mayor caída relativa (menor retención, excluyendo paso 0)
  let minRet = 101;
  let idxCaida = -1;
  retenciones.forEach((r, i) => {
    if (r === null) return;
    if (r < minRet) { minRet = r; idxCaida = i; }
  });

  contenedor.innerHTML = '';

  pasos.forEach((paso, i) => {
    const pct   = base > 0 ? Math.round((paso.n / base) * 100) : 0;
    const ancho = base > 0 ? (paso.n / base) * 100 : 0;
    const esCaida = i === idxCaida && idxCaida !== -1 && pasos[0].n > 0;
    const retTxt = retenciones[i] !== null ? `↓ ${retenciones[i]}% del paso anterior` : '';

    const row = document.createElement('div');
    row.className = 'embudo-row' + (esCaida ? ' mayor-caida' : '');

    const labelEl = document.createElement('span');
    labelEl.className = 'embudo-label';
    labelEl.textContent = (esCaida ? '⚠ ' : '') + paso.label;
    row.appendChild(labelEl);

    const barraWrap = document.createElement('div');
    barraWrap.className = 'embudo-barra-wrap';
    const barra = document.createElement('div');
    barra.className = 'embudo-barra';
    barra.style.width = '0%';
    barraWrap.appendChild(barra);
    row.appendChild(barraWrap);

    const numEl = document.createElement('span');
    numEl.className = 'embudo-num';
    numEl.innerHTML = `${paso.n} <small style="color:var(--t3)">(${pct}%)</small>`;
    row.appendChild(numEl);

    const retEl = document.createElement('span');
    retEl.className = 'embudo-retencion';
    retEl.textContent = retTxt;
    row.appendChild(retEl);

    contenedor.appendChild(row);

    // Animar barra con pequeño delay para que se vea la transición CSS
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { barra.style.width = ancho + '%'; });
    });
  });
}

/**
 * Renderiza doughnut + tabla de desglose por tema/origen.
 */
function renderizarDesgloseTema(sesiones) {
  const TEMAS = [
    { key: 'basica',      label: 'Educación básica' },
    { key: 'reactividad', label: 'Reactividad'       },
    { key: 'cachorros',   label: 'Cachorros'         },
    { key: 'ansiedad',    label: 'Ansiedad/miedos'   },
    { key: null,          label: 'Sin tema'           },
  ];
  const COLORES = ['#c53030', '#9cb64b', '#d97706', '#78350f', '#555555'];

  const datos = TEMAS.map(t => {
    const grupo = sesiones.filter(s =>
      t.key === null ? !s.tema_preseleccionado : s.tema_preseleccionado === t.key
    );
    return { label: t.label, total: grupo.length, citas: grupo.filter(s => s.cita_confirmada).length };
  });

  _chartTema = _renderDoughnut('chart-tema', _chartTema, datos, COLORES);
  _renderTablaDesglose('tabla-tema', datos, COLORES);
}

/**
 * Renderiza doughnut + tabla de desglose por modalidad.
 */
function renderizarDesgloseModalidad(sesiones) {
  const MODALIDADES = [
    { key: 'presencial', label: 'Presencial'           },
    { key: 'online',     label: 'Online'                },
    { key: 'fuera',      label: 'Fuera de cobertura'   },
    { key: 'otro',       label: 'Derivar / sin definir' },
  ];
  const COLORES = ['#c53030', '#9cb64b', '#d97706', '#555555'];

  const datos = MODALIDADES.map((m, i) => {
    const grupo = i === 3
      ? sesiones.filter(s => !s.modalidad || s.modalidad === 'derivar' || s.modalidad === 'desconocida')
      : sesiones.filter(s => s.modalidad === m.key);
    return { label: m.label, total: grupo.length, citas: grupo.filter(s => s.cita_confirmada).length };
  });

  _chartModalidad = _renderDoughnut('chart-modalidad', _chartModalidad, datos, COLORES);
  _renderTablaDesglose('tabla-modalidad', datos, COLORES);
}

/**
 * Renderiza doughnut + tabla de desglose por canal de origen.
 */
function renderizarDesgloseCanal(sesiones) {
  const CANALES = [
    { key: 'whatsapp',  label: 'WhatsApp'      },
    { key: 'instagram', label: 'Instagram'      },
    { key: 'mail',      label: 'Mail'           },
    { key: 'paseos',    label: 'App de Paseos'  },
    { key: null,        label: 'Directo'        },
  ];
  const COLORES = ['#25D366', '#c53030', '#9cb64b', '#d97706', '#555555'];

  const datos = CANALES.map(c => {
    const grupo = sesiones.filter(s =>
      c.key === null ? !s.origen : s.origen === c.key
    );
    return { label: c.label, total: grupo.length, citas: grupo.filter(s => s.cita_confirmada).length };
  });

  _chartCanal = _renderDoughnut('chart-canal', _chartCanal, datos, COLORES);
  _renderTablaDesglose('tabla-canal', datos, COLORES);
}

/**
 * Helper: crea o re-crea un gráfico doughnut Chart.js.
 * Devuelve la nueva instancia.
 */
function _renderDoughnut(canvasId, instanciaPrevia, datos, colores) {
  if (instanciaPrevia) instanciaPrevia.destroy();

  const canvas = $(canvasId);
  if (!canvas) return null;

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels:   datos.map(d => d.label),
      datasets: [{
        data:            datos.map(d => d.total),
        backgroundColor: colores,
        borderColor:     'rgba(0,0,0,0)',
        borderWidth:     0,
        hoverOffset:     6,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.parsed} sesiones` },
        },
      },
      animation: { animateRotate: true, duration: 500 },
    },
  });
}

/**
 * Helper: renderiza la tabla de desglose (nombre · n · tasa conversión).
 */
function _renderTablaDesglose(contenedorId, datos, colores) {
  const cont = $(contenedorId);
  if (!cont) return;

  cont.innerHTML = '';

  const visibles = datos.filter(d => d.total > 0);
  if (visibles.length === 0) {
    cont.innerHTML = '<p class="stats-vacio" style="text-align:left;padding:0">Sin datos aún.</p>';
    return;
  }

  datos.forEach((d, i) => {
    if (d.total === 0) return;
    const tasa = ((d.citas / d.total) * 100).toFixed(1) + '%';

    const row = document.createElement('div');
    row.className = 'desglose-row';
    row.innerHTML = `
      <span class="desglose-dot" style="background:${colores[i]}"></span>
      <span class="desglose-nombre">${d.label}</span>
      <span class="desglose-num">${d.total}</span>
      <span class="desglose-tasa">${tasa} conv.</span>
    `;
    cont.appendChild(row);
  });
}

/**
 * Renderiza las 4 métricas pequeñas al final.
 */
function renderizarMetricasFinales(sesiones) {
  const cont = $('stats-mini');
  if (!cont) return;

  const total   = sesiones.length;
  const etologo = sesiones.filter(s => s.derivado_etologo).length;
  const zona    = sesiones.filter(s => s.derivado_zona).length;
  const movil   = sesiones.filter(s => s.dispositivo === 'movil').length;
  const pctMov  = total > 0 ? Math.round((movil / total) * 100) : 0;
  const pctDesk = total > 0 ? 100 - pctMov : 0;

  cont.innerHTML = `
    <div class="stats-mini-item">
      <span class="stats-mini-val">${etologo}</span>
      <span class="stats-mini-etiqueta">Deriv. etólogo</span>
    </div>
    <div class="stats-mini-item">
      <span class="stats-mini-val">${zona}</span>
      <span class="stats-mini-etiqueta">Deriv. por zona</span>
    </div>
    <div class="stats-mini-item">
      <span class="stats-mini-val">${pctMov}%</span>
      <span class="stats-mini-etiqueta">Móvil</span>
    </div>
    <div class="stats-mini-item">
      <span class="stats-mini-val">${pctDesk}%</span>
      <span class="stats-mini-etiqueta">Desktop</span>
    </div>
  `;
}

/* ── UTILS ── */

function formatearFechaLarga(fechaStr) {
  const f = new Date(fechaStr + 'T00:00:00');
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[f.getDay()]} ${f.getDate()} ${meses[f.getMonth()]}`;
}

/* ── INIT ── */

function init() {
  $('login-btn').addEventListener('click', intentarLogin);
  $('login-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') intentarLogin();
  });
  $('logout-btn').addEventListener('click', logout);

  configurarTabs();
  configurarModalAddHora();
  configurarFormBloqueo();

  checkLogin();
}

document.addEventListener('DOMContentLoaded', init);

/* ═══════════════════════════════════════════
   SWIPE ENTRE PESTAÑAS (solo móvil/tablet)
   ═══════════════════════════════════════════ */

const TABS_ORDER = ['plantilla', 'bloqueos', 'citas', 'estadisticas'];

let _swipeIniciado = false;
let _trackEl = null;

function inicializarSwipe() {
  if (_swipeIniciado) return;

  const esTactil = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!esTactil) return;
  if (window.innerWidth > 768) return;

  const tabContent = document.querySelector('.tab-content');
  if (!tabContent) return;

  const panels = Array.from(tabContent.querySelectorAll('.tab-panel'));
  if (panels.length === 0) return;

  const track = document.createElement('div');
  track.className = 'tab-content-track';
  panels.forEach(p => track.appendChild(p));
  tabContent.appendChild(track);
  _trackEl = track;

  const tabActiva = document.querySelector('.tab.active')?.dataset.tab || 'plantilla';
  const idxActivo = TABS_ORDER.indexOf(tabActiva);
  posicionarTrack(idxActivo, false);
  marcarPanelActivo(idxActivo);

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let dragging = false;
  let bloquearSwipe = false;
  const ANCHO_PANTALLA = window.innerWidth;
  const UMBRAL_CAMBIO = ANCHO_PANTALLA * 0.25;

  track.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = 0;
    dragging = false;
    bloquearSwipe = false;
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    if (bloquearSwipe) return;

    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!dragging) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        bloquearSwipe = true;
        return;
      }
      dragging = true;
      track.classList.add('dragging');
    }

    currentX = dx;

    const tabActual = document.querySelector('.tab.active')?.dataset.tab || 'plantilla';
    const idxActual = TABS_ORDER.indexOf(tabActual);
    let dxAplicado = dx;

    if (idxActual === 0 && dx > 0) {
      dxAplicado = dx * 0.3;
    } else if (idxActual === TABS_ORDER.length - 1 && dx < 0) {
      dxAplicado = dx * 0.3;
    }

    const offsetBase = -idxActual * 25;
    const offsetDrag = (dxAplicado / ANCHO_PANTALLA) * 25;
    track.style.transform = `translateX(${offsetBase + offsetDrag}%)`;
  }, { passive: true });

  track.addEventListener('touchend', () => {
    if (!dragging) {
      bloquearSwipe = false;
      return;
    }
    dragging = false;
    track.classList.remove('dragging');

    const tabActual = document.querySelector('.tab.active')?.dataset.tab || 'plantilla';
    let idxActual = TABS_ORDER.indexOf(tabActual);
    let idxNuevo = idxActual;

    if (currentX < -UMBRAL_CAMBIO && idxActual < TABS_ORDER.length - 1) {
      idxNuevo = idxActual + 1;
    } else if (currentX > UMBRAL_CAMBIO && idxActual > 0) {
      idxNuevo = idxActual - 1;
    }

    if (idxNuevo !== idxActual) {
      cambiarPestana(idxNuevo);
    } else {
      posicionarTrack(idxActual, true);
    }
  }, { passive: true });

  _swipeIniciado = true;
}

function posicionarTrack(idx, animar) {
  if (!_trackEl) return;
  const offset = -idx * 25;
  _trackEl.style.transition = animar ? '' : 'none';
  _trackEl.style.transform = `translateX(${offset}%)`;
  if (!animar) {
    _trackEl.offsetHeight;
    _trackEl.style.transition = '';
  }
}

function marcarPanelActivo(idx) {
  document.querySelectorAll('.tab-panel').forEach((p, i) => {
    p.classList.toggle('swipe-active', i === idx);
  });
}

function cambiarPestana(idxNuevo) {
  const tabId = TABS_ORDER[idxNuevo];

  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add('active');

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tabId}`)?.classList.add('active');

  posicionarTrack(idxNuevo, true);
  marcarPanelActivo(idxNuevo);

  cargarPestañaActiva();
}

function hookClicksTabsParaSwipe() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_swipeIniciado || !_trackEl) return;
      const tabId = btn.dataset.tab;
      const idx = TABS_ORDER.indexOf(tabId);
      if (idx >= 0) {
        posicionarTrack(idx, true);
        marcarPanelActivo(idx);
      }
    });
  });
}

/* ── PWA: registrar service worker ── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW registrado'))
      .catch(err => console.warn('SW error:', err));
  });
}
