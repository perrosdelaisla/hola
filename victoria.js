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
import {
  obtenerFrase,
  FRASES_PRECIO,
  FRASES_PACK,
  FRASE_PRECIO_POR_PERRO,
  FRASE_MENSAJE_PRINCIPAL,
  FRASE_RAMIFICACION,
  FRASE_COMO_TRABAJAMOS_PRESENCIAL,
  FRASE_COMO_TRABAJAMOS_ONLINE,
  FRASE_CIERRE_METODOLOGIA,
  FRASE_DURACION_UNIFICADA,
} from "./victoria-phrases.js";
import { esPPP }                             from "./victoria-breeds.js";
import { decidirRespuesta }                  from "./victoria-matching.js";
import { renderAgenda }                      from "./agenda.js";
import { renderPago }                        from "./pagos.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL   = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjAwODAsImV4cCI6MjA5MjMzNjA4MH0.0SpunQTuSwYaAjzWEDQivZy7971-Tf3CX2KxAEo8Nuw";
const NTFY_TOPIC = "perrosdelaisla-citas-2026"; // ← cambia por string aleatorio antes de producción

// Delay de typing indicator en ms
const TYPING_BASE     = 1200;  // mínimo antes de responder
const TYPING_POR_CHAR = 15;    // ms extra por cada carácter
const TYPING_MAX      = 3500;  // tope — no hacer esperar más de 3.5s
const TYPING_DELAY    = 1200;  // fallback para callbacks de botones

const VICTORIA_AVATAR = "https://i.ibb.co/1GXMwqzQ/victoria-cuadrada.jpg";

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
    tema_preseleccionado: null,  // viene de ?tema=X en la URL

    perro: { nombre: null, edad_meses: null, raza: null, peso_kg: null, es_ppp: false },

    zona: {
      zonaDetectada: null, modalidad: "desconocida",
      esSonGotleu: false, necesitaAclaracion: true,
    },

    mensajes_diagnostico: [],  // solo s4+s5 — alimentan el matcher
    prescan_mensaje_inicial: null,  // texto del primer mensaje si tenía contenido

    cliente: { nombre: null, telefono: null, email: null },

    slot_elegido: null,        // { fecha, hora, label, id }
    modalidad_final: null,
    cita_id: null,
    metodo_pago: null,
    comprobante_url: null,
    pago_pendiente_verificar: false,
    slot_confirmando: false,   // guard contra doble-tap en móvil
    cita_confirmada: false,
    mostrar_precio_tras_protocolo: false,
    mostrar_ramificacion_tras_protocolo: false,

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
  _conectarSplash();

  // Leer el parámetro ?tema=X de la URL — permite que Victoria sepa desde qué
  // botón de la app de paseos vino el cliente, y personalice el saludo inicial.
  // Valores válidos: basica, reactividad, cachorros, ansiedad. Otros se ignoran.
  const params = new URLSearchParams(window.location.search);
  const temaRaw = (params.get("tema") || "").toLowerCase().trim();
  const TEMAS_VALIDOS = ["basica", "reactividad", "cachorros", "ansiedad"];
  if (TEMAS_VALIDOS.includes(temaRaw)) {
    state.tema_preseleccionado = temaRaw;
  }

  const bienvenida = _construirSaludoBienvenida();

  _registrarTurno("victoria", bienvenida);
  _mostrarVictoria(bienvenida);
  state.current_step = "s1";
  _actualizarProgreso();
}

/**
 * Construye el mensaje de bienvenida. Si hay tema_preseleccionado (viene de la
 * app de paseos con ?tema=X), personaliza el saludo para que el cliente se
 * sienta reconocido. Si no, saludo estándar.
 */
function _construirSaludoBienvenida() {
  const tema = state.tema_preseleccionado;

  const intros = {
    basica: "Veo que vienes interesado en la educación básica de tu perro — paseos, convivencia, llamada, modales en casa. Es uno de los servicios que más trabajamos.",
    reactividad: "Veo que vienes por un tema de reactividad — perros que reaccionan ante otros perros, personas o estímulos. Es de los casos que mejor resultado dan cuando se trabaja bien.",
    cachorros: "Veo que vienes por tu cachorro — socialización, mordida, higiene, rutinas. Una etapa clave donde marcar las bases bien te evita mil cosas después.",
    ansiedad: "Veo que vienes por un tema de ansiedad o miedos — ansiedad por separación, ruidos, tormentas, inseguridades. Lo trabajamos a menudo con buenos resultados.",
  };

  if (tema && intros[tema]) {
    return "¡Hola! Soy Victoria, la coordinadora de Perros de la Isla. " +
      intros[tema] + " " +
      "Para orientarte bien, cuéntame primero: ¿en qué zona de Mallorca estás?";
  }

  // Saludo estándar (sin parámetro o con tema inválido)
  return "¡Hola! Soy Victoria, la coordinadora de Perros de la Isla. " +
    "Estoy aquí para ayudarte a encontrar el protocolo adecuado para tu perro. " +
    "Para empezar, ¿en qué zona de Mallorca estás?";
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

function _conectarSplash() {
  const splashEl = document.getElementById("splash");
  const btnEl    = document.getElementById("splash-start-btn");
  if (!splashEl || !btnEl) return;

  btnEl.addEventListener("click", () => {
    splashEl.classList.add("splash-fadeout");
    setTimeout(() => {
      splashEl.style.display = "none";
    }, 650);
  });
}

async function _enviarMensaje() {
  const texto = _inputEl?.value?.trim();
  if (!texto) return;
  _inputEl.value = "";

  _mostrarCliente(texto);
  _registrarTurno("cliente", texto);
  _ocultarOpciones(); // ocultar panel de opciones al escribir texto libre

  // Mostrar typing mientras Victoria "piensa"
  _mostrarTyping(true);

  // Procesar la respuesta PRIMERO (antes de calcular el delay)
  const respuesta = await _procesarTexto(texto);

  // Calcular delay natural: más largo el texto, más tarda en "escribirlo"
  const longitud = respuesta ? respuesta.length : 0;
  const delay = Math.min(TYPING_BASE + longitud * TYPING_POR_CHAR, TYPING_MAX);

  // Esperar ese tiempo con el typing visible, luego mostrar respuesta
  setTimeout(() => {
    _mostrarTyping(false);
    if (respuesta) {
      _mostrarVictoria(respuesta);
      _registrarTurno("victoria", respuesta);
    }
    _actualizarProgreso();
    _scrollAbajo();
    _inputEl?.focus();

    // Si debe mostrar botones de ramificación tras el mensaje principal
    if (state.mostrar_ramificacion_tras_protocolo) {
      state.mostrar_ramificacion_tras_protocolo = false; // consumir flag
      _mostrarBotonesRamificacion();
    }

    // (flag legacy — ya no se activa en v2.0 pero se mantiene por compatibilidad)
    if (state.mostrar_precio_tras_protocolo) {
      state.mostrar_precio_tras_protocolo = false;
      _mostrarPrecioYBotonesAgenda();
    }
  }, delay);
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
      <img src="${VICTORIA_AVATAR}" alt="Victoria">
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

  // Para la agenda, scrollear al INICIO del widget (no al final)
  // así el usuario ve "Lun X may" arriba del todo y puede elegir con calma
  if (className.includes("agenda-widget")) {
    setTimeout(() => {
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  } else {
    _scrollAbajo();
  }

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
  // El body es quien scrollea, no el .chat — usar window.scrollTo
  setTimeout(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  }, 50);
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
  // ── INTERCEPTOR: desescalada tras derivación ──
  // Si el último turno de Victoria fue una derivación al etólogo y el cliente
  // matiza ("en realidad no muerde", "solo marca"...), recalculamos desde cero
  // el cuadro con el contexto actualizado. La gente exagera al describir al
  // principio — hay que permitir corregir.
  if (_esDesescaladaTrasDerivacion(texto)) {
    return _recalcularTrasDesescalada(texto);
  }

  // ── INTERCEPTOR: cierre elegante tras derivación al etólogo ──
  // Si Victoria ya derivó al etólogo y el cliente responde cualquier cosa
  // (que no sea desescalada, ya interceptada arriba), damos un mensaje cálido
  // de cierre y bloqueamos el input. Evita el efecto robótico de repetir
  // el mensaje largo de derivación.
  if (_esPostDerivacionEtologo()) {
    setTimeout(() => { _insertarCierrePostDerivacion(); }, 3500);
    return "Gracias a ti por confiar en nosotros. Cualquier duda que te surja en el proceso, " +
      "en Perros de la Isla estamos a tu disposición. Mucho ánimo con tu perro.";
  }

  const procesadores = {
    s1:  _procesarS1_Zona,
    s2:  _procesarS2_NombrePerro,
    s3:  _procesarS3_DatosPerro,
    s4:  _procesarS4_Problema,
    s5:  _procesarGravedadMordida,
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
  // Prescan del primer mensaje — si tiene contenido, extrae todo lo que pueda
  // (zona, raza, edad, peso, ppp, problema) para no re-preguntar después.
  _prescanPrimerMensaje(texto);

  // Si el prescan ya detectó la zona, saltamos s1 directamente
  if (state.zona && !state.zona.necesitaAclaracion) {
    state.current_step = "s2";
    return "Perfecto, gracias por el detalle. ¿Cómo se llama tu perro?";
  }

  // Si no hay zona en prescan, seguir flujo normal: detectar en este texto
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
  // Si el prescan ya llenó todos los datos, saltamos s3 completo y vamos a s4.
  // Esto pasa cuando el cliente escribe un mini-ensayo con raza+edad+peso en
  // el primer mensaje.
  const yaTieneEdad = state.perro.edad_meses !== null;
  const yaTienePeso = state.perro.peso_kg !== null;
  const yaTieneRaza = state.perro.raza !== null;

  if (yaTieneEdad && yaTienePeso && yaTieneRaza) {
    // Guardar este texto como parte del diagnóstico (puede describir el problema)
    state.mensajes_diagnostico.push(texto);
    state.current_step = "s4";
    return `Perfecto. Cuéntame, ¿qué te gustaría mejorar o trabajar con ${state.perro.nombre}? ` +
      "Descríbeme la situación con tus propias palabras.";
  }

  // Flujo normal: extraer lo que se pueda del texto actual
  const edad = _extraerEdad(texto);
  const peso = _extraerPeso(texto);
  const raza = _extraerRaza(texto);

  if (edad !== null) state.perro.edad_meses = edad;
  if (peso !== null) state.perro.peso_kg    = peso;
  if (raza !== null) state.perro.raza       = raza;

  state.perro.es_ppp = esPPP(texto);

  const faltaEdad = state.perro.edad_meses === null;
  const faltaPeso = state.perro.peso_kg    === null;

  if (faltaEdad) {
    state.s3_intentos++;
    if (state.s3_intentos === 1) {
      return `¿Qué edad tiene ${state.perro.nombre}? Con meses si es cachorro, o años si es adulto.`;
    }
    if (state.s3_intentos === 2) {
      return `Perdona, no he sabido leerlo bien. Dímelo con números si puedes — por ejemplo "3 años" o "8 meses".`;
    }
    state.perro.edad_meses = 24;
  }

  if (faltaPeso && state.s3_intentos <= 1) {
    state.s3_intentos++;
    return `¿Y cuánto pesa ${state.perro.nombre} aproximadamente? Un número aproximado me vale — por ejemplo "12 kilos".`;
  }

  if (state.perro.peso_kg    === null) state.perro.peso_kg    = 15;
  if (state.perro.edad_meses === null) state.perro.edad_meses = 24;
  if (state.perro.raza       === null) state.perro.raza       = "mestizo";

  state.current_step = "s4";
  return `Perfecto. Cuéntame, ¿qué te gustaría mejorar o trabajar con ${state.perro.nombre}? ` +
    "Descríbeme la situación con tus propias palabras.";
}

function _procesarS4_Problema(texto) {
  // Si había mensaje inicial largo (prescan), incluirlo en el diagnóstico
  // — una sola vez, marcándolo como ya consumido.
  if (state.prescan_mensaje_inicial) {
    state.mensajes_diagnostico.unshift(state.prescan_mensaje_inicial);
    state.prescan_mensaje_inicial = null; // consumir para no duplicar
  }

  state.mensajes_diagnostico.push(texto);

  const lateral = detectarLateral(texto);
  if (lateral) state.lateral_detectado = lateral;

  return _evaluarYResponder(texto);
}

function _procesarGravedadMordida(texto) {
  state.mensajes_diagnostico.push(texto);
  state.s5_intentos++;

  const norm = normalizar(texto);

  // LEVE se evalúa PRIMERO — si hay negaciones claras gana, aunque mencione palabras como "marca"
  const esLeve = [
    "apenas toco", "apenas roza", "apenas tocó", "casi ni toca",
    "sin marca", "ni marca", "no dejo marca", "no dejó marca", "no deja marca",
    "sin sangre", "no hubo sangre", "no sangró", "no sangro",
    "sin herida", "sin lesión", "sin lesion", "no hubo lesión", "no hubo lesion",
    "sin contacto", "no hubo contacto", "no llegó a morder", "no llego a morder",
    "ni siquiera llegó", "ni siquiera llego",
    "leve", "no es grave", "no fue grave", "no es nada grave",
    "solo gruñe", "solo gruño", "solo gruñido", "solo ladra",
    "solo amaga", "solo amenaza", "amago",
    "sin consecuencias", "nada grave",
  ].some(kw => norm.includes(normalizar(kw)));

  // GRAVE solo si hay indicadores claros de lesión — quita "marca" suelta (ambigua)
  const esGrave = [
    "grave", "muy grave",
    "lesión", "lesion",
    "sangre", "sangró", "sangro",
    "puntos", "puntos de sutura", "sutura",
    "herida", "herida profunda",
    "urgencias", "médico", "medico", "hospital",
    "hematoma", "moratón", "moraton",
    "dejó marca", "quedó marca", "dejó marcas", "hay marca",
    "mordisco fuerte", "mordida fuerte",
  ].some(kw => norm.includes(normalizar(kw)));

  if (esLeve) {
    state.gravedad_mordida = "leve";
  } else if (esGrave) {
    state.gravedad_mordida = "grave";
  } else if (state.s5_intentos >= 2) {
    // Tras 2 intentos ambiguos, asumir grave por precaución si perro >10kg o PPP
    const esGrande = (state.perro.peso_kg ?? 0) > 10;
    const esPPP    = state.perro.es_ppp ?? false;
    state.gravedad_mordida = (esGrande || esPPP) ? "grave" : "leve";
  } else {
    // Primer intento ambiguo → repregunta
    return "Para orientarte bien, necesito saber si hubo contacto real de los dientes y si dejó alguna marca " +
      "(enrojecimiento, hematoma, sangre). Cuéntame con un poco más de detalle.";
  }

  state.pending = null;
  return _evaluarYResponder(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DE OPCIONES — inline dentro del chat
// ─────────────────────────────────────────────────────────────────────────────

function _mostrarOpciones(opciones) {
  if (!_chatEl || !_twEl) return;
  _ocultarOpciones();

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

const KEYWORDS_AFIRMATIVO = [
  "sí", "si", "ok", "okay", "vale", "perfecto", "adelante",
  "me interesa", "quiero", "me apunto", "venga", "dale",
  "bien", "muy bien", "suena bien", "me parece bien",
  "genial", "estupendo", "claro", "por supuesto",
  "yep", "yes", "ver horarios", "ver horario",
];

const KEYWORDS_DURACION = [
  "cuantas clases", "cuántas clases",
  "cuantas sesiones", "cuántas sesiones",
  "cuantas veces", "cuántas veces",
  "numero de clases", "número de clases",
  "numero de sesiones", "número de sesiones",
  "cuanto dura", "cuánto dura",
  "duracion", "duración",
  "cuanto tiempo", "cuánto tiempo",
  "cuantos meses", "cuántos meses",
  "cuantas semanas", "cuántas semanas",
];

const KEYWORDS_UBICACION = [
  "donde se hace", "dónde se hace",
  "donde son", "dónde son",
  "donde es", "dónde es",
  "en que sitio", "en qué sitio",
  "en casa", "a domicilio",
  "en mi casa",
  "vais a casa", "venís a casa",
  "tengo que ir", "hay que ir",
  "donde se dan", "dónde se dan",
  "donde hacen", "dónde hacen",
  "lugar de las clases",
  "se realizan", "realizan",
  "se imparten",
  "donde vamos", "dónde vamos",
  "a donde voy", "a dónde voy",
  "tengo que desplazarme", "me desplazo",
  "os desplazais", "os desplazáis",
  "viene a casa",
];

const KEYWORDS_PRECIO = [
  "cuanto cuesta", "cuánto cuesta",
  "cuanto vale", "cuánto vale",
  "que precio", "qué precio",
  "cual es el precio", "cuál es el precio",
  "cual es el valor", "cuál es el valor",
  "precio de la sesion", "precio de la sesión",
  "precio de la clase",
  "valor de la clase", "valor de la sesion", "valor de la sesión",
  "que cuesta", "qué cuesta",
  "cuanto es", "cuánto es",
  "precios", "tarifa", "tarifas",
  "coste", "costo",
];

const KEYWORDS_PACK = [
  "pack", "paquete", "bono",
  "descuento", "oferta", "rebaja",
  "mas barato", "más barato",
  "mejor precio", "ahorro",
  "hay algun descuento", "hay algún descuento",
  "bonos", "packs",
];

const KEYWORDS_PRECIO_POR_PERRO = [
  "es por perro", "por perro",
  "precio por perro", "valor por perro",
  "cobran por perro", "cobras por perro",
  "cada perro", "por cada perro",
  "tengo dos perros", "tengo 2 perros",
  "tengo tres perros", "tengo 3 perros",
  "tengo varios perros", "tengo mas de un perro", "tengo más de un perro",
  "mis perros", "mis dos perros",
  "son dos perros", "son 2 perros",
];

const KEYWORDS_MATERIALES = [
  "que llevo", "qué llevo",
  "que tengo que llevar", "qué tengo que llevar",
  "tengo que llevar",
  "llevar algo", "traer algo",
  "que necesito", "qué necesito",
  "necesito algo", "necesito llevar", "necesito preparar",
  "que debo tener", "qué debo tener",
  "que preparo", "qué preparo",
  "hace falta algo", "hace falta que lleve", "hace falta preparar",
  "materiales", "material",
  "herramientas",
  "tengo que tener algo", "hay que tener algo",
  "algo especial", "cosa especial",
  "tengo que comprar", "hay que comprar",
  "que me compro", "qué me compro",
  "llevar comida", "llevar premios",
  "necesito collar", "necesito arnés", "necesito arnes",
  "necesito correa",
];

// ─────────────────────────────────────────────────────────────────────────────
// DESESCALADA — cuando el cliente matiza que exageró al describir
// Usado tras una derivación al etólogo para permitir recalcular
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORDS_DESESCALADA = [
  "en realidad no muerde",
  "en realidad no es",
  "en realidad solo",
  "no es mordida",
  "no es una mordida",
  "no fue mordida",
  "no fue una mordida",
  "no llega a morder",
  "no llega a morderme",
  "no llegó a morder",
  "no llegó a lastimar",
  "no lastima",
  "no lastimó",
  "no hace daño",
  "no hizo daño",
  "no dejó marca",
  "no deja marca",
  "sin marca",
  "no ha mordido",
  "solo marca",
  "solo gruñe",
  "solo ladra",
  "solo avisa",
  "solo amaga",
  "solo amenaza",
  "solo enseña los dientes",
  "solo muestra los dientes",
  "exageré",
  "exagere",
  "exageramos",
  "no fue tanto",
  "no es tan grave",
  "no es para tanto",
  "quizá exageré",
  "quizas exagere",
  "tal vez exageré",
];

async function _procesarS6_Protocolo(texto) {
  const norm = normalizar(texto);
  const match = (lista) => lista.some((kw) => norm.includes(normalizar(kw)));

  // ORDEN de matching IMPORTANTE — primero keywords específicas, afirmativo al final

  // 1. Precio por perro
  if (match(KEYWORDS_PRECIO_POR_PERRO)) {
    _mostrarBotonesAgendaTrasPausa();
    return FRASE_PRECIO_POR_PERRO;
  }

  // 2. Pack / descuentos
  if (match(KEYWORDS_PACK)) {
    const modalidad = state.modalidad_final === "online" ? "online" : "presencial";
    _mostrarBotonesAgendaTrasPausa();
    return FRASES_PACK[modalidad];
  }

  // 3. Precio / valor
  if (match(KEYWORDS_PRECIO)) {
    let clave = "sin_modalidad";
    if (state.modalidad_final === "online")          clave = "online";
    else if (state.modalidad_final === "presencial") clave = "presencial";
    _mostrarBotonesAgendaTrasPausa();
    return FRASES_PRECIO[clave];
  }

  // 4. Duración / número de clases
  if (match(KEYWORDS_DURACION)) {
    _mostrarBotonesAgendaTrasPausa();
    const perro = state.perro.nombre ?? null;
    return obtenerFrase({ tipo: "duracion", vars: { perro } });
  }

  // 5. Ubicación / dónde se hacen las clases
  if (match(KEYWORDS_UBICACION)) {
    let respuesta;
    if (state.modalidad_final === "online") {
      respuesta = "Las clases online se hacen por Google Meet — solo necesitas un ordenador o móvil con cámara. " +
        "Te enviamos el enlace antes de cada clase y la hacemos desde donde te venga bien.";
    } else {
      respuesta = "Las clases presenciales se hacen en tu domicilio — es donde el perro vive su día a día y " +
        "donde podemos observar con más criterio el comportamiento en su contexto real. " +
        "El adiestrador se desplaza a tu casa.";
    }
    _mostrarBotonesAgendaTrasPausa();
    return respuesta;
  }

  // 6. Materiales / qué llevar
  if (match(KEYWORDS_MATERIALES)) {
    const perro = state.perro.nombre ?? "tu perro";
    _mostrarBotonesAgendaTrasPausa();
    return `Para la primera clase no hace falta que prepares nada especial — el adiestrador te cuenta en ese momento qué vamos a ir usando según el caso de ${perro}. Lo único que sí conviene tener a mano es su comida habitual y algunos premios que le gusten mucho (trocitos de salchicha, queso, pollo hervido, o premios comerciales que suela disfrutar). Eso es todo.`;
  }

  // 7. Afirmativo corto → agenda (AL FINAL para que no se coma "quiero los precios")
  const esAfirmativo = texto.length < 40 && match(KEYWORDS_AFIRMATIVO);
  if (esAfirmativo) {
    state.current_step = "s7";
    return await _iniciarAgenda();
  }

  // 8. Nada matcheó → pedir WhatsApp al cliente (NUNCA dar el 622 sin seña pagada)
  _mostrarBotonPedirWhatsApp();
  return "Para esa pregunta prefiero que alguien del equipo te contacte directamente y lo habléis con calma. " +
    "¿Me puedes dejar tu WhatsApp? En cuanto me lo pases, nos ponemos en contacto contigo. " +
    "Si prefieres, también puedes seguir aquí y ver los horarios disponibles.";
}

/**
 * Muestra los botones de ramificación tras el mensaje principal:
 * - "Cómo son las clases" → metodología + cierre → precio + agenda
 * - "Ver precios" → precio + agenda directamente
 */
function _mostrarBotonesRamificacion() {
  setTimeout(() => {
    _mostrarOpciones([
      {
        label: "Cómo son las clases",
        onClick: () => {
          _mostrarCliente("Cómo son las clases");
          _registrarTurno("cliente", "Cómo son las clases");
          _mostrarTyping(true);
          setTimeout(() => {
            _mostrarTyping(false);
            const modalidad = state.modalidad_final === "online" ? "online" : "presencial";
            const perro = state.perro.nombre ?? null;
            const frase = obtenerFrase({
              tipo: "como_trabajamos",
              vars: { perro, modalidad },
            });
            _mostrarVictoria(frase);
            _registrarTurno("victoria", frase);
            _actualizarProgreso();

            // Tras la metodología → cierre + botones
            setTimeout(() => {
              _mostrarTyping(true);
              setTimeout(() => {
                _mostrarTyping(false);
                const cierre = obtenerFrase({ tipo: "cierre_metodologia" });
                _mostrarVictoria(cierre);
                _registrarTurno("victoria", cierre);

                setTimeout(() => {
                  _mostrarOpciones([
                    {
                      label: "Sí, ver precios y horarios",
                      onClick: () => {
                        _mostrarCliente("Sí, ver precios y horarios");
                        _registrarTurno("cliente", "Sí, ver precios y horarios");
                        _mostrarPrecioYBotonesAgenda();
                      },
                    },
                    {
                      label: "Tengo otra pregunta",
                      onClick: () => {
                        _mostrarCliente("Tengo otra pregunta");
                        _registrarTurno("cliente", "Tengo otra pregunta");
                        const msg = "Claro, dime.";
                        _mostrarVictoria(msg);
                        _registrarTurno("victoria", msg);
                      },
                    },
                  ]);
                }, 200);
              }, 1200);
            }, 3000);
          }, TYPING_DELAY);
        },
      },
      {
        label: "Ver precios",
        onClick: () => {
          _mostrarCliente("Ver precios");
          _registrarTurno("cliente", "Ver precios");
          _mostrarPrecioYBotonesAgenda();
        },
      },
    ]);
  }, 4500);
}

function _mostrarBotonPedirWhatsApp() {
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
        label: "Dejar mi WhatsApp para que me contacten",
        onClick: () => {
          _mostrarCliente("Dejar mi WhatsApp");
          _registrarTurno("cliente", "Dejar mi WhatsApp");
          const msg = "Genial. Escríbeme tu número de WhatsApp y el equipo de Perros de la Isla te contactará en cuanto pueda.";
          _mostrarVictoria(msg);
          _registrarTurno("victoria", msg);
        },
      },
    ]);
  }, 4500);
}

function _mostrarBotonesAgendaTrasPausa() {
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
        label: "Tengo otra pregunta",
        onClick: () => {
          _mostrarCliente("Tengo otra pregunta");
          _registrarTurno("cliente", "Tengo otra pregunta");
          const msg = "Claro, dime.";
          _mostrarVictoria(msg);
          _registrarTurno("victoria", msg);
        },
      },
    ]);
  }, 4500);
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
    return "¿Y tu número de teléfono? Para que el equipo pueda contactarte si hace falta.";
  }

  if (state.modalidad_final === "online" && !state.cliente.email) {
    return "Como la sesión es por Google Meet, necesito también tu email " +
      "para enviarte el enlace de la videollamada.";
  }
  const email = _extraerEmail(texto);
  if (email) state.cliente.email = email;

  state.current_step = "s10";
  // Programar el widget de pago para que aparezca DESPUÉS del mensaje explicativo.
  // Secuencia: mensaje Victoria → pausa con typing → widget de pago.
  // El delay de 4500ms asegura que el mensaje se ha pintado completamente
  // antes de empezar a mostrar el typing indicator del widget.
  setTimeout(() => {
    _mostrarTyping(true);
    setTimeout(() => {
      _mostrarTyping(false);
      _iniciarPago();
    }, 1000);
  }, 3500);
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
  // Guard: si la cita ya se confirmó en una ejecución previa, no re-ejecutar
  // el guardado en Supabase ni la notificación ntfy. Devolver null para no
  // insertar otra burbuja de respuesta.
  if (state.cita_confirmada) {
    return null;
  }

  try {
    await _guardarCitaEnSupabase();
    await _notificarCarlos();
    state.cita_confirmada = true;
    setTimeout(() => { _insertarCierre(); }, 3500);

    const perro    = state.perro.nombre ?? "tu perro";
    const slot     = state.slot_elegido;
    const modalidad = state.modalidad_final === "online"
      ? "online por Google Meet"
      : "en tu domicilio";

    return `¡Todo confirmado! 🐾 El equipo de Perros de la Isla se pondrá en contacto contigo para preparar la primera sesión. ` +
      `Quedamos el ${slot?.label ?? "día acordado"}, ${modalidad}. ` +
      `Si necesitas cambiar algo, escríbenos directamente al 622 922 173. ` +
      `¡Mucho ánimo con ${perro}!`;
  } catch (err) {
    console.error("Error al confirmar cita:", err);
    return "Ha habido un problema técnico al confirmar la cita. " +
      "Por favor, escribe directamente al equipo de Perros de la Isla al 622 922 173 y lo gestionamos enseguida.";
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

  await renderAgenda(
    contenedor,
    (slotElegido) => {
      if (state.slot_confirmando) return;
      state.slot_confirmando = true;

      state.slot_elegido = slotElegido;
      state.current_step = "s8";

      _mostrarTyping(true);
      setTimeout(() => {
        _mostrarTyping(false);
        const msg = `Has elegido el ${slotElegido.label}. ¿Confirmamos este horario?`;
        _registrarTurno("victoria", msg);
        _mostrarVictoria(msg);
        _actualizarProgreso();
        state.slot_confirmando = false;
      }, 800);
    },
    () => {
      // Reservado para futuras ampliaciones
    }
  );

  return null;
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
      state.metodo_pago                = metodo;
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

function _mensajePrecio() {
  if (state.modalidad_final === "online") {
    return "Antes de seguir te cuento los detalles prácticos: el valor de la clase online es de 75€. " +
      "También tenemos un pack de 4 clases por 240€ — ahorras 60€ y es lo que solemos recomendar para que el trabajo sea consistente. " +
      "Puedes decidir pack o clase suelta cuando conozcas al adiestrador en la primera sesión, no hace falta elegir ahora. " +
      "Para reservar la cita se pide una seña de 45€ por Bizum o transferencia, que se descuenta del total. " +
      "Si necesitas cancelar o cambiar la cita, sin problema siempre que sea con 48h de antelación.";
  }
  return "Antes de seguir te cuento los detalles prácticos: el valor de la clase presencial es de 90€. " +
    "También tenemos un pack de 4 clases por 300€ — ahorras 60€ y es lo que solemos recomendar para que el trabajo sea consistente. " +
    "Puedes decidir pack o clase suelta cuando conozcas al adiestrador en la primera sesión, no hace falta elegir ahora. " +
    "Para reservar la cita se pide una seña de 45€ por Bizum o transferencia, que se descuenta del total. " +
    "Si necesitas cancelar o cambiar la cita, sin problema siempre que sea con 48h de antelación.";
}

function _mostrarPrecioYBotonesAgenda() {
  setTimeout(() => {
    _mostrarTyping(true);

    setTimeout(() => {
      _mostrarTyping(false);
      const msgPrecio = _mensajePrecio();
      _mostrarVictoria(msgPrecio);
      _registrarTurno("victoria", msgPrecio);

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
      }, 200);
    }, 1500);
  }, 800);
}

function _explicarPago() {
  return "Perfecto, vamos a confirmar la cita. La seña es de 45€ por Bizum o transferencia " +
    "y se descuenta del total. Ahora te paso las opciones de pago.";
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO MATCHING
// ─────────────────────────────────────────────────────────────────────────────

function _evaluarYResponder(textoActual) {
  const contexto = _construirContexto(textoActual);
  const decision = decidirRespuesta(contexto);

  if (decision.pending_next !== undefined)       state.pending = decision.pending_next;
  if (decision.cuadro_pendiente_mordida)         state.cuadro_pendiente_mordida = decision.cuadro_pendiente_mordida;
  if (decision.bandera_edad_temprana)            state.bandera_edad_temprana = true;

  state.decision_actual    = decision;
  state.log_matching_final = decision.log;

  // Determinar modalidad_final desde frase_params o vars
  if (decision.frase_params?.vars?.modalidad) {
    state.modalidad_final = decision.frase_params.vars.modalidad;
  } else if (decision.frase_params?.modalidad) {
    state.modalidad_final = decision.frase_params.modalidad;
  } else if (["zona", "son_gotleu"].includes(decision.frase_params?.tipo)) {
    state.modalidad_final = "derivar";
  }

  switch (decision.accion) {
    case "responder": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("frase null: " + JSON.stringify(decision.frase_params));

      // Mensaje principal unificado → avanzar a s6 y mostrar botones de ramificación
      if (decision.frase_params.tipo === "mensaje_principal") {
        state.protocolo_ya_presentado = true;
        state.current_step = "s6";
        // Flag: _enviarMensaje mostrará botones de ramificación DESPUÉS del mensaje
        state.mostrar_ramificacion_tras_protocolo = true;
        return frase;
      }

      return frase;
    }

    case "derivar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("frase null: " + JSON.stringify(decision.frase_params));
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

  return {
    perro:    { ...state.perro },
    zona:     state.zona,
    cuadros:  [],  // ya no se usa en el matching simplificado
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
// ─────────────────────────────────────────────────────────────────────────────

async function _guardarCitaEnSupabase() {
  const clienteRes = await _supabasePost("/rest/v1/clientes", {
    nombre:   state.cliente.nombre,
    telefono: state.cliente.telefono,
    email:    state.cliente.email,
  });
  const clienteId = clienteRes?.id ?? null;

  const perroRes = await _supabasePost("/rest/v1/perros", {
    nombre:     state.perro.nombre,
    raza:       state.perro.raza,
    edad_meses: state.perro.edad_meses,
    peso_kg:    state.perro.peso_kg,
    es_ppp:     state.perro.es_ppp,
    cliente_id: clienteId,
  });
  const perroId = perroRes?.id ?? null;

  const decision = state.decision_actual;
  const cuadros  = decision?.cuadros_originales ??
    (decision?.cuadro_ganador ? [decision.cuadro_ganador] : []);

  const slot = state.slot_elegido;
  const fechaCita = slot?.fecha ?? null;
  const horaCita  = slot?.hora  ?? null;

  const citaRes = await _supabasePost("/rest/v1/citas", {
    cliente_id:              clienteId,
    fecha:                   fechaCita,
    hora:                    horaCita,
    estado:                  "confirmada",
    sena_pagada:             !state.pago_pendiente_verificar,
    metodo_pago:             state.metodo_pago ?? null,
    comprobante_url:         state.comprobante_url,
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

  await _supabasePost("/rest/v1/conversaciones", {
    cita_id:      state.cita_id,
    turnos:       state.historial_turnos,
    log_matching: state.log_matching_final,
  });
}

// Mapa cuadro interno → nombre humano + duración estimada
// Separación y generalizada comparten nombre comercial "Gestión de ansiedad"
const PROTOCOLO_HUMANO = {
  separacion:   "Gestión de ansiedad · 8-12 clases",
  generalizada: "Gestión de ansiedad · 8-12 clases",
  miedos:       "Miedos/fobias · 8-12 clases",
  reactividad:  "Reactividad · 4-12 clases",
  posesion:     "Posesión de recursos · 4-8 clases",
  basica:       "Educación básica · 4 clases",
  cachorros:    "Educación de cachorros · 4 clases",
};

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
  if (state.tema_preseleccionado)     flags.push(`📲 Viene de app paseos · botón: ${state.tema_preseleccionado}`);
  const flagsTexto = flags.length ? flags.map((f) => `   ${f}`).join("\n") : "   Sin flags";

  // Nombre humano del protocolo recomendado (usa el primer cuadro detectado)
  const cuadroPrincipal = cuadros[0] ?? null;
  const protocoloHumano = cuadroPrincipal && PROTOCOLO_HUMANO[cuadroPrincipal]
    ? PROTOCOLO_HUMANO[cuadroPrincipal]
    : "No identificado";

  // Resumen del problema reportado: primeros 2 mensajes de s4+s5 del cliente,
  // truncado para que la notificación no sea gigante
  const mensajesCliente = state.mensajes_diagnostico ?? [];
  const reportadoTexto = mensajesCliente.slice(0, 2).join(" · ").slice(0, 400) ||
    "Sin texto del cliente";

  // Mensaje listo para copiar-pegar y enviar al cliente por WhatsApp
  // Charly lo envía manualmente tras verificar que el Bizum/transferencia llegó
  const primerNombre = (c.nombre ?? "").split(" ")[0] || "hola";
  const nombrePerro  = p.nombre ?? "tu perro";
  const razaPerro    = p.raza   ?? "";
  const perroTexto   = razaPerro ? `${nombrePerro} (${razaPerro})` : nombrePerro;
  const slotLabel    = slot?.label ?? "—";
  const modalidadTexto = state.modalidad_final === "online"
    ? "online por Google Meet"
    : "presencial · en tu domicilio";

  const mensajeCliente = [
    `¡Hola ${primerNombre}! 🐾`,
    "",
    "Soy Carlos, de Perros de la Isla. Te confirmo que hemos recibido la seña de 45€ y tu cita está reservada.",
    "",
    `📅 Día y hora: ${slotLabel}`,
    `🐕 Perro: ${perroTexto}`,
    `🎯 Protocolo: ${protocoloHumano}`,
    `📍 Modalidad: ${modalidadTexto}`,
    "",
    "Cómo trabajamos:",
    "",
    "La clase dura 1 hora y puede extenderse un poco si hace falta — priorizamos que entiendas todo lo que vemos, no cerrar la sesión a toque de reloj.",
    "",
    "Entre clases tienes consultas por WhatsApp con el adiestrador. Te enviamos videos de referencia para que tengas claro cómo practicar, y puedes mandarnos videos tuyos entrenando para que te vayamos corrigiendo. Así cada clase avanza sobre la anterior y aprovechamos al máximo el trabajo.",
    "",
    "Si necesitas cambiar o cancelar algo, avísame con 48h de antelación y lo reorganizamos sin problema.",
    "",
    "Cualquier duda hasta entonces, aquí estoy.",
    "",
    "Un abrazo,",
    "Carlos",
    "Perros de la Isla 🐾",
  ].join("\n");

  const mensaje = [
    "[NUEVA CITA CONFIRMADA 🐾]",
    "",
    `👤 Cliente: ${c.nombre ?? "—"} · ${c.telefono ?? "—"}`,
    `📧 Email: ${c.email ?? (state.modalidad_final === "online" ? "⚠️ FALTA" : "no requerido")}`,
    "",
    `🐕 Perro: ${p.nombre ?? "—"} · ${p.raza ?? "—"} · ${edadTexto} · ${p.peso_kg ?? "—"}kg`,
    `📍 Zona: ${state.zona?.zonaDetectada ?? "—"} · Modalidad: ${state.modalidad_final ?? "—"}`,
    "",
    `🧠 Protocolo: ${protocoloHumano}`,
    `   Cuadro(s) internos: ${cuadros.join(" + ")}`,
    `   Flags:\n${flagsTexto}`,
    "",
    `📝 Reportado por el cliente:`,
    `   "${reportadoTexto}"`,
    "",
    `📅 Slot: ${slot?.label ?? "—"}`,
    `💰 Seña: 45€ ${state.pago_pendiente_verificar ? "PENDIENTE DE VERIFICAR" : "confirmada"}`,
    state.comprobante_url ? `📎 Comprobante: ${state.comprobante_url}` : "📎 Comprobante: no subido",
    "",
    `[Paso ${d?.log?.paso ?? "?"} | ${d?.log?.notas ?? ""}]`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━",
    "📱 MENSAJE PARA EL CLIENTE (copiar y enviar por WhatsApp):",
    "━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    mensajeCliente,
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

const NUMEROS_PALABRA = {
  "un": "1", "una": "1", "uno": "1",
  "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
  "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
  "diez": "10", "once": "11", "doce": "12", "trece": "13",
  "catorce": "14", "quince": "15",
};

function _normalizarNumeros(texto) {
  let t = texto.toLowerCase();
  for (const [palabra, digito] of Object.entries(NUMEROS_PALABRA)) {
    t = t.replace(new RegExp(`\\b${palabra}\\b`, "gi"), digito);
  }
  return t;
}

function _extraerEdad(texto) {
  const t = _normalizarNumeros(texto);

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
  // Detecta: 4kg, 4 kg, 4 kilos, 4 kilo, 4 klos, 4 quilos, 4 kilogramos, 4k (como sufijo)
  const kg = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogramos?|kilos?|kilo|klos|klo|quilos?|quilo|k)\b/i);
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

/**
 * Prescan del primer mensaje del cliente. Se ejecuta una única vez cuando el
 * mensaje tiene suficiente contenido como para que valga la pena escanearlo
 * (>60 caracteres). Intenta extraer todo lo que ya pueda saberse del mensaje
 * inicial, para que Victoria no pregunte datos que el cliente ya dio.
 *
 * Rellena el state con lo que encuentre. NO avanza el paso — eso lo hace cada
 * procesador al ver que ya tiene su dato.
 *
 * Lo que intenta extraer:
 * - Zona (usando detectarZona)
 * - Raza (usando _extraerRaza)
 * - Edad en meses (usando _extraerEdad)
 * - Peso en kg (usando _extraerPeso)
 * - Flag es_ppp (usando esPPP)
 * - Problema descriptivo: si el mensaje tiene >60 chars, se considera que
 *   contiene descripción del problema y se guarda en mensajes_diagnostico
 *   para que el matcher lo evalúe.
 *
 * Lo que NO extrae:
 * - Nombre del perro (ambiguo, mejor pedirlo siempre).
 */
function _prescanPrimerMensaje(texto) {
  if (!texto || texto.length < 60) return;

  // Zona
  const zonaDetectada = detectarZona(texto);
  if (zonaDetectada && !zonaDetectada.necesitaAclaracion) {
    state.zona = zonaDetectada;
  }

  // Raza
  const raza = _extraerRaza(texto);
  if (raza !== null) state.perro.raza = raza;

  // Edad
  const edad = _extraerEdad(texto);
  if (edad !== null) state.perro.edad_meses = edad;

  // Peso
  const peso = _extraerPeso(texto);
  if (peso !== null) state.perro.peso_kg = peso;

  // PPP
  state.perro.es_ppp = esPPP(texto);

  // Problema: si el mensaje es descriptivo, guardarlo para el matcher
  // (se añadirá como contexto cuando evaluemos en s4)
  state.prescan_mensaje_inicial = texto;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function _registrarTurno(rol, texto) {
  state.historial_turnos.push({ rol, texto, timestamp: new Date().toISOString() });
}

function _fallbackHumano(razon) {
  console.warn("Victoria fallback:", razon);
  return "Para poder orientarte bien, te paso directamente con el equipo de Perros de la Isla. " +
    "Puedes escribirnos por WhatsApp al 622 922 173.";
}

function _insertarCierre() {
  if (!_chatEl || !_twEl) return;
  // Evitar duplicados
  if (document.getElementById("chat-cierre-inyectado")) return;

  const cierre = document.createElement("div");
  cierre.id = "chat-cierre-inyectado";
  cierre.className = "chat-cierre";
  cierre.innerHTML = `
    <p class="chat-cierre-lema">Tu perro<br>merece ser feliz, hoy</p>
    <div class="chat-cierre-botones">
      <button class="chat-cierre-btn ig" onclick="window.open('https://www.instagram.com/perrosdelaisla/', '_blank')">Instagram</button>
      <button class="chat-cierre-btn web" onclick="window.open('https://www.perrosdelaisla.com/', '_blank')">Web</button>
    </div>
  `;
  _chatEl.insertBefore(cierre, _twEl);

  // Bloquear input y botón de enviar — la conversación ya está cerrada
  if (_inputEl) {
    _inputEl.disabled = true;
    _inputEl.placeholder = "Conversación finalizada";
    _inputEl.blur();
  }
  if (_sendEl) {
    _sendEl.disabled = true;
  }
  // Ocultar visualmente el wrap del input
  const inputWrap = document.getElementById("victoria-input-wrap");
  if (inputWrap) {
    inputWrap.style.opacity = "0.4";
    inputWrap.style.pointerEvents = "none";
  }

  _scrollAbajo();
}

/**
 * Detecta si el cliente está matizando ("en realidad no muerde") justo
 * después de que Victoria haya derivado al etólogo. Esto permite recalcular
 * el cuadro con la info corregida — la gente tiende a exagerar al principio.
 */
function _esDesescaladaTrasDerivacion(texto) {
  // Solo aplica si la decisión anterior fue una derivación al etólogo
  const decisionPrevia = state.decision_actual;
  if (!decisionPrevia) return false;
  if (decisionPrevia.accion !== "derivar") return false;
  if (decisionPrevia.frase_params?.tipo !== "etologo") return false;

  // Buscar keywords de desescalada en el texto nuevo
  const textoNorm = normalizar(texto);
  return KEYWORDS_DESESCALADA.some((kw) => textoNorm.includes(normalizar(kw)));
}

/**
 * Reevalúa el cuadro tras detectar desescalada. Añade el mensaje corrector
 * al contexto de diagnóstico y vuelve a llamar al matching. Si tras recalcular
 * sigue sin haber cuadro claro, pide al cliente su WhatsApp para que el equipo
 * le contacte (NUNCA dar el WhatsApp de PDLI en fallback).
 */
function _recalcularTrasDesescalada(texto) {
  // Añadir el mensaje al contexto de diagnóstico para que el matcher lo considere
  state.mensajes_diagnostico.push(texto);

  // Resetear la decisión previa para que el matching empiece limpio
  state.decision_actual          = null;
  state.cuadro_pendiente_mordida = null;
  state.gravedad_mordida         = null;
  state.pending                  = null;

  // Volver al paso 4 — reprocessar el problema como si fuera la primera vez
  state.current_step = "s4";

  // Reevaluar con el contexto actualizado
  const respuesta = _evaluarYResponder(texto);

  // Si el matching devuelve fallback, sustituir por la versión "pide WhatsApp"
  // en lugar de "te damos el WhatsApp de PDLI"
  if (state.decision_actual?.accion === "fallback") {
    return "Gracias por aclararlo. Para orientarte bien con todos los matices que me comentas, " +
      "prefiero que alguien del equipo te llame y lo habléis con calma. " +
      "¿Me puedes dejar tu WhatsApp? En cuanto me lo pases, nos ponemos en contacto contigo.";
  }

  return respuesta;
}

/**
 * True si la última decisión fue una derivación al etólogo y el cliente
 * sigue escribiendo tras recibir el mensaje de derivación.
 */
function _esPostDerivacionEtologo() {
  const d = state.decision_actual;
  if (!d) return false;
  if (d.accion !== "derivar") return false;
  if (d.frase_params?.tipo !== "etologo") return false;
  return true;
}

/**
 * Inserta el bloque de cierre "Tu perro merece ser feliz, hoy" con los botones
 * de Instagram y Web, igual que el cierre tras pago. Bloquea el input para que
 * la conversación quede cerrada tras una derivación al etólogo.
 */
function _insertarCierrePostDerivacion() {
  // Reutilizamos la función de cierre existente — hace exactamente lo que
  // necesitamos: pinta el bloque, bloquea input y botón de enviar
  _insertarCierre();
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
