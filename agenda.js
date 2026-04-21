/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   agenda.js — Slots y selección de cita
   ═══════════════════════════════════════════ */

import { obtenerSlotsDisponibles } from './supabase.js';

/* ── ESTADO SELECCIÓN ── */
let slotSeleccionado = null;

/**
 * Renderiza el selector de slots disponibles
 * dentro del widget del chat
 * @param {Function} onSeleccion - callback(slot) cuando elige
 * @param {Function} onVolver - callback para botón atrás
 * @returns {HTMLElement} el widget
 */
export async function renderAgenda(onSeleccion, onVolver) {
  slotSeleccionado = null;

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="ail"><div class="ais"></div><span>Comprobando disponibilidad...</span></div>`;

  let slots;
  try {
    slots = await obtenerSlotsDisponibles();
  } catch (e) {
    wrap.innerHTML = `
      <div class="warn">
        No pude cargar los horarios en este momento.<br>
        Escríbenos al <a href="https://wa.me/34653591301">653 591 301</a> y te buscamos hueco.
      </div>`;
    return wrap;
  }

  if (slots.length === 0) {
    wrap.innerHTML = `
      <div class="warn">
        No hay huecos disponibles en los próximos días.<br>
        Escríbenos al <a href="https://wa.me/34653591301">653 591 301</a> y te buscamos hueco.
      </div>`;
    return wrap;
  }

  // Agrupar por fecha
  const porFecha = {};
  slots.forEach(s => {
    if (!porFecha[s.fecha]) porFecha[s.fecha] = { label: s.label, horas: [] };
    porFecha[s.fecha].horas.push(s.hora);
  });

  // Construir HTML
  let html = '';
  Object.entries(porFecha).forEach(([fecha, { label, horas }]) => {
    html += `<div class="agenda-dia">`;
    html += `<div class="agenda-dia-label">${label}</div>`;
    html += `<div class="sgrid">`;
    horas.forEach(hora => {
      html += `
        <button class="slot" data-fecha="${fecha}" data-hora="${hora}" onclick="seleccionarSlot(this)">
          <div class="sday">${label}</div>
          <div class="stime">${hora}h</div>
        </button>`;
    });
    html += `</div></div>`;
  });

  html += `<div id="agenda-confirmar" style="display:none;margin-top:8px">
    <button class="bmain verde" onclick="confirmarSlot()">Confirmar este horario →</button>
    <button class="bsec" onclick="agendaVolver()">← Elegir otro horario</button>
  </div>`;

  wrap.innerHTML = html;

  // Callbacks globales temporales
  window.seleccionarSlot = (el) => {
    document.querySelectorAll('.slot').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
    slotSeleccionado = {
      fecha: el.dataset.fecha,
      hora: el.dataset.hora,
      label: el.querySelector('.sday').textContent,
    };
    document.getElementById('agenda-confirmar').style.display = 'block';
  };

  window.confirmarSlot = () => {
    if (slotSeleccionado) onSeleccion(slotSeleccionado);
  };

  window.agendaVolver = () => {
    slotSeleccionado = null;
    if (onVolver) onVolver();
  };

  return wrap;
}

/**
 * Formatea slot para mostrar en resumen
 */
export function formatearSlot(slot) {
  return `${slot.label} · ${slot.hora}h`;
}
