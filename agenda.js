/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   agenda.js — Slots y selección de cita
   ═══════════════════════════════════════════ */

import { obtenerSlotsDisponibles } from './supabase.js';

/* ── ESTADO SELECCIÓN ── */
let slotSeleccionado = null;

/**
 * Renderiza el selector de slots dentro del contenedor dado.
 * Mismo contrato que pagos.js — escribe en contenedor.innerHTML,
 * no devuelve nada, no usa globals de window.
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
    slots = await obtenerSlotsDisponibles();
  } catch (e) {
    contenedor.innerHTML = `
      <div class="warn">
        No pude cargar los horarios en este momento.<br>
        Escríbenos al <a href="https://wa.me/34653591301">653 591 301</a> y te buscamos hueco.
      </div>`;
    return;
  }

  // Fix C — Filtrar slots: primer día visible a +5 días del actual
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaMinima = new Date(hoy);
  fechaMinima.setDate(fechaMinima.getDate() + 5);

  slots = slots.filter((s) => {
    // s.fecha tiene formato "YYYY-MM-DD"
    const fechaSlot = new Date(s.fecha + "T00:00:00");
    return fechaSlot >= fechaMinima;
  });

  if (!slots || slots.length === 0) {
    contenedor.innerHTML = `
      <div class="warn">
        No hay huecos disponibles en los próximos días.<br>
        Escríbenos al <a href="https://wa.me/34653591301">653 591 301</a> y te buscamos hueco.
      </div>`;
    return;
  }

  // Agrupar por fecha
  const porFecha = {};
  slots.forEach(s => {
    if (!porFecha[s.fecha]) porFecha[s.fecha] = { label: s.label, horas: [] };
    porFecha[s.fecha].horas.push(s.hora);
  });

  // Construir HTML — sin onclick inline, usaremos addEventListener
  let html = '';
  Object.entries(porFecha).forEach(([fecha, { label, horas }]) => {
    html += `<div class="agenda-dia">`;
    html += `<div class="agenda-dia-label">${label}</div>`;
    html += `<div class="sgrid">`;
    horas.forEach(hora => {
      html += `
        <button class="slot" data-fecha="${fecha}" data-hora="${hora}">
          <div class="sday">${label}</div>
          <div class="stime">${hora}h</div>
        </button>`;
    });
    html += `</div></div>`;
  });

  html += `
    <div id="agenda-confirmar" style="display:none;margin-top:8px">
      <button class="bmain verde" id="btn-confirmar-slot">Confirmar este horario →</button>
      <button class="bsec" id="btn-volver-slot">← Elegir otro horario</button>
    </div>`;

  contenedor.innerHTML = html;

  // Fix D — Eventos con scroll automático al panel de confirmación
  contenedor.querySelectorAll('.slot').forEach(btn => {
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
