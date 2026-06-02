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

import { normalizar }                        from "./victoria-utils.js?v=59";
import { detectarZona }                      from "./victoria-zones.js?v=59";
import { detectarCuadros, detectarLateral }  from "./victoria-dictionaries.js?v=59";
import { DICT_BASICA }                       from "./victoria-dictionaries.js?v=59";
import {
  obtenerFrase,
  FRASES_PRECIO,
  FRASES_PACK,
  FRASE_PRECIO_POR_PERRO,
  FRASE_RECONOCIMIENTO_INICIAL,
  FRASE_RECONOCIMIENTO_INICIAL_SENSIBLE,
  FRASE_MENSAJE_PRINCIPAL,
  FRASE_RAMIFICACION,
  FRASE_COMO_TRABAJAMOS_PRESENCIAL,
  FRASE_COMO_TRABAJAMOS_ONLINE,
  FRASE_CIERRE_METODOLOGIA,
  FRASE_DURACION_UNIFICADA,
} from "./victoria-phrases.js?v=59";
import { esPPP }                             from "./victoria-breeds.js?v=59";
import { decidirRespuesta, tieneVocabularioReconocible, tieneKeywordsAgresion } from "./victoria-matching.js?v=59";
import { renderAgenda }                      from "./agenda.js?v=59";
import { renderPago }                        from "./pagos.js?v=59";
import {
  buscarOCrearClientePorTelefono,
  reservarLlamada,
  obtenerSlotsDisponibles,
}                                            from "./supabase.js?v=59";
import { IA_FALLBACK_CONFIG }                from "./victoria-ai-config.js?v=59";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL   = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjAwODAsImV4cCI6MjA5MjMzNjA4MH0.0SpunQTuSwYaAjzWEDQivZy7971-Tf3CX2KxAEo8Nuw";
const NTFY_TOPIC = "perrosdelaisla-citas-2026"; // ← cambia por string aleatorio antes de producción

// Delay de typing indicator en ms
const TYPING_BASE     = 700;   // mínimo antes de responder (random 700-1200)
const TYPING_POR_CHAR = 0;     // legacy: ya no se suma por char (ver _enviarMensaje)
const TYPING_MAX      = 1200;  // tope — random uniform en [TYPING_BASE, TYPING_MAX]
const TYPING_DELAY    = 1200;  // fallback para callbacks de botones

const VICTORIA_AVATAR = "https://i.ibb.co/1GXMwqzQ/victoria-cuadrada.jpg";

// ── Persistencia de sesión (Bug A: retomar al recargar) ──
const STORAGE_KEY = "pdli_victoria_state";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 horas

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
    s_inicio_intentos: 0,
    s3_intentos: 0,
    s5_intentos: 0,
    protocolo_ya_presentado: false,
    tema_preseleccionado: null,  // viene de ?tema=X en la URL
    origen: null,                // viene de ?origen=X en la URL (whatsapp/instagram/mail/paseos)
    prueba: false,               // viene de ?prueba=1 en la URL — marca la sesión como es_prueba=true
    token_vicky: null,           // si arrancó con ?token=XXX (flujo Vicky), guarda el token

    perro: { nombre: null, edad_meses: null, raza: null, peso_kg: null, es_ppp: false },

    zona: {
      zonaDetectada: null, modalidad: "desconocida",
      esSonGotleu: false, necesitaAclaracion: true,
    },

    // Zonas fuera de cobertura: cliente elige online | palma | rechaza tras
    // que Victoria pregunte. null = todavía no se le preguntó.
    modalidad_zona_fuera_elegida: null,

    mensajes_diagnostico: [],  // solo s4+s5 — alimentan el matcher
    prescan_mensaje_inicial: null,  // texto del primer mensaje si tenía contenido
    problema_texto: null,           // descripción del problema capturada en s_inicio

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
    // ── ADICIÓN 1: campos de tracking ──
    sesion_id: null,
    sesion_inicio_ts: null,
    log_matching_final: null,

    // ── Fallback IA: tracking de turnos y guardado de historial ──
    turnos_ia: 0,
    historial_ia: [],           // array de {role:"user"|"assistant", content:string}
    fallback_ia_cerrado: false, // true tras alcanzar maxTurnos — no reentrar

    // Origen de la última respuesta — solo se renderiza si state.prueba.
    // Patrón consume-and-reset: se setea en _fallbackInteligente / _fallbackHumano
    // y se limpia en _mostrarVictoria tras pintar la etiqueta.
    ultima_respuesta_origen: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL — llamado desde index.html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arranca la conversación. Conecta la UI y envía el primer mensaje.
 * index.html llama a start() al cargar.
 */
export async function start() {
  state = _estadoInicial();
  _conectarUI();
  _conectarSplash();
  _conectarHeader();

  // Leer el parámetro ?tema=X de la URL — permite que Victoria sepa desde qué
  // botón de la app de paseos vino el cliente, y personalice el saludo inicial.
  // Valores válidos: basica, reactividad, cachorros, ansiedad. Otros se ignoran.
  const params = new URLSearchParams(window.location.search);
  const temaRaw = (params.get("tema") || "").toLowerCase().trim();
  const TEMAS_VALIDOS = ["basica", "reactividad", "cachorros", "ansiedad"];
  if (TEMAS_VALIDOS.includes(temaRaw)) {
    state.tema_preseleccionado = temaRaw;
  }

  // Leer ?origen=X — tracking de canal de captación
  // Valores válidos: whatsapp, instagram, mail, paseos. Otros → null (= Directo)
  const origenRaw = (params.get("origen") || "").toLowerCase().trim();
  const ORIGENES_VALIDOS = ["whatsapp", "instagram", "mail", "paseos"];
  if (ORIGENES_VALIDOS.includes(origenRaw)) {
    state.origen = origenRaw;
  }

  // Leer ?prueba=1 — marca esta sesión como prueba para que NO cuente en stats
  // Útil para testear el flujo sin contaminar las métricas de conversión.
  const pruebaRaw = (params.get("prueba") || "").trim();
  if (pruebaRaw === "1") {
    state.prueba = true;
  }

  // ── ADICIÓN: intentar restaurar sesión previa (Bug A) ──
  // Solo si NO viene con token (flujo Vicky) ni con prueba=1.
  // Si la URL trae token, descartamos cualquier storage previo: el flujo
  // Vicky tiene su propia lógica y no se mezcla.
  const tokenEnURL = (params.get("token") || "").trim();
  if (state.prueba || tokenEnURL) {
    _limpiarEstadoPersistido();
  } else {
    const restaurado = _cargarEstadoPersistido();
    if (restaurado) {
      // Validar coincidencia de tema (si la URL trae uno distinto al
      // guardado, el cliente cambió de intención → descartar)
      const temaURL = state.tema_preseleccionado || null;
      const temaGuardado = restaurado.tema_preseleccionado || null;
      const temaCoincide = temaURL === temaGuardado || (!temaURL && temaGuardado);

      if (temaCoincide) {
        // Restaurar state completo, pero preservar origen actual de URL
        // por si el cliente reentra desde un canal distinto (whatsapp/mail/etc.)
        const origenActual = state.origen;
        state = restaurado;
        if (origenActual) state.origen = origenActual;
        delete state._persistido_ts;

        // Repintar y re-disparar el widget pendiente del paso
        _repintarHistorial();
        _actualizarProgreso();
        await _redispararPasoActual();
        return;
      } else {
        // Tema distinto → descartar el viejo, flujo limpio
        _limpiarEstadoPersistido();
      }
    }
  }

  // Leer ?token=XXX — flujo Vicky: el lead viene de un link generado por
  // Vicky humana, con sus datos ya cargados. Saltamos el embudo
  // conversacional (s1-s6) y entramos directo a la agenda.
  const tokenRaw = (params.get("token") || "").trim();
  if (tokenRaw) {
    _arrancarFlujoVicky(tokenRaw);
    return;
  }

  // Arranque normal (sin token)
  const bienvenida = _construirSaludoBienvenida();

  _registrarTurno("victoria", bienvenida);
  _mostrarVictoria(bienvenida);
  state.current_step = "s_inicio";
  _actualizarProgreso();
  // ── ADICIÓN 2: crear sesión de tracking (async, no bloquea) ──
  _crearSesionTracking();
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
      "Cuéntame un poco más: ¿qué está pasando con tu perro en el día a día? Te orientamos en un par de minutos.";
  }

  // Personalización por origen (cuando no hay tema)
  const origen = state.origen;
  const introsOrigen = {
    whatsapp:  "Veo que vienes desde WhatsApp, bienvenido. ",
    instagram: "Veo que vienes desde Instagram, gracias por seguirnos. ",
    mail:      "Gracias por escribirnos por mail. ",
  };
  if (origen && introsOrigen[origen]) {
    return "¡Hola! Soy Victoria, del equipo de Perros de la Isla. " +
      introsOrigen[origen] +
      "En Mallorca desde 2019, con más de 14 años de experiencia acompañando a familias con su perro. " +
      "Cuéntanos qué está pasando con tu perro — qué situación os preocupa o queréis mejorar — y te orientamos en un par de minutos.";
  }

  // Saludo estándar (sin parámetro o con tema inválido)
  return "¡Hola! Soy Victoria, del equipo de Perros de la Isla. En Mallorca desde 2019, con más de 14 años de experiencia acompañando a familias con su perro. Cuéntanos qué está pasando con tu perro — qué situación os preocupa o queréis mejorar — y te orientamos en un par de minutos.";
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO VICKY — arranque por ?token=XXX
// El lead llega con un link que Vicky generó al teléfono. Consumimos el
// token, precargamos sus datos y saltamos directo a la agenda (s7).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arranca el flujo Vicky: consume el token vía RPC, precarga el state con
 * los datos del lead y muestra el saludo + resumen + botones de confirmación.
 * Si el token es inválido/expirado/usado, muestra un mensaje y bloquea el input.
 */
async function _arrancarFlujoVicky(token) {
  state.token_vicky = token;

  let datos;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/consume_token_vicky`, {
      method: "POST",
      headers: {
        "apikey":        SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    });
    const payload = await res.json();
    if (!payload?.ok) {
      const mensaje = _mensajeErrorToken(payload?.error);
      _registrarTurno("victoria", mensaje);
      _mostrarVictoria(mensaje);
      _deshabilitarInput();
      return;
    }
    datos = payload.datos;
  } catch (err) {
    console.error("Error consumiendo token:", err);
    const mensaje = "Hemos tenido un problema técnico al cargar tus datos. " +
      "Escríbenos al 622 922 173 y lo solucionamos enseguida.";
    _registrarTurno("victoria", mensaje);
    _mostrarVictoria(mensaje);
    _deshabilitarInput();
    return;
  }

  // Precargar state con los datos del token
  state.cliente.nombre   = datos.tutor_nombre;
  state.cliente.telefono = datos.tutor_telefono;
  state.cliente.email    = datos.tutor_email;
  state.perro.nombre     = datos.perro_nombre;
  state.perro.raza       = datos.perro_raza;
  state.perro.edad_meses = datos.perro_edad_meses;
  state.perro.peso_kg    = datos.perro_peso_kg;
  state.perro.es_ppp     = datos.perro_es_ppp;

  const esPresencial = String(datos.modalidad || "").startsWith("presencial");
  state.zona = {
    zonaDetectada:      datos.zona,
    modalidad:          esPresencial ? "presencial" : "online",
    esSonGotleu:        false,
    necesitaAclaracion: false,
  };
  state.modalidad_final = esPresencial ? "presencial" : "online";
  if (datos.modalidad === "presencial-parque-Palma") {
    state.modalidad_zona_fuera_elegida = "palma";
  }
  state.mensajes_diagnostico = [datos.problematica];
  state.protocolo_ya_presentado = true;
  state.current_step = "s7";  // saltamos directo a agenda

  // Crear sesión de tracking con es_vicky=true
  await _crearSesionTrackingVicky();

  // Mostrar saludo + resumen + botones de confirmación
  _mostrarSaludoVickyConResumen(datos);
}

/**
 * Mensaje al cliente según el código de error de consume_token_vicky.
 */
function _mensajeErrorToken(codigo) {
  if (codigo === "token_expirado") {
    return "Este enlace ha caducado. Escríbenos al 622 922 173 y te enviamos uno nuevo.";
  }
  if (codigo === "token_ya_usado") {
    return "Este enlace ya se ha utilizado. Si necesitas hacer una nueva reserva, " +
      "escríbenos al 622 922 173.";
  }
  // token_no_existe u otro
  return "No hemos podido cargar tu reserva. Escríbenos al 622 922 173 y lo " +
    "solucionamos enseguida.";
}

/**
 * Convierte el slug de modalidad a texto legible para el cliente.
 */
function _modalidadLegible(slug) {
  if (slug === "presencial-zona-cliente")  return "Presencial en tu domicilio";
  if (slug === "presencial-parque-Palma")  return "Presencial en parque de Palma";
  if (slug === "online")                   return "Online (videollamada)";
  return slug || "—";
}

/**
 * Convierte edad en meses a texto legible: "X años" si ≥12, "X meses" si <12.
 */
function _edadLegible(meses) {
  if (meses == null) return "edad no indicada";
  if (meses >= 12) {
    const anios = Math.round(meses / 12);
    return anios === 1 ? "1 año" : `${anios} años`;
  }
  return meses === 1 ? "1 mes" : `${meses} meses`;
}

/**
 * Muestra el saludo Vicky con el resumen de datos del lead y 2 botones:
 * confirmar (→ agenda) o reportar error (→ derivar al 622). Con typing
 * indicator y delays para mantener el ritmo del resto de Victoria.
 */
function _mostrarSaludoVickyConResumen(datos) {
  const perro        = datos.perro_nombre || "tu perro";
  const edadTxt      = _edadLegible(datos.perro_edad_meses);
  const modalidadTxt = _modalidadLegible(datos.modalidad);

  const mensaje =
    `Hola ${datos.tutor_nombre}. Esto es lo que apuntamos sobre tu llamada con el equipo:\n\n` +
    `Perro: ${perro} (${datos.perro_raza}, ${edadTxt}, ${datos.perro_peso_kg} kg)\n` +
    `Zona: ${datos.zona}\n` +
    `Modalidad: ${modalidadTxt}\n` +
    `Tema a trabajar: ${datos.problematica}\n\n` +
    `¿Está todo correcto?`;

  _mostrarTyping(true);
  setTimeout(() => {
    _mostrarTyping(false);
    _registrarTurno("victoria", mensaje);
    _mostrarVictoria(mensaje);
    _actualizarProgreso();

    setTimeout(() => {
      _mostrarOpciones([
        {
          label: "Sí, continuar con la reserva",
          onClick: async () => {
            _mostrarCliente("Sí, continuar con la reserva");
            _registrarTurno("cliente", "Sí, continuar con la reserva");
            _mostrarTyping(true);
            setTimeout(async () => {
              _mostrarTyping(false);
              await _iniciarAgenda();
              _actualizarProgreso();
            }, TYPING_DELAY);
          },
        },
        {
          label: "Hay un dato que no encaja",
          onClick: () => {
            _mostrarCliente("Hay un dato que no encaja");
            _registrarTurno("cliente", "Hay un dato que no encaja");
            const msg = "Sin problema. Escríbenos al 622 922 173 indicando qué hay " +
              "que ajustar y enseguida te mandamos el enlace actualizado. " +
              "Esto nos lleva 2 minutos.";
            _mostrarVictoria(msg);
            _registrarTurno("victoria", msg);
            _deshabilitarInput();
          },
        },
      ]);
    }, 800);
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONEXIÓN CON EL DOM REAL (index.html)
// ─────────────────────────────────────────────────────────────────────────────

let _chatEl    = null;
let _twEl      = null;   // typing indicator
let _inputEl   = null;
let _sendEl    = null;

// Timer de rescate cuando el cliente abre agenda y no elige slot
// en 45 segundos. Se cancela al elegir slot o al cambiar de paso.
let _timerRescateAgenda = null;

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
  // Splash eliminado: el cliente entra directo al chat. No queda nada que
  // conectar — la función se mantiene por simetría con _conectarUI/_conectarHeader.
}

/**
 * Listener de scroll para encoger/expandir el header según el scroll del
 * body. El chat scrollea a nivel window (no en un contenedor), por eso
 * usamos window.scrollY en lugar de scrollTop sobre un elemento.
 */
function _conectarHeader() {
  const header = document.querySelector(".pdli-header");
  if (!header) return;
  const onScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add("shrunk");
    } else {
      header.classList.remove("shrunk");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
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

  // Delay aleatorio uniforme en [TYPING_BASE, TYPING_MAX] — estética WhatsApp
  // (típicamente 700-1200ms). Se mantiene `longitud` por si en el futuro se
  // re-introduce un factor por carácter.
  // eslint-disable-next-line no-unused-vars
  const longitud = respuesta ? respuesta.length : 0;
  const delay = TYPING_BASE + Math.random() * (TYPING_MAX - TYPING_BASE);

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

  // Etiqueta de debug — SOLO en modo prueba (?prueba=1). Se inserta como
  // hermana del bubble, justo encima. Patrón consume-and-reset: el origen
  // queda null tras pintar para que respuestas posteriores (clicks de botón,
  // bienvenida, etc.) no hereden la etiqueta del turno anterior.
  if (state.prueba && state.ultima_respuesta_origen) {
    const o = state.ultima_respuesta_origen;
    let label = null;
    if (o.tipo === "IA")             label = `IA · turno ${o.turno}/${IA_FALLBACK_CONFIG.maxTurnos}`;
    else if (o.tipo === "IA_CIERRE") label = `IA · cierre 3/3`;
    else if (o.tipo === "FH")        label = `FH: ${o.motivo}`;
    if (label) {
      const debugEl = document.createElement("div");
      debugEl.className = "msg-debug";
      debugEl.textContent = `[${label}]`;
      _chatEl.insertBefore(debugEl, _twEl);
    }
    state.ultima_respuesta_origen = null;
  }

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
    return await _recalcularTrasDesescalada(texto);
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
    s_inicio: _procesarInicioProblema,
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
    s_zona_fuera: _procesarModalidadZonaFuera,
  };

  const procesador = procesadores[state.current_step];
  if (!procesador) return _fallbackHumano("paso desconocido: " + state.current_step);

  return await procesador(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESADORES DE PASOS s1–s12
// ─────────────────────────────────────────────────────────────────────────────

async function _procesarInicioProblema(texto) {
  _prescanPrimerMensaje(texto);
  state.problema_texto = (state.problema_texto ? state.problema_texto + " " : "") + texto;
  if (!state.mensajes_diagnostico.includes(texto)) {
    state.mensajes_diagnostico.push(texto);
  }
  state.prescan_mensaje_inicial = null;
  state.s_inicio_intentos = (state.s_inicio_intentos || 0) + 1;

  _actualizarSesion({ paso_actual: "s_inicio", paso_maximo_alcanzado: "s_inicio" });

  const textoCompleto = state.problema_texto;
  const tieneZona = state.zona && !state.zona.necesitaAclaracion;
  const tieneMordida = _tieneKeywordsMordida(textoCompleto);
  const tieneAgresion = tieneKeywordsAgresion(textoCompleto);
  const tieneVocabulario = tieneVocabularioReconocible(textoCompleto);
  const esVago = !tieneMordida && !tieneAgresion && !tieneVocabulario;

  // Servicio lateral PURO (peluquería, guardería, adopciones, paseos
  // grupales, veterinaria) sin problema de conducta de por medio:
  // derivamos de inmediato con la frase correspondiente. Si hay
  // vocabulario de cuadro, mordida o agresión, NO se trata como lateral
  // — el problema de conducta manda (ej. "se pone agresivo en la peluquería").
  const lateral = detectarLateral(textoCompleto);
  if (lateral && !tieneVocabulario && !tieneMordida && !tieneAgresion) {
    state.lateral_detectado = lateral;
    return obtenerFrase({ tipo: "lateral", subtipo: lateral });
  }

  if (esVago && state.s_inicio_intentos >= 2) {
    return "Para orientarte bien necesitamos hablar contigo más directamente. Escríbenos por WhatsApp al 622 922 173 y el equipo te atiende.";
  }
  if (esVago && state.s_inicio_intentos === 1) {
    return "Cuéntanos un poco más: qué situación con tu perro os preocupa o queréis mejorar. Cuanto más detalle nos des, mejor podemos orientarte.";
  }

  // SEGURIDAD: cualquier señal de mordida O agresión NO recibe el
  // reconocimiento "lo trabajamos". Pedimos los datos del perro para que
  // el matcher (s4) decida con el peso y el tipo de perro si es un caso
  // que trabajamos o que derivamos al etólogo (perro grande, PPP, víctima
  // vulnerable). La seguridad y la no-contradicción mandan sobre el enganche.
  if (tieneMordida || tieneAgresion) {
    const necesitaDatos = state.perro.edad_meses === null
      || state.perro.peso_kg === null
      || state.perro.raza === null;
    if (necesitaDatos) {
      state.current_step = "s3";
      return "Entiendo, necesito más datos. ¿Qué edad tiene tu perro, qué raza es y cuánto pesa aproximadamente?";
    }
    return await _completarYEvaluar();
  }

  // Reconocimiento temprano. Si llegó hasta acá, hay vocabulario de cuadro
  // reconocible y SIN señales de agresión/mordida (separación, miedos,
  // reactividad sin agresión, tirones, ladridos): validamos y transmitimos
  // experiencia antes de pedir datos.
  const _fraseReconoc = _tieneMarcadoresSobrepasado(textoCompleto)
    ? FRASE_RECONOCIMIENTO_INICIAL_SENSIBLE
    : FRASE_RECONOCIMIENTO_INICIAL;
  if (!tieneZona) {
    state.current_step = "s1";
    return `${_fraseReconoc} Para empezar, ¿en qué zona de Mallorca estás?`;
  }

  state.current_step = "s2";
  return `${_fraseReconoc} Para empezar, ¿cómo se llama tu perro?`;
}

async function _completarYEvaluar() {
  // Defaults del perro si algo quedó sin responder (mismo criterio que s3).
  if (state.perro.peso_kg    === null) state.perro.peso_kg    = 15;
  if (state.perro.edad_meses === null) state.perro.edad_meses = 24;
  if (state.perro.raza       === null) state.perro.raza       = "mestizo";

  // Marcar paso s4 → mantiene el embudo de stats ("Dieron datos del perro").
  state.current_step = "s4";
  _actualizarSesion({
    paso_actual:           "s4",
    paso_maximo_alcanzado: "s4",
    zona:                  state.zona?.zonaDetectada,
    modalidad:             state.zona?.modalidad,
    raza_perro:            state.perro.raza,
    peso_kg:               state.perro.peso_kg,
    edad_meses:            state.perro.edad_meses,
  });

  const problema = state.problema_texto || (state.mensajes_diagnostico[0] ?? "");
  return await _evaluarYResponder(problema);
}

function _procesarS1_Zona(texto) {
  // Prescan del primer mensaje — si tiene contenido, extrae todo lo que pueda
  // (zona, raza, edad, peso, ppp, problema) para no re-preguntar después.
  _prescanPrimerMensaje(texto);

  // Si el prescan ya detectó la zona, saltamos s1 directamente
  if (state.zona && !state.zona.necesitaAclaracion) {
    state.current_step = "s2";
    return "Perfecto. ¿Cómo se llama tu perro?";
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

async function _procesarS2_NombrePerro(texto) {
  // 1. Stripping de prefix conversacional ("se llama", "mi perro es", etc.)
  let candidato = texto
    .replace(/^(se llama|mi perro (es|se llama))\s*/i, "")
    .replace(/^(es|un|una)\s+/i, "")
    .trim();

  // 2. Cortar en el primer delimitador de frase para evitar capturar
  //    continuaciones como "toby y se porta muy mal".
  const DELIMITADORES = /\s+(y|que|pero|porque|tiene|es\s+un|es\s+una|se)\s+|[,.;:?!]/i;
  const matchDelim = candidato.match(DELIMITADORES);
  if (matchDelim) {
    candidato = candidato.slice(0, matchDelim.index).trim();
  }

  // 3. Limitar a máximo 3 palabras (permite "Bella Luna" pero no frases)
  const palabras = candidato.split(/\s+/).filter(Boolean).slice(0, 3);

  // 4. Validación: descartar respuestas vacías o evasivas
  const BLACKLIST = ["todavia", "aun", "ninguno", "ninguna", "no"];
  const palabrasNorm = palabras.map(w =>
    w.toLowerCase()
      .replace(/[áàâä]/g, "a")
      .replace(/[éèêë]/g, "e")
      .replace(/[íìîï]/g, "i")
      .replace(/[óòôö]/g, "o")
      .replace(/[úùûü]/g, "u")
      .replace(/ñ/g, "n")
  );
  const esEvasiva = palabrasNorm.some(w => BLACKLIST.includes(w));

  if (palabras.length > 0 && !esEvasiva) {
    // 5. Capitalizar cada palabra: "bella luna" → "Bella Luna"
    state.perro.nombre = palabras
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  // Si vacío o evasivo: no asignar, state.perro.nombre queda como estaba (null al inicio)

  const yaTieneEdad = state.perro.edad_meses !== null;
  const yaTienePeso = state.perro.peso_kg !== null;
  const yaTieneRaza = state.perro.raza !== null;

  // Si el prescan ya llenó todos los datos, saltar s3 e ir directo a s4
  if (yaTieneEdad && yaTienePeso && yaTieneRaza) {
    return await _completarYEvaluar();
  }

  // Falta algún dato → construir pregunta pidiendo SOLO lo que falta
  state.current_step = "s3";

  const preguntas = [];
  if (!yaTieneEdad) preguntas.push("qué edad tiene");
  if (!yaTieneRaza) preguntas.push("qué raza es");
  if (!yaTienePeso) preguntas.push("cuánto pesa aproximadamente");

  let textoPregunta;
  if (preguntas.length === 1) {
    textoPregunta = `¿${preguntas[0].charAt(0).toUpperCase() + preguntas[0].slice(1)}?`;
  } else if (preguntas.length === 2) {
    textoPregunta = `¿${preguntas[0].charAt(0).toUpperCase() + preguntas[0].slice(1)} y ${preguntas[1]}?`;
  } else {
    textoPregunta = `¿${preguntas[0].charAt(0).toUpperCase() + preguntas[0].slice(1)}, ${preguntas[1]} y ${preguntas[2]}?`;
  }

  return `${_aperturaPostNombre()} Una cosa más sobre ${_nombrePerro()}: ${textoPregunta}`;
}

async function _procesarS3_DatosPerro(texto) {
  // Si el prescan ya llenó todos los datos, saltamos s3 completo y vamos a s4.
  // Esto pasa cuando el cliente escribe un mini-ensayo con raza+edad+peso en
  // el primer mensaje.
  const yaTieneEdad = state.perro.edad_meses !== null;
  const yaTienePeso = state.perro.peso_kg !== null;
  const yaTieneRaza = state.perro.raza !== null;

  if (yaTieneEdad && yaTienePeso && yaTieneRaza) {
    // Guardar este texto como parte del diagnóstico (puede describir el problema)
    return await _completarYEvaluar();
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
      return `¿Qué edad tiene ${_nombrePerro()}? Con meses si es cachorro, o años si es adulto.`;
    }
    if (state.s3_intentos === 2) {
      return `Perdona, no he sabido leerlo bien. Dímelo con números si puedes — por ejemplo "3 años" o "8 meses".`;
    }
    state.perro.edad_meses = 24;
  }

  if (faltaPeso && state.s3_intentos <= 1) {
    state.s3_intentos++;
    return `¿Y cuánto pesa ${_nombrePerro()} aproximadamente? Un número aproximado me vale — por ejemplo "12 kilos".`;
  }

  if (state.perro.peso_kg    === null) state.perro.peso_kg    = 15;
  if (state.perro.edad_meses === null) state.perro.edad_meses = 24;
  if (state.perro.raza       === null) state.perro.raza       = "mestizo";

  return await _completarYEvaluar();
}

async function _procesarS4_Problema(texto) {
  // Si había mensaje inicial largo (prescan), incluirlo en el diagnóstico
  // — una sola vez, marcándolo como ya consumido.
  if (state.prescan_mensaje_inicial) {
    state.mensajes_diagnostico.unshift(state.prescan_mensaje_inicial);
    state.prescan_mensaje_inicial = null; // consumir para no duplicar
  }

  state.mensajes_diagnostico.push(texto);

  const lateral = detectarLateral(texto);
  if (lateral) state.lateral_detectado = lateral;

  // ── ADICIÓN 4: tracking s4 ──
  _actualizarSesion({
    paso_actual:           "s4",
    paso_maximo_alcanzado: "s4",
    zona:                  state.zona?.zonaDetectada,
    modalidad:             state.zona?.modalidad,
    raza_perro:            state.perro.raza,
    peso_kg:               state.perro.peso_kg,
    edad_meses:            state.perro.edad_meses,
  });

  return await _evaluarYResponder(texto);
}

/**
 * Procesa la respuesta del cliente cuando Victoria le preguntó si prefiere
 * trabajar online o desplazarse a un parque de Palma (zonas fuera del radio
 * presencial habitual). Tres ramas posibles:
 *   - "online"  → continúa con mensaje principal versión online
 *   - "palma"   → confirmación bespoke + sigue como presencial
 *   - "rechaza" → cierre amable con WhatsApp del negocio + input deshabilitado
 * Si la respuesta es ambigua, repregunta de forma suave.
 */
async function _procesarModalidadZonaFuera(texto) {
  const t = (texto || "").toLowerCase().trim();

  const eligeOnline = [
    "online", "on line", "videollamada", "video llamada",
    "video", "por video", "desde casa", "videoconferencia",
    "primera opcion", "primera opción", "la primera",
    "opcion 1", "opción 1", "la 1",
  ].some(p => t.includes(p));

  const eligePalma = [
    "palma", "voy", "ir", "me acerco", "me desplazo",
    "presencial", "en persona", "en parque",
    "segunda opcion", "segunda opción", "la segunda",
    "opcion 2", "opción 2", "la 2",
  ].some(p => t.includes(p));

  // Detección de duda primero — NO es rechazo, debe caer al "repreguntar"
  const expresaDuda = [
    "no sé", "no se", "no estoy seguro", "no estoy segura",
    "no entiendo", "no tengo claro", "no me decido",
    "ninguna idea", "no sabría", "no sabria",
  ].some(p => t.includes(p));

  // Rechazo: solo frases claras de descarte (sin "no" suelto, evita
  // falsos positivos como "no sé"). Si expresa duda, no es rechazo.
  const rechaza = !expresaDuda && [
    "no me interesa", "no gracias", "no, gracias",
    "no me convence", "no quiero", "no me sirve",
    "no es para mi", "no es para mí",
    "ninguna", "ninguna de las dos", "ninguna de las opciones",
    "paso", "lo dejo", "olvidalo", "olvídalo", "déjalo", "dejalo",
    "mejor no", "no por ahora", "ahora no",
  ].some(p => {
    const regex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return regex.test(t);
  });

  // ── PALMA ──────────────────────────────────────────────────────────────
  if (eligePalma && !eligeOnline) {
    state.modalidad_zona_fuera_elegida = "palma";
    state.zona.modalidad = "presencial";
    state.modalidad_final = "presencial";
    state.protocolo_ya_presentado = true;
    state.current_step = "s6";
    state.mostrar_ramificacion_tras_protocolo = true;
    _actualizarSesion({
      paso_actual:           "s6",
      paso_maximo_alcanzado: "s6",
      vio_mensaje_principal: true,
      modalidad:             "presencial",
    });
    return obtenerFrase({
      tipo: "apoyo",
      subtipo: "zona_fuera_eligio_palma",
      vars: { perro: state.perro?.nombre ?? null },
    });
  }

  // ── ONLINE ─────────────────────────────────────────────────────────────
  // Frase puente bespoke (igual que Palma) + flags para que la ramificación
  // aparezca a continuación. NO pasamos por mensaje_principal porque su
  // apertura ("Te escucho. Lo que describes…") suena descontextualizada
  // dos turnos después de que el cliente describiera el caso.
  if (eligeOnline && !eligePalma) {
    state.modalidad_zona_fuera_elegida = "online";
    state.modalidad_final = "online";
    state.protocolo_ya_presentado = true;
    state.current_step = "s6";
    state.mostrar_ramificacion_tras_protocolo = true;
    _actualizarSesion({
      paso_actual:           "s6",
      paso_maximo_alcanzado: "s6",
      vio_mensaje_principal: true,
      modalidad:             "online",
    });
    return obtenerFrase({
      tipo: "apoyo",
      subtipo: "zona_fuera_eligio_online",
      vars: { perro: state.perro?.nombre ?? null },
    });
  }

  // ── RECHAZO ────────────────────────────────────────────────────────────
  if (rechaza) {
    state.modalidad_zona_fuera_elegida = "rechaza";
    _deshabilitarInput();
    return obtenerFrase({
      tipo: "apoyo",
      subtipo: "zona_fuera_rechaza",
      vars: { perro: state.perro?.nombre ?? null },
    });
  }

  // ── AMBIGUO ────────────────────────────────────────────────────────────
  return "¿Prefieres online o desplazarte a Palma? Si no te encaja ninguna, también está bien.";
}

/**
 * Deshabilita el input y el botón de enviar sin inyectar la tarjeta de
 * cierre completa (que tiene el lema y los botones de redes). Pensado para
 * cierres conversacionales más sobrios — p.ej. cuando el cliente rechaza
 * ambas opciones de zona fuera.
 */
function _deshabilitarInput() {
  if (_inputEl) {
    _inputEl.disabled = true;
    _inputEl.placeholder = "Conversación finalizada";
    _inputEl.blur();
  }
  if (_sendEl) {
    _sendEl.disabled = true;
  }
  const inputWrap = document.getElementById("victoria-input-wrap");
  if (inputWrap) {
    inputWrap.style.opacity = "0.4";
    inputWrap.style.pointerEvents = "none";
  }
}

async function _procesarGravedadMordida(texto) {
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
    // Rayón sin intención (criterio Charly)
    "rayón", "rayon", "rayazo",
    "rasguño", "rasguno", "raspón", "raspon",
    "arañazo", "aranazo",
    // Contexto de juego o exploración (no agresión)
    "jugando", "mientras jugaba", "estaba jugando",
    "en el juego", "fue jugando",
    "exploraba", "exploración", "exploracion",
    "estaba explorando",
    "dientes afilados", "diente afilado",
    "tiene dientes afilados",
    "se enganchó la piel", "se engancho la piel",
    "sin querer", "sin intención", "sin intencion",
    "sin maldad", "sin mala intención",
  ].some(kw => norm.includes(normalizar(kw)));

  // GRAVE solo si hay indicadores claros de lesión — quita "marca" suelta (ambigua)
  const esGrave = [
    "grave", "muy grave",
    "lesión", "lesion",
    "sangre", "sangró", "sangro", "sangrar", "sangrando",
    "hizo sangrar", "me hizo sangrar", "le hizo sangrar",
    "ha sangrado", "está sangrando",
    "puntos", "puntos de sutura", "sutura",
    "herida", "herida profunda",
    "urgencias", "médico", "medico", "hospital",
    "hematoma", "moratón", "moraton",
    "dejó marca", "quedó marca", "dejó marcas", "hay marca",
    "mordisco fuerte", "mordida fuerte",
    // Intención + sujeción (criterio Charly: mordida real)
    "clavó los dientes", "clavo los dientes",
    "clavó dientes", "clavo dientes",
    "apretó", "apreto", "apretó fuerte", "apreto fuerte",
    "no soltaba", "no soltó", "no solto",
    "se enganchó y no soltó", "se engancho y no solto",
    "agarró fuerte", "agarro fuerte",
    "sujetó", "sujeto", "sujetó fuerte",
    "no me soltaba", "no la soltaba", "no lo soltaba",
    "tuve que abrirle la boca",
    "con intención", "con intencion",
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
  return await _evaluarYResponder(texto);
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

const KEYWORDS_METODOLOGIA = [
  "como son las clases", "cómo son las clases",
  "como son las sesiones", "cómo son las sesiones",
  "como es la clase", "cómo es la clase",
  "como es la sesion", "cómo es la sesión",
  "como trabajan", "cómo trabajan",
  "como trabajais", "cómo trabajáis",
  "como trabaja", "cómo trabaja",
  "como funciona", "cómo funciona",
  "como funcionan", "cómo funcionan",
  "que hacen en la clase", "qué hacen en la clase",
  "que haceis", "qué hacéis",
  "metodologia", "metodología",
  "en que consiste", "en qué consiste",
  "como van las clases", "cómo van las clases",
  "que pasa en la clase", "qué pasa en la clase",
  "como es una clase", "cómo es una clase",
  "como se desarrolla", "cómo se desarrolla",
  "como se hace", "cómo se hace",
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

  // 0. Metodología / cómo son las clases (prioridad máxima — es la pregunta más natural)
  if (match(KEYWORDS_METODOLOGIA)) {
    _mostrarMetodologiaCompleta();
    return null;  // la metodología se muestra async, no devolver texto aquí
  }

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
    } else if (state.modalidad_zona_fuera_elegida === "palma") {
      respuesta = "Las clases presenciales las hacemos en un parque céntrico de Palma — un entorno tranquilo donde el adiestrador conoce a tu perro en persona. " +
        "Te enviamos la ubicación exacta al confirmar la cita.";
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

  // 8. Nada matcheó → catch-all del s6. El lead vio precio, hizo pregunta sin
  //    match. Ofrecemos 3 opciones con jerarquía visual: CTA primario "Agendar
  //    llamada gratuita", secundario "Ver horarios de clase" (acceso directo a
  //    agenda regular), link chico "déjanos tu WhatsApp" (último recurso).
  _mostrarBotonPedirWhatsApp();
  return "Si quieres lo hablamos por teléfono. " +
    "Puedes agendar una llamada gratuita con el adiestrador eligiendo un horario que te venga bien.";
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
          _mostrarMetodologiaCompleta();
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
  }, 1600);
}

function _mostrarMetodologiaCompleta() {
  _mostrarTyping(true);
  setTimeout(() => {
    _mostrarTyping(false);
    const modalidad = state.modalidad_final === "online" ? "online" : "presencial";
    const perro = state.perro.nombre ?? null;
    const lugar = state.modalidad_zona_fuera_elegida === "palma"
      ? "en un parque céntrico de Palma, un entorno tranquilo donde el adiestrador conoce a {perro} en persona (te enviamos la ubicación al confirmar la cita)"
      : "en tu domicilio — donde {perro} vive su día a día, que es donde mejor se observa su comportamiento real";
    const frase = obtenerFrase({
      tipo: "como_trabajamos",
      vars: { perro, modalidad, lugar },
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
}

function _mostrarBotonPedirWhatsApp() {
  setTimeout(() => {
    // Widget custom (bubble bot) con 3 opciones en jerarquía visual:
    //   1. CTA primario "Agendar llamada" — outline rojo PDLI, peso 600
    //   2. Secundario "Ver horarios de clase" — outline crema fino, peso 400
    //   3. Link terciario "O déjanos tu WhatsApp" — crema casi invisible
    // Tono editorial sobrio: jerarquía por peso/opacidad, no por contraste de fondo.
    const contenedor = _insertarContenedorEnChat("cta-llamada-slot", "cta-llamada-widget");
    if (!contenedor) return;

    contenedor.innerHTML = `
      <button id="btn-cta-llamada" style="
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
      ">📞 Agendar llamada gratuita</button>

      <button id="btn-cta-agenda" style="
        display:block;
        width:100%;
        padding:12px 16px;
        margin-bottom:12px;
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
      ">Ver horarios de clase</button>

      <div style="text-align:center">
        <a href="#" id="lnk-cta-wa" style="
          color:rgba(245,239,224,0.6);
          font-size:13px;
          text-decoration:underline;
        ">O déjanos tu WhatsApp y te contactamos</a>
      </div>
    `;

    contenedor.querySelector('#btn-cta-llamada').addEventListener('click', async () => {
      _mostrarCliente("📞 Agendar llamada gratuita");
      _registrarTurno("cliente", "Agendar llamada gratuita");
      _mostrarTyping(true);
      setTimeout(async () => {
        _mostrarTyping(false);
        await _iniciarLlamada();           // ← se define en Sub-bloque 4
        _actualizarProgreso();
      }, TYPING_DELAY);
    });

    contenedor.querySelector('#btn-cta-agenda').addEventListener('click', async () => {
      _mostrarCliente("Sí, ver horarios");
      _registrarTurno("cliente", "Sí, ver horarios");
      state.current_step = "s7";
      _mostrarTyping(true);
      setTimeout(async () => {
        _mostrarTyping(false);
        await _iniciarAgenda();
        _actualizarProgreso();
      }, TYPING_DELAY);
    });

    contenedor.querySelector('#lnk-cta-wa').addEventListener('click', (e) => {
      e.preventDefault();
      _mostrarCliente("Dejar mi WhatsApp");
      _registrarTurno("cliente", "Dejar mi WhatsApp");
      const msg = "Genial. Escríbeme tu número de WhatsApp y el equipo de Perros de la Isla te contactará en cuanto pueda.";
      _mostrarVictoria(msg);
      _registrarTurno("victoria", msg);
    });
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
        label: "📞 Agendar llamada gratuita",
        onClick: async () => {
          _mostrarCliente("📞 Agendar llamada gratuita");
          _registrarTurno("cliente", "Agendar llamada gratuita");
          state.current_step = "s6";  // NO avanzamos a s7 — la llamada es rescate, no agenda
          _mostrarTyping(true);
          setTimeout(async () => {
            _mostrarTyping(false);
            await _iniciarLlamada();
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

  // Flujo Vicky: nombre/teléfono/email ya vienen precargados del token, así
  // que NO pasamos por s9 (pedir datos) — saltamos directo a s10 (pago).
  // Replica el cierre de _procesarS9_DatosCliente: programa el widget de
  // pago tras el mensaje explicativo y devuelve el texto de _explicarPago.
  if (state.token_vicky) {
    state.current_step = "s10";
    setTimeout(() => {
      _mostrarTyping(true);
      setTimeout(() => {
        _mostrarTyping(false);
        _iniciarPago();
      }, 1000);
    }, 3500);
    return `Perfecto, reservamos el ${state.slot_elegido.label}. ` + _explicarPago();
  }

  state.current_step = "s9";
  return `Perfecto, reservamos el ${state.slot_elegido.label}. ` +
    "Para confirmar la cita necesito algunos datos: ¿cuál es tu nombre completo y tu teléfono?";
}

function _procesarS9_DatosCliente(texto) {
  const telefono = _extraerTelefono(texto);
  if (telefono) state.cliente.telefono = telefono;

  // Limpiar el texto del/los teléfonos antes de quedarnos con el nombre.
  // Mismo set de patrones que _extraerTelefono (intl + ES + genérico).
  const nombreCandidato = texto
    .replace(/\+\d[\d\s.\-()]{7,18}/g, "")                               // intl con +
    .replace(/(?<!\d)[6789]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}(?!\d)/g, "")  // ES móvil/fijo
    .replace(/\d[\d\s.\-()]{8,18}/g, "")                                  // genérico
    .trim();
  if (nombreCandidato.length > 2) state.cliente.nombre = nombreCandidato;

  if (!state.cliente.nombre) return "¿Cuál es tu nombre completo?";
  if (!state.cliente.telefono) {
    return "¿Y tu número de teléfono? Para que el equipo pueda contactarte si hace falta.";
  }

  if (state.modalidad_final === "online" && !state.cliente.email) {
    return "Como la clase es por Google Meet, necesito también tu email " +
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
    // Modo prueba: NO persistir cita ni disparar push a Carlos. El tracking
    // de la sesión sí se actualiza (la fila ya está marcada es_prueba=true
    // desde _crearSesionTracking; la query del admin la filtra fuera de
    // stats). UI completa y bubble de confirmación se mantienen.
    if (!state.prueba) {
      // Capa 2 doble reserva: si el slot fue tomado entre la elección y la
      // confirmación, _guardarCitaEnSupabase devuelve false tras reubicar al
      // cliente en la agenda. Cortamos aquí — sin notificar ni marcar cita.
      const guardado = await _guardarCitaEnSupabase();
      if (!guardado) return null;
      await _notificarCarlos();

      // Flujo Vicky: marcar el token como usado ahora que la cita existe.
      // No bloqueante — si falla, la cita ya está guardada igual.
      if (state.token_vicky && state.cita_id) {
        try {
          await fetch(`${SUPA_URL}/rest/v1/rpc/confirmar_token_vicky`, {
            method: "POST",
            headers: {
              "apikey":        SUPA_KEY,
              "Authorization": `Bearer ${SUPA_KEY}`,
              "Content-Type":  "application/json",
            },
            body: JSON.stringify({ p_token: state.token_vicky, p_cita_id: state.cita_id }),
          });
        } catch (err) {
          console.warn("Fallo al marcar token Vicky como usado:", err);
        }
      }
    }
    state.cita_confirmada = true;
    // ── ADICIÓN 11: tracking conversión ──
    _actualizarSesion({
      paso_actual:           "s12",
      paso_maximo_alcanzado: "s12",
      cita_confirmada:       true,
      cita_id:               state.cita_id,
    });
    // ── ADICIÓN Bug A: cita confirmada, limpiar storage ──
    _limpiarEstadoPersistido();
    setTimeout(() => { _insertarCierre(); }, 3500);

    const perro    = state.perro.nombre ?? "tu perro";
    const slot     = state.slot_elegido;
    const modalidad = state.modalidad_final === "online"
      ? "online por Google Meet"
      : state.modalidad_zona_fuera_elegida === "palma"
        ? "presencial en un parque de Palma"
        : "en tu domicilio";

    return `¡Todo confirmado! 🐾 El equipo de Perros de la Isla se pondrá en contacto contigo para preparar la primera clase. ` +
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
  // ── ADICIÓN 8: tracking agenda ──
  _actualizarSesion({
    paso_actual:           "s7",
    paso_maximo_alcanzado: "s7",
    abrio_agenda:          true,
  });
  // Recordatorio de valor antes de mostrar el widget
  const modalidadLabel = state.modalidad_final === "online" ? "online (75€)" : "presencial (90€)";
  const msgIntroAgenda = `Aquí tienes los horarios disponibles para tu primera clase ${modalidadLabel}. Reservas con seña de 45€.`;
  _mostrarVictoria(msgIntroAgenda);
  _registrarTurno("victoria", msgIntroAgenda);

  // Rescate por inactividad: si el cliente abre agenda y no elige
  // slot en 45 segundos, mostramos burbuja con WhatsApp para no
  // perder al cliente que duda.
  if (_timerRescateAgenda) clearTimeout(_timerRescateAgenda);
  _timerRescateAgenda = setTimeout(() => {
    if (state.current_step === "s7" && !state.slot_elegido) {
      const msgRescate = "¿No encuentras un horario que te encaje? Si quieres, escríbenos al 622 922 173 y te buscamos hueco.";
      _mostrarVictoria(msgRescate);
      _registrarTurno("victoria", msgRescate);
    }
    _timerRescateAgenda = null;
  }, 45000);

  const contenedor = _insertarContenedorEnChat("victoria-agenda-slot", "agenda-widget");
  if (!contenedor) {
    return "Ahora te muestro los horarios disponibles — " +
      "si no aparecen, escríbenos al 622 922 173 y te damos opciones.";
  }

  await renderAgenda(
    contenedor,
    (slotElegido) => {
      // Cancelar rescate por inactividad: el cliente eligió slot
      if (_timerRescateAgenda) {
        clearTimeout(_timerRescateAgenda);
        _timerRescateAgenda = null;
      }
      if (state.slot_confirmando) return;
      state.slot_confirmando = true;

      state.slot_elegido = slotElegido;
      // El clic en "Reservar este horario (seña 45€)" ya es la confirmación.
      // Saltamos directo a s9 (datos cliente) o s10 (pago) según token Vicky.
      _actualizarSesion({
        paso_actual:           "s8",
        paso_maximo_alcanzado: "s8",
        eligio_slot:           true,
      });

      _mostrarTyping(true);
      setTimeout(() => {
        _mostrarTyping(false);

        // Flujo Vicky: datos ya están precargados del token → ir a pago directo
        if (state.token_vicky) {
          state.current_step = "s10";
          const msg = `Perfecto, reservamos el ${slotElegido.label}. ` + _explicarPago();
          _registrarTurno("victoria", msg);
          _mostrarVictoria(msg);
          _actualizarProgreso();
          setTimeout(() => {
            _mostrarTyping(true);
            setTimeout(() => {
              _mostrarTyping(false);
              _iniciarPago();
            }, 1000);
          }, 3500);
        } else {
          // Flujo normal: ir a s9 (datos cliente)
          state.current_step = "s9";
          const msg = `Perfecto, el ${slotElegido.label} queda apartado para ti. ` +
            "Vamos a tomar tus datos para confirmar la reserva. ¿Cuál es tu nombre completo y tu teléfono?";
          _registrarTurno("victoria", msg);
          _mostrarVictoria(msg);
          _actualizarProgreso();
        }

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
// LLAMADA — Reserva de llamada con el adiestrador (catch-all del s6)
// Patrón espejado de _iniciarAgenda: insertamos un widget como burbuja
// del chat. Diferencia clave: import dinámico de llamada.js para no
// cargar el bundle hasta que el lead efectivamente pulse "Agendar llamada".
// ─────────────────────────────────────────────────────────────────────────────

async function _iniciarLlamada() {
  const contenedor = _insertarContenedorEnChat("victoria-llamada-slot", "llamada-widget");
  if (!contenedor) {
    return "Ahora te muestro los horarios disponibles para la llamada — " +
      "si no aparecen, escríbenos al 622 922 173 y te buscamos hueco.";
  }

  // Import dinámico: el bundle de llamada.js solo se carga si el lead
  // efectivamente entra al flujo de catch-all y pulsa el CTA.
  const { renderLlamada } = await import("./llamada.js?v=59");

  await renderLlamada(
    contenedor,
    async (datos) => await _finalizarReservaLlamada(datos),
    () => {
      // onVolver — reservado, espejo del contrato de agenda.js
    }
  );

  return null;
}

/**
 * Orquesta la reserva post-confirmación del form de llamada:
 *   1) Cliente — busca por móvil, crea si no existe (vincula a fila existente)
 *   2) llamadas_solicitadas — INSERT con snapshot completo del state
 *   3) ntfy a Charly (ver _notificarLlamada en sub-bloque 5)
 *   4) _actualizarSesion({ agendo_llamada: true }) — tracking de rescate
 *   5) UI: pantalla de éxito + _insertarCierre
 *
 * En modo prueba (?prueba=1) saltea pasos 1-3 (no toca DB, no notifica)
 * pero SÍ marca agendo_llamada y muestra la UI completa — permite testear
 * end-to-end sin contaminar producción. Espejo del s12.
 *
 * Errores: si reservarLlamada o ntfy fallan post-cliente, el cliente
 * queda creado huérfano. Asumido como menos malo que mostrar error sin
 * guardar — el 622 recupera al lead por WhatsApp.
 */
async function _finalizarReservaLlamada({ fecha, hora, nombre, telefono, mensaje_adicional }) {
  // Modo prueba — espejo del s12 (línea ~1330)
  if (state.prueba) {
    _actualizarSesion({ agendo_llamada: true });
    _mostrarExitoLlamada({ fecha, hora, telefono, nombre });
    return;
  }

  try {
    // 1) Cliente — buscar o crear por teléfono
    const cliente_id = await buscarOCrearClientePorTelefono(telefono, {
      nombre,
      telefono,
      zona: state.zona?.zonaDetectada ?? null,
    });

    // 2) Llamada — INSERT con snapshot completo del state
    const llamada = await reservarLlamada({
      cliente_id,
      sesion_id:            state.sesion_id ?? null,
      fecha,
      hora,
      nombre_cliente:       nombre,
      telefono_cliente:     telefono,
      mensaje_adicional:    mensaje_adicional || null,
      zona:                 state.zona?.zonaDetectada ?? null,
      perro_nombre:         state.perro?.nombre        ?? null,
      perro_raza:           state.perro?.raza          ?? null,
      perro_edad_meses:     state.perro?.edad_meses    ?? null,
      perro_peso_kg:        state.perro?.peso_kg       ?? null,
      mensajes_diagnostico: state.mensajes_diagnostico?.length
                             ? state.mensajes_diagnostico
                             : null,
    });

    // 3) ntfy — definida en Sub-bloque 5
    _notificarLlamada({
      llamada,
      nombre,
      telefono,
      fecha,
      hora,
      mensaje_adicional,
      zona:                 state.zona?.zonaDetectada,
      perro_nombre:         state.perro?.nombre,
      perro_raza:           state.perro?.raza,
      perro_edad_meses:     state.perro?.edad_meses,
      perro_peso_kg:        state.perro?.peso_kg,
      mensajes_diagnostico: state.mensajes_diagnostico,
    });

    // 4) Tracking — flag de rescate de lead
    _actualizarSesion({ agendo_llamada: true });

    // 5) UI éxito
    _mostrarExitoLlamada({ fecha, hora, telefono, nombre });
  } catch (err) {
    console.error("Error reservando llamada:", err);
    const errMsg = "Ha habido un problema técnico al reservar la llamada. " +
      "Por favor, escríbenos al 622 922 173 y lo gestionamos enseguida.";
    _mostrarVictoria(errMsg);
    _registrarTurno("victoria", errMsg);
  }
}

/**
 * Renderiza la pantalla de éxito post-reserva con el copy literal
 * aprobado #4. Formato fecha: "martes 19 de mayo" — completo en
 * español ES, sin abreviar. Tras 3500ms inserta el cierre (slogan +
 * IG/web) igual que s12.
 */
function _mostrarExitoLlamada({ fecha, hora, telefono, nombre }) {
  const fechaLegible = _formatearFechaCompleta(fecha);
  const horaCorta    = hora.length > 5 ? hora.substring(0, 5) : hora;

  const msg = `Listo. Hemos agendado una llamada para el ${fechaLegible} a las ${horaCorta}h. ` +
    `El adiestrador o alguien del equipo te llamará al ${telefono}. ` +
    `Si necesitas cambiar algo, escríbenos al 622 922 173.`;

  _mostrarVictoria(msg);
  _registrarTurno("victoria", msg);
  _actualizarProgreso();

  // Cierre con slogan + botones — mismo patrón que s12 (línea ~1370)
  setTimeout(() => { _insertarCierre(); }, 3500);
}

/**
 * "2026-05-19" → "martes 19 de mayo" en español ES.
 * Helper local — el formatearFecha de supabase.js da formato corto
 * abreviado ("Mar 19 may") que no queremos en la pantalla de éxito.
 */
function _formatearFechaCompleta(fechaIso) {
  const d = new Date(fechaIso + "T00:00:00");
  const dias  = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
}

/**
 * Notifica a Charly por ntfy.sh cuando un lead reserva llamada desde
 * el catch-all del s6. Topic compartido con citas — Charly ya lo
 * monitorea en su móvil.
 *
 * Title ASCII-safe (sin emojis) por restricción ISO-8859-1 del header
 * HTTP. Días abreviados ["lun","mar","mie.","jue","vie","sab.","dom"]
 * para evitar tildes en el Title. Body con prefijo 📞 y datos
 * completos para preparar la llamada (móvil destacado, perro, zona,
 * mensaje adicional, problema reportado, id de la fila).
 *
 * Try/catch interno DELIBERADO: un fallo de ntfy NO debe romper la
 * UX del cliente. La fila ya está insertada en llamadas_solicitadas.
 * Charly la verá en admin (Fase 4) o Google Calendar (Fase 5).
 */
async function _notificarLlamada({
  llamada,
  nombre,
  telefono,
  fecha,
  hora,
  mensaje_adicional,
  zona,
  perro_nombre,
  perro_raza,
  perro_edad_meses,
  perro_peso_kg,
  mensajes_diagnostico,
}) {
  try {
    const DIAS_ABREV   = ["dom", "lun", "mar", "mie.", "jue", "vie", "sab."];
    const fechaObj     = new Date(fecha + "T00:00:00");
    const diaAbrev     = DIAS_ABREV[fechaObj.getDay()];
    const horaCorta    = hora.length > 5 ? hora.substring(0, 5) : hora;
    const primerNombre = (nombre ?? "").split(" ")[0] || nombre;

    // Edad humana: <12m → "X meses", ≥12m → "X años"
    const edadTexto =
      perro_edad_meses == null         ? "—" :
      perro_edad_meses < 12            ? `${perro_edad_meses} meses` :
                                         `${Math.round(perro_edad_meses / 12)} años`;

    // Resumen del problema: primeros 2 mensajes del cliente, truncado a 400 chars
    const mensajesCliente = Array.isArray(mensajes_diagnostico) ? mensajes_diagnostico : [];
    const reportadoTexto  = mensajesCliente.slice(0, 2).join(" · ").slice(0, 400) ||
      "Sin texto del cliente";

    const cuerpo = [
      "📞 LLAMADA AGENDADA",
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `📅 Cuándo: ${diaAbrev} ${fecha} a las ${horaCorta}h`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "📞 MÓVIL (llamar a este número):",
      "",
      `    ➡️  ${telefono}  ⬅️`,
      `    👤  ${nombre}`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `🐕 Perro: ${perro_nombre ?? "—"} · ${perro_raza ?? "—"} · ${edadTexto} · ${perro_peso_kg ?? "—"}kg`,
      `📍 Zona: ${zona ?? "—"}`,
      "",
      mensaje_adicional
        ? `📝 Mensaje del cliente:\n   "${mensaje_adicional.slice(0, 300)}"`
        : "📝 Mensaje del cliente: —",
      "",
      `🗒️ Reportado en chat:`,
      `   "${reportadoTexto}"`,
      "",
      `🔗 ID llamada: ${llamada?.id ?? "—"}`,
    ].join("\n");

    const titulo = `LLAMADA - ${diaAbrev} ${horaCorta} - ${primerNombre}`;

    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Title":        titulo,
        "Priority":     "high",
        "Tags":         "phone,calendar",
      },
      body: cuerpo,
    });
  } catch (err) {
    // DELIBERADO: no re-tirar. La fila ya está en llamadas_solicitadas.
    // El cliente ve "Listo, hemos agendado" sin enterarse del fallo.
    // Charly la verá igual en admin (Fase 4) o Google Calendar (Fase 5).
    console.warn("Error notificando llamada por ntfy (la fila ya está guardada):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGO — se inserta dinámicamente en el chat
// ─────────────────────────────────────────────────────────────────────────────

function _iniciarPago() {
  // ── ADICIÓN 10: tracking pago ──
  _actualizarSesion({
    paso_actual:           "s10",
    paso_maximo_alcanzado: "s10",
    llego_a_pago:          true,
  });
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
    return `Te cuento los detalles. El valor de la clase suelta online es de 75€, y el del pack de 4 clases, 240€ (ahorras 60€). No hace falta que elijas ahora: reservas con una seña de 45€ (por Bizum o transferencia, que se descuenta del total) y en la primera clase, cuando ya conozcas al adiestrador, decides si haces el pack o solo esa clase, sin compromiso.

Puedes cancelar o cambiar la cita sin cargo avisando con al menos 48h de antelación; con menos de 48h, la seña no se devuelve.`;
  }
  return `Te cuento los detalles. El valor de la clase suelta presencial es de 90€, y el del pack de 4 clases, 300€ (ahorras 60€). No hace falta que elijas ahora: reservas con una seña de 45€ (por Bizum o transferencia, que se descuenta del total) y en la primera clase, cuando ya conozcas al adiestrador, decides si haces el pack o solo esa clase, sin compromiso.

Puedes cancelar o cambiar la cita sin cargo avisando con al menos 48h de antelación; con menos de 48h, la seña no se devuelve.`;
}

function _mostrarPrecioYBotonesAgenda() {
  // ── ADICIÓN 7: tracking precio ──
  _actualizarSesion({ vio_precio: true });
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
            label: "📞 Agendar llamada gratuita",
            onClick: async () => {
              _mostrarCliente("📞 Agendar llamada gratuita");
              _registrarTurno("cliente", "Agendar llamada gratuita");
              state.current_step = "s6";  // NO avanzamos a s7 — la llamada es rescate, no agenda
              _mostrarTyping(true);
              setTimeout(async () => {
                _mostrarTyping(false);
                await _iniciarLlamada();
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
  const nombre = state.cliente.nombre || "";
  const slot = state.slot_elegido?.label || "el horario elegido";
  const total = state.modalidad_final === "online" ? "75€" : "90€";
  return `Perfecto${nombre ? `, ${nombre}` : ""}. Tu clase queda apartada para ${slot}. ` +
    `Solo falta la seña de 45€ por Bizum o transferencia para asegurar el horario ` +
    `(se descuenta del total de ${total}). Ahora te paso las opciones de pago.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO MATCHING
// ─────────────────────────────────────────────────────────────────────────────

async function _evaluarYResponder(textoActual) {
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
        // ── ADICIÓN 5: tracking mensaje principal ──
        _actualizarSesion({
          paso_actual:           "s6",
          paso_maximo_alcanzado: "s6",
          vio_mensaje_principal: true,
          modalidad:             state.modalidad_final,
        });
        // Flag: _enviarMensaje mostrará botones de ramificación DESPUÉS del mensaje
        state.mostrar_ramificacion_tras_protocolo = true;
        return frase;
      }

      return frase;
    }

    case "derivar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("frase null: " + JSON.stringify(decision.frase_params));
      // ── ADICIÓN 6: tracking derivaciones ──
      if (decision.frase_params?.tipo === "etologo") {
        _actualizarSesion({ derivado_etologo: true });
      } else if (decision.frase_params?.tipo === "zona") {
        _actualizarSesion({ derivado_zona: true });
      }
      return frase;
    }

    case "preguntar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("frase null en preguntar");
      // Routear al procesador correcto según qué se está preguntando
      if (decision.pending_next === "modalidad_zona_fuera") {
        state.current_step = "s_zona_fuera";
      } else {
        state.current_step = "s5";  // mordida (legacy: única pregunta hasta v25)
      }
      return frase;
    }

    case "fallback":
      return await _fallbackInteligente(textoActual);

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
    modalidad_zona_fuera_elegida: state.modalidad_zona_fuera_elegida,

    // Estado del fallback IA — usado por la regla de continuidad en
    // decidirRespuesta. Aquí se pasan en plano para que el matcher quede
    // desacoplado de IA_FALLBACK_CONFIG.
    turnos_ia:           state.turnos_ia,
    max_turnos_ia:       IA_FALLBACK_CONFIG.maxTurnos,
    fallback_ia_cerrado: state.fallback_ia_cerrado,
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

  let citaRes;
  try {
    citaRes = await _supabasePost("/rest/v1/citas", {
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
    }, { relanzarError: true });
  } catch (err) {
    if (_esErrorSlotTomado(err)) {
      const msg = "Acabamos de comprobar que ese horario ya no está disponible. Te mostramos las opciones que quedan libres.";
      _registrarTurno("victoria", msg);
      _mostrarVictoria(msg);
      // Reubicar en la agenda. Reseteamos el paso a s7 para que la
      // persistencia (Bug A) y un eventual recargar reabran la agenda y no
      // el cierre de s12. El slot tomado se descarta.
      state.current_step = "s7";
      state.slot_elegido = null;
      await _iniciarAgenda();
      return false; // slot tomado — el caller corta el flujo (no crea conversación)
    }
    throw err;
  }
  state.cita_id = citaRes?.id ?? null;

  await _supabasePost("/rest/v1/conversaciones", {
    cita_id:      state.cita_id,
    turnos:       state.historial_turnos,
    log_matching: state.log_matching_final,
  });
  return true;
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
  if (state.origen)                   flags.push(`🔗 Canal de origen: ${state.origen}`);
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
    : state.modalidad_zona_fuera_elegida === "palma"
      ? "presencial · parque de Palma"
      : "presencial · en tu domicilio";

  const mensajeCliente = [
    `¡Hola ${primerNombre}! 🐾`,
    "",
    "Soy Carlos, de Perros de la Isla. Te confirmo que hemos recibido la seña de 45€ y tu cita está reservada.",
    "",
    `📅 Día y hora: ${slotLabel}`,
    `🐕 Perro: ${perroTexto}`,
    `📍 Modalidad: ${modalidadTexto}`,
    "",
    "Cómo trabajamos:",
    "",
    "La clase dura 1 hora y puede extenderse un poco si hace falta — priorizamos que entiendas todo lo que vemos, no cerrar la clase a toque de reloj.",
    "",
    "Entre clases tienes consultas por WhatsApp con el adiestrador. Te enviamos videos de referencia para que tengas claro cómo practicar, y puedes mandarnos videos tuyos entrenando para que te vayamos corrigiendo. Así cada clase avanza sobre la anterior y aprovechamos al máximo el trabajo.",
    "",
    "Si necesitas cambiar o cancelar, avísame con al menos 48h de antelación y lo reorganizamos sin problema. Con menos de 48h, la seña de 45€ no se devuelve.",
    "",
    "Cualquier duda hasta entonces, aquí estoy.",
    "",
    "Un abrazo,",
    "Carlos",
    "Perros de la Isla 🐾",
  ].join("\n");

  // ─── NOTIFICACIÓN 1: Interna (resumen de la cita + teléfono destacado) ───
  const mensajeInterno = [
    "━━━━━━━━━━━━━━━━━━━━━━━",
    "📞 TELÉFONO (guardar en agenda):",
    "",
    `    ➡️  ${c.telefono ?? "—"}  ⬅️`,
    `    👤  ${c.nombre ?? "—"}`,
    "━━━━━━━━━━━━━━━━━━━━━━━",
    "",
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
  ].join("\n");

  // ─── Notificación 1: alta prioridad, suena (para tener teléfono y resumen) ───
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Title": `Nueva cita - ${primerNombre}`,
      "Priority": "high",
      "Tags": "dog,calendar",
    },
    body: mensajeInterno,
  });

  // ─── Notificación 2: prioridad baja (no vuelve a sonar) — mensaje listo para WhatsApp ───
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Title": `Mensaje para ${primerNombre} (copiar y enviar)`,
      "Priority": "low",
      "Tags": "speech_balloon",
    },
    body: mensajeCliente,
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// BARRA DE PROGRESO
// ─────────────────────────────────────────────────────────────────────────────

const PROGRESO_POR_PASO = {
  s0: 0, s_inicio: 30, s1: 35, s2: 45, s3: 55, s4: 65, s5: 70,
  s6: 75, s7: 82, s8: 88, s9: 92, s10: 95, s11: 98, s12: 100,
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

  const compuesto = t.match(/(\d+)\s*años?\s*y\s*(\d+)\s*meses?\b/i);
  if (compuesto) return parseInt(compuesto[1]) * 12 + parseInt(compuesto[2]);

  const semanas = t.match(/(\d+)\s*semanas?\b/i);
  if (semanas) return Math.round(parseInt(semanas[1]) / 4.3);

  const meses = t.match(/(\d+)\s*meses?\b/i);
  if (meses) return parseInt(meses[1]);

  const anos = t.match(/(\d+)\s*(?:años?|ano)\b/i);
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
  // Estrategia: detectar SECUENCIAS LARGAS de dígitos que claramente son
  // teléfonos. Aceptamos cualquier país (Mallorca tiene mucho cliente
  // extranjero: alemanes, ingleses, franceses, italianos). El antifraude
  // real lo pone Bizum en el flujo de pago — si el número es falso, el
  // cliente no puede pagar la seña de 45€ y se autorregula.
  //
  // Acepta:
  //   - 612345678          (ES sin prefijo)
  //   - +34 612 345 678    (ES con prefijo)
  //   - +44 7700 900123    (UK)
  //   - +49 151 12345678   (DE)
  //   - +33 6 12 34 56 78  (FR)
  //   - 4477009 00123      (raro pero válido — fallback genérico)
  //
  // Rechaza:
  //   - "tengo 5 años"     (1 dígito)
  //   - "07001"            (CP, 5 dígitos)
  //   - "65 kilos"         (2 dígitos)

  // 1) Internacional con + adelante: + seguido de 8 a 15 dígitos,
  //    permitiendo separadores espacios, guiones, puntos, paréntesis.
  const reIntl = /\+\d[\d\s.\-()]{7,18}/;

  // 2) ES sin prefijo: 9 dígitos contiguos comenzando por 6/7/8/9
  //    (móvil 6/7, fijo 8/9), con separadores opcionales.
  const reES = /(?<!\d)[6789]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}(?!\d)/;

  // 3) Fallback genérico: cualquier secuencia con separadores
  //    que tenga al menos ~9 caracteres (≈ 8 dígitos reales).
  //    Cubre extranjeros que copian-pegan números formateados raro
  //    sin '+'. Se evalúa ÚLTIMO porque privilegia matches con + o ES.
  const reFallback = /\d[\d\s.\-()]{8,18}/;

  const match =
    texto.match(reIntl) ||
    texto.match(reES) ||
    texto.match(reFallback);

  if (!match) return null;

  // Normalizar: dejar solo dígitos y conservar el + inicial si lo había.
  let limpio = match[0].trim();
  const tienePlus = limpio.startsWith("+");
  limpio = limpio.replace(/[^\d]/g, "");

  // Validar longitud final según ITU-T E.164 (mín 8, máx 15).
  if (limpio.length < 8 || limpio.length > 15) return null;

  return tienePlus ? `+${limpio}` : limpio;
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

const MARCADORES_TUTOR_SOBREPASADO = [
  "insostenible",
  "no puedo mas", "ya no puedo", "no doy mas",
  "no se que hacer",
  "no aguanto",
  "ultima opcion", "ultimo recurso",
  "nuevo hogar", "darlo en adopcion", "regalarlo", "deshacerme",
  "desesperad",
  "estoy harto", "estoy harta", "harto de", "harta de",
];

function _tieneMarcadoresSobrepasado(texto) {
  const norm = normalizar(texto);
  return MARCADORES_TUTOR_SOBREPASADO.some((m) => norm.includes(normalizar(m)));
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
  if (!texto) return;

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

  // ── ADICIÓN 3: tracking prescan ──
  _actualizarSesion({
    zona:        state.zona?.zonaDetectada,
    modalidad:   state.zona?.modalidad,
    raza_perro:  state.perro.raza,
    peso_kg:     state.perro.peso_kg,
    edad_meses:  state.perro.edad_meses,
    es_ppp:      state.perro.es_ppp,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function _registrarTurno(rol, texto) {
  state.historial_turnos.push({ rol, texto, timestamp: new Date().toISOString() });
  _persistirEstado();
}

async function _fallbackInteligente(textoUsuario) {
  // 1. Kill-switch global
  if (!IA_FALLBACK_CONFIG.activa) {
    return _fallbackHumano("ia_desactivada");
  }

  // 2. Modo prueba: solo URL con ?prueba=1
  if (IA_FALLBACK_CONFIG.soloPrueba && !state.prueba) {
    return _fallbackHumano("ia_solo_prueba");
  }

  // 3. Cierre ya forzado en turno previo: no reentrar
  if (state.fallback_ia_cerrado) {
    return _fallbackHumano("ia_ya_cerrada");
  }

  // 4. Tope de turnos alcanzado: forzar cierre con frase fija
  if (state.turnos_ia >= IA_FALLBACK_CONFIG.maxTurnos) {
    state.fallback_ia_cerrado = true;
    state.ultima_respuesta_origen = { tipo: "IA_CIERRE" };
    return "Para orientarte mejor, ¿puedes dejarnos tu WhatsApp? El adiestrador te contacta personalmente y te explica con detalle. También puedes escribir al 622 922 173 si lo prefieres.";
  }

  // 5. Construir messages con historial + turno actual
  const messages = [
    ...state.historial_ia,
    { role: "user", content: textoUsuario },
  ];

  // 6. fetch al proxy con AbortController + timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IA_FALLBACK_CONFIG.timeoutMs);

  try {
    const res = await fetch(IA_FALLBACK_CONFIG.proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`Victoria IA fallback: proxy respondió ${res.status}`);
      return _fallbackHumano(`ia_proxy_${res.status}`);
    }

    const data = await res.json();
    if (typeof data?.reply !== "string" || !data.reply.trim()) {
      console.warn("Victoria IA fallback: reply vacío o inválido", data);
      return _fallbackHumano("ia_reply_vacio");
    }

    // 7. Sanitizar markdown que la IA pueda haber introducido pese al system prompt
    const replyLimpio = data.reply
      .replace(/\*\*(.*?)\*\*/g, '$1')   // negrita: **texto** → texto
      .replace(/\*(.*?)\*/g, '$1')       // cursiva: *texto* → texto
      .replace(/__(.*?)__/g, '$1')       // negrita alt: __texto__ → texto
      .replace(/_(.*?)_/g, '$1')         // cursiva alt: _texto_ → texto
      .replace(/`(.*?)`/g, '$1');        // backticks: `código` → código

    // 8. Persistir historial + incrementar turnos
    state.historial_ia.push({ role: "user", content: textoUsuario });
    state.historial_ia.push({ role: "assistant", content: replyLimpio });
    state.turnos_ia += 1;
    state.ultima_respuesta_origen = { tipo: "IA", turno: state.turnos_ia };
    return replyLimpio;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      console.warn("Victoria IA fallback: timeout");
      return _fallbackHumano("ia_timeout");
    }
    console.warn("Victoria IA fallback: error de red:", err);
    return _fallbackHumano("ia_error_red");
  }
}

function _fallbackHumano(razon) {
  console.warn("Victoria fallback:", razon);
  state.ultima_respuesta_origen = { tipo: "FH", motivo: razon };
  return "Para poder orientarte bien, te paso directamente con el equipo de Perros de la Isla. " +
    "Puedes escribirnos por WhatsApp al 622 922 173.";
}

/**
 * Devuelve el nombre del perro o "tu perro" como fallback cuando no se conoce
 * (cliente respondió evasivamente en s2 o el state aún no se ha rellenado).
 * Centraliza el fallback para evitar render de "null" en plantillas de Victoria.
 */
function _nombrePerro() {
  return state.perro.nombre ?? "tu perro";
}

/**
 * Devuelve la frase de apertura que sigue al paso s2 (nombre del perro).
 * Si el cliente dio un nombre → felicitación. Si no (respondió evasivamente)
 * → frase neutra que reconoce sin felicitar. Centraliza la decisión por si
 * en el futuro hay más plantillas que abren tras s2.
 */
function _aperturaPostNombre() {
  return "Bien.";
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
async function _recalcularTrasDesescalada(texto) {
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
  const respuesta = await _evaluarYResponder(texto);

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

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING DE EMBUDO — tabla sesiones en Supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea una fila nueva en la tabla sesiones cuando el cliente abre Victoria.
 * Guarda el id devuelto en state.sesion_id para poder actualizar después.
 * No bloquea el flujo si falla — Victoria sigue funcionando igual.
 */
async function _crearSesionTracking() {
  try {
    const ahora = Date.now();
    state.sesion_inicio_ts = ahora;

    const res = await _supabasePost("/rest/v1/sesiones", {
      paso_actual:           "s0",
      paso_maximo_alcanzado: "s0",
      tema_preseleccionado:  state.tema_preseleccionado,
      origen:                state.origen,
      es_prueba:             state.prueba,
      dispositivo:           /Mobi|Android/i.test(navigator.userAgent) ? "movil" : "desktop",
    });

    if (res?.id) {
      state.sesion_id = res.id;
    }
  } catch (err) {
    console.warn("Tracking: fallo al crear sesión (continúo sin tracking):", err);
  }
}

/**
 * Variante de _crearSesionTracking para el flujo Vicky: marca es_vicky=true
 * y arranca el tracking en s7 (saltamos s0-s6, el embudo conversacional).
 * Persiste de entrada los datos del perro/zona ya conocidos por el token.
 */
async function _crearSesionTrackingVicky() {
  try {
    const ahora = Date.now();
    state.sesion_inicio_ts = ahora;

    const res = await _supabasePost("/rest/v1/sesiones", {
      paso_actual:           "s7",
      paso_maximo_alcanzado: "s7",
      origen:                state.origen,
      es_prueba:             state.prueba,
      es_vicky:              true,
      dispositivo:           /Mobi|Android/i.test(navigator.userAgent) ? "movil" : "desktop",
      zona:                  state.zona?.zonaDetectada,
      modalidad:             state.modalidad_final,
      raza_perro:            state.perro.raza,
      peso_kg:               state.perro.peso_kg,
      edad_meses:            state.perro.edad_meses,
      es_ppp:                state.perro.es_ppp,
      perro_nombre:          state.perro.nombre,
      mensajes_diagnostico:  state.mensajes_diagnostico,
    });

    if (res?.id) {
      state.sesion_id = res.id;
    }
  } catch (err) {
    console.warn("Tracking Vicky: fallo al crear sesión:", err);
  }
}

/**
 * Actualiza la fila de la sesión en Supabase con datos nuevos. Acepta un
 * objeto parcial — solo se actualizan las columnas que se pasan.
 * Se ejecuta "fire and forget" — no bloquea el flujo principal si falla.
 */
function _actualizarSesion(cambios) {
  if (!state.sesion_id) return;

  const payload = {
    ...cambios,
    ultima_actualizacion: new Date().toISOString(),
  };

  if (state.sesion_inicio_ts) {
    payload.duracion_segundos = Math.round((Date.now() - state.sesion_inicio_ts) / 1000);
  }

  // Persistencia de datos que vivían solo en memoria. Se inyectan en CADA
  // PATCH para refrescar el array si s5 añadió mensajes tras la PATCH de s4
  // y para que sesiones que se mueren a mitad del flujo conserven lo último
  // que vio Victoria. Redundancia barata (<1KB por PATCH típico).
  if (state.perro?.nombre)               payload.perro_nombre         = state.perro.nombre;
  if (state.mensajes_diagnostico?.length) payload.mensajes_diagnostico = state.mensajes_diagnostico;

  fetch(`${SUPA_URL}/rest/v1/sesiones?id=eq.${state.sesion_id}`, {
    method: "PATCH",
    headers: {
      "apikey":        SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(err => {
    console.warn("Tracking: fallo al actualizar sesión:", err);
  });

  // ── ADICIÓN Bug A: mirror a localStorage para retomar al recargar ──
  _persistirEstado();
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA DE SESIÓN — Bug A: retomar al recargar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda el state completo en localStorage para que el cliente pueda
 * recargar la página o cerrar/abrir el chat y retomar donde lo dejó.
 * Se llama después de cada _actualizarSesion y _registrarTurno.
 * Silencioso si localStorage falla (Safari incognito, quota llena, etc.).
 */
function _persistirEstado() {
  // Guards: no persistir si no hay sesión, si es prueba, o si ya se confirmó
  if (!state.sesion_id) return;
  if (state.prueba) return;
  if (state.cita_confirmada) return;

  try {
    const snapshot = {
      ...state,
      _persistido_ts: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    // Silencioso — Safari incognito tira QuotaExceededError, no es crítico
  }
}

/**
 * Lee el state guardado de localStorage. Valida que sea retomable:
 * - JSON parseable
 * - Tiene sesion_id
 * - No es prueba
 * - No tiene cita_confirmada
 * - No expiró el TTL (24h)
 * Si no pasa validación, retorna null (no restaura).
 */
function _cargarEstadoPersistido() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== "object") return null;
    if (!snapshot.sesion_id) return null;
    if (snapshot.cita_confirmada === true) return null;
    if (snapshot.prueba === true) return null;

    // TTL check
    const persistidoTs = snapshot._persistido_ts || snapshot.sesion_inicio_ts || 0;
    if (Date.now() - persistidoTs > STORAGE_TTL_MS) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      return null;
    }

    return snapshot;
  } catch (err) {
    return null;
  }
}

/**
 * Borra el state persistido. Se llama cuando la sesión cumple su misión
 * (cita_confirmada=true) o cuando se decide descartar (token Vicky, tema
 * cambiado, prueba en URL).
 */
function _limpiarEstadoPersistido() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // ignore
  }
}

/**
 * Repinta el historial de turnos en la UI tras restaurar el state.
 * Itera state.historial_turnos e inserta las burbujas SIN animación de
 * typing — pintado instantáneo para que el cliente vea el chat completo
 * antes del mensaje de "continuemos donde quedamos".
 */
function _repintarHistorial() {
  if (!_chatEl || !_twEl) return;
  if (!Array.isArray(state.historial_turnos) || state.historial_turnos.length === 0) {
    return;
  }
  for (const turno of state.historial_turnos) {
    const burbuja = document.createElement("div");
    if (turno.rol === "victoria") {
      burbuja.className = "msg bot in";
      burbuja.innerHTML = `
        <div class="av">
          <img src="${VICTORIA_AVATAR}" alt="Victoria">
        </div>
        <div class="bub">${_escaparHTML(turno.texto)}</div>
      `;
    } else if (turno.rol === "cliente") {
      burbuja.className = "msg usr in";
      burbuja.innerHTML = `<div class="bub">${_escaparHTML(turno.texto)}</div>`;
    } else {
      continue;
    }
    _chatEl.insertBefore(burbuja, _twEl);
  }
  _scrollAbajo();
}

/**
 * Re-dispara el widget o mensaje correspondiente al paso actual tras
 * restaurar. Lógica diferenciada por paso para no confundir al cliente:
 *  - s10 (pago): validar slot. Si libre → _iniciarPago(). Si tomado →
 *    mensaje + _iniciarAgenda().
 *  - s7 (eligiendo slot, agenda abierta sin elegir): _iniciarAgenda().
 *  - s8 (slot elegido, esperando confirmación): mensaje específico
 *    "¿Confirmamos tu cita del [slot]?" SIN agenda (el cliente responde
 *    sí/no en el input, el flujo s8 procesa).
 *  - s9 (slot confirmado, pidiendo datos cliente): mensaje SIN agenda.
 *  - s1-s6 (flujo conversacional): mensaje genérico, sin widget.
 *
 * Guard contra duplicación: si el último turno del historial ya es un
 * "Bienvenido de vuelta", no agregamos otro (caso de doble F5).
 */
async function _redispararPasoActual() {
  const paso = state.current_step;

  // Guard contra mensaje duplicado de bienvenida (doble F5)
  const ultimoTurno = state.historial_turnos[state.historial_turnos.length - 1];
  const yaSaludoBienvenida = ultimoTurno
    && ultimoTurno.rol === "victoria"
    && typeof ultimoTurno.texto === "string"
    && ultimoTurno.texto.startsWith("¡Bienvenido de vuelta");

  const decir = (msg) => {
    if (yaSaludoBienvenida) return;
    _registrarTurno("victoria", msg);
    _mostrarVictoria(msg);
  };

  if (paso === "s10") {
    const slot = state.slot_elegido;
    if (!slot || !slot.fecha || !slot.hora) {
      await _iniciarAgenda();
      return;
    }
    try {
      const slotsLibres = await obtenerSlotsDisponibles();
      const sigueLibre = (slotsLibres || []).some(
        s => s.fecha === slot.fecha && s.hora === slot.hora
      );
      if (sigueLibre) {
        decir(`¡Bienvenido de vuelta! Continuemos con tu pago para confirmar la cita del ${slot.label}.`);
        _iniciarPago();
      } else {
        decir(`¡Bienvenido de vuelta! El horario que habías elegido (${slot.label}) ya no está disponible. Te muestro las opciones que quedan libres.`);
        await _iniciarAgenda();
      }
    } catch (err) {
      console.warn("Error validando slot al restaurar:", err);
      _iniciarPago();
    }
  } else if (paso === "s7") {
    decir("¡Bienvenido de vuelta! Sigamos eligiendo el horario.");
    await _iniciarAgenda();
  } else if (paso === "s8") {
    const slot = state.slot_elegido;
    const slotLabel = slot && slot.label ? slot.label : "el horario elegido";
    decir(`¡Bienvenido de vuelta! ¿Confirmamos tu cita del ${slotLabel}?`);
    // Sin widget — el cliente tipea sí/no en el input, _procesarS8 maneja
  } else if (paso === "s9") {
    decir("¡Bienvenido de vuelta! Continuemos con tus datos.");
    // Sin widget — el cliente sigue tipeando datos, _procesarS9 maneja
  } else if (paso === "s_inicio") {
    // El cliente recién llegó y aún no escribió nada; el saludo ya se repintó
    // con _repintarHistorial. No mostramos "bienvenido de vuelta".
  } else {
    decir("¡Bienvenido de vuelta! Continuemos donde quedamos.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE — helper genérico
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta si un error de Supabase corresponde a violación del constraint
 * UNIQUE citas_slot_unico (Capa 1, aplicado 22/05/2026).
 */
function _esErrorSlotTomado(error) {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = typeof error.message === 'string' ? error.message : '';
  return msg.includes('citas_slot_unico') || msg.includes('duplicate key');
}

async function _supabasePost(endpoint, body, { relanzarError = false } = {}) {
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
    if (!res.ok) {
      // Parsear body para extraer info del error (ej. código 23505 del
      // constraint citas_slot_unico — Capa 1 aplicada 22/05/2026).
      let bodyErr = {};
      try { bodyErr = await res.json(); } catch (_) {}
      const err = new Error(bodyErr.message || `Supabase ${res.status} en ${endpoint}`);
      err.status = res.status;
      err.code = bodyErr.code;
      err.details = bodyErr.details;
      err.hint = bodyErr.hint;
      throw err;
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error("Error Supabase:", err);
    // Opt-in: solo los llamadores que pasan { relanzarError: true } reciben
    // el error propagado. Por defecto se mantiene el contrato histórico
    // (devolver null) para no romper los otros llamadores del helper.
    if (relanzarError) throw err;
    return null;
  }
}
