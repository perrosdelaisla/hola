/**
 * victoria-matching.js
 * Perros de la Isla — Embudo Victoria
 * Versión 2.0 · Abril 2026
 *
 * ARQUITECTURA SIMPLIFICADA:
 * decidirRespuesta aplica una regla de continuidad y luego evalúa 5 filtros
 * en orden. Devuelve una Decision. Ya no hay diagnóstico de cuadros,
 * exclusiones ni pasos de afinado.
 *
 * REGLA DE CONTINUIDAD IA (short-circuit previo a los filtros):
 *   Si la IA ya inició conversación y no ha cerrado, todos los turnos
 *   siguientes van directos a fallback IA (la IA controla los N turnos
 *   completos como conversación continua). Excepción: filtro 1
 *   (seguridad/mordida) tiene prioridad sobre la continuidad.
 *
 * FILTROS (en orden, solo si la regla de continuidad no aplica):
 *   1. Mordida grave (→ preguntar gravedad o derivar al etólogo)
 *   2. Lateral (guardería, peluquería, etc)
 *   3. Zona (Son Gotleu, fuera de cobertura)
 *   5. Vocabulario canino (input sin keywords reconocidas → fallback IA)
 *   4. Caso general → mensaje principal unificado
 */

import { normalizar, filtrarHits } from "./victoria-utils.js";
import { TODOS_LOS_DICCIONARIOS } from "./victoria-dictionaries.js";

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORDS_MORDIDA = [
  "muerde", "ha mordido", "mordió", "llegó a morder",
  "se tira a morder", "intento de mordida", "mordida",
  "casi muerde", "amago de mordida",
];

// Palabras que describen agresión o conducta peligrosa SIN ser mordida literal.
// Disparan el filtro de seguridad en combinación con perros grandes o PPP.
const KEYWORDS_AGRESION = [
  "agresivo", "agresiva", "agresividad",
  "ataca", "atacó", "ataque", "atacado",
  "gruñe", "gruñido", "gruñidos", "gruñir",
  "marca con la boca", "marca con los dientes", "marcado con la boca",
  "enseña los dientes", "muestra los dientes",
  "se lanza a morder", "se abalanza",
  "se encara", "se encaró",
  "embiste", "embistió",
];

// Palabras que indican víctima humana vulnerable (niños, bebés, ancianos).
// Con agresión + víctima vulnerable → derivación cautelosa aunque no haya peso.
const KEYWORDS_VICTIMA_VULNERABLE = [
  "mi hijo", "mi hija", "mis hijos", "mis hijas",
  "niño", "niña", "niños", "niñas",
  "bebé", "bebe", "bebés", "bebes",
  "anciano", "anciana", "abuelo", "abuela",
];

// Objetos que el perro puede morder = destrucción, NO agresión.
// Si "muerde" aparece junto a uno de estos, el filtro de mordida
// NO se activa (es exploración o destructividad, no agresión).
const KEYWORDS_OBJETOS_MORDIBLES = [
  "muebles", "mueble",
  "sofá", "sofa", "sillón", "sillon",
  "silla", "sillas",
  "mesa", "patas de la mesa",
  "zapatos", "zapato", "zapatillas", "zapatilla",
  "cordones",
  "ropa", "calcetines", "calcetín", "calcetin",
  "manga", "mangas",
  "correa", "la correa",
  "manguera",
  "juguetes", "juguete", "peluche", "peluches",
  "cojines", "cojín", "cojin", "almohadas", "almohada",
  "manta", "mantas",
  "cables", "cable",
  "puerta", "puertas", "marco de la puerta",
  "rodapié", "rodapie",
  "cosas", "todo lo que pilla", "todo lo que encuentra",
  "lo que pilla",
  "alfombra", "alfombras",
  "plantas", "planta",
];

// Vocabulario canino unificado: todas las keywords (n1/n2/n3) de los 7
// diccionarios de cuadros + términos genéricos razonables. Se construye
// una sola vez al cargar el módulo y se consulta en el filtro 5.
const _VOCABULARIO_CANINO = (() => {
  const set = new Set();
  for (const dict of TODOS_LOS_DICCIONARIOS) {
    for (const nivel of ["n1", "n2", "n3"]) {
      const items = dict[nivel] ?? [];
      for (const item of items) set.add(item);
    }
  }
  // Vocabulario genérico mínimo: palabras que un cliente real puede usar
  // para describir un problema aunque no matchee ningún cuadro PDLI, más
  // respuestas afirmativas/negativas cortas para no romper flujos de
  // confirmación que pasen por _enviarMensaje.
  const GENERICO = [
    "perro", "perra", "perrito", "perrita",
    "mi", "tiene", "tengo", "hace",
    "hola", "ayuda", "duda",
    "si", "no", "vale", "ok",
  ];
  for (const palabra of GENERICO) set.add(palabra);
  return Array.from(set);
})();

// Vocabulario SOLO de cuadros (sin set genérico) — usado por la regla de
// continuidad IA para detectar cuando el cliente vuelve a hablar coherentemente
// del perro y debe gestionarlo el árbol normal, no la IA. Más estricto que
// _VOCABULARIO_CANINO porque no acepta palabras como "hola" o "perro" sueltas.
const _VOCABULARIO_CUADROS = (() => {
  const set = new Set();
  for (const dict of TODOS_LOS_DICCIONARIOS) {
    for (const nivel of ["n1", "n2", "n3"]) {
      const items = dict[nivel] ?? [];
      for (const item of items) set.add(item);
    }
  }
  return Array.from(set);
})();

function _inputTieneVocabularioDeCuadro(textoNorm) {
  return filtrarHits(textoNorm, _VOCABULARIO_CUADROS).length > 0;
}

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
  const textoNorm = normalizar(contexto.mensaje ?? "");

  // ── REGLA DE CONTINUIDAD IA ──────────────────────────────────────────────
  //
  // Si la IA ya tomó al menos un turno en esta sesión y aún no ha cerrado
  // (fallback_ia_cerrado=false), TODOS los turnos siguientes pasan por la
  // IA sin filtrar. La IA gestiona la conversación reconduciendo al cliente
  // durante sus N turnos como una conversación continua. Sin esto, charla
  // casual del cliente ("vale, no estoy seguro") devolvería el control al
  // árbol y rompería la continuidad de la conversación IA.
  //
  // EXCEPCIÓN 1 — filtro 1 (seguridad/mordida) tiene prioridad sobre la
  // continuidad. Si el cliente menciona mordida durante la conversación IA,
  // el árbol retoma el control para activar la derivación al etólogo. Es
  // regla de seguridad clínica, no de UX.
  //
  // EXCEPCIÓN 2 — si el cliente vuelve a describir el problema del perro con
  // vocabulario reconocible de los 7 diccionarios de cuadros, el árbol retoma
  // el control para gestionarlo como caso normal. NO se setea
  // fallback_ia_cerrado: la IA puede volver a entrar después si el cliente
  // vuelve a divagar.
  //
  // Salida del modo IA: ÚNICAMENTE vía fallback_ia_cerrado=true, que setea
  // _fallbackInteligente cuando alcanza maxTurnos (cierre por tope con frase
  // fija de WhatsApp). NO se usa el contador de turnos como guard aquí
  // porque necesitamos que la llamada del turno N+1 AÚN entre a
  // _fallbackInteligente para que ejecute el cierre forzado y setee la flag.

  const enConversacionIA =
    contexto.turnos_ia >= 1 &&
    !contexto.fallback_ia_cerrado;

  const inputDisparaFiltroSeguridad = keywords_mordida || gravedad_mordida;
  const inputVuelveAlHilo = _inputTieneVocabularioDeCuadro(textoNorm);

  if (enConversacionIA && !inputDisparaFiltroSeguridad && !inputVuelveAlHilo) {
    return _decision({
      accion: "fallback",
      frase_params: null,
      pending_next: null,
      cuadro_ganador: null,
      log: _log(0, `continuidad IA · turnos:${contexto.turnos_ia}/${contexto.max_turnos_ia}`),
    });
  }

  // ── FILTRO 1: Seguridad (mordida + agresión) ─────────────────────────────
  //
  // Se activa si el texto menciona mordida, agresión, ataque, gruñido, o si el
  // perro es PPP con cualquier conducta problemática. También se mantiene
  // activo si ya hay una gravedad definida de turnos previos (el cliente está
  // respondiendo a la repregunta). Esto evita que Victoria "olvide" el filtro
  // de seguridad entre turnos y venda clases para casos que necesitan etólogo.

  const hayAgresion = KEYWORDS_AGRESION.some(kw => textoNorm.includes(normalizar(kw)));
  const hayVictimaVulnerable = KEYWORDS_VICTIMA_VULNERABLE.some(kw => textoNorm.includes(normalizar(kw)));
  const esGrande = (perro?.peso_kg ?? 0) > 10;
  const esGrandota = (perro?.peso_kg ?? 0) >= 25;
  const esPPP = perro?.es_ppp ?? false;

  // ── DETECCIÓN: muerde objetos vs muerde personas ──
  // Si el texto contiene "muerde" junto a un objeto del listado,
  // NO es agresión. Es destrucción o exploración. NO activar
  // filtro de mordida.
  const muerdeObjetos =
    keywords_mordida &&
    KEYWORDS_OBJETOS_MORDIBLES.some(obj => textoNorm.includes(normalizar(obj)));

  // Condiciones para activar el filtro de seguridad
  const activarFiltro =
    (keywords_mordida && !muerdeObjetos) ||    // mordida a personas/perros, no objetos
    gravedad_mordida ||                        // ya preguntamos antes
    (hayAgresion && esGrande) ||               // agresión + perro >10kg
    (hayAgresion && esPPP) ||                  // agresión + PPP (de cualquier tamaño)
    (hayAgresion && hayVictimaVulnerable) ||   // agresión + niño/bebé/anciano
    (esPPP && hayAgresion);                    // PPP con cualquier conducta agresiva

  if (activarFiltro) {
    // ── REGLA EDUCAN: cachorros nunca van a etólogo ──
    // Mordidas en cachorro <9 meses son exploratorias por
    // definición. PDLI las trabaja en clase, no se derivan
    // aunque haya señales de gravedad — el adiestrador valora
    // en la primera clase. Decisión clínica deliberada de Charly.
    const esCachorro = (perro?.edad_meses ?? 999) < 9;

    // Gravedad aún no definida → preguntar (también en cachorros,
    // la pregunta misma es útil porque hace que el cliente
    // dimensione realmente la conducta).
    if (!gravedad_mordida) {
      return _decision({
        accion: "preguntar",
        frase_params: { tipo: "apoyo", subtipo: "filtro_mordida" },
        pending_next: "gravedad_mordida",
        cuadro_ganador: null,
        log: _log(1, `filtro seguridad: cachorro=${esCachorro} mordida=${!!keywords_mordida} muerdeObjetos=${muerdeObjetos} agresion=${hayAgresion} vulnerable=${hayVictimaVulnerable} ppp=${esPPP} peso=${perro?.peso_kg}`),
      });
    }

    // CACHORRO → siempre se queda en flujo, NO derivar
    if (esCachorro) {
      // Cae al caso general (flujo normal de PDLI)
    }
    // Adulto + grave + (perro grande o PPP) → etólogo
    else if (gravedad_mordida === "grave" && (esGrande || esPPP)) {
      return _decision({
        accion: "derivar",
        frase_params: { tipo: "etologo", subtipo: "mordida_personas" },
        pending_next: null,
        cuadro_ganador: null,
        log: _log(1, `mordida grave + peso:${perro?.peso_kg}kg ppp:${esPPP}`),
      });
    }
    // Adulto + agresión + grandota (≥25kg) + grave → etólogo
    else if (hayAgresion && esGrandota && gravedad_mordida === "grave") {
      return _decision({
        accion: "derivar",
        frase_params: { tipo: "etologo", subtipo: "mordida_personas" },
        pending_next: null,
        cuadro_ganador: null,
        log: _log(1, `agresion + grandota + grave (peso:${perro?.peso_kg})`),
      });
    }

    // Resto de casos: flujo normal (cae al caso general)
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

  // ── FILTRO 5: Vocabulario canino ─────────────────────────────────────────
  //
  // Si el texto del cliente no contiene NINGUNA keyword de los 7 diccionarios
  // ni una palabra genérica del vocabulario mínimo, lo consideramos input
  // incoherente o fuera de embudo y delegamos en la IA fallback.
  // Sin esto, el filtro 4 captura cualquier cosa con FRASE_MENSAJE_PRINCIPAL,
  // incluyendo entradas como "aslkjdaslkdjasldkj".

  const hayVocabularioCanino = filtrarHits(textoNorm, _VOCABULARIO_CANINO).length > 0;
  if (!hayVocabularioCanino) {
    return _decision({
      accion: "fallback",
      frase_params: null,
      pending_next: null,
      cuadro_ganador: null,
      log: _log(5, "input sin vocabulario canino reconocido"),
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
