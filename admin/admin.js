/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Panel Admin
   admin.js — Lógica de las 3 pestañas
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
  const tabActiva = document.querySelector('.tab.active')?.dataset.tab || 'plantilla';
  if (tabActiva === 'plantilla') cargarPlantilla();
  if (tabActiva === 'bloqueos')  cargarBloqueos();
  if (tabActiva === 'citas')     cargarCitas();
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

      // Los perros vienen anidados dentro de clientes (perro pertenece a cliente, no a cita)
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

/* ── PWA: registrar service worker ── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW registrado'))
      .catch(err => console.warn('SW error:', err));
  });
}
