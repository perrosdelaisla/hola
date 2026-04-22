/**
 * victoria.js
 * Perros de la Isla — Embudo Victoria
 * Controlador conversacional — conecta matching, frases, agenda y pagos
 * Versión 1.0 · Abril 2026
 *
 * EXPORTS PÚBLICOS:
 *   iniciarConversacion()  → primer mensaje de bienvenida
 *   procesarMensaje(texto) → entrada principal del cliente
 *   obtenerEstado()        → estado actual para la UI
 *
 * FLUJO:
 *   s0  → bienvenida + primera pregunta
 *   s1  → zona del cliente
 *   s2  → nombre del perro
 *   s3  → edad + raza + peso (un solo paso, con repregunta si faltan)
 *   s4  → descripción libre del problema
 *   s5  → preguntas de afinado (filtro mordida, conducta, etc.)
 *   s6  → propuesta de protocolo (Victoria responde con frase)
 *   s7  → elección de slot (renderAgenda)
 *   s8  → confirmación del slot elegido
 *   s9  → datos del cliente (nombre, teléfono, email si online, dirección)
 *   s10 → explicación del pago
 *   s11 → subida captura de Bizum/transferencia
 *   s12 → confirmación final
 */

import { normalizar }            from "./victoria-utils.js";
import { detectarZona }          from "./victoria-zones.js";
import { detectarCuadros, detectarLateral } from "./victoria-dictionaries.js";
import { obtenerFrase }          from "./victoria-phrases.js";
import { esPPP }                 from "./victoria-breeds.js";
import { decidirRespuesta }      from "./victoria-matching.js";
import { renderAgenda }          from "./agenda.js";
import { renderPago, confirmarPago } from "./pagos.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL  = "https://sydzfwwiruxqaxojymdz.supabase.co";
const SUPA_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZHpmd3dpcnV4cWF4b2p5bWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2ODMzNDcsImV4cCI6MjA1OTI1OTM0N30.ixjBBHMsEu5ANxl4MXodVdYFhnlEi9MBnj0TxmPHxe0";
const NTFY_TOPIC = "perrosdelaisla-citas-2026"; // Charly: cambia por string aleatorio antes de producción

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO CONVERSACIONAL
// Vive en memoria durante la sesión — se persiste en Supabase al cerrar cita
// ─────────────────────────────────────────────────────────────────────────────

let state = _estadoInicial();

function _estadoInicial() {
  return {
    // Flujo
    current_step: "s0",
    pending: null,
    cuadro_pendiente_mordida: null,
    gravedad_mordida: null,
    lateral_detectado: null,
    decision_actual: null,       // última Decision de victoria-matching
    s3_intentos: 0,              // reintentos en paso s3

    // Datos del perro
    perro: {
      nombre: null,
      edad_meses: null,
      raza: null,
      peso_kg: null,
      es_ppp: false,
    },

    // Zona (output de detectarZona)
    zona: {
      zonaDetectada: null,
      modalidad: "desconocida",
      esSonGotleu: false,
      necesitaAclaracion: true,
    },

    // Solo mensajes de s4+s5 — los que usa el matcher
    mensajes_diagnostico: [],

    // Datos del cliente (recogidos en s9)
    cliente: {
      nombre: null,
      telefono: null,
      email: null,
      direccion: null,
    },

    // Cita
    slot_elegido: null,
    modalidad_final: null,
    cita_id: null,
    captura_url: null,
    pago_pendiente_verificar: false,
    cita_confirmada: false,

    // Historial completo para Carlos (guardado en Supabase al cerrar)
    historial_turnos: [],
    log_matching_final: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicia la conversación. Devuelve el primer mensaje de Victoria.
 * @returns {string}
 */
export function iniciarConversacion() {
  state = _estadoInicial();
  const bienvenida = "¡Hola! Soy Victoria, la asistente de Perros de la Isla. " +
    "Estoy aquí para ayudarte a encontrar el protocolo adecuado para tu perro. " +
    "Para empezar, ¿en qué zona de Mallorca estás?";
  _registrarTurno("victoria", bienvenida);
  state.current_step = "s1";
  return bienvenida;
}

/**
 * Procesa el mensaje del cliente y devuelve la respuesta de Victoria.
 * @param {string} texto
 * @returns {string|null} — null si el paso usa renderizado especial (agenda, pago)
 */
export function procesarMensaje(texto) {
  if (!texto?.trim()) return null;
  const textoLimpio = texto.trim();
  _registrarTurno("cliente", textoLimpio);

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

  const respuesta = procesador(textoLimpio);
  if (respuesta) _registrarTurno("victoria", respuesta);
  return respuesta;
}

/** Devuelve el estado actual para que la UI sepa en qué paso está */
export function obtenerEstado() {
  return {
    step: state.current_step,
    pending: state.pending,
    modalidad: state.modalidad_final ?? state.zona?.modalidad,
    cita_confirmada: state.cita_confirmada,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESADORES DE PASOS
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
  // Limpiar artículos comunes ("se llama X", "mi perro es X")
  const nombre = texto
    .replace(/^(se llama|mi perro (es|se llama)|se llama)\s*/i, "")
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
  const raza = _extraerRaza(texto); // extrae solo la raza, no el texto entero

  if (edad !== null) state.perro.edad_meses = edad;
  if (peso !== null) state.perro.peso_kg    = peso;
  if (raza !== null) state.perro.raza       = raza;

  // Calcular PPP — usar texto completo por si la raza está en forma larga
  state.perro.es_ppp = esPPP(texto);

  const faltaEdad = state.perro.edad_meses === null;
  const faltaPeso = state.perro.peso_kg    === null;
  const faltaRaza = state.perro.raza       === null;

  if ((faltaEdad || faltaPeso) && state.s3_intentos < 2) {
    state.s3_intentos++;
    if (faltaEdad && faltaPeso) {
      return `Necesito saber la edad y el peso de ${state.perro.nombre} para orientarte bien. ` +
        "¿Puedes decirme cuánto tiempo tiene y cuánto pesa aproximadamente?";
    }
    if (faltaEdad) {
      return `¿Qué edad tiene ${state.perro.nombre}? Con meses si aún es cachorro, o años si ya es adulto.`;
    }
    if (faltaPeso) {
      return `¿Cuánto pesa ${state.perro.nombre} aproximadamente? No hace falta que sea exacto.`;
    }
  }

  // Si tras 2 intentos sigue faltando, usar defaults y continuar
  if (state.perro.edad_meses === null) state.perro.edad_meses = 24;
  if (state.perro.peso_kg    === null) state.perro.peso_kg    = 15;
  if (state.perro.raza       === null) state.perro.raza       = "mestizo"; // safe default

  state.current_step = "s4";
  return `Perfecto. Cuéntame, ¿qué te gustaría mejorar o trabajar con ${state.perro.nombre}? ` +
    "Descríbeme la situación con tus propias palabras.";
}

function _procesarS4_Problema(texto) {
  // Añadir a mensajes de diagnóstico (solo s4 y s5 alimentan el matcher)
  state.mensajes_diagnostico.push(texto);

  // Detectar lateral — función pura
  const lateral = detectarLateral(texto);

  // Ignorar lateral si hay cuadros fuertes en el mismo mensaje
  if (lateral) {
    const cuadros = detectarCuadros(texto);
    const hayCuadroFuerte = cuadros.cuadros.some(
      (c) => c.confianza === "alta" || c.confianza === "media"
    );
    if (!hayCuadroFuerte) {
      state.lateral_detectado = lateral;
    }
  }

  return _evaluarYResponder(texto);
}

function _procesarS5_Afinado(texto) {
  // Las respuestas a preguntas de afinado también alimentan el matcher
  state.mensajes_diagnostico.push(texto);
  // Nota: respuesta_pendiente se construye en _construirContexto desde textoActual
  // No se asigna aquí para evitar duplicidad
  return _evaluarYResponder(texto);
}

function _procesarS6_Protocolo(texto) {
  // El cliente puede preguntar algo después de recibir el protocolo
  // Si es afirmativo/pregunta, continuar a agenda; si es nueva info, re-evaluar
  const norm = normalizar(texto);
  // Mensajes cortos y afirmativos → ir a agenda
  // Restricción de longitud para evitar falsos positivos ("sí, pero antes quiero preguntar...")
  const esAfirmativo = texto.length < 20 &&
    ["sí", "si", "ok", "vale", "perfecto", "adelante",
     "me interesa", "quiero", "me apunto", "venga"].some(
      (kw) => norm.includes(kw)
    );

  if (esAfirmativo) {
    state.current_step = "s7";
    return _iniciarAgenda();
  }

  // Si no es afirmativo, tratar como nueva info diagnóstica
  state.mensajes_diagnostico.push(texto);
  return _evaluarYResponder(texto);
}

function _procesarS7_Slot(_texto) {
  // La elección de slot se hace con renderAgenda — este paso se gestiona por callback
  // Si llega texto aquí, probablemente el cliente escribió algo mientras ve la agenda
  return "Cuando veas un hueco que te venga bien, selecciónalo en el calendario de arriba.";
}

function _procesarS8_ConfirmacionSlot(texto) {
  if (!state.slot_elegido) {
    return "Parece que no has seleccionado ningún horario todavía. " +
      "Elige el que mejor te venga en el calendario.";
  }

  const slot = state.slot_elegido;
  state.current_step = "s9";

  return `Perfecto, reservamos el ${slot.label}. ` +
    "Para terminar de confirmar la cita necesito algunos datos. " +
    "¿Cuál es tu nombre completo y tu número de teléfono?";
}

function _procesarS9_DatosCliente(texto) {
  // Extracción básica de nombre y teléfono
  const telefono = _extraerTelefono(texto);
  if (telefono) state.cliente.telefono = telefono;

  // El nombre es el resto del texto sin el teléfono
  const nombreCandiato = texto.replace(/\d[\d\s]{8,}/g, "").trim();
  if (nombreCandiato.length > 2) state.cliente.nombre = nombreCandiato;

  // ¿Falta algún dato?
  if (!state.cliente.nombre) {
    return "¿Cuál es tu nombre completo?";
  }
  if (!state.cliente.telefono) {
    return "¿Y tu número de teléfono? Para que Carlos pueda contactarte si hace falta.";
  }

  // ¿Modalidad online? → email obligatorio
  const esOnline = state.modalidad_final === "online";
  if (esOnline && !state.cliente.email) {
    return "Como la sesión es por Google Meet, necesito también tu email " +
      "para enviarte el enlace de la videollamada.";
  }

  // Si el texto tiene formato email, guardarlo
  const email = _extraerEmail(texto);
  if (email) state.cliente.email = email;

  state.current_step = "s10";
  return _explicarPago();
}

function _procesarS10_Pago(_texto) {
  state.current_step = "s11";
  return _iniciarPago();
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGO — renderiza el componente y gestiona los callbacks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IMPORTANTE PARA index.html:
 * Los mensajes de Victoria que vienen de callbacks (agenda, pago) se envían
 * vía CustomEvent "victoria:mensaje". index.html DEBE tener un listener:
 *
 *   window.addEventListener("victoria:mensaje", (e) => {
 *     mostrarMensajeEnChat(e.detail.rol, e.detail.texto);
 *   });
 *
 * Sin ese listener, los mensajes de confirmación de slot y pago no aparecen en el chat.
 */
function _iniciarPago() {
  const contenedor = document.getElementById("victoria-pago-slot");
  if (!contenedor) {
    return _explicarPago();
  }

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
      // Pago confirmado (o fallback WhatsApp) — actualizar estado y disparar s12
      state.captura_url             = signedUrl ?? null;
      state.pago_pendiente_verificar = !!pendienteVerificar;
      state.current_step             = "s12";

      const respuesta = await _procesarS12_Confirmacion("");
      _registrarTurno("victoria", respuesta);
      _mostrarMensajeEnUI(respuesta);
    },
    () => {
      // Volver al paso anterior
      state.current_step = "s9";
      const msg = "Sin problema. ¿Quieres cambiar algo de los datos antes de pagar?";
      _registrarTurno("victoria", msg);
      _mostrarMensajeEnUI(msg);
    }
  );

  return null; // la UI renderiza el componente — no hay texto de chat aquí
}

function _procesarS11_Captura(_texto) {
  // La subida se gestiona por pagos.js — esperamos el callback
  return "Cuando hayas subido la captura y confirmado el pago, lo proceso enseguida.";
}

async function _procesarS12_Confirmacion(_texto) {
  // Guardar todo en Supabase y notificar a Carlos
  try {
    await _guardarCitaEnSupabase();
    await _notificarCarlos();
    state.cita_confirmada = true;
    state.current_step = "s12";

    const perro = state.perro.nombre ?? "tu perro";
    const slot  = state.slot_elegido;
    const modalidad = state.modalidad_final === "online" ? "online por Google Meet" : "en tu domicilio";

    return `¡Todo confirmado! 🐾 Carlos se pondrá en contacto contigo para preparar la primera sesión. ` +
      `Quedamos el ${slot?.label ?? "día acordado"}, ` +
      `${modalidad}. ` +
      `Si necesitas cambiar algo, escríbele directamente al 622 922 173. ` +
      `¡Mucho ánimo con ${perro}!`;
  } catch (err) {
    console.error("Error al confirmar cita:", err);
    return "Ha habido un problema técnico al confirmar la cita. " +
      "Por favor, escribe directamente a Carlos al 622 922 173 y él lo gestiona enseguida.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO — evaluar y responder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye el contexto, llama a decidirRespuesta y renderiza la frase.
 * Es el punto central donde el matching se conecta con la conversación.
 */
function _evaluarYResponder(textoActual) {
  const contexto = _construirContexto(textoActual);
  const decision = decidirRespuesta(contexto);

  // Persistir campos de estado que el matching necesita entre turnos
  if (decision.pending_next !== undefined) state.pending = decision.pending_next;
  if (decision.cuadro_pendiente_mordida)   state.cuadro_pendiente_mordida = decision.cuadro_pendiente_mordida;
  if (decision.bandera_edad_temprana)      state.bandera_edad_temprana = true;

  // Guardar la decision para usar en confirmación final
  state.decision_actual = decision;
  state.log_matching_final = decision.log;

  // Determinar modalidad final si ya se decidió
  if (decision.frase_params?.modalidad) {
    state.modalidad_final = decision.frase_params.modalidad;
  } else if (decision.frase_params?.tipo === "zona" || decision.frase_params?.tipo === "son_gotleu") {
    state.modalidad_final = "derivar";
  }

  switch (decision.accion) {
    case "responder":
    case "derivar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("obtenerFrase devolvió null para " + JSON.stringify(decision.frase_params));

      // Si es una propuesta de protocolo (no una pregunta), avanzar a s6
      if (decision.accion === "responder" && state.current_step === "s4") {
        state.current_step = "s6";
        // Añadir transición al slot si no es derivación
        if (state.modalidad_final !== "derivar") {
          return frase + "\n\n¿Te gustaría ver los horarios disponibles?";
        }
      }
      return frase;
    }

    case "preguntar": {
      const frase = obtenerFrase(decision.frase_params);
      if (!frase) return _fallbackHumano("obtenerFrase null en preguntar");
      // Nos quedamos en s5 mientras hay preguntas de afinado
      state.current_step = "s5";
      return frase;
    }

    case "fallback":
      return _fallbackHumano(decision.log?.notas ?? "acción fallback");

    default:
      return _fallbackHumano("acción desconocida: " + decision.accion);
  }
}

/**
 * Construye el objeto contexto para victoria-matching a partir del estado actual.
 */
function _construirContexto(textoActual) {
  // El mensaje es la concatenación de todos los mensajes de diagnóstico
  const mensajeCompleto = state.mensajes_diagnostico.join(" ");
  const cuadros = detectarCuadros(mensajeCompleto);

  return {
    perro: { ...state.perro },
    zona:  state.zona,
    cuadros: cuadros.cuadros,
    mensaje: mensajeCompleto,
    pending: state.pending,
    respuesta_pendiente: state.pending ? textoActual : null,
    keywords_mordida: _tieneKeywordsMordida(textoActual),
    lateral_detectado: state.lateral_detectado,
    gravedad_mordida: state.gravedad_mordida,
    cuadro_pendiente_mordida: state.cuadro_pendiente_mordida,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA
// ─────────────────────────────────────────────────────────────────────────────

function _iniciarAgenda() {
  // renderAgenda renderiza en el DOM y usa callbacks
  // Devolvemos null para que la UI sepa que debe mostrar el componente de agenda
  const contenedor = document.getElementById("victoria-agenda-slot");
  if (!contenedor) {
    // Fallback si no hay contenedor — texto de instrucción
    return "Ahora voy a mostrarte los horarios disponibles para que elijas el que mejor te venga.";
  }

  renderAgenda(
    (slotElegido) => {
      // Callback cuando el cliente elige slot
      state.slot_elegido = slotElegido;
      state.current_step = "s8";
      // renderAgenda devuelve { fecha, hora, label } — usar label para mostrar al cliente
      const msg = `Has elegido el ${slotElegido.label}. ¿Confirmamos este horario?`;
      _registrarTurno("victoria", msg);
      _mostrarMensajeEnUI(msg);
    },
    () => {
      // Callback volver
      state.current_step = "s6";
      const msg = "Sin problema. ¿Hay algo más que quieras preguntarme sobre el servicio?";
      _registrarTurno("victoria", msg);
      _mostrarMensajeEnUI(msg);
    }
  );

  return null; // la UI renderiza el componente
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGO
// ─────────────────────────────────────────────────────────────────────────────

function _explicarPago() {
  const precio = 45;
  const modalidad = state.modalidad_final === "online" ? "online (75€ la sesión)" : "presencial (90€ la sesión)";

  return `Para confirmar la cita en modalidad ${modalidad}, necesito una seña de ${precio}€. ` +
    "Puedes pagarla por Bizum al 653 591 301 o por transferencia al IBAN " +
    "ES27 0182 5319 7002 0055 6013 (titular: Carlos Antonio Acevedo). " +
    "Cuando hayas hecho el pago, súbeme la captura o el justificante y lo confirmo enseguida.";
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA EN SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

async function _guardarCitaEnSupabase() {
  // 1. Guardar/actualizar cliente
  const clienteRes = await _supabasePost("/rest/v1/clientes", {
    nombre: state.cliente.nombre,
    telefono: state.cliente.telefono,
    email: state.cliente.email,
  });
  const clienteId = clienteRes?.id ?? null;

  // 2. Guardar perro
  const perroRes = await _supabasePost("/rest/v1/perros", {
    nombre: state.perro.nombre,
    raza: state.perro.raza,
    edad_meses: state.perro.edad_meses,
    peso_kg: state.perro.peso_kg,
    es_ppp: state.perro.es_ppp,
    cliente_id: clienteId,
  });
  const perroId = perroRes?.id ?? null;

  // 3. Guardar cita
  const decision = state.decision_actual;
  const cuadros  = decision?.cuadros_originales ?? (decision?.cuadro_ganador ? [decision.cuadro_ganador] : []);

  const citaRes = await _supabasePost("/rest/v1/citas", {
    cliente_id: clienteId,
    perro_id: perroId,
    slot_id: state.slot_elegido?.id ?? null,
    modalidad: state.modalidad_final,
    zona: state.zona?.zonaDetectada,
    cuadros_detectados: cuadros,
    es_mixto: decision?.es_mixto ?? false,
    mixto_degradado: decision?.mixto_degradado ?? false,
    bandera_edad_temprana: state.bandera_edad_temprana ?? false,
    captura_url: state.captura_url,
    pago_pendiente_verificar: state.pago_pendiente_verificar,
    confirmada: true,
  });
  state.cita_id = citaRes?.id ?? null;

  // 4. Guardar conversación
  await _supabasePost("/rest/v1/conversaciones", {
    cita_id: state.cita_id,
    turnos: state.historial_turnos,
    log_matching: state.log_matching_final,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICACIÓN A CARLOS (ntfy.sh)
// ─────────────────────────────────────────────────────────────────────────────

async function _notificarCarlos() {
  const d = state.decision_actual;
  const cuadros = d?.cuadros_originales ?? (d?.cuadro_ganador ? [d.cuadro_ganador] : ["no detectado"]);
  const slot    = state.slot_elegido;
  const p       = state.perro;
  const c       = state.cliente;

  const edadTexto = p.edad_meses < 12
    ? `${p.edad_meses} meses`
    : `${Math.round(p.edad_meses / 12)} años`;

  // Flags condicionales
  const flags = [];
  if (state.bandera_edad_temprana) flags.push("⚠️ Perro joven — atención primera sesión");
  if (d?.mixto_degradado) flags.push(`ℹ️ Mixto degradado por zona — detectados: ${(d.cuadros_originales ?? []).join(" + ")}`);
  if (state.cuadro_pendiente_mordida) flags.push("⚠️ Amago de mordida mencionado — cliente no precisó gravedad");
  if (state.pago_pendiente_verificar) flags.push("⚠️ Comprobante no subido — verificar pago manualmente");

  const flagsTexto = flags.length > 0 ? flags.map((f) => `   ${f}`).join("\n") : "   Sin flags";

  const mensaje = [
    "[NUEVA CITA CONFIRMADA 🐾]",
    "",
    `👤 Cliente: ${c.nombre ?? "—"} · ${c.telefono ?? "—"}`,
    `📧 Email: ${c.email ?? (state.modalidad_final === "online" ? "⚠️ FALTA" : "presencial — no requerido")}`,
    "",
    `🐕 Perro: ${p.nombre ?? "—"} · ${p.raza ?? "—"} · ${edadTexto} · ${p.peso_kg ?? "—"}kg`,
    `📍 Zona: ${state.zona?.zonaDetectada ?? "—"} · Modalidad: ${state.modalidad_final ?? "—"}`,
    "",
    `🧠 Cuadro(s): ${cuadros.join(" + ")}`,
    `   Flags:\n${flagsTexto}`,
    "",
    `📅 Slot: ${slot?.label ?? "—"}`,
    `💰 Seña: 45€ ${state.pago_pendiente_verificar ? "PENDIENTE DE VERIFICAR" : "Bizum confirmado"}`,
    state.captura_url ? `📎 Captura: ${state.captura_url}` : "📎 Captura: no subida",
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
// EXTRACCIÓN DE DATOS ESTRUCTURADOS
// ─────────────────────────────────────────────────────────────────────────────

function _extraerEdad(texto) {
  const semanas = texto.match(/(\d+)\s*semanas?/i);
  if (semanas) return Math.round(parseInt(semanas[1]) / 4.3);

  const meses = texto.match(/(\d+)\s*(meses?|mes)/i);
  if (meses) return parseInt(meses[1]);

  const anos = texto.match(/(\d+)\s*(años?|ano)/i);
  if (anos) return parseInt(anos[1]) * 12;

  // "tiene 1 año y 5 meses" → 17
  const compuesto = texto.match(/(\d+)\s*años?\s*y\s*(\d+)\s*meses?/i);
  if (compuesto) return parseInt(compuesto[1]) * 12 + parseInt(compuesto[2]);

  return null;
}

function _extraerPeso(texto) {
  const kg = texto.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilo)/i);
  if (kg) return parseFloat(kg[1].replace(",", "."));
  return null;
}

// Lista de razas comunes para extracción limpia
// Si el cliente escribe "es un labrador de 3 años", extraemos solo "labrador"
const RAZAS_COMUNES = [
  "labrador", "golden retriever", "golden", "pastor alemán", "pastor aleman",
  "border collie", "border", "bulldog", "beagle", "yorkshire", "yorkshire terrier",
  "chihuahua", "teckel", "dachshund", "husky", "husky siberiano", "shih tzu",
  "pug", "boxer", "galgo", "galgo español", "podenco", "cocker", "cocker spaniel",
  "caniche", "bichon", "bichon frise", "maltés", "maltes", "schnauzer",
  "samoyedo", "setter", "pointer", "dálmata", "dalmata", "doberman",
  "gran danés", "gran danes", "san bernardo", "terranova", "mastín", "mastin",
  "malinois", "pastor belga", "vizsla", "weimaraner", "braco",
  "jack russell", "fox terrier", "west highland", "westies",
  "shiba inu", "shiba", "corgi", "basenji", "whippet",
  "mestizo", "cruce", "mix", "mixto",
];

function _extraerRaza(texto) {
  const norm = normalizar(texto);
  // Ordenar por longitud descendente para que "golden retriever" gane sobre "golden"
  const razasOrdenadas = [...RAZAS_COMUNES].sort((a, b) => b.length - a.length);
  for (const raza of razasOrdenadas) {
    if (norm.includes(normalizar(raza))) {
      // Devolver en formato capitalizado
      return raza.charAt(0).toUpperCase() + raza.slice(1);
    }
  }
  // También detectar PPP por si la raza es de lista restringida
  // esPPP() usa su propia lista — si matchea, devolver el texto que matcheó
  // (se detectará en el contexto del matching via state.perro.es_ppp)
  return null; // no detectada — el historial_turnos tiene el texto original
}

function _extraerTelefono(texto) {
  const tel = texto.match(/(\+34\s?)?[6789]\d{8}/);
  if (tel) return tel[0].replace(/\s/g, "");
  return null;
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
  state.historial_turnos.push({
    rol,
    texto,
    timestamp: new Date().toISOString(),
  });
}

function _mostrarMensajeEnUI(texto) {
  // Hook para que index.html añada el mensaje al chat
  // La UI puede sobrescribir esta función o escuchar un evento
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("victoria:mensaje", {
      detail: { rol: "victoria", texto },
    }));
  }
}

function _fallbackHumano(razon) {
  console.warn("Victoria fallback:", razon);
  return "Para poder orientarte bien, te paso directamente con Carlos — " +
    "él puede atenderte con más detalle. Puedes escribirle por WhatsApp al 622 922 173.";
}

async function _supabasePost(endpoint, body) {
  try {
    const res = await fetch(`${SUPA_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status} en ${endpoint}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error("Error Supabase:", err);
    return null;
  }
}
