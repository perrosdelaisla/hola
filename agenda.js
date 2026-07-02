/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   agenda.js — Slots y selección de cita
   ═══════════════════════════════════════════ */

import { obtenerSlotsDisponibles, obtenerSlotsConEstado } from './supabase.js?v=75';

/* ── ESTADO SELECCIÓN ── */
let slotSeleccionado = null;

/**
 * Renderiza el selector de slots dentro del contenedor dado.
 * Escribe en contenedor.innerHTML, no devuelve nada, no usa
 * globals de window.
 *
 * @param {HTMLElement} contenedor — div en el que renderizar
 * @param {Function} onSeleccion  — callback({ fecha, hora, label }) al confirmar
 * @param {Function} onVolver     — callback al pulsar "elegir otro horario"
 */
export async function renderAgenda(contenedor, onSeleccion, onVolver) {
  slotSeleccionado = null;

  // Loader inmediato dentro del contenedor
  contenedor.innerHTML = `
    <div class="ail">
      <div class="ais"></div>
      <span>Comprobando disponibilidad...</span>
    </div>`;

  let slots;
  try {
    slots = await obtenerSlotsConEstado();
  } catch (e) {
    contenedor.innerHTML = `
      <div class="warn">
        No pude cargar los horarios en este momento.<br>
        Escríbenos al <a href="https://wa.me/34622922173">622 922 173</a> y te buscamos hueco.
      </div>`;
    return;
  }

  if (!slots || slots.length === 0) {
    contenedor.innerHTML = `
      <div class="warn">
        No hay huecos disponibles en los próximos días.<br>
        Escríbenos al <a href="https://wa.me/34622922173">622 922 173</a> y te buscamos hueco.
      </div>`;
    return;
  }

  // Agrupar por fecha (ahora cada hora trae también su flag ocupado)
  const porFecha = {};
  slots.forEach(s => {
    if (!porFecha[s.fecha]) porFecha[s.fecha] = { label: s.label, horas: [] };
    porFecha[s.fecha].horas.push({ hora: s.hora, ocupado: s.ocupado });
  });

  // Construir HTML — sin onclick inline, usaremos addEventListener
  // El primer slot disponible (no ocupado) recibe la clase
  // 'slot-primero' que añade un badge visual "Próximo" para reducir
  // parálisis de elección (patrón Calendly). Los ocupados se
  // renderizan con la clase 'lleno' (atenuados, no clickeables).
  let html = '';
  let primerSlotMarcado = false;
  Object.entries(porFecha).forEach(([fecha, { label, horas }]) => {
    html += `<div class="agenda-dia">`;
    html += `<div class="agenda-dia-label">${label}</div>`;
    html += `<div class="sgrid">`;
    horas.forEach(({ hora, ocupado }) => {
      let claseExtra = '';
      if (ocupado) {
        claseExtra = ' lleno';
      } else if (!primerSlotMarcado) {
        claseExtra = ' slot-primero';
        primerSlotMarcado = true;
      }
      html += `
        <button class="slot${claseExtra}" data-fecha="${fecha}" data-hora="${hora}" ${ocupado ? 'disabled' : ''}>
          <div class="sday">${label}</div>
          <div class="stime">${hora}h</div>
        </button>`;
    });
    html += `</div></div>`;
  });

  html += `
    <div id="agenda-confirmar" style="display:none;margin-top:8px">
      <button class="bmain verde" id="btn-confirmar-slot">Reservar este horario</button>
      <button class="bsec" id="btn-volver-slot">← Elegir otro horario</button>
    </div>`;

  contenedor.innerHTML = html;

  // Fix D — Eventos con scroll automático al panel de confirmación
  contenedor.querySelectorAll('.slot:not(.lleno)').forEach(btn => {
    btn.addEventListener('click', () => {
      contenedor.querySelectorAll('.slot').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      slotSeleccionado = {
        fecha: btn.dataset.fecha,
        hora:  btn.dataset.hora,
        // label completo: "Lun 28 abr · 10:00h" — usado en mensaje de confirmación
        label: btn.querySelector('.sday').textContent + ' · ' + btn.dataset.hora + 'h',
      };
      const panelConfirmar = contenedor.querySelector('#agenda-confirmar');
      panelConfirmar.style.display = 'block';
      // Scroll suave al panel de confirmación para que el cliente vea los botones
      setTimeout(() => {
        panelConfirmar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });

  contenedor.querySelector('#btn-confirmar-slot').addEventListener('click', () => {
    if (slotSeleccionado) onSeleccion(slotSeleccionado);
  });

  contenedor.querySelector('#btn-volver-slot').addEventListener('click', () => {
    // Deseleccionar slot actual y ocultar panel de confirmación
    // NO llamar a onVolver — el cliente sigue en la agenda eligiendo otro slot
    contenedor.querySelectorAll('.slot').forEach(b => b.classList.remove('on'));
    contenedor.querySelector('#agenda-confirmar').style.display = 'none';
    slotSeleccionado = null;
  });
}

/**
 * Formatea slot para mostrar en resumen
 */
export function formatearSlot(slot) {
  return `${slot.label} · ${slot.hora}h`;
}
