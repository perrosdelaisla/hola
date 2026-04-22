/**
 * victoria-matching.js
 * Perros de la Isla — Embudo Victoria
 * Árbol maestro de precedencia — convierte contexto en decisión de respuesta
 * Versión 1.0 · Abril 2026
 *
 * ARQUITECTURA:
 * - Una función por paso del árbol (pasos 0-10)
 * - Orquestador `decidirRespuesta` llama los pasos en orden
 * - Cada paso devuelve null (no aplica) o una Decision completa
 * - _evaluarCuadros encapsula los pasos 6, 7 y 8 internamente
 *
 * DEPENDENCIAS:
 * - victoria-utils.js        → normalizar, filtrarHits
 * - victoria-zones.js        → esCompatibleOnline
 * - victoria-dictionaries.js → detectarCuadros
 * - victoria-breeds.js       → esPPP, clasificarTamano, requiereEtologo, KEYWORDS_AGRESION
 * - victoria-phrases.js      → (consumida por victoria.js, no aquí)
 */

import { normalizar, filtrarHits } from "./victoria-utils.js";
import { esCompatibleOnline } from "./victoria-zones.js";
import { detectarCuadros } from "./victoria-dictionaries.js";
import { requiereEtologo, KEYWORDS_AGRESION } from "./victoria-breeds.js";
import { DICT_BASICA } from "./victoria-dictionaries.js";


// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS para clasificación de mordida (Paso 5)
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORDS_MORDIDA = [
  "muerde", "ha mordido", "mordió", "llegó a morder",
  "se tira a morder", "intento de mordida", "mordida",
  "casi muerde", "amago de mordida",
];

const KEYWORDS_MORDIDA_GRAVE = [
  "sangre", "sangró", "herida", "puntos", "urgencias", "médico",
  "hematoma", "moratón", "marca profunda",
];

const KEYWORDS_MORDIDA_LEVE = [
  "marca leve", "arañazo", "rozó", "sin consecuencias", "no dejó marca",
  "piel roja", "no sangró",
];

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


// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Función central del sistema. Recibe el contexto completo del turno
 * y devuelve una Decision que victoria.js ejecuta.
 *
 * @param {Object} contexto
 * @returns {Object} Decision
 */
export function decidirRespuesta(contexto) {
  // Si hay una pregunta pendiente, ir directamente al paso que la gestiona
  if (contexto.pending === "filtro_mordida") {
    return paso5_filtroMordida(contexto);
  }
  if (contexto.pending === "zona") {
    return _fallbackWhatsapp("pending zona sin resolver al entrar al orquestador");
  }

  // Árbol normal de decisión — orden estricto de la spec §8
  const pasos = [
    paso0_datosMinimos,
    paso1_etologo,
    paso2_laterales,
    paso3_cachorropleno,
    paso4_cachorroTransicion,
    paso5_filtroMordida,
    _evaluarCuadros,       // pasos 6 (cuadros únicos) + 7 (exclusiones) + 8 (mixto)
    paso9_basica,
    paso10_pedirEspecificacion,
  ];

  for (const paso of pasos) {
    const resultado = paso(contexto);
    if (resultado !== null) {
      // LOG TEMPORAL — quitar después de verificar
      console.log("[decidirRespuesta]", {
        paso_disparado: paso.name,
        accion: resultado.accion,
        frase_params: resultado.frase_params,
      });
      return resultado;
    }
  }

  return _fallbackWhatsapp("árbol agotado sin decisión");
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 0 — Pre-filtro de datos mínimos
// ─────────────────────────────────────────────────────────────────────────────

function paso0_datosMinimos(contexto) {
  const { perro, zona } = contexto;

  if (zona.necesitaAclaracion) {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_zona" },
      pending_next: "zona",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "zona desconocida"),
    });
  }

  if (perro.edad_meses === null || perro.edad_meses === undefined) {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_edad" },
      pending_next: "edad",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "edad desconocida"),
    });
  }

  if (!perro.peso_kg || perro.peso_kg <= 0) {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_peso" },
      pending_next: "peso",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "peso desconocido"),
    });
  }

  if (!perro.raza || perro.raza.trim() === "") {
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "pedir_raza" },
      pending_next: "raza",
      log: _log(0, [], [], zona.zonaDetectada, null, [], "raza desconocida"),
    });
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — Derivación al etólogo
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

  // Umbral elevado: PPP sin cuadro serio (media/alta) no deriva
  const hay_senal = cuadros.some((c) => c.confianza === "alta" || c.confianza === "media");

  const descripcion_agresion = KEYWORDS_AGRESION.some((kw) =>
    textoNorm.includes(normalizar(kw))
  );

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
  const { perro, cuadros } = contexto;

  if (perro.edad_meses > 6) return null;

  // Sub-check: posesión con rigidez corporal → posesión con bandera edad temprana
  const cuadroPosesion = cuadros.find((c) => c.id === "posesion" && c.confianza !== "ninguna");
  if (cuadroPosesion && _tieneRigidezCorporal(contexto)) {
    return _resolverCuadro("posesion", contexto, { bandera_edad_temprana: true, paso: 3 });
  }

  // Sub-check: miedo extremo sostenido → miedos con bandera edad temprana
  const cuadroMiedos = cuadros.find((c) => c.id === "miedos" && c.confianza === "alta");
  if (cuadroMiedos) {
    return _resolverCuadro("miedos", contexto, { bandera_edad_temprana: true, paso: 3 });
  }

  // Cachorro pleno sin excepción
  return _resolverCuadro("cachorros", contexto, { paso: 3 });
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 4 — Cachorro en transición (6-9 meses)
// ─────────────────────────────────────────────────────────────────────────────

function paso4_cachorroTransicion(contexto) {
  const { perro, cuadros } = contexto;

  if (perro.edad_meses <= 6 || perro.edad_meses > 9) return null;

  // Cuadro instalado con alta confianza → ese cuadro gana
  const cuadroInstalado = cuadros
    .filter((c) => c.id !== "cachorros" && c.id !== "basica")
    .find((c) => c.confianza === "alta");

  if (cuadroInstalado) {
    return _resolverCuadro(cuadroInstalado.id, contexto, { paso: 4 });
  }

  // Conductas típicas de etapa → cachorros
  const cuadroCachorros = cuadros.find((c) => c.id === "cachorros" && c.confianza !== "ninguna");
  if (cuadroCachorros) {
    return _resolverCuadro("cachorros", contexto, { paso: 4 });
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 5 — Filtro de mordida
// ─────────────────────────────────────────────────────────────────────────────

function paso5_filtroMordida(contexto) {
  const { cuadros, mensaje, pending, respuesta_pendiente, zona } = contexto;
  const textoNorm = normalizar(mensaje ?? "");

  // ── Modo respuesta: el cliente acaba de responder al filtro de mordida ────
  if (pending === "filtro_mordida" && respuesta_pendiente) {
    const respNorm = normalizar(respuesta_pendiente);

    const esGrave     = filtrarHits(respNorm, KEYWORDS_MORDIDA_GRAVE).length > 0;
    const esNoSabe    = filtrarHits(respNorm, KEYWORDS_NO_SABE).length > 0;
    const sinContacto = filtrarHits(respNorm, KEYWORDS_SIN_CONTACTO).length > 0;
    const esLeve      = filtrarHits(respNorm, KEYWORDS_MORDIDA_LEVE).length > 0;

    const cuadroGanador = contexto.cuadro_pendiente_mordida ?? null;

    // 1. Grave → etólogo
    if (esGrave) {
      return _decision({
        accion: "derivar",
        frase_params: { tipo: "etologo", subtipo: "principal" },
        pending_next: null,
        cuadro_ganador: null,
        log: _log(5, [], [], zona.zonaDetectada, null,
          ["mordida_grave", "derivacion_etologo"], "mordida grave confirmada"),
      });
    }

    // 2. No sabe → amago probable con nota
    if (esNoSabe) {
      if (!cuadroGanador) return _fallbackWhatsapp("filtro mordida: no_sabe sin cuadro pendiente");
      return _resolverCuadro(cuadroGanador, contexto, {
        paso: 5, nota: "cliente no pudo precisar — tratar como amago probable",
      });
    }

    // 3. Sin contacto o leve → continuar con cuadro
    if (sinContacto || esLeve) {
      if (!cuadroGanador) return _fallbackWhatsapp("filtro mordida: leve/sincontacto sin cuadro pendiente");
      return _resolverCuadro(cuadroGanador, contexto, {
        paso: 5, nota: sinContacto ? "sin contacto real confirmado" : "contacto leve confirmado",
      });
    }

    // 4. No clasificable → repregunta, no asumir gravedad
    return _decision({
      accion: "preguntar",
      frase_params: { tipo: "apoyo", subtipo: "filtro_mordida_repregunta" },
      pending_next: "filtro_mordida",
      cuadro_pendiente_mordida: cuadroGanador,
      log: _log(5, [], [], zona.zonaDetectada, null,
        ["mordida_no_clasificable"], "respuesta ambigua — repreguntando"),
    });
  }

  // ── Modo detección: ¿el mensaje actual menciona mordida? ─────────────────
  const hayMordida = KEYWORDS_MORDIDA.some((kw) => textoNorm.includes(normalizar(kw)));
  if (!hayMordida) return null;

  // Solo relevante en posesión o reactividad con confianza suficiente
  const cuadroRelevante = cuadros.find(
    (c) => (c.id === "posesion" || c.id === "reactividad") &&
      (c.confianza === "alta" || c.confianza === "media")
  );
  if (!cuadroRelevante) return null;

  return _decision({
    accion: "preguntar",
    frase_params: { tipo: "apoyo", subtipo: "filtro_mordida" },
    pending_next: "filtro_mordida",
    cuadro_pendiente_mordida: cuadroRelevante.id,
    cuadro_ganador: null,
    log: _log(5, [cuadroRelevante.id], [], zona.zonaDetectada, null,
      ["mordida_pendiente"], "keywords de mordida detectadas"),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// PASOS 6-8 — Cuadros únicos + exclusiones + caso mixto
// ─────────────────────────────────────────────────────────────────────────────

function _evaluarCuadros(contexto) {
  // INVARIANTE: aquí solo llegan perros >9 meses.
  // Los pasos 3 y 4 ya resolvieron cachorros pleno (0-6m) y transición (6-9m).
  // Si cachorros aparece en el array con confianza alta, la Regla 5 lo neutraliza.
  // La bandera edad_temprana nunca aparece aquí — los pasos 3-4 la consumen.

  const cuadrosFiltrados = _aplicarExclusiones(contexto.cuadros, contexto);
  const clasificacion = _clasificarResultado(cuadrosFiltrados);

  if (clasificacion.tipo === "vacio") return null;

  return _resolverResultado(clasificacion, cuadrosFiltrados, contexto);
}

function _aplicarExclusiones(cuadros, contexto) {
  const c = cuadros.map((x) => ({ ...x }));
  const get = (id) => c.find((x) => x.id === id);

  const sep  = get("separacion");
  const gen  = get("generalizada");
  const mied = get("miedos");
  const reac = get("reactividad");
  const pos  = get("posesion");
  const bas  = get("basica");
  const cach = get("cachorros");

  // Regla 1: sep vs gen — resuelta por exclusion_textual en detectarCuadros.
  // No hay acción aquí — la arquitectura ya lo resuelve sin ciclo posible.

  // Regla 2: reactividad alta → miedos pierde (conducta activa > pasiva)
  if (reac?.confianza === "alta" && mied?.confianza !== "ninguna") {
    mied.confianza = "ninguna";
    mied._excluido_por = "reactividad_alta";
  }

  // Regla 3: posesión domina sobre reactividad débil.
  // Si reactividad también tiene alta, es mixto legítimo — no se toca.
  const posTieneRecurso = (pos?.n2_hits?.length ?? 0) > 0 || (pos?.n3_hits?.length ?? 0) > 0;
  const posMuchoMasFuerte =
    pos?.confianza === "alta" &&
    (reac?.confianza === "media" || reac?.confianza === "baja");

  if (posMuchoMasFuerte && posTieneRecurso) {
    reac.confianza = "ninguna";
    reac._excluido_por = "posesion_con_recurso_domina";
  }

  // Regla 4: generalizada con detonantes concretos serios → baja a "baja"
  // Umbral alta/media — una mención anecdótica no convierte generalizada en otra cosa
  const hayDetonantesConcretosSerios =
    mied?.confianza === "alta" || mied?.confianza === "media" ||
    reac?.confianza === "alta" || reac?.confianza === "media";

  if ((gen?.confianza === "alta" || gen?.confianza === "media") && hayDetonantesConcretosSerios) {
    gen.confianza = "baja";
    gen._excluido_por = "detonantes_concretos_serios";
  }

  // Regla 5: cachorros >9 meses → neutralizar
  if (cach && contexto.perro.edad_meses > 9) {
    cach.confianza = "ninguna";
    cach._excluido_por = "edad_superior_a_9_meses";
  }

  // Regla adicional: básica pierde ante cualquier cuadro específico activo
  const hayEspecificoActivo = [sep, gen, mied, reac, pos].some(
    (x) => x?.confianza === "alta" || x?.confianza === "media"
  );
  if (hayEspecificoActivo && bas) {
    bas.confianza = "ninguna";
    bas._excluido_por = "cuadro_especifico_presente";
  }

  return c;
}

function _clasificarResultado(cuadrosFiltrados) {
  const activos = cuadrosFiltrados.filter(
    (c) => c.confianza === "alta" || c.confianza === "media"
  );

  if (activos.length === 0) return { tipo: "vacio", cuadros: [], tercero: null };
  if (activos.length === 1) return { tipo: "unico", cuadros: activos, tercero: null };

  // Tercer cuadro solo al log — no a la frase del cliente (Confirmación 2 Opus)
  return {
    tipo: "mixto",
    cuadros: activos.slice(0, 2),
    tercero: activos[2] ?? null,
  };
}

function _resolverResultado(clasificacion, cuadrosFiltrados, contexto) {
  const { zona } = contexto;
  const excluidos = cuadrosFiltrados.filter((c) => c._excluido_por).map((c) => c.id);

  if (clasificacion.tipo === "unico") {
    return _resolverCuadro(clasificacion.cuadros[0].id, contexto, { paso: 6 });
  }

  const [primero, segundo] = clasificacion.cuadros;
  const ids = [primero.id, segundo.id];
  const tercero = clasificacion.tercero;
  const esSepGen = ids.includes("separacion") && ids.includes("generalizada");

  // Frases mixtas solo en presencial — fuera de zona: degradar al cuadro más fuerte
  const zonaSoportaMixto = zona.modalidad === "presencial" && !zona.esSonGotleu;

  if (!zonaSoportaMixto) {
    const resultado = _resolverCuadro(primero.id, contexto, { paso: 6 });
    return {
      ...resultado,
      mixto_degradado: true,
      cuadros_originales: [primero.id, segundo.id],  // Carlos ve los dos en la notificación
      log: _log(6, ids, excluidos, zona.zonaDetectada, "degradado",
        ["mixto_degradado_por_zona"],
        `mixto ${ids.join("+")} degradado a ${primero.id} por zona fuera`),
    };
  }

  const frase_params = esSepGen
    ? { tipo: "mixto", subtipo: "separacion_generalizada" }
    : { tipo: "mixto", subtipo: "plantilla", vars: { cuadro_1: primero.id, cuadro_2: segundo.id } };

  const flags = [];
  if (esSepGen) flags.push("mixto_sep_gen_especial");
  if (tercero) flags.push(`tercer_cuadro:${tercero.id}`);

  return _decision({
    accion: "responder",
    frase_params,
    pending_next: null,
    cuadro_ganador: null,                          // null en mixto — nunca concatenar ids
    cuadros_originales: [primero.id, segundo.id],  // victoria.js usa esto en notificación
    es_mixto: true,
    bandera_edad_temprana: false,
    log: _log(6, ids, excluidos, zona.zonaDetectada, "presencial", flags,
      tercero ? `tercer cuadro a valorar en presencial: ${tercero.id}` : ""),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 9 — Educación básica (categoría por defecto)
// ─────────────────────────────────────────────────────────────────────────────

function paso9_basica(contexto) {
  const basica = contexto.cuadros.find((c) => c.id === "basica");

  if (!basica || basica.confianza === "ninguna") return null;

  // Respeta el flag requires_concrete_problem del diccionario.
  // Si está activo y no hay N2 concreto, pedir especificación (paso10).
  // Así el criterio vive en el diccionario, no hardcodeado aquí.
  if (DICT_BASICA.requires_concrete_problem && basica.n2_hits.length === 0) return null;

  return _resolverCuadro("basica", contexto, { paso: 9 });
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 10 — Pedir especificación
// Paso legítimo del árbol — ningún cuadro disparó con confianza suficiente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elige el subtipo de pregunta de afinado según qué hits parciales detectó el matcher.
 * Hace que Victoria pregunte dirigido en vez de genérico.
 */
function _elegirSubtipoAfinado(cuadros, mensaje) {
  const textoLower = (mensaje || "").toLowerCase();

  // Mordida sin contexto → preguntar cuándo muerde
  if (/\b(muerde|mordido|mordida|amago)\b/.test(textoLower)) {
    return "contexto_mordida";
  }

  // Ladridos sin detonante → preguntar a qué ladra
  if (/\b(ladra|ladrido|ladrar|ladridos)\b/.test(textoLower)) {
    return "detonante_ladridos";
  }

  // Detonante sin conducta → preguntar cómo reacciona
  const hayDetonante = /\b(petardo|petardos|perro|perros|persona|personas|bicicleta|bicicletas|moto|motos|timbre|visita|visitas|tormenta|tormentas|coche|coches|ruido|ruidos|gente)\b/.test(textoLower);
  const hayConducta  = /\b(se esconde|se lanza|tiembla|huye|corre|ataca|se paraliza|se queda|ladra|muerde)\b/.test(textoLower);
  if (hayDetonante && !hayConducta) {
    return "respuesta_detonante";
  }

  // Conducta genérica (géneros y plurales cubiertos) sin contexto temporal → preguntar cuándo/dónde
  const hayConductaGeneral = /\b(nervios[oa]s?|inquiet[oa]s?|reactiv[oa]s?|ansios[oa]s?|tens[oa]s?|agresiv[oa]s?|problema|problemas|miedo|miedos|mal|malito|malita|estresad[oa])\b/.test(textoLower);
  const hayContexto = /\b(en casa|en el paseo|en la calle|cuando|si |al ir|al volver|solo|sola)\b/.test(textoLower);
  if (hayConductaGeneral && !hayContexto) {
    return "contexto_temporal";
  }

  return null; // fallback al genérico
}

function paso10_pedirEspecificacion(contexto) {
  const subtipoAfinado = _elegirSubtipoAfinado(contexto.cuadros, contexto.mensaje);

  // LOG TEMPORAL — quitar después de verificar
  console.log("[paso10_afinado]", {
    mensaje: contexto.mensaje,
    subtipo_elegido: subtipoAfinado,
    cuadros_confianza: contexto.cuadros.map(c => ({ id: c.id, conf: c.confianza })),
  });

  return _decision({
    accion: "preguntar",
    frase_params: {
      tipo: "apoyo",
      subtipo: "pedir_especificacion",
      vars: { subtipo_afinado: subtipoAfinado },
    },
    pending_next: null,
    cuadro_ganador: null,
    log: _log(10, [], [], contexto.zona?.zonaDetectada ?? "desconocida", null, [],
      `ningún cuadro disparó — subtipo afinado: ${subtipoAfinado ?? "generico"}`),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resuelve las 5 rutas de modalidad y devuelve la Decision correcta.
 * Ruta 1: zona presencial → frase presencial
 * Ruta 2: zona fuera + compatible online → frase online
 * Ruta 3: zona fuera + NO compatible online → derivación por zona
 * Ruta 4: Son Gotleu + compatible online → Son Gotleu compatible
 * Ruta 5: Son Gotleu + NO compatible online → Son Gotleu no compatible
 * (Son Gotleu se evalúa antes porque tiene su propio flag)
 */
function _resolverCuadro(cuadroId, contexto, { bandera_edad_temprana = false, paso = 6, nota = "" } = {}) {
  const { zona, perro } = contexto;
  const compatibleOnline = esCompatibleOnline(cuadroId);
  const vars = { nombre_perro: perro?.nombre ?? null };

  let frase_params;
  let modalidad_final;

  if (zona.esSonGotleu && compatibleOnline) {
    // Ruta 4
    modalidad_final = "online";
    frase_params = { tipo: "son_gotleu", subtipo: "compatible_online", cuadro: cuadroId, vars };

  } else if (zona.esSonGotleu && !compatibleOnline) {
    // Ruta 5
    modalidad_final = "derivar";
    frase_params = { tipo: "son_gotleu", subtipo: "no_compatible_online" };

  } else if (zona.modalidad === "presencial") {
    // Ruta 1
    modalidad_final = "presencial";
    frase_params = { tipo: "cuadro", cuadro: cuadroId, modalidad: "presencial", vars };

  } else if (zona.modalidad === "fuera" && compatibleOnline) {
    // Ruta 2
    modalidad_final = "online";
    frase_params = { tipo: "cuadro", cuadro: cuadroId, modalidad: "online", vars };

  } else if (zona.modalidad === "fuera" && !compatibleOnline) {
    // Ruta 3
    modalidad_final = "derivar";
    frase_params = { tipo: "zona", vars: { cuadro: cuadroId } };

  } else {
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

function _tieneRigidezCorporal(contexto) {
  const textoNorm = normalizar(contexto.mensaje ?? "");
  const RIGIDEZ = ["cuerpo tieso", "cuerpo rígido", "cola tiesa", "se tensa", "se rigidiza"];
  return RIGIDEZ.some((kw) => textoNorm.includes(normalizar(kw)));
}

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

function _decision({
  accion,
  frase_params,
  pending_next = null,
  cuadro_ganador = null,
  es_mixto = false,
  bandera_edad_temprana = false,
  cuadro_pendiente_mordida = null,
  mixto_degradado = false,
  cuadros_originales = null,  // array [id1, id2] cuando es_mixto o mixto_degradado
  log,
}) {
  return {
    accion,
    frase_params,
    pending_next,
    cuadro_ganador,       // string único de id o null — nunca concatenado
    es_mixto,
    bandera_edad_temprana,
    cuadro_pendiente_mordida, // persistido por victoria.js entre turnos
    mixto_degradado,      // true si había mixto pero se degradó a cuadro único por zona
    cuadros_originales,   // victoria.js lee esto para la notificación a Carlos
    log,
  };
}

function _fallbackWhatsapp(razon) {
  return _decision({
    accion: "fallback",
    frase_params: { tipo: "apoyo", subtipo: "fallback_whatsapp" },
    log: _log(99, [], [], null, null, ["fallback"], razon),
  });
}
