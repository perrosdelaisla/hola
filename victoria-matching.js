/**
 * victoria-matching.js
 * Perros de la Isla — Embudo Victoria
 * Árbol maestro de precedencia — convierte contexto en decisión de respuesta
 * Versión 1.0 · Abril 2026
 *
 * ARQUITECTURA:
 * - Una función por paso del árbol (pasos 0-10)
 * - Orquestador `decidirRespuesta` llama los pasos en orden
 * - Cada paso devuelve null (no aplica) o una Decision completa (para el flujo)
 * - El Paso 7 (exclusiones) se aplica entre el 6 y el 8, no es un paso del orquestador
 *
 * DEPENDENCIAS:
 * - victoria-utils.js    → normalizar, filtrarHits
 * - victoria-zones.js    → esCompatibleOnline
 * - victoria-dictionaries.js → detectarCuadros
 * - victoria-breeds.js   → esPPP, clasificarTamano, requiereEtologo, KEYWORDS_AGRESION
 * - victoria-phrases.js  → (consumida por victoria.js, no aquí)
 */

import { normalizar, filtrarHits } from "./victoria-utils.js";
import { esCompatibleOnline } from "./victoria-zones.js";
import { detectarCuadros } from "./victoria-dictionaries.js";
import { esPPP, clasificarTamano, requiereEtologo, KEYWORDS_AGRESION } from "./victoria-breeds.js";


// ─────────────────────────────────────────────────────────────────────────────
// TIPOS — documentación de las estructuras principales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Contexto
 * @property {Object}  perro
 * @property {string}  perro.nombre
 * @property {number}  perro.edad_meses
 * @property {string}  perro.raza
 * @property {number}  perro.peso_kg
 * @property {boolean} perro.es_ppp          — calculado por esPPP()
 * @property {Object}  zona                  — output de detectarZona()
 * @property {Array}   cuadros               — output de detectarCuadros()
 * @property {string}  mensaje               — mensaje actual del cliente
 * @property {string|null} pending           — null | 'filtro_mordida' | 'conducta' | 'zona' | 'edad'
 * @property {string|null} respuesta_pendiente — respuesta del cliente a pending
 * @property {boolean} keywords_mordida      — si el mensaje menciona mordida
 * @property {string|null} lateral_detectado — servicio lateral detectado o null
 *
 * @typedef {Object} Decision
 * @property {'responder'|'preguntar'|'derivar'|'fallback'} accion
 * @property {Object|null}  frase_params     — params para obtenerFrase()
 * @property {string|null}  pending_next     — pregunta pendiente para el siguiente turno
 * @property {string|null}  cuadro_ganador
 * @property {boolean}      es_mixto
 * @property {boolean}      bandera_edad_temprana
 * @property {Object}       log
 */


// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS DE MORDIDA — para detección en el Paso 5
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORDS_MORDIDA = [
  "muerde", "ha mordido", "mordió", "llegó a morder",
  "se tira a morder", "intento de mordida", "mordida",
  "casi muerde", "amago de mordida",
];

// Severidad de la consecuencia — evaluada en respuesta al filtro de mordida
const KEYWORDS_MORDIDA_GRAVE = [
  "sangre", "sangró", "herida", "puntos", "urgencias", "médico",
  "hematoma", "moratón", "marca profunda",
];

const KEYWORDS_MORDIDA_LEVE = [
  "marca leve", "arañazo", "rozó", "sin consecuencias", "no dejó marca",
  "piel roja", "no sangró",
];


// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Función central del sistema. Recibe el contexto completo del turno
 * y devuelve una Decision que victoria.js ejecuta.
 *
 * @param {Contexto} contexto
 * @returns {Decision}
 */
export function decidirRespuesta(contexto) {
  // Si hay una pregunta pendiente, ir directamente al paso que la gestiona
  if (contexto.pending === "filtro_mordida") {
    return paso5_filtroMordida(contexto);
  }
  if (contexto.pending === "zona") {
    // La zona ya debe estar resuelta antes de llamar — si llega aquí es bug
    return _fallbackWhatsapp("pending zona sin resolver");
  }

  // Árbol normal de decisión
  const pasos = [
    paso0_datosMinimos,
    paso1_etologo,
    paso2_laterales,
    paso3_cachorropleno,
    paso4_cachorroTransicion,
    paso5_filtroMordida,
    // Paso 6-8: cuadros únicos + exclusiones + mixto — en _evaluarCuadros
    _evaluarCuadros,
    paso9_basica,
    paso10_pedirEspecificacion,
  ];

  for (const paso of pasos) {
    const resultado = paso(contexto);
    if (resultado !== null) return resultado;
  }

  // Nunca debería llegar aquí — paso10 siempre devuelve algo
  return _fallbackWhatsapp("árbol agotado sin decisión");
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 0 — Pre-filtro de datos mínimos
// Si faltan datos críticos, pedir antes de evaluar cuadros
// ─────────────────────────────────────────────────────────────────────────────

function paso0_datosMinimos(contexto) {
  const { perro, zona } = contexto;

  // Zona desconocida — siempre preguntar primero
  if (zona.necesitaAclaracion) {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_zona" },
      pending_next: "zona",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "zona desconocida"),
    });
  }

  // Edad desconocida — necesaria para filtro de cachorros
  if (perro.edad_meses === null || perro.edad_meses === undefined) {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_edad" },
      pending_next: "edad",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "edad desconocida"),
    });
  }

  // Peso desconocido — necesario para criterios de etólogo y clasificación de tamaño
  if (!perro.peso_kg || perro.peso_kg <= 0) {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_peso" },
      pending_next: "peso",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "peso desconocido"),
    });
  }

  // Raza desconocida — necesaria para detección PPP
  if (!perro.raza || perro.raza.trim() === "") {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_raza" },
      pending_next: "raza",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "raza desconocida"),
    });
  }

  return null; // todos los datos mínimos presentes, continuar
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — Derivación al etólogo
// Se activa si cualquiera de los criterios de gravedad se cumple
// ─────────────────────────────────────────────────────────────────────────────

function paso1_etologo(contexto) {
  const { perro, cuadros, mensaje } = contexto;
  const textoNorm = normalizar(mensaje);

  // NOTA: gravedad_mordida llega null en la primera pasada del árbol.
  // Este paso entonces solo dispara por: (a) PPP + cuadro serio (media/alta),
  // o (b) perro grande + descripción de agresión explícita en keywords.
  // Si hay mordida mencionada pero sin clasificar, el paso 5 hace la pregunta.
  // Cuando el cliente responde y la gravedad resulta grave, victoria.js vuelve a
  // llamar decidirRespuesta con el campo gravedad_mordida populado, y este paso
  // sí dispara por el criterio 2 de requiereEtologo. No es bug — es diseño.

  // Corrección 1: umbral elevado — solo cuadros con confianza media o alta cuentan
  // como "señal conductual seria". Confianza baja (un N3 solo) no basta para derivar.
  const hay_senal = cuadros.some((c) => c.confianza === "alta" || c.confianza === "media");

  // ¿Hay descripción de agresión activa?
  const descripcion_agresion = KEYWORDS_AGRESION.some((kw) =>
    textoNorm.includes(normalizar(kw))
  );

  // Gravedad de mordida — solo si ya se procesó el filtro de mordida
  const gravedad_mordida = contexto.gravedad_mordida ?? null;

  if (requiereEtologo({
    es_ppp: perro.es_ppp,
    peso_kg: perro.peso_kg,
    hay_senal_conductual: hay_senal,
    gravedad_mordida,
    descripcion_agresion,
  })) {
    return _decision({
      accion: "derivar",
      frase_params: { tipo: "etologo", subtipo: "principal" },
      pending_next: null,
      cuadro_ganador: null,
      log: _log(1, [], [], contexto.zona.zonaDetectada, null,
        ["derivacion_etologo"],
        `PPP:${perro.es_ppp} peso:${perro.peso_kg}kg gravedad:${gravedad_mordida}`),
    });
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — Servicios laterales
// Solo si la solicitud PRINCIPAL es un servicio lateral
// ─────────────────────────────────────────────────────────────────────────────

function paso2_laterales(contexto) {
  if (!contexto.lateral_detectado) return null;

  return _decision({
    accion: "responder",
    frase_params: { tipo: "lateral", subtipo: contexto.lateral_detectado },
    pending_next: null,
    cuadro_ganador: null,
    log: _log(2, [], [], contexto.zona.zonaDetectada, null, [], `lateral: ${contexto.lateral_detectado}`),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 3 — Cachorro pleno (0-6 meses)
// ─────────────────────────────────────────────────────────────────────────────

function paso3_cachorropleno(contexto) {
  const { perro, cuadros, zona } = contexto;

  if (perro.edad_meses > 6) return null;

  // Sub-check: ¿hay posesión fuerte con rigidez corporal?
  const cuadroPosesion = cuadros.find((c) => c.id === "posesion" && c.confianza !== "ninguna");
  if (cuadroPosesion && _tieneRigidezCorporal(contexto)) {
    return _resolverCuadro("posesion", contexto, { bandera_edad_temprana: true, paso: 3 });
  }

  // Sub-check: ¿hay miedo extremo sostenido?
  const cuadroMiedos = cuadros.find((c) => c.id === "miedos" && c.confianza === "alta");
  if (cuadroMiedos) {
    return _resolverCuadro("miedos", contexto, { bandera_edad_temprana: true, paso: 3 });
  }

  // Cachorro pleno sin excepción → protocolo cachorros
  return _resolverCuadro("cachorros", contexto, { paso: 3 });
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 4 — Cachorro en transición (6-9 meses)
// ─────────────────────────────────────────────────────────────────────────────

function paso4_cachorroTransicion(contexto) {
  const { perro, cuadros } = contexto;

  if (perro.edad_meses <= 6 || perro.edad_meses > 9) return null;

  // ¿Hay cuadros instalados con confianza alta? → cuadro específico gana
  const cuadroInstalado = cuadros
    .filter((c) => c.id !== "cachorros" && c.id !== "basica")
    .find((c) => c.confianza === "alta");

  if (cuadroInstalado) {
    return _resolverCuadro(cuadroInstalado.id, contexto, { paso: 4 });
  }

  // Conductas típicas de etapa sin cuadro instalado → cachorros
  const cuadroCachorros = cuadros.find((c) => c.id === "cachorros" && c.confianza !== "ninguna");
  if (cuadroCachorros) {
    return _resolverCuadro("cachorros", contexto, { paso: 4 });
  }

  return null; // edad de transición pero sin señal clara — dejar al árbol continuar
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 5 — Filtro de mordida
// Se activa si el mensaje contiene keywords de mordida en cuadros de posesión/reactividad
// También gestiona la respuesta cuando pending === 'filtro_mordida'
// ─────────────────────────────────────────────────────────────────────────────

function paso5_filtroMordida(contexto) {
  const { cuadros, mensaje, pending, respuesta_pendiente, perro, zona } = contexto;
  const textoNorm = normalizar(mensaje);

  // ── Modo respuesta: el cliente acaba de responder al filtro de mordida ────
  if (pending === "filtro_mordida" && respuesta_pendiente) {
    const respNorm = normalizar(respuesta_pendiente);

    // Clasificación en orden de prioridad — sin defaults agresivos
    const esGrave    = filtrarHits(respNorm, KEYWORDS_MORDIDA_GRAVE).length > 0;
    const esNoSabe   = filtrarHits(respNorm, KEYWORDS_NO_SABE).length > 0;
    const sinContacto = filtrarHits(respNorm, KEYWORDS_SIN_CONTACTO).length > 0;
    const esLeve     = filtrarHits(respNorm, KEYWORDS_MORDIDA_LEVE).length > 0;

    const cuadroGanador = contexto.cuadro_pendiente_mordida ?? null;

    // 1. Grave explícito → derivar al etólogo
    if (esGrave) {
      return _decision({
        accion: "derivar",
        frase_params: { tipo: "etologo", subtipo: "principal" },
        pending_next: null,
        cuadro_ganador: null,
        log: _log(5, [], [], zona.zonaDetectada, null, ["mordida_grave", "derivacion_etologo"], "mordida grave confirmada"),
      });
    }

    // 2. Cliente no sabe → amago probable, continuar con nota
    if (esNoSabe) {
      if (!cuadroGanador) return _fallbackWhatsapp("filtro mordida: no_sabe sin cuadro pendiente");
      return _resolverCuadro(cuadroGanador, contexto, {
        paso: 5,
        nota: "cliente no pudo precisar gravedad — tratar como amago probable",
      });
    }

    // 3. Sin contacto real o leve → continuar con cuadro
    if (sinContacto || esLeve) {
      if (!cuadroGanador) return _fallbackWhatsapp("filtro mordida: leve/sincontacto sin cuadro pendiente");
      return _resolverCuadro(cuadroGanador, contexto, {
        paso: 5,
        nota: sinContacto ? "sin contacto real confirmado" : "contacto leve confirmado",
      });
    }

    // 4. No clasificable → repetir pregunta con más detalle (no asumir gravedad)
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "filtro_mordida_repregunta" },
      pending_next: "filtro_mordida", // mantener el pending para el siguiente turno
      cuadro_pendiente_mordida: cuadroGanador,
      log: _log(5, [], [], zona.zonaDetectada, null, ["mordida_no_clasificable"], "respuesta ambigua — repreguntando"),
    });
  }

  // ── Modo detección: ¿el mensaje actual menciona mordida? ────────────────
  const hayMordida = KEYWORDS_MORDIDA.some((kw) => textoNorm.includes(normalizar(kw)));
  if (!hayMordida) return null;

  // ¿Es relevante? Solo en cuadros de posesión o reactividad con confianza suficiente
  const cuadroRelevante = cuadros.find(
    (c) => (c.id === "posesion" || c.id === "reactividad") &&
      (c.confianza === "alta" || c.confianza === "media")
  );
  if (!cuadroRelevante) return null;

  // Preguntar filtro de mordida
  return _decision({
    accion: "preguntar",
    frase_params: { tipo: "apoyo", subtipo: "filtro_mordida" },
    pending_next: "filtro_mordida",
    cuadro_pendiente_mordida: cuadroRelevante.id, // guardar para cuando llegue la respuesta
    cuadro_ganador: null,
    log: _log(5, [cuadroRelevante.id], [], zona.zonaDetectada, null, ["mordida_pendiente"], "keywords de mordida detectadas"),
  });
}


// Keywords para clasificar la respuesta al filtro de mordida
// Usadas en paso5 modo respuesta — consistentes con el patrón filtrarHits del sistema
const KEYWORDS_SIN_CONTACTO = [
  "no llegó", "solo aviso", "se quedó en el aviso", "gruñido",
  "no muerde", "no ha llegado", "solo ladra", "amago", "amagó",
  "fingió", "gesto", "dientes sin tocar", "no hubo contacto",
  "no tocó", "avisó nada más",
];

const KEYWORDS_NO_SABE = [
  "no sé", "no lo sé", "no estoy seguro", "no recuerdo",
  "creo que", "no sabría decirte", "no puedo decirte",
];

/**
 * Resuelve las 5 rutas de modalidad y devuelve la Decision correcta.
 * Esta es la función central del matching de cuadro × zona.
 *
 * Las 5 rutas (Ajuste 3 de Opus):
 * 1. Zona presencial + cuadro → frase presencial
 * 2. Zona fuera + cuadro compatible online → frase online
 * 3. Zona fuera + cuadro NO compatible online → derivación por zona
 * 4. Zona Son Gotleu + cuadro compatible online → Son Gotleu compatible
 * 5. Zona Son Gotleu + cuadro NO compatible online → Son Gotleu no compatible
 */
function _resolverCuadro(cuadroId, contexto, { bandera_edad_temprana = false, paso = 6, nota = "" } = {}) {
  const { zona, perro } = contexto;
  const compatibleOnline = esCompatibleOnline(cuadroId);
  const vars = { nombre_perro: perro?.nombre ?? null };

  let frase_params;
  let modalidad_final;

  if (zona.modalidad === "presencial" && !zona.esSonGotleu) {
    // Ruta 1: zona presencial normal
    modalidad_final = "presencial";
    frase_params = { tipo: "cuadro", cuadro: cuadroId, modalidad: "presencial", vars };

  } else if (zona.esSonGotleu && compatibleOnline) {
    // Ruta 4: Son Gotleu + compatible online
    modalidad_final = "online";
    frase_params = { tipo: "son_gotleu", subtipo: "compatible_online", cuadro: cuadroId, vars };

  } else if (zona.esSonGotleu && !compatibleOnline) {
    // Ruta 5: Son Gotleu + NO compatible online
    modalidad_final = "derivar";
    frase_params = { tipo: "son_gotleu", subtipo: "no_compatible_online" };

  } else if (zona.modalidad === "fuera" && compatibleOnline) {
    // Ruta 2: fuera de zona + compatible online
    modalidad_final = "online";
    frase_params = { tipo: "cuadro", cuadro: cuadroId, modalidad: "online", vars };

  } else if (zona.modalidad === "fuera" && !compatibleOnline) {
    // Ruta 3: fuera de zona + NO compatible online
    modalidad_final = "derivar";
    frase_params = { tipo: "zona", vars: { cuadro: cuadroId } };

  } else {
    // Zona desconocida — no debería llegar aquí (Paso 0 lo filtra)
    return _fallbackWhatsapp(`zona desconocida en _resolverCuadro para ${cuadroId}`);
  }

  const flags = [];
  if (bandera_edad_temprana) flags.push("bandera_edad_temprana");

  return _decision({
    accion: modalidad_final === "derivar" ? "derivar" : "responder",
    frase_params,
    pending_next: null,
    cuadro_ganador: cuadroId,
    es_mixto: false,
    bandera_edad_temprana,
    log: _log(paso, [cuadroId], [], zona.zonaDetectada, modalidad_final, flags, nota),
  });
}

/** Comprueba si el contexto tiene señales de rigidez corporal (para sub-check de posesión en cachorros) */
function _tieneRigidezCorporal(contexto) {
  const textoNorm = normalizar(contexto.mensaje);
  const RIGIDEZ = ["cuerpo tieso", "cuerpo rígido", "cola tiesa", "se tensa", "se rigidiza"];
  return RIGIDEZ.some((kw) => textoNorm.includes(normalizar(kw)));
}

/** Construye objeto log estructurado (serializable a JSON para Supabase) */
function _log(paso, cuadros_detectados, cuadros_excluidos, zona, modalidad_final, flags, notas) {
  return {
    paso,
    cuadros_detectados,
    cuadros_excluidos,
    zona: zona ?? "desconocida",
    modalidad_final: modalidad_final ?? "pendiente",
    flags: flags ?? [],
    notas: notas ?? "",
  };
}

/** Construye un objeto Decision con defaults seguros */
function _decision({
  accion,
  frase_params,
  pending_next = null,
  cuadro_ganador = null,
  es_mixto = false,
  bandera_edad_temprana = false,
  cuadro_pendiente_mordida = null,
  log,
}) {
  return {
    accion,
    frase_params,
    pending_next,
    cuadro_ganador,
    es_mixto,
    bandera_edad_temprana,
    cuadro_pendiente_mordida, // campo interno — lo usa el orquestador para persistir entre turnos
    log,
  };
}

/** Fallback al WhatsApp humano — último recurso */
function _fallbackWhatsapp(razon) {
  return _decision({
    accion: "fallback",
    frase_params: { tipo: "apoyo", subtipo: "fallback_whatsapp" },
    log: _log(99, [], [], null, null, ["fallback"], razon),
  });
}

// Placeholder para pasos 6-10 — se implementarán tras validación de Opus
function _evaluarCuadros(_contexto) { return null; }
function paso9_basica(_contexto) { return null; }

// Paso 10 — pedir especificación: ningún cuadro disparó con suficiente confianza
// Es un paso legítimo del árbol, no un error. Victoria pide más información.
function paso10_pedirEspecificacion(contexto) {
  return _decision({
    accion: "preguntar",
    frase_params: { tipo: "apoyo", subtipo: "pedir_especificacion" },
    pending_next: null,
    cuadro_ganador: null,
    log: _log(10, [], [], contexto.zona?.zonaDetectada ?? "desconocida", null, [], "ningún cuadro disparó con confianza suficiente"),
  });
}
