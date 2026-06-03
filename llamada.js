/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Embudo Victoria
   llamada.js — Mini-widget de reserva de llamada
   ═══════════════════════════════════════════ */

import { obtenerSlotsLlamadasDisponibles } from './supabase.js?v=69';

/* ── ESTADO ── */
let slotSeleccionado = null;
let slotsCache = null;

/**
 * Renderiza el widget de reserva de llamada en 2 pantallas:
 *   1) grid de slots (espejo de renderAgenda) con botón "Continuar"
 *   2) form de datos (nombre + móvil + mensaje opcional) + "Confirmar"
 *
 * Al confirmar, dispara onConfirmacion con un objeto completo. NO
 * persiste nada en DB — eso es responsabilidad del caller (victoria.js
 * orquesta en _finalizarReservaLlamada).
 *
 * @param {HTMLElement} contenedor   — div donde renderizar
 * @param {Function}    onConfirmacion — callback({ fecha, hora, nombre, telefono, mensaje_adicional })
 * @param {Function}    onVolver       — callback al pulsar Volver desde la grid (vestigial,
 *                                       espejo del contrato de agenda.js; no se invoca hoy)
 */
export async function renderLlamada(contenedor, onConfirmacion, onVolver) {
  slotSeleccionado = null;
  slotsCache = null;

  // Estado: cargando
  contenedor.innerHTML = `
    <div class="ail">
      <div class="ais"></div>
      <span>Comprobando disponibilidad...</span>
    </div>`;

  // Fetch slots
  try {
    slotsCache = await obtenerSlotsLlamadasDisponibles();
  } catch (e) {
    contenedor.innerHTML = `
      <div class="warn">
        No pude cargar los horarios de llamada en este momento.<br>
        Escríbenos al <a href="https://wa.me/34622922173">622 922 173</a> y te buscamos hueco.
      </div>`;
    return;
  }

  if (!slotsCache || slotsCache.length === 0) {
    contenedor.innerHTML = `
      <div class="warn">
        No hay huecos de llamada disponibles en los próximos días.<br>
        Escríbenos al <a href="https://wa.me/34622922173">622 922 173</a> y te buscamos hueco.
      </div>`;
    return;
  }

  _renderGrid(contenedor, onConfirmacion, onVolver);
}

/**
 * Pantalla 1: grid de slots con panel "Continuar / Volver".
 * Calca el patrón de renderAgenda — mismas clases CSS (agenda-dia,
 * sgrid, slot, sday, stime, bmain.verde, bsec).
 *
 * Si el cliente vuelve desde el form (Volver), preservamos el slot
 * previamente elegido pintándolo "on" y mostrando el panel de continuar.
 */
function _renderGrid(contenedor, onConfirmacion, onVolver) {
  // Agrupar por fecha
  const porFecha = {};
  slotsCache.forEach(s => {
    if (!porFecha[s.fecha]) porFecha[s.fecha] = { label: s.label, horas: [] };
    porFecha[s.fecha].horas.push(s.hora);
  });

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
    <div id="llamada-confirmar" style="display:none;margin-top:8px">
      <button class="bmain verde" id="btn-continuar-slot">Continuar con estos datos →</button>
      <button class="bsec" id="btn-volver-slot">← Elegir otro horario</button>
    </div>`;

  contenedor.innerHTML = html;

  // Si veníamos del form ("Volver"), re-seleccionamos el slot previo
  if (slotSeleccionado) {
    const btn = contenedor.querySelector(
      `.slot[data-fecha="${slotSeleccionado.fecha}"][data-hora="${slotSeleccionado.hora}"]`
    );
    if (btn) {
      btn.classList.add('on');
      contenedor.querySelector('#llamada-confirmar').style.display = 'block';
    }
  }

  contenedor.querySelectorAll('.slot').forEach(btn => {
    btn.addEventListener('click', () => {
      contenedor.querySelectorAll('.slot').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      slotSeleccionado = {
        fecha: btn.dataset.fecha,
        hora:  btn.dataset.hora,
        label: btn.querySelector('.sday').textContent + ' · ' + btn.dataset.hora + 'h',
      };
      const panel = contenedor.querySelector('#llamada-confirmar');
      panel.style.display = 'block';
      setTimeout(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });

  contenedor.querySelector('#btn-continuar-slot').addEventListener('click', () => {
    if (slotSeleccionado) _renderForm(contenedor, onConfirmacion, onVolver);
  });

  contenedor.querySelector('#btn-volver-slot').addEventListener('click', () => {
    // Misma semántica que agenda.js: deselecciona + oculta panel.
    // No invoca onVolver — el cliente sigue dentro del widget.
    contenedor.querySelectorAll('.slot').forEach(b => b.classList.remove('on'));
    contenedor.querySelector('#llamada-confirmar').style.display = 'none';
    slotSeleccionado = null;
  });
}

/**
 * Pantalla 2: form con nombre, móvil y mensaje opcional.
 * Botones: "Confirmar reserva" (bmain verde) → onConfirmacion;
 *          "← Volver" (bsec) → vuelve a la grid preservando el slot.
 *
 * Validación inline previa al callback. Si el orquestador tarda,
 * el botón se queda "Reservando…" y deshabilitado para evitar doble-tap.
 */
function _renderForm(contenedor, onConfirmacion, onVolver) {
  contenedor.innerHTML = `
    <style>
      #victoria-llamada-slot .llamada-form-input {
        width:100%;
        background:transparent;
        color:#F5EFE0;
        border:none;
        border-bottom:1px solid rgba(245,239,224,0.3);
        border-radius:0;
        padding:8px 0;
        font-family:inherit;
        font-size:14px;
        box-sizing:border-box;
        outline:none;
      }
      #victoria-llamada-slot .llamada-form-input:focus {
        border-bottom-color:#C8102E;
      }
      #victoria-llamada-slot .llamada-form-input::placeholder {
        color:rgba(245,239,224,0.35);
      }
    </style>
    <div class="llamada-form">
      <div style="margin-bottom:14px;font-size:13px;color:rgba(245,239,224,0.7);letter-spacing:0.3px">
        Horario elegido: <strong style="color:#F5EFE0">${slotSeleccionado.label}</strong>
      </div>

      <label style="display:block;margin-bottom:14px">
        <span style="display:block;margin-bottom:4px;color:rgba(245,239,224,0.7);font-size:13px;font-weight:500;letter-spacing:0.3px">Nombre completo *</span>
        <input class="llamada-form-input" type="text" id="llamada-nombre" maxlength="120" autocomplete="name" required>
      </label>

      <label style="display:block;margin-bottom:14px">
        <span style="display:block;margin-bottom:4px;color:rgba(245,239,224,0.7);font-size:13px;font-weight:500;letter-spacing:0.3px">Móvil *</span>
        <input class="llamada-form-input" type="tel" id="llamada-telefono" maxlength="40" inputmode="tel" autocomplete="tel" required placeholder="+34 612 345 678">
      </label>

      <label style="display:block;margin-bottom:14px">
        <span style="display:block;margin-bottom:4px;color:rgba(245,239,224,0.7);font-size:13px;font-weight:500;letter-spacing:0.3px">¿Algo más que quieras que sepamos antes de la llamada?</span>
        <textarea class="llamada-form-input" id="llamada-mensaje" maxlength="200" rows="3" style="resize:vertical"></textarea>
        <small style="color:rgba(245,239,224,0.5);font-size:12px"><span id="llamada-mensaje-counter">0</span> / 200</small>
      </label>

      <div id="llamada-form-error" style="display:none;color:#C8102E;font-size:13px;padding:8px 0"></div>

      <button id="btn-confirmar-reserva" style="
        display:block;
        width:100%;
        padding:12px 16px;
        margin-bottom:8px;
        background:transparent;
        color:#C8102E;
        border:1.5px solid #C8102E;
        border-radius:6px;
        font-family:inherit;
        font-size:14px;
        font-weight:600;
        letter-spacing:0.3px;
        cursor:pointer;
        text-align:center;
      ">Confirmar reserva</button>

      <button id="btn-volver-form" style="
        display:block;
        width:100%;
        padding:12px 16px;
        background:transparent;
        color:rgba(245,239,224,0.85);
        border:1.5px solid rgba(245,239,224,0.4);
        border-radius:6px;
        font-family:inherit;
        font-size:14px;
        font-weight:400;
        letter-spacing:0.3px;
        cursor:pointer;
        text-align:center;
      ">← Volver</button>

      <small style="display:block;margin-top:12px;color:rgba(245,239,224,0.6);font-size:12px;text-align:center">
        Te llamaremos al móvil que indiques.
      </small>
    </div>`;

  // Contador del textarea
  const textarea = contenedor.querySelector('#llamada-mensaje');
  const counter  = contenedor.querySelector('#llamada-mensaje-counter');
  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length;
  });

  // Volver → re-render grid preservando slotSeleccionado
  contenedor.querySelector('#btn-volver-form').addEventListener('click', () => {
    _renderGrid(contenedor, onConfirmacion, onVolver);
  });

  // Confirmar reserva
  contenedor.querySelector('#btn-confirmar-reserva').addEventListener('click', async () => {
    const nombreEl = contenedor.querySelector('#llamada-nombre');
    const telEl    = contenedor.querySelector('#llamada-telefono');
    const msgEl    = contenedor.querySelector('#llamada-mensaje');
    const errBox   = contenedor.querySelector('#llamada-form-error');

    const nombre  = (nombreEl.value || '').trim();
    const telRaw  = (telEl.value || '').trim();
    const mensaje = (msgEl.value || '').trim().slice(0, 200);

    errBox.style.display = 'none';
    errBox.textContent = '';

    if (!nombre) {
      errBox.textContent = 'Falta el nombre.';
      errBox.style.display = 'block';
      nombreEl.focus();
      return;
    }
    const tel = validarTelefono(telRaw);
    if (!tel) {
      errBox.textContent = 'El móvil no parece válido. Probá con 612 345 678 o +34 612 345 678.';
      errBox.style.display = 'block';
      telEl.focus();
      return;
    }

    // Bloqueo de doble-tap mientras el orquestador hace su trabajo
    const btn = contenedor.querySelector('#btn-confirmar-reserva');
    const btnVolver = contenedor.querySelector('#btn-volver-form');
    btn.disabled = true;
    btn.textContent = 'Reservando…';
    btnVolver.disabled = true;

    try {
      await onConfirmacion({
        fecha:             slotSeleccionado.fecha,
        hora:              slotSeleccionado.hora,
        nombre,
        telefono:          tel,
        mensaje_adicional: mensaje || null,
      });
    } catch (err) {
      // El orquestador suele renderizar su propio mensaje de error en chat.
      // Restablecemos el botón por si quiere reintentar.
      btn.disabled = false;
      btn.textContent = 'Confirmar reserva';
      btnVolver.disabled = false;
    }
  });
}

/**
 * Validación permisiva de teléfono — mismo criterio que _extraerTelefono
 * en victoria.js. Acepta:
 *   - E.164 internacional (+XX seguido de 8-14 dígitos)
 *   - Móvil ES (empieza por 6/7/8/9, total 9 dígitos)
 *   - Genérico (9-15 dígitos seguidos)
 *
 * Devuelve el número normalizado (sin espacios/guiones/paréntesis/puntos)
 * o null si no encaja en ninguno de los 3 formatos.
 */
function validarTelefono(input) {
  const limpio = (input || '').replace(/[\s\-().]/g, '');
  if (/^\+[1-9]\d{8,14}$/.test(limpio)) return limpio;  // E.164 internacional
  if (/^[6-9]\d{8}$/.test(limpio))      return limpio;  // móvil ES (6/7/8/9 + 8 dígitos)
  if (/^\d{9,15}$/.test(limpio))        return limpio;  // genérico 9-15 dígitos
  return null;
}
