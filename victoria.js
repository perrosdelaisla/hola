/**
 * victoria.js
 * Perros de la Isla — Embudo Victoria
 * Versión 1.1 · Abril 2026
 *
 * EXPORT PRINCIPAL: start() — llamado desde index.html al cargar la página
 *
 * CAMBIOS v1.1 (integración con index.html real):
 * - Export start() en vez de iniciarConversacion() — coincide con index.html
 * - UI conectada al DOM real: #chat, #tw (typing indicator), #panel, #opts
 * - Mensajes renderizados directamente en el DOM sin CustomEvent
 * - Agenda y pago insertados dinámicamente en el chat como burbujas
 * - _guardarCitaEnSupabase usa campos reales de la tabla citas:
 *   fecha+hora separados (no slot_id), comprobante_url (no captura_url)
 *
 * FLUJO s0→s12:
 *   s1  zona · s2  nombre perro · s3  edad+raza+peso
 *   s4  descripción problema · s5  afinado/filtro mordida
 *   s6  propuesta protocolo · s7  agenda · s8  confirmación slot
 *   s9  datos cliente · s10 pago · s11 captura · s12 confirmación final
 */

import { normalizar }                        from "./victoria-utils.js";
import { detectarZona }                      from "./victoria-zones.js";
import { detectarCuadros, detectarLateral }  from "./victoria-dictionaries.js";
import { DICT_BASICA }                       from "./victoria-dictionaries.js";
import { obtenerFrase }                      from "./victoria-phrases.js";
import { esPPP }                             from "./victoria-breeds.js";
import { decidirRespuesta }                  from "./victoria-matching.js";
import { renderAgenda }                      from "./agenda.js";
import { renderPago }                        from "./pagos.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL   = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2ODMzNDcsImV4cCI6MjA1OTI1OTM0N30.ixjBBHMsEu5ANxl4MXodVdYFhnlEi9MBnj0TxmPHxe0";
const NTFY_TOPIC = "perrosdelaisla-citas-2026"; // ← cambia por string aleatorio antes de producción

// Delay de typing indicator en ms
const TYPING_DELAY = 900;

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO CONVERSACIONAL — vive en memoria, se persiste en Supabase al cerrar
// ─────────────────────────────────────────────────────────────────────────────

let state = _estadoInicial();

function _estadoInicial() {
  return {
    current_step: "s0",
    pending: null,
    cuadro_pendiente_mordida: null,
    gravedad_mordida: null,
    lateral_detectado: null,
    decision_actual: null,
    bandera_edad_temprana: false,
    s3_intentos: 0,
    s5_intentos: 0,
    protocolo_ya_presentado: false,

    perro: { nombre: null, edad_meses: null, raza: null, peso_kg: null, es_ppp: false },

    zona: {
      zonaDetectada: null, modalidad: "desconocida",
      esSonGotleu: false, necesitaAclaracion: true,
    },

    mensajes_diagnostico: [],  // solo s4+s5 — alimentan el matcher

    cliente: { nombre: null, telefono: null, email: null },

    slot_elegido: null,        // { fecha, hora, label, id }
    modalidad_final: null,
    cita_id: null,
    metodo_pago: null,         // "bizum" o "transf" — del callback de renderPago
    comprobante_url: null,     // nombre real del campo en la tabla citas
    pago_pendiente_verificar: false,
    cita_confirmada: false,

    historial_turnos: [],
    log_matching_final: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL — llamado desde index.html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arranca la conversación. Conecta la UI y envía el primer mensaje.
 * index.html llama a start() al cargar.
 */
export function start() {
  state = _estadoInicial();
  _conectarUI();

  const bienvenida = "¡Hola! Soy Victoria, la coordinadora de Perros de la Isla. " +
    "Estoy aquí para ayudarte a encontrar el protocolo adecuado para tu perro. " +
    "Para empezar, ¿en qué zona de Mallorca estás?";

  _registrarTurno("victoria", bienvenida);
  _mostrarVictoria(bienvenida);
  state.current_step = "s1";
  _actualizarProgreso();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONEXIÓN CON EL DOM REAL (index.html)
// ─────────────────────────────────────────────────────────────────────────────

let _chatEl    = null;
let _twEl      = null;   // typing indicator
let _inputEl   = null;
let _sendEl    = null;

function _conectarUI() {
  _chatEl  = document.getElementById("chat");
  _twEl    = document.getElementById("tw");

  // Input y botón viven en index.html — solo los conectamos aquí
  _inputEl = document.getElementById("victoria-input");
  _sendEl  = document.getElementById("victoria-send");

  if (_inputEl && _sendEl) {
    _inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") _enviarMensaje();
    });
    _sendEl.addEventListener("click", _enviarMensaje);
  }
}

function _enviarMensaje() {
  const texto = _inputEl?.value?.trim();
  if (!texto) return;
  _inputEl.value = "";

  _mostrarCliente(texto);
  _registrarTurno("cliente", texto);
  _ocultarOpciones(); // ocultar panel de opciones al escribir texto libre

  // Typing indicator mientras Victoria "piensa"
  _mostrarTyping(true);
  setTimeout(async () => {
    const respuesta = await _procesarTexto(texto);
    _mostrarTyping(false);
    if (respuesta) {
      _mostrarVictoria(respuesta);
      _registrarTurno("victoria", respuesta);
    }
    _actualizarProgreso();
    _scrollAbajo();
    _inputEl?.focus(); // mantener teclado abierto en móvil
  }, TYPING_DELAY);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO EN EL CHAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Muestra un mensaje de Victoria en el chat.
 * Inserta antes del typing indicator para que siempre quede al final.
 */
function _mostrarVictoria(texto) {
  if (!_chatEl || !_twEl) return;
  const burbuja = document.createElement("div");
  burbuja.className = "msg bot";
  burbuja.innerHTML = `
    <div class="av">
      <img src="https://i.ibb.co/Q7Ssr8XM/icon.png" alt="V" width="19" height="16" style="object-fit:contain">
    </div>
    <div class="bub">${_escaparHTML(texto)}</div>
  `;
  _chatEl.insertBefore(burbuja, _twEl);
  // Forzar reflow antes de añadir .in para que la transición CSS se dispare
  burbuja.getBoundingClientRect();
  burbuja.classList.add("in");
  _scrollAbajo();
}

/** Muestra un mensaje del cliente */
function _mostrarCliente(texto) {
  if (!_chatEl || !_twEl) return;
  const burbuja = document.createElement("div");
  burbuja.className = "msg usr";
  burbuja.innerHTML = `<div class="bub">${_escaparHTML(texto)}</div>`;
  _chatEl.insertBefore(burbuja, _twEl);
  burbuja.getBoundingClientRect();
  burbuja.classList.add("in");
  _scrollAbajo();
}

/** Inserta un contenedor especial (agenda, pago) en el chat como burbuja */
function _insertarContenedorEnChat(id, className = "") {
  if (!_chatEl || !_twEl) return null;
  const wrap = document.createElement("div");
  wrap.className = `msg bot widget-wrap ${className}`;
  const contenedor = document.createElement("div");
  contenedor.id = id;
  wrap.appendChild(contenedor);
  _chatEl.insertBefore(wrap, _twEl);
  _scrollAbajo();
  return contenedor;
}

function _mostrarTyping(visible) {
  if (!_twEl) return;
  if (visible) {
    _twEl.classList.add("in");
  } else {
    _twEl.classList.remove("in");
  }
}

function _scrollAbajo() {
  if (_chatEl) _chatEl.scrollTop = _chatEl.scrollHeight;
}

function _escaparHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO DEL PROCESAMIENTO
// ─────────────────────────────────────────────────────────────────────────────

async function _procesarTexto(texto) {
  const procesadores = {
    s1:  _procesarS1_Zona,
    s2:  _procesarS2_NombrePerro,
    s3:  _procesarS3_DatosPerro,
    s4:  _procesarS4_Problema,
    s5:  _procesarS5_Afinado,
    s6:  _procesarS6_Protocolo,
    s7:  _procesarS7_Slot,
    s8:  _procesarS8_ConfirmacionSlot,
    s9:  _procesarS9_DatosCliente,
    s10: _procesarS10_Pago,
    s11: _procesarS11_Captura,
    s12: _procesarS12_Confirmacion,
  };

  const procesador = procesadores[state.current_step];
  if (!procesador) return _fallbackHumano("paso desconocido: " + state.current_step);

  return await procesador(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESADORES DE PASOS s1–s12
// ─────────────────────────────────────────────────────────────────────────────

function _procesarS1_Zona(texto) {
  const zona = detectarZona(texto);
  state.zona = zona;

  if (zona.necesitaAclaracion) {
    return "No he reconocido esa zona. ¿Puedes decirme el municipio o barrio? " +
      "Por ejemplo: Palma, Inca, Llucmajor, Calvià…";
  }

  state.current_step = "s2";
  return "Perfecto. ¿Cómo se llama tu perro?";
}

function _procesarS2_NombrePerro(texto) {
  const nombre = texto
    .replace(/^(se llama|mi perro (es|se llama))\s*/i, "")
    .replace(/^(es|un|una)\s+/i, "")
    .trim();

  state.perro.nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  state.current_step = "s3";

  return `¡Qué nombre más bonito! Cuéntame un poco más sobre ${state.perro.nombre}: ` +
    "¿qué edad tiene, qué raza es y cuánto pesa aproximadamente?";
}

function _procesarS3_DatosPerro(texto) {
  const edad = _extraerEdad(texto);
  const peso = _extraerPeso(texto);
  const raza = _extraerRaza(texto);

  if (edad !== null) state.perro.edad_meses = edad;
  if (peso !== null) state.perro.peso_kg    = peso;
  if (raza !== null) state.perro.raza       = raza;

  state.perro.es_ppp = esPPP(texto);

  const faltaEdad = state.perro.edad_meses === null;
  const faltaPeso = state.perro.peso_kg    === null;

  // La edad es crítica para el matching (cachorros, filtros de edad)
  // El peso es informativo — si falta tras 1 intento, usar default y avanzar
  // La edad merece hasta 3 intentos con mensajes distintos antes del default

  if (faltaEdad) {
    state.s3_intentos++;
    if (state.s3_intentos === 1) {
      return `¿Qué edad tiene ${state.perro.nombre}? Con meses si es cachorro, o años si es adulto.`;
    }
    if (state.s3_intentos === 2) {
      return `Perdona, no he sabido leerlo bien. Dímelo con números si puedes — por ejemplo "3 años" o "8 meses".`;
    }
    // Tercer intento fallido → default y avanzar
    state.perro.edad_meses = 24;
  }

  if (faltaPeso && state.s3_intentos <= 1) {
    // Solo pedimos el peso si es el primer bloqueo (edad ya resuelta)
    state.s3_intentos++;
    return `¿Y cuánto pesa ${state.perro.nombre} aproximadamente? Un número aproximado me vale — por ejemplo "12 kilos".`;
  }

  // Si falta peso tras intento o no se pudo extraer → default y avanzar
  if (state.perro.peso_kg    === null) state.perro.peso_kg    = 15;
  if (state.perro.edad_meses === null) state.perro.edad_meses = 24;
  if (state.perro.raza       === null) state.perro.raza       = "mestizo";

  state.current_step = "s4";
  return `Perfecto. Cuéntame, ¿qué te gustaría mejorar o trabajar con ${state.perro.nombre}? ` +
    "Descríbeme la situación con tus propias palabras.";
}

function _procesarS4_Problema(texto) {
  state.mensajes_diagnostico.push(texto);

  // Detectar lateral — ignorar si hay cuadro fuerte en el mismo mensaje
  const lateral = detectarLateral(texto);
  if (lateral) {
    const cuadros = detectarCuadros(texto);
    const hayCuadroFuerte = cuadros.cuadros.some(
      (c) => c.confianza === "alta" || c.confianza === "media"
    );
    if (!hayCuadroFuerte) state.lateral_detectado = lateral;
  }

  return _evaluarYResponder(texto);
}

function _procesarS5_Afinado(texto) {
  state.mensajes_diagnostico.push(texto);
  state.s5_intentos++;

  if (state.s5_intentos >= 3) {
    return _fallbackHumano("3+ rondas de afinado sin decisión clara");
  }

  // respuesta_pendiente se construye en _construirContexto — no asignar aquí
  return _evaluarYResponder(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DE OPCIONES — inline dentro del chat (no fijo abajo)
// Los botones aparecen como parte de la conversación, debajo del último mensaje
// ─────────────────────────────────────────────────────────────────────────────

function _mostrarOpciones(opciones) {
  if (!_chatEl || !_twEl) return;
  _ocultarOpciones(); // limpia cualquier bloque anterior

  const wrap = document.createElement("div");
  wrap.className = "opts-inline";
  wrap.id = "opts-inline-actual";

  opciones.forEach(({ label, onClick }) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn-inline";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      _ocultarOpciones();
      onClick();
    });
    wrap.appendChild(btn);
  });

  _chatEl.insertBefore(wrap, _twEl);
  _scrollAbajo();
}

function _ocultarOpciones() {
  const prev = document.getElementById("opts-inline-actual");
  if (prev) prev.remove();
}

// Keywords afirmativas — usadas en s6 para detectar "sí, ver horarios"
const KEYWORDS_AFIRMATIVO = [
  "sí", "si", "ok", "okay", "vale", "perfecto", "adelante",
  "me interesa", "quiero", "me apunto", "venga", "dale",
  "bien", "muy bien", "suena bien", "me parece bien",
  "genial", "estupendo", "claro", "por supuesto",
  "yep", "yes", "ver horarios", "ver horario",
];

async function _procesarS6_Protocolo(texto) {
  const norm = normalizar(texto);
  const esAfirmativo = texto.length < 40 &&
    KEYWORDS_AFIRMATIVO.some((kw) => norm.includes(kw));

  if (esAfirmativo) {
    state.current_step = "s7";
    return await _iniciarAgenda();
  }

  // No repetir el protocolo — mensaje puente + botones de opción
  setTimeout(() => {
    _mostrarOpciones([
      {
        label: "Sí, ver horarios disponibles",
        onClick: async () => {
          _mostrarCliente("Sí, ver horarios");
          _registrarTurno("cliente", "Sí, ver horarios");
          state.current_step = "s7";
          _mostrarTyping(true);
          setTimeout(async () => {
            _mostrarTyping(false);
            await _iniciarAgenda();
            _actualizarProgreso();
          }, TYPING_DELAY);
        },
      },
      {
        label: "Prefiero preguntar algo más",
        onClick: () => {
          _mostrarCliente("Tengo una pregunta");
          _registrarTurno("cliente", "Tengo una pregunta");
          const msg = "Claro, cuéntame — estoy aquí.";
          _mostrarVictoria(msg);
          _registrarTurno("victoria", msg);
        },
      },
    ]);
  }, 100);

  return "¿Quieres ver los horarios disponibles o prefieres preguntarme algo más antes?";
}

function _procesarS7_Slot(_texto) {
  return "Cuando veas un horario que te venga bien, selecciónalo en el calendario de arriba.";
}

function _procesarS8_ConfirmacionSlot(_texto) {
  if (!state.slot_elegido) {
    return "Parece que no has seleccionado ningún horario todavía. " +
      "Elige el que mejor te venga en el calendario.";
  }
  state.current_step = "s9";
  return `Perfecto, reservamos el ${state.slot_elegido.label}. ` +
    "Para confirmar la cita necesito algunos datos: ¿cuál es tu nombre completo y tu teléfono?";
}

function _procesarS9_DatosCliente(texto) {
  const telefono = _extraerTelefono(texto);
  if (telefono) state.cliente.telefono = telefono;

  const nombreCandidato = texto.replace(/\d[\d\s]{8,}/g, "").trim();
  if (nombreCandidato.length > 2) state.cliente.nombre = nombreCandidato;

  if (!state.cliente.nombre) return "¿Cuál es tu nombre completo?";
  if (!state.cliente.telefono) {
    return "¿Y tu número de teléfono? Para que Carlos pueda contactarte si hace falta.";
  }

  // Email obligatorio si online
  if (state.modalidad_final === "online" && !state.cliente.email) {
    return "Como la sesión es por Google Meet, necesito también tu email " +
      "para enviarte el enlace de la videollamada.";
  }
  const email = _extraerEmail(texto);
  if (email) state.cliente.email = email;

  state.current_step = "s10";
  return _explicarPago();
}

function _procesarS10_Pago(_texto) {
  state.current_step = "s11";
  return _iniciarPago();
}

function _procesarS11_Captura(_texto) {
  return "Cuando hayas subido la captura y confirmado el pago, lo proceso enseguida.";
}

async function _procesarS12_Confirmacion(_texto) {
  try {
    await _guardarCitaEnSupabase();
    await _notificarCarlos();
    state.cita_confirmada = true;

    const perro    = state.perro.nombre ?? "tu perro";
    const slot     = state.slot_elegido;
    const modalidad = state.modalidad_final === "online"
      ? "online por Google Meet"
      : "en tu domicilio";

    return `¡Todo confirmado! 🐾 Carlos se pondrá en contacto contigo para preparar la primera sesión. ` +
      `Quedamos el ${slot?.label ?? "día acordado"}, ${modalidad}. ` +
      `Si necesitas cambiar algo, escríbele directamente al 622 922 173. ` +
      `¡Mucho ánimo con ${perro}!`;
  } catch (err) {
    console.error("Error al confirmar cita:", err);
    return "Ha habido un problema técnico al confirmar la cita. " +
      "Por favor, escribe directamente a Carlos al 622 922 173 y él lo gestiona enseguida.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA — se inserta dinámicamente en el chat
// ─────────────────────────────────────────────────────────────────────────────

async function _iniciarAgenda() {
  const contenedor = _insertarContenedorEnChat("victoria-agenda-slot", "agenda-widget");
  if (!contenedor) {
    return "Ahora te muestro los horarios disponibles — " +
      "si no aparecen, escríbenos al 622 922 173 y te damos opciones.";
  }

  // contenedor como primer parámetro — mismo contrato que pagos.js
  await renderAgenda(
    contenedor,
    (slotElegido) => {
      state.slot_elegido = slotElegido;
      state.current_step = "s8";
      const msg = `Has elegido el ${slotElegido.label}. ¿Confirmamos este horario?`;
      _registrarTurno("victoria", msg);
      _mostrarVictoria(msg);
      _actualizarProgreso();
    },
    () => {
      state.current_step = "s6";
      const msg = "Sin problema. ¿Hay algo más que quieras preguntarme?";
      _registrarTurno("victoria", msg);
      _mostrarVictoria(msg);
    }
  );

  return null; // el widget se renderiza en el DOM — sin burbuja de texto
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGO — se inserta dinámicamente en el chat
// ─────────────────────────────────────────────────────────────────────────────

function _iniciarPago() {
  const contenedor = _insertarContenedorEnChat("victoria-pago-slot", "pago-widget");
  if (!contenedor) return _explicarPago();

  renderPago(
    contenedor,
    {
      nombre: state.cliente.nombre,
      telefono: state.cliente.telefono,
      slot: state.slot_elegido,
      modalidad: state.modalidad_final,
      precio: 45,
      citaId: state.cita_id,
    },
    async ({ metodo, signedUrl, pendienteVerificar }) => {
      state.metodo_pago                = metodo;  // "bizum" o "transf"
      state.comprobante_url            = signedUrl ?? null;
      state.pago_pendiente_verificar   = !!pendienteVerificar;
      state.current_step               = "s12";

      _mostrarTyping(true);
      const respuesta = await _procesarS12_Confirmacion("");
      _mostrarTyping(false);

      if (respuesta) {
        _registrarTurno("victoria", respuesta);
        _mostrarVictoria(respuesta);
      }
      _actualizarProgreso();
    },
    () => {
      state.current_step = "s9";
      const msg = "Sin problema. ¿Quieres cambiar algo de los datos antes de pagar?";
      _registrarTurno("victoria", msg);
      _mostrarVictoria(msg);
    }
  );

  return null;
}

function _explicarPago() {
  const precio    = 45;
  const modalidad = state.modalidad_final === "online"
    ? "online (75€ la sesión)"
    : "presencial (90€ la sesión)";
  return `Para confirmar la cita en modalidad ${modalidad}, necesito una seña de ${precio}€. ` +
    "Puedes pagarla por Bizum al 653 591 301 o por transferencia al IBAN " +
    "ES27 0182 5319 7002 0055 6013 (titular: Carlos Antonio Acevedo). " +
    "Cuando hayas hecho el pago, súbeme la captura y lo confirmo enseguida.";
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO MATCHING — construir contexto y evaluar
// ─────────────────────────────────────────────────────────────────────────────

function _evaluarYResponder(textoActual) {
  const contexto = _construirContexto(textoActual);
  const decision = decidirRespuesta(contexto);

  // Persistir campos de estado entre turnos
  if (decision.pending_next !== undefined)       state.pending = decision.pending_next;
  if (decision.cuadro_pendiente_mordida)         state.cuadro_pendiente_mordida = decision.cuadro_pendiente_mordida;
  if (decision.bandera_edad_temprana)            state.bandera_edad_temprana = true;

  state.decision_actual    = decision;
  state.log_matching_final = decision.log;

  if (decision.frase_params?.modalidad) {
    state.modalidad_final = decision.frase_params.modalidad;
  } else if (["zona", "son_gotleu"].includes(decision.frase_params?.tipo)) {
    state.modalidad_final = "derivar";
  }

  switch (decision.accion) {
    case "responder":
    case "derivar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("frase null: " + JSON.stringify(decision.frase_params));

      // Protocolo presentado — avanzar a s6 y mostrar botones de opción
      if (decision.accion === "responder" &&
          (state.current_step === "s4" || state.current_step === "s5")) {
        state.protocolo_ya_presentado = true;
        state.current_step = "s6";
        if (state.modalidad_final !== "derivar") {
          // Mostrar botones en el panel tras un pequeño delay
          setTimeout(() => {
            _mostrarOpciones([
              {
                label: "Sí, ver horarios disponibles",
                onClick: async () => {
                  _mostrarCliente("Sí, ver horarios");
                  _registrarTurno("cliente", "Sí, ver horarios");
                  state.current_step = "s7";
                  _mostrarTyping(true);
                  setTimeout(async () => {
                    _mostrarTyping(false);
                    await _iniciarAgenda();
                    _actualizarProgreso();
                  }, TYPING_DELAY);
                },
              },
              {
                label: "Prefiero preguntar algo más",
                onClick: () => {
                  _mostrarCliente("Tengo una pregunta");
                  _registrarTurno("cliente", "Tengo una pregunta");
                  const msg = "Claro, cuéntame — estoy aquí.";
                  _mostrarVictoria(msg);
                  _registrarTurno("victoria", msg);
                },
              },
            ]);
          }, TYPING_DELAY + 100);
          return frase; // sin transición de texto — los botones hacen ese trabajo
        }
      }
      return frase;
    }

    case "preguntar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("frase null en preguntar");
      state.current_step = "s5";
      return frase;
    }

    case "fallback":
      return _fallbackHumano(decision.log?.notas ?? "fallback");

    default:
      return _fallbackHumano("acción desconocida: " + decision.accion);
  }
}

function _construirContexto(textoActual) {
  const mensajeCompleto = state.mensajes_diagnostico.join(" ");
  const cuadros = detectarCuadros(mensajeCompleto);

  return {
    perro:    { ...state.perro },
    zona:     state.zona,
    cuadros:  cuadros.cuadros,
    mensaje:  mensajeCompleto,
    pending:  state.pending,
    respuesta_pendiente: state.pending ? textoActual : null,
    keywords_mordida:    _tieneKeywordsMordida(textoActual),
    lateral_detectado:   state.lateral_detectado,
    gravedad_mordida:    state.gravedad_mordida,
    cuadro_pendiente_mordida: state.cuadro_pendiente_mordida,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA EN SUPABASE
// Campos alineados con la tabla real de citas (vista en captura de pantalla)
// ─────────────────────────────────────────────────────────────────────────────

async function _guardarCitaEnSupabase() {
  // 1. Guardar cliente
  const clienteRes = await _supabasePost("/rest/v1/clientes", {
    nombre:   state.cliente.nombre,
    telefono: state.cliente.telefono,
    email:    state.cliente.email,
  });
  const clienteId = clienteRes?.id ?? null;

  // 2. Guardar perro
  const perroRes = await _supabasePost("/rest/v1/perros", {
    nombre:     state.perro.nombre,
    raza:       state.perro.raza,
    edad_meses: state.perro.edad_meses,
    peso_kg:    state.perro.peso_kg,
    es_ppp:     state.perro.es_ppp,
    cliente_id: clienteId,
  });
  const perroId = perroRes?.id ?? null;

  // 3. Guardar cita — usando campos reales de la tabla:
  //    fecha (date) + hora (time) separados, comprobante_url (no captura_url)
  const decision = state.decision_actual;
  const cuadros  = decision?.cuadros_originales ??
    (decision?.cuadro_ganador ? [decision.cuadro_ganador] : []);

  const slot = state.slot_elegido;
  // slot.fecha es "YYYY-MM-DD", slot.hora es "HH:MM"
  const fechaCita = slot?.fecha ?? null;
  const horaCita  = slot?.hora  ?? null;

  const citaRes = await _supabasePost("/rest/v1/citas", {
    cliente_id:              clienteId,
    fecha:                   fechaCita,
    hora:                    horaCita,
    estado:                  "confirmada",
    sena_pagada:             !state.pago_pendiente_verificar,
    metodo_pago:             state.metodo_pago ?? null,
    comprobante_url:         state.comprobante_url,  // nombre real del campo
    modalidad:               state.modalidad_final,
    zona:                    state.zona?.zonaDetectada,
    cuadros_detectados:      cuadros,
    es_mixto:                decision?.es_mixto            ?? false,
    mixto_degradado:         decision?.mixto_degradado     ?? false,
    bandera_edad_temprana:   state.bandera_edad_temprana   ?? false,
    pago_pendiente_verificar: state.pago_pendiente_verificar,
    confirmada:              true,
  });
  state.cita_id = citaRes?.id ?? null;

  // 4. Guardar conversación
  await _supabasePost("/rest/v1/conversaciones", {
    cita_id:      state.cita_id,
    turnos:       state.historial_turnos,
    log_matching: state.log_matching_final,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICACIÓN A CARLOS (ntfy.sh)
// ─────────────────────────────────────────────────────────────────────────────

async function _notificarCarlos() {
  const d      = state.decision_actual;
  const cuadros = d?.cuadros_originales ??
    (d?.cuadro_ganador ? [d.cuadro_ganador] : ["no detectado"]);
  const slot   = state.slot_elegido;
  const p      = state.perro;
  const c      = state.cliente;

  const edadTexto = (p.edad_meses ?? 0) < 12
    ? `${p.edad_meses} meses`
    : `${Math.round((p.edad_meses ?? 24) / 12)} años`;

  const flags = [];
  if (state.bandera_edad_temprana)    flags.push("⚠️ Perro joven — atención primera sesión");
  if (d?.mixto_degradado)             flags.push(`ℹ️ Mixto degradado — detectados: ${(d.cuadros_originales ?? []).join(" + ")}`);
  if (state.cuadro_pendiente_mordida) flags.push("⚠️ Amago de mordida — cliente no precisó gravedad");
  if (state.pago_pendiente_verificar) flags.push("⚠️ Comprobante no subido — verificar pago manualmente");
  const flagsTexto = flags.length ? flags.map((f) => `   ${f}`).join("\n") : "   Sin flags";

  const mensaje = [
    "[NUEVA CITA CONFIRMADA 🐾]",
    "",
    `👤 Cliente: ${c.nombre ?? "—"} · ${c.telefono ?? "—"}`,
    `📧 Email: ${c.email ?? (state.modalidad_final === "online" ? "⚠️ FALTA" : "no requerido")}`,
    "",
    `🐕 Perro: ${p.nombre ?? "—"} · ${p.raza ?? "—"} · ${edadTexto} · ${p.peso_kg ?? "—"}kg`,
    `📍 Zona: ${state.zona?.zonaDetectada ?? "—"} · Modalidad: ${state.modalidad_final ?? "—"}`,
    "",
    `🧠 Cuadro(s): ${cuadros.join(" + ")}`,
    `   Flags:\n${flagsTexto}`,
    "",
    `📅 Slot: ${slot?.label ?? "—"}`,
    `💰 Seña: 45€ ${state.pago_pendiente_verificar ? "PENDIENTE DE VERIFICAR" : "confirmada"}`,
    state.comprobante_url ? `📎 Comprobante: ${state.comprobante_url}` : "📎 Comprobante: no subido",
    "",
    `[Paso ${d?.log?.paso ?? "?"} | ${d?.log?.notas ?? ""}]`,
  ].join("\n");

  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Title": "Nueva cita Perros de la Isla",
      "Priority": "high",
      "Tags": "dog,calendar",
    },
    body: mensaje,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BARRA DE PROGRESO
// ─────────────────────────────────────────────────────────────────────────────

const PROGRESO_POR_PASO = {
  s0: 0, s1: 8, s2: 16, s3: 24, s4: 35, s5: 45,
  s6: 55, s7: 65, s8: 72, s9: 80, s10: 88, s11: 94, s12: 100,
};

function _actualizarProgreso() {
  const pf = document.getElementById("pf");
  if (!pf) return;
  const pct = PROGRESO_POR_PASO[state.current_step] ?? 0;
  pf.style.width = `${pct}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACCIÓN DE DATOS ESTRUCTURADOS
// ─────────────────────────────────────────────────────────────────────────────

// Mapa de números en palabras → dígitos (español)
const NUMEROS_PALABRA = {
  "un": "1", "una": "1", "uno": "1",
  "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
  "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
  "diez": "10", "once": "11", "doce": "12", "trece": "13",
  "catorce": "14", "quince": "15",
};

/**
 * Normaliza números escritos en palabras a dígitos.
 * "un año" → "1 año", "siete kilos" → "7 kilos"
 */
function _normalizarNumeros(texto) {
  let t = texto.toLowerCase();
  for (const [palabra, digito] of Object.entries(NUMEROS_PALABRA)) {
    t = t.replace(new RegExp(`\\b${palabra}\\b`, "gi"), digito);
  }
  return t;
}

function _extraerEdad(texto) {
  const t = _normalizarNumeros(texto);

  // "1 año y 5 meses" → 17
  const compuesto = t.match(/(\d+)\s*años?\s*y\s*(\d+)\s*meses?/i);
  if (compuesto) return parseInt(compuesto[1]) * 12 + parseInt(compuesto[2]);

  const semanas = t.match(/(\d+)\s*semanas?/i);
  if (semanas) return Math.round(parseInt(semanas[1]) / 4.3);

  const meses = t.match(/(\d+)\s*(meses?|mes)/i);
  if (meses) return parseInt(meses[1]);

  const anos = t.match(/(\d+)\s*(años?|ano)/i);
  if (anos) return parseInt(anos[1]) * 12;

  return null;
}

function _extraerPeso(texto) {
  const t = _normalizarNumeros(texto);
  const kg = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilo)/i);
  if (kg) return parseFloat(kg[1].replace(",", "."));
  return null;
}

const RAZAS_COMUNES = [
  "golden retriever", "pastor alemán", "pastor aleman", "border collie",
  "cocker spaniel", "yorkshire terrier", "shih tzu", "jack russell",
  "husky siberiano", "gran danés", "gran danes", "san bernardo",
  "pastor belga", "fox terrier", "west highland",
  "labrador", "golden", "border", "bulldog", "beagle", "yorkshire",
  "chihuahua", "teckel", "dachshund", "husky", "pug", "boxer",
  "galgo", "podenco", "cocker", "caniche", "bichon", "maltés", "maltes",
  "schnauzer", "samoyedo", "setter", "pointer", "dálmata", "dalmata",
  "doberman", "terranova", "mastín", "mastin", "malinois", "vizsla",
  "weimaraner", "braco", "corgi", "basenji", "whippet", "shiba",
  "mestizo", "cruce", "mix", "mixto",
];

function _extraerRaza(texto) {
  const norm = normalizar(texto);
  const razasOrdenadas = [...RAZAS_COMUNES].sort((a, b) => b.length - a.length);
  for (const raza of razasOrdenadas) {
    if (norm.includes(normalizar(raza))) {
      return raza.charAt(0).toUpperCase() + raza.slice(1);
    }
  }
  return null;
}

function _extraerTelefono(texto) {
  const tel = texto.match(/(\+34\s?)?[6789]\d{8}/);
  return tel ? tel[0].replace(/\s/g, "") : null;
}

function _extraerEmail(texto) {
  const email = texto.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return email ? email[0] : null;
}

function _tieneKeywordsMordida(texto) {
  const MORDIDA = ["muerde", "mordió", "ha mordido", "llegó a morder",
    "se tira a morder", "mordida", "amago"];
  const norm = normalizar(texto);
  return MORDIDA.some((kw) => norm.includes(normalizar(kw)));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function _registrarTurno(rol, texto) {
  state.historial_turnos.push({ rol, texto, timestamp: new Date().toISOString() });
}

function _fallbackHumano(razon) {
  console.warn("Victoria fallback:", razon);
  return "Para poder orientarte bien, te paso directamente con Carlos. " +
    "Puedes escribirle por WhatsApp al 622 922 173.";
}

async function _supabasePost(endpoint, body) {
  try {
    const res = await fetch(`${SUPA_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "apikey":        SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status} en ${endpoint}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error("Error Supabase:", err);
    return null;
  }
}
