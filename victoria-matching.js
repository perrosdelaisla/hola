/**
 * victoria-matching.js
 * Perros de la Isla — Embudo Victoria
 * Versión 2.0 · Abril 2026
 *
 * ARQUITECTURA SIMPLIFICADA:
 * decidirRespuesta evalúa 4 filtros en orden y devuelve una Decision.
 * Ya no hay diagnóstico de cuadros, exclusiones ni pasos de afinado.
 *
 * FILTROS (en orden):
 *   1. Mordida grave (→ preguntar gravedad o derivar al etólogo)
 *   2. Lateral (guardería, peluquería, etc)
 *   3. Zona (Son Gotleu, fuera de cobertura)
 *   4. Caso general → mensaje principal unificado
 */

import { normalizar } from "./victoria-utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORDS_MORDIDA = [
  "muerde", "ha mordido", "mordió", "llegó a morder",
  "se tira a morder", "intento de mordida", "mordida",
  "casi muerde", "amago de mordida",
];

// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recibe el contexto completo del turno y devuelve una Decision.
 *
 * @param {Object} contexto
 * @returns {Object} Decision
 */
export function decidirRespuesta(contexto) {
  const { perro, zona, lateral_detectado, keywords_mordida, gravedad_mordida } = contexto;

  // ── FILTRO 1: Mordida ────────────────────────────────────────────────────
  //
  // Se activa si el texto actual menciona mordida O si ya tenemos una gravedad
  // definida de un turno anterior (el cliente está respondiendo a la repregunta
  // de gravedad). Esto evita que Victoria "olvide" el filtro de seguridad entre
  // turnos y caiga al caso general vendiendo clases para mordidas graves.

  if (keywords_mordida || gravedad_mordida) {
    // Gravedad aún no definida → preguntar
    if (!gravedad_mordida) {
      return _decision({
        accion: "preguntar",
        frase_params: { tipo: "apoyo", subtipo: "filtro_mordida" },
        pending_next: "gravedad_mordida",
        cuadro_ganador: null,
        log: _log(1, "preguntar gravedad mordida"),
      });
    }

    // Grave + perro grande o PPP → etólogo
    const esGrande = (perro?.peso_kg ?? 0) > 10;
    const esPPP    = perro?.es_ppp ?? false;
    if (gravedad_mordida === "grave" && (esGrande || esPPP)) {
      return _decision({
        accion: "derivar",
        frase_params: { tipo: "etologo", subtipo: "mordida_personas" },
        pending_next: null,
        cuadro_ganador: null,
        log: _log(1, `mordida grave + peso:${perro?.peso_kg}kg ppp:${esPPP}`),
      });
    }

    // Leve o perro pequeño → sigue flujo normal (cae al caso general)
  }

  // ── FILTRO 2: Lateral ────────────────────────────────────────────────────

  if (lateral_detectado) {
    return _decision({
      accion: "derivar",
      frase_params: { tipo: "lateral", subtipo: lateral_detectado },
      pending_next: null,
      cuadro_ganador: null,
      log: _log(2, `lateral: ${lateral_detectado}`),
    });
  }

  // ── FILTRO 3: Zona ───────────────────────────────────────────────────────

  if (zona?.esSonGotleu) {
    return _decision({
      accion: "derivar",
      frase_params: { tipo: "son_gotleu", subtipo: "no_compatible_online" },
      pending_next: null,
      cuadro_ganador: null,
      log: _log(3, "son gotleu"),
    });
  }

  if (zona?.modalidad === "derivar") {
    return _decision({
      accion: "derivar",
      frase_params: { tipo: "zona", subtipo: zona.subtipo_derivacion ?? "generico" },
      pending_next: null,
      cuadro_ganador: null,
      log: _log(3, `zona fuera sin cobertura`),
    });
  }

  // ── FILTRO 4: Caso general ───────────────────────────────────────────────

  const modalidad = zona?.modalidad === "fuera" ? "online" : (zona?.modalidad ?? "presencial");

  return _decision({
    accion: "responder",
    frase_params: {
      tipo: "mensaje_principal",
      vars: { perro: perro?.nombre ?? null, modalidad },
    },
    pending_next: null,
    cuadro_ganador: null,
    log: _log(4, `mensaje principal unificado · modalidad: ${modalidad}`),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _log(paso, notas = "") {
  return { paso, notas };
}

function _decision({
  accion,
  frase_params,
  pending_next = null,
  cuadro_ganador = null,
  es_mixto = false,
  bandera_edad_temprana = false,
  cuadro_pendiente_mordida = null,
  mixto_degradado = false,
  cuadros_originales = null,
  log,
}) {
  return {
    accion,
    frase_params,
    pending_next,
    cuadro_ganador,
    es_mixto,
    bandera_edad_temprana,
    cuadro_pendiente_mordida,
    mixto_degradado,
    cuadros_originales,
    log,
  };
}
