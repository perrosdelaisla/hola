/* ═══════════════════════════════════════════
   PERROS DE LA ISLA · Vicky
   vicky.js — Generador de links de auto-reserva
   ═══════════════════════════════════════════ */

const SUPA_URL = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjAwODAsImV4cCI6MjA5MjMzNjA4MH0.0SpunQTuSwYaAjzWEDQivZy7971-Tf3CX2KxAEo8Nuw";

// Password en memoria de módulo — NO localStorage para minimizar persistencia.
// Vicky tipea cada vez que abre la página (4 segundos).
let passwordActual = null;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replica la lógica de _extraerEdad de victoria.js + regla de número solo.
 * Devuelve edad en meses (entero, Math.round) o null si no se puede parsear.
 *
 * Soporta decimales con punto o coma ("1.5 años", "1,5 años" → 18). La
 * coma se normaliza a punto antes de parsear. La "y" del formato
 * compuesto es opcional ("1 año y 6 meses" y "1 año 6 meses" → 18).
 *
 * Reglas:
 *   - "X años [y] Y meses" → X*12 + Y
 *   - "X semanas"          → X / 4.3
 *   - "X mes(es)"          → X
 *   - "X año(s)"           → X*12
 *   - "X" (solo número)    → X meses si X≤24, X*12 si X>24
 */
function parsearEdadAMeses(texto) {
  // Normalizamos coma decimal a punto para que parseFloat funcione.
  const t = (texto || '').toLowerCase().trim().replace(',', '.');
  if (!t) return null;

  // Compuesto "X años y Y meses" — la "y" es opcional.
  const compuesto = t.match(/(\d+(?:[.,]\d+)?)\s*años?\s*(?:y\s*)?(\d+(?:[.,]\d+)?)\s*meses?/i);
  if (compuesto) {
    return Math.round(parseFloat(compuesto[1]) * 12 + parseFloat(compuesto[2]));
  }

  const semanas = t.match(/(\d+(?:[.,]\d+)?)\s*semanas?/i);
  if (semanas) return Math.round(parseFloat(semanas[1]) / 4.3);

  const meses = t.match(/(\d+(?:[.,]\d+)?)\s*(meses?|mes)/i);
  if (meses) return Math.round(parseFloat(meses[1]));

  const anos = t.match(/(\d+(?:[.,]\d+)?)\s*(años?|ano)/i);
  if (anos) return Math.round(parseFloat(anos[1]) * 12);

  const soloNumero = t.match(/^(\d+(?:[.,]\d+)?)$/);
  if (soloNumero) {
    const n = parseFloat(soloNumero[1]);
    return n <= 24 ? Math.round(n) : Math.round(n * 12);
  }

  return null;
}

function mostrarPantalla(id) {
  ['pantalla-login', 'pantalla-form', 'pantalla-link'].forEach(p => {
    const el = document.getElementById(p);
    if (el) el.hidden = (p !== id);
  });
}

function mostrarError(elId, mensaje) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = mensaje;
  el.hidden = false;
}

function limpiarError(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById('form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  limpiarError('login-error');
  const pwd = document.getElementById('login-password').value.trim();
  if (!pwd) {
    mostrarError('login-error', 'Falta la contraseña.');
    return;
  }
  passwordActual = pwd;
  // La validación real se hace al primer intento de generar link (la RPC
  // devuelve password_invalida si está mal). Acá solo guardamos y avanzamos.
  mostrarPantalla('pantalla-form');
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO — generación de token vía RPC
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById('form-lead').addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarError('form-error');

  const datos = {
    tutor_nombre:   document.getElementById('tutor-nombre').value.trim(),
    tutor_telefono: document.getElementById('tutor-telefono').value.trim(),
    tutor_email:    document.getElementById('tutor-email').value.trim(),
    perro_nombre:   document.getElementById('perro-nombre').value.trim(),
    perro_raza:     document.getElementById('perro-raza').value.trim(),
    perro_edad_raw: document.getElementById('perro-edad').value.trim(),
    perro_peso:     parseFloat(document.getElementById('perro-peso').value),
    perro_es_ppp:   document.getElementById('perro-ppp').checked,
    zona:           document.getElementById('lead-zona').value.trim(),
    modalidad:      document.getElementById('lead-modalidad').value,
    problematica:   document.getElementById('lead-problematica').value.trim(),
  };

  // Validaciones cliente
  if (!datos.tutor_nombre || !datos.tutor_telefono ||
      !datos.perro_nombre || !datos.perro_raza || !datos.perro_edad_raw ||
      !datos.zona || !datos.modalidad || !datos.problematica) {
    mostrarError('form-error', 'Faltan campos obligatorios.');
    return;
  }
  if (datos.modalidad === 'online' && !datos.tutor_email) {
    mostrarError('form-error', 'Email obligatorio para modalidad online.');
    document.getElementById('tutor-email').focus();
    return;
  }
  if (!Number.isFinite(datos.perro_peso) || datos.perro_peso <= 0) {
    mostrarError('form-error', 'Peso del perro inválido.');
    document.getElementById('perro-peso').focus();
    return;
  }
  const edadMeses = parsearEdadAMeses(datos.perro_edad_raw);
  if (edadMeses == null || edadMeses <= 0) {
    mostrarError('form-error', 'Edad no válida. Probá "3 años", "8 meses" o un número.');
    document.getElementById('perro-edad').focus();
    return;
  }
  if (datos.problematica.length < 10) {
    mostrarError('form-error', 'La problemática debe tener al menos 10 caracteres.');
    document.getElementById('lead-problematica').focus();
    return;
  }

  // Bloqueo de doble-tap mientras la RPC trabaja
  const btn = document.getElementById('btn-generar');
  btn.disabled = true;
  btn.textContent = 'Generando…';

  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/crear_token_vicky`, {
      method: 'POST',
      headers: {
        'apikey':        SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        p_password:         passwordActual,
        p_tutor_nombre:     datos.tutor_nombre,
        p_tutor_telefono:   datos.tutor_telefono,
        p_tutor_email:      datos.tutor_email || null,
        p_perro_nombre:     datos.perro_nombre,
        p_perro_raza:       datos.perro_raza,
        p_perro_edad_meses: edadMeses,
        p_perro_peso_kg:    datos.perro_peso,
        p_perro_es_ppp:     datos.perro_es_ppp,
        p_zona:             datos.zona,
        p_modalidad:        datos.modalidad,
        p_problematica:     datos.problematica,
      }),
    });

    if (!res.ok) {
      mostrarError('form-error', 'Error de conexión, intenta de nuevo.');
      return;
    }

    const json = await res.json();
    if (!json || json.ok === false) {
      const err = json?.error || 'error_desconocido';

      if (err === 'password_invalida') {
        // Volvemos al login y limpiamos password
        passwordActual = null;
        document.getElementById('login-password').value = '';
        mostrarError('login-error', 'Contraseña incorrecta.');
        mostrarPantalla('pantalla-login');
        return;
      }
      if (err === 'email_requerido_para_online') {
        mostrarError('form-error', 'Email obligatorio para modalidad online.');
        document.getElementById('tutor-email').focus();
        return;
      }
      if (err === 'modalidad_invalida') {
        mostrarError('form-error', 'Modalidad no válida.');
        return;
      }
      mostrarError('form-error', `Error: ${err}`);
      return;
    }

    // Éxito
    const link = `https://perrosdelaisla.github.io/hola/?token=${json.token}`;
    document.getElementById('link-generado').value = link;
    mostrarPantalla('pantalla-link');

  } catch (err) {
    console.error('Error generando token:', err);
    mostrarError('form-error', 'Error de conexión, intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generar link';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COPIAR LINK
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById('btn-copiar').addEventListener('click', async () => {
  const link = document.getElementById('link-generado').value;
  if (!link) return;
  const btn = document.getElementById('btn-copiar');
  try {
    await navigator.clipboard.writeText(link);
    btn.textContent = 'Copiado ✓';
    setTimeout(() => { btn.textContent = 'Copiar link'; }, 2000);
  } catch (err) {
    // Fallback: seleccionar el input para que Vicky haga Ctrl+C manual
    document.getElementById('link-generado').select();
    btn.textContent = 'Seleccioná y Ctrl+C';
    setTimeout(() => { btn.textContent = 'Copiar link'; }, 2500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CREAR OTRO LINK
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById('btn-otro').addEventListener('click', () => {
  document.getElementById('form-lead').reset();
  limpiarError('form-error');
  document.getElementById('link-generado').value = '';
  mostrarPantalla('pantalla-form');
});
