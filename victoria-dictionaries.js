/**
 * victoria-dictionaries.js
 * Perros de la Isla — Embudo Victoria
 * Los 7 diccionarios de detección de cuadros + función detectarCuadros()
 * Versión 1.0 · Abril 2026
 */

import { normalizar, filtrarHits } from "./victoria-utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTRUCTURA DE CADA DICCIONARIO
//
// id                    — identificador interno del cuadro
// n1                    — alta confianza (dispara solo)
// n2                    — corroboradores (necesitan combinarse)
// n3                    — contexto/entorno (refuerza, no dispara solo)
// exclusions_textual    — patrones literales que anulan el cuadro
// exclusions_cooccurrence — reglas que dependen del matcheo de otros cuadros
//                          (aplicadas por victoria-matching.js tras evaluar todos)
// compound_rules        — reglas compuestas detonante+conducta (miedos/reactividad)
//
// NORMALIZACIÓN: las keywords pueden mantenerse legibles (con tildes, ñ).
// filtrarHits() normaliza tanto el input como cada keyword antes de comparar.
// ─────────────────────────────────────────────────────────────────────────────


// ── 1. ANSIEDAD POR SEPARACIÓN ───────────────────────────────────────────────

export const DICT_SEPARACION = {
  id: "separacion",

  n1: [
    "ansiedad por separación",
    "ansiedad de separación",
    "aps",
    "cuando me voy",
    "cuando salgo",
    "si salgo",
    "al irme",
    "al marcharme",
    "si lo dejo solo",
    "cuando se queda solo",
    "no puede estar solo",
    "no soporta estar solo",
    "no aguanta quedarse solo",
    "no puedo dejarlo",
    "no se queda solo",
    "no lo puedo dejar",
  ],

  n2: [
    "llora",
    "aúlla",
    "ladra sin parar",
    "ladra mucho",
    "no deja de ladrar",
    "destroza",
    "destruye",
    "rompe",
    "muerde los muebles",
    "rompe cosas",
    "se hace pis",
    "se mea",
    "se hace caca",
    "hace sus necesidades dentro",
    "rasca la puerta",
    "araña la puerta",
    "intenta salir",
    "me sigue a todas partes",
    "no se separa de mí",
    "siempre pegado",
  ],

  n3: [
    "vecinos",
    "se quejan los vecinos",
    "aviso del casero",
    "denuncia",
    "cámara",
    "lo grabé",
    "lo he grabado",
    "kong",
    "tele puesta",
    "feromonas",
    "adaptil",
    "suplementos",
    "teletrabajo",
    "volver a la oficina",
    "empiezo a trabajar fuera",
  ],

  // Patrones literales que anulan el cuadro si aparecen en el mensaje
  exclusions_textual: [
    "también cuando estoy",
    "aunque esté en casa",
    "incluso cuando estoy",
    "cuando estoy con él",
    "cuando estamos con él",
    "aunque estemos",
    "con nosotros también",
    "estando nosotros",
  ],

  // Reglas que dependen del matcheo de otros cuadros
  // Aplicadas por victoria-matching.js DESPUÉS de evaluar todos los diccionarios
  exclusions_cooccurrence: [
    {
      condition: "Si 'generalizada' tiene confianza alta o media comparable → gana generalizada",
      loses_to: "generalizada",
    },
  ],

  // No aplica reglas compuestas para este cuadro
  compound_rules: [],
};


// ── 2. ANSIEDAD GENERALIZADA ──────────────────────────────────────────────────

export const DICT_GENERALIZADA = {
  id: "generalizada",

  n1: [
    "ansiedad generalizada",
    "en modo alerta",
    "siempre alerta",
    "hipervigilante",
    "siempre pendiente",
    "pendiente de todo",
    "no se relaja nunca",
    "no consigue relajarse",
    "no sabe relajarse",
    "no se relaja ni en casa",
    "no descansa bien",
    "no duerme bien",
    "duerme poco",
    "se despierta por todo",
    "siempre tenso",
    "siempre en tensión",
    "no baja la tensión",
    "vive en tensión",
  ],

  n2: [
    "muy nervioso",
    "hiperactivo",
    "no para quieto",
    "no para",
    "se sobresalta con todo",
    "se asusta por todo",
    "reacciona a todo",
    "jadea sin motivo",
    "resopla",
    "respira rápido",
    "da vueltas",
    "camina en círculos",
    "no sabemos qué le pasa",
    "no hay nada concreto",
    "no hay un motivo claro",
  ],

  n3: [
    "desde hace meses",
    "desde cachorro",
    "siempre ha sido así",
    "en casa y fuera",
    "en todos lados",
    "ya probamos de todo",
    "nada le calma",
    "cambió desde",
    "antes era tranquilo",
    "antes estaba bien",
    // Palabras de frecuencia genéricas — solo refuerzan en combinación con N1/N2
    "constantemente",
    "permanentemente",
    "en todo momento",
  ],

  exclusions_textual: [],

  exclusions_cooccurrence: [
    {
      condition: "Si síntomas solo en ausencia del tutor → gana separación",
      loses_to: "separacion",
    },
    {
      condition: "Si hay detonantes concretos claros → reevaluar miedos o reactividad según conducta",
      loses_to: "miedos_o_reactividad",
    },
  ],

  compound_rules: [],
};


// ── 3. MIEDOS Y FOBIAS ────────────────────────────────────────────────────────

export const DICT_MIEDOS = {
  id: "miedos",

  n1: [
    "miedo",
    "le da miedo",
    "tiene miedo",
    "mucho miedo",
    "pánico",
    "le aterra",
    "terror",
    "fobia",
    "fóbico",
    "se esconde",
    "se mete debajo",
    "se refugia",
    "tiembla",
    "tembloroso",
    "temblando",
    "se orina del susto",
    "se mea del miedo",
    "se hace pis del miedo",
    "se queda paralizado",
    "no se mueve",
    "se bloquea",
    "se queda congelado",
    "intenta huir",
    "sale corriendo",
    "quiere escapar",
    "miedoso",
    "asustadizo",
  ],

  n2: [
    // Detonantes con conducta pasiva
    "petardos", "fuegos artificiales", "tormentas", "truenos", "cohetes",
    "ruidos fuertes", "explosiones",
    "paraguas", "escobas", "aspiradora", "secador", "bolsas", "globos",
    "veterinario", "peluquería canina",
    "escaleras", "ascensor", "sitios nuevos",
    // Corporal específico de miedo
    "cola entre las piernas",
    "orejas hacia atrás",
    "babea del miedo",
  ],

  n3: [
    "desde cachorro tuvo miedo",
    "nunca se acostumbró",
    "desde pequeño",
    "desde que pasó",
    "desde aquel día",
    "se llevó un susto",
    "fue abandonado",
    "protectora",
    "rescate",
    "maltrato",
    // Bajados de N2 por ser signos corporales compartidos con otros cuadros
    "encogido",
    "postura baja",
    "jadea mucho",
  ],

  exclusions_textual: [],

  exclusions_cooccurrence: [
    {
      condition: "Si la respuesta al detonante es activa (ladrar, lanzarse, perseguir) → gana reactividad",
      loses_to: "reactividad",
    },
    {
      condition: "Si no hay detonante concreto y es permanente → gana generalizada",
      loses_to: "generalizada",
    },
    {
      condition: "Si solo ocurre en ausencia del tutor → gana separación",
      loses_to: "separacion",
    },
  ],

  // Regla clave: detonante + respuesta PASIVA confirma miedos
  // Si respuesta es activa → victoria-matching.js debe reclasificar como reactividad
  compound_rules: [
    {
      id: "detonante_con_evitacion",
      description: "Detonante conocido + conducta de evitación/huida/bloqueo = miedos confirmados",
      requires_any_of: [
        "petardos", "fuegos artificiales", "tormentas", "truenos",
        "paraguas", "aspiradora", "veterinario", "escaleras",
      ],
      requires_also: [
        "se esconde", "tiembla", "sale corriendo", "se paraliza",
        "se queda congelado", "intenta huir", "se bloquea",
      ],
      confidence: "alta",
    },
    {
      id: "detonante_sin_conducta",
      description: "Detonante mencionado pero sin conducta asociada → matching debe preguntar conducta",
      requires_any_of: [
        "petardos", "tormentas", "veterinario", "paraguas",
        "aspiradora", "escaleras", "ascensor",
      ],
      // Dispara si hay detonante Y NO hay ninguna de estas conductas
      excludes_all_of: [
        "se esconde", "tiembla", "sale corriendo", "se paraliza",
        "se queda paralizado", "no se mueve", "se queda congelado",
        "intenta huir", "se bloquea",
        "ladra", "se lanza", "persigue", "se tira", "se abalanza",
      ],
      requires_also: null, // null = usa excludes_all_of en su lugar
      confidence: "baja",
    },
  ],
};


// ── 4. REACTIVIDAD E IMPULSIVIDAD ─────────────────────────────────────────────

export const DICT_REACTIVIDAD = {
  id: "reactividad",

  n1: [
    "reactividad",
    "reactivo",
    "reactiva",
    "reacciona mucho",
    "reacciona fuerte",
    "se lanza",
    "se tira",
    "se abalanza",
    "tira de la correa",
    "da tirones",
    "me arrastra",
    "me lleva",
    "ladra como loco",
    "ladra sin parar",
    "persigue bicicletas",
    "persigue motos",
    "persigue corredores",
    "persigue coches",
    "descontrolado",
    "se descontrola",
    "se pone como loco",
    "no puedo sacarlo tranquilo",
    "no puedo pasearlo",
    "el paseo es un infierno",
    "imposible pasear",
    "se tira a morder",
    "se lanza encima",
    "se tira encima",
  ],

  n2: [
    "se pone nervioso al ver",
    "al cruzarse con",
    "cuando aparece",
    "cruzo de acera",
    "me cambio de acera",
    "evito cruzarme",
    "se enfada",
    "se pone agresivo",
    "parece agresivo",
    "le tiene manía",
    "no soporta",
    "brusco",
    "bruta",
    "impulsivo",
    "sin control",
    "sin filtro",
    "protege",
    "me protege",
    "protege la casa",
    "protege el territorio",
  ],

  n3: [
    // Detonantes típicos
    "otros perros", "perros en la calle", "perros grandes", "perros pequeños",
    "bicicletas", "motos", "patinetes", "skates", "runners", "corredores",
    "personas", "desconocidos", "gente por la calle", "visitas", "gente en casa",
    "niños", "coches", "furgonetas",
    "timbre", "puerta", "llaman a la puerta", "tocan el timbre",
    "ventana", "balcón", "ve por la ventana", "mira por la ventana",
    "paseo", "sacar", "sacarlo",
    // Bajados de N2 por ser ambiguos entre cuadros
    "hiperactivo",
    "demasiada energía",
  ],

  exclusions_textual: [],

  exclusions_cooccurrence: [
    {
      condition: "Si la respuesta al detonante es evitación pasiva → gana miedos",
      loses_to: "miedos",
    },
    {
      condition: "Si la tensión es solo con recurso concreto en casa → gana posesión",
      loses_to: "posesion",
    },
  ],

  // Regla clave: vehículos y ciertos detonantes típicos son reactividad por defecto
  compound_rules: [
    {
      id: "detonante_con_respuesta_activa",
      description: "Detonante + conducta activa (ladrar, lanzarse, perseguir) = reactividad confirmada",
      requires_any_of: [
        "bicicletas", "motos", "perros", "personas", "corredores",
        "timbre", "ventana", "coches",
      ],
      requires_also: [
        "se lanza", "ladra", "tira de la correa", "persigue", "se descontrola",
        "se abalanza", "se tira",
      ],
      confidence: "alta",
    },
  ],
};


// ── 5. POSESIÓN DE RECURSOS ───────────────────────────────────────────────────

export const DICT_POSESION = {
  id: "posesion",

  n1: [
    "posesión",
    "posesivo",
    "posesiva",
    "protector con",
    "celoso con",
    "gruñe",
    "gruñidos",
    "enseña los dientes",
    "muestra los dientes",
    "se tensa",
    "se rigidiza",
    "cuerpo tieso",
    "cuerpo rígido",
    "cola tiesa",
    "no me deja acercarme",
    "no deja que le quite",
    "defiende",
    "me muerde cuando",
    "se tira a morder cuando",
  ],

  n2: [
    // Conductas específicas de posesión (con recurso implícito)
    "ladra al acercarme",
    "reacciona si toco",
    // Corporal
    "mirada fija",
    "me mira mal",
    "labio levantado",
    "colmillos",
    // Marco erróneo del cliente — específico de posesión con recurso
    "dominante con",
    "se cree el jefe con",
    "me desafía con",
    // Posesión afectiva
    "se pone entre",
    "se interpone",
    "celoso de",
  ],

  n3: [
    // Recursos (objetos genéricos — solos no son diagnóstico)
    "comida", "plato", "hueso", "chuchería", "juguete", "pelota",
    "peluche", "cama", "sofá", "rincón", "sitio",
    // Contextos
    "cuando come",
    "mientras come",
    "al darle de comer",
    "si le quito",
    "al intentar quitarle",
    "si toco su",
    "en el sofá",
    "en la cama",
    "en su sitio",
    "con la familia",
    "con los niños",
    "con visitas",
  ],

  exclusions_textual: [],

  exclusions_cooccurrence: [
    {
      condition: "Si no hay recurso identificable → probablemente reactividad",
      loses_to: "reactividad",
    },
    {
      condition: "Si hay signos claros de juego (cola relajada, reverencia) → no es posesión",
      loses_to: null, // no dispara ningún otro cuadro, simplemente se cancela
    },
  ],

  compound_rules: [],
};


// ── 6. EDUCACIÓN BÁSICA (categoría por defecto) ───────────────────────────────

export const DICT_BASICA = {
  id: "basica",

  // Flag para victoria-matching.js:
  // Si básica activa pero el mensaje no contiene ninguna conducta problemática concreta
  // (solo intención genérica como "mejorar la convivencia"), no disparar protocolo → pedir especificación.
  requires_concrete_problem: true,

  n1: [
    "educación básica",
    "educar",
    "educación",
    "obediencia",
    "que obedezca",
    "que me haga caso",
    "no hace caso",
    "no escucha",
    "no obedece",
    "que aprenda",
    "enseñarle",
    "mejorar la convivencia",
    "mejorar el día a día",
    "empezar bien",
    "desde cero",
    "empezar con buen pie",
  ],

  n2: [
    // Paseo
    "tira de la correa",
    "no sabe pasear",
    "no camina bien",
    // Llamada
    "no viene",
    "no responde a la llamada",
    "se escapa",
    "no regresa",
    // Casa
    "salta a visitas",
    "salta encima",
    "ladra al timbre",
    "ladra a los ruidos",
    "ladra al cartero",
    // Modales
    "pide comida en la mesa",
    "no respeta espacios",
    "se sube al sofá sin permiso",
    // Necesidades (sin contexto de ansiedad)
    "se hace pis dentro",
    "se hace caca dentro",
    // Objetos (sin contexto de separación)
    "muerde zapatos",
    "destroza cosas",
  ],

  n3: [
    "adoptado",
    "adopción",
    "rescate",
    "protectora",
    "la calle",
    "queremos hacer las cosas bien",
    "que se adapte",
    "que esté cómodo",
    "cambio de casa",
    "nuevo hogar",
    "primer perro",
    "nunca hemos tenido perro",
  ],

  exclusions_textual: [],

  // Solo se activa si ningún cuadro específico se dispara con fuerza
  // loses_to lista explícita — victoria-matching.js itera esta lista para aplicar la regla
  exclusions_cooccurrence: [
    {
      condition: "Si alguno de estos cuadros tiene confianza alta → ese cuadro gana, básica no se dispara",
      loses_to: ["separacion", "generalizada", "miedos", "reactividad", "posesion", "cachorros"],
    },
  ],

  compound_rules: [],
};


// ── 7. CACHORROS ──────────────────────────────────────────────────────────────

export const DICT_CACHORROS = {
  id: "cachorros",

  n1: [
    "cachorro",
    "cachorra",
    "cachorrito",
    "puppy",
    "pequeño todavía",
    "muy pequeño",
  ],

  n2: [
    // Mordida exploratoria
    "muerde todo",
    "muerde manos",
    "muerde cuando juega",
    // Aprendizaje
    "no sabe dónde ir",
    "no avisa",
    "marca la casa",
    // Rutinas
    "llora por las noches",
    "no se adapta",
    // Socialización
    "primera vez fuera",
    "no conoce otros perros",
    "nunca ha salido",
    // Expectativas
    "empezar bien desde el principio",
    "desde pequeño",
    "queremos educarlo bien",
  ],

  n3: [
    "primer perro",
    "nunca hemos tenido perro",
    "familia con niños",
    "los niños están ilusionados",
    "vacunación",
    "primeras vacunas",
    "camada",
    "separado de la madre",
  ],

  exclusions_textual: [],

  // Cachorros solo se dispara dentro de los tramos de edad correctos
  // La lógica de tramos vive en victoria-matching.js
  exclusions_cooccurrence: [
    {
      condition: "Si edad >9 meses y hay cuadro instalado → cuadro específico gana",
      loses_to: ["separacion", "generalizada", "miedos", "reactividad", "posesion"],
    },
    {
      condition: "Si hay señales fuertes de posesión con rigidez corporal → posesión con bandera edad temprana",
      loses_to: "posesion",
    },
    {
      condition: "Si hay miedo extremo sostenido → miedos con bandera edad temprana",
      loses_to: "miedos",
    },
  ],

  compound_rules: [],
};


// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO COMPLETO — todos los diccionarios en orden de precedencia
// (el orden importa: victoria-matching.js los evalúa en este orden para cuadros únicos)
// ─────────────────────────────────────────────────────────────────────────────

export const TODOS_LOS_DICCIONARIOS = [
  DICT_SEPARACION,
  DICT_POSESION,
  DICT_MIEDOS,
  DICT_REACTIVIDAD,
  DICT_GENERALIZADA,
  DICT_BASICA,
  DICT_CACHORROS,
];


// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — detectarCuadros(mensaje)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza el mensaje del cliente y devuelve los cuadros detectados
 * con su nivel de confianza y los hits por nivel.
 *
 * Esta función hace el matching puro de keywords.
 * Las reglas de precedencia, exclusiones por co-ocurrencia y decisión
 * final viven en victoria-matching.js (que consume este output).
 *
 * Lógica de confianza:
 *   alta  → 1+ hit N1
 *   media → 2+ hits N2, o 1 hit N2 + 2+ hits N3
 *   baja  → 1 hit N2 + 1 hit N3, o solo N3
 *   none  → sin hits
 *
 * @param {string} mensaje — texto libre del cliente
 * @returns {{
 *   cuadros: Array<{
 *     id: string,
 *     confianza: 'alta'|'media'|'baja'|'ninguna',
 *     n1_hits: string[],
 *     n2_hits: string[],
 *     n3_hits: string[],
 *     exclusion_textual: boolean,
 *     compound_hits: string[]
 *   }>,
 *   requiere_aclaracion: boolean
 * }}
 */
export function detectarCuadros(mensaje) {
  const textoNorm = normalizar(mensaje);

  const cuadros = TODOS_LOS_DICCIONARIOS.map((dict) => {
    const n1_hits = filtrarHits(textoNorm, dict.n1);
    const n2_hits = filtrarHits(textoNorm, dict.n2);
    const n3_hits = filtrarHits(textoNorm, dict.n3);

    // Exclusión textual directa
    const exclusion_textual = (dict.exclusions_textual || []).some((ex) =>
      textoNorm.includes(normalizar(ex))
    );

    // Compound rules — devuelven array de { id, confidence }
    const compound_hits = _evaluarCompoundRules(textoNorm, dict.compound_rules || []);

    // Contar compound hits de alta confianza para elevar la confianza del cuadro
    const compound_hits_alta_count = compound_hits.filter((h) => h.confidence === "alta").length;

    const confianza = _calcularConfianza(n1_hits, n2_hits, n3_hits, exclusion_textual, compound_hits_alta_count);

    return {
      id: dict.id,
      confianza,
      n1_hits,
      n2_hits,
      n3_hits,
      exclusion_textual,
      compound_hits,
    };
  });

  // requiere_aclaracion = ningún cuadro tiene confianza alta o media
  const hayConfianzaSuficiente = cuadros.some(
    (c) => c.confianza === "alta" || c.confianza === "media"
  );

  return {
    cuadros,
    requiere_aclaracion: !hayConfianzaSuficiente,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crítica 3: compound rules con confidence "alta" elevan la confianza del cuadro
 * aunque no haya N1. compound_hits_alta_count = número de reglas "alta" que dispararon.
 */
function _calcularConfianza(n1_hits, n2_hits, n3_hits, exclusion_textual, compound_hits_alta_count) {
  if (exclusion_textual) return "ninguna";
  if (n1_hits.length >= 1) return "alta";
  if (compound_hits_alta_count > 0) return "alta";
  if (n2_hits.length >= 2) return "media";
  if (n2_hits.length >= 1 && n3_hits.length >= 2) return "media";
  if (n2_hits.length >= 1 && n3_hits.length >= 1) return "baja";
  if (n3_hits.length >= 1) return "baja";
  return "ninguna";
}

/**
 * Crítica 4: soporta dos modos de compound rule:
 * - requires_also (array): dispara si hay detonante Y alguna conducta del array
 * - excludes_all_of (array): dispara si hay detonante Y NINGUNA conducta del array
 *
 * Devuelve array de objetos { id, confidence } para los que dispararon.
 */
function _evaluarCompoundRules(textoNorm, compound_rules) {
  const hits = [];
  for (const rule of compound_rules) {
    const tieneDetonante = (rule.requires_any_of || []).some((kw) =>
      textoNorm.includes(normalizar(kw))
    );
    if (!tieneDetonante) continue;

    let dispara = false;

    if (rule.excludes_all_of) {
      // Modo "detonante sin conducta": dispara si NO hay ninguna conducta listada
      const tieneConducta = rule.excludes_all_of.some((kw) =>
        textoNorm.includes(normalizar(kw))
      );
      dispara = !tieneConducta;
    } else if (Array.isArray(rule.requires_also) && rule.requires_also.length > 0) {
      // Modo "detonante con conducta": dispara si hay al menos una conducta listada
      dispara = rule.requires_also.some((kw) =>
        textoNorm.includes(normalizar(kw))
      );
    } else {
      // requires_also vacío o null — no aplica ningún modo, no dispara
      dispara = false;
    }

    if (dispara) {
      hits.push({ id: rule.id, confidence: rule.confidence });
    }
  }
  return hits;
}


// ─────────────────────────────────────────────────────────────────────────────
// CASOS DE PRUEBA (solo para desarrollo — eliminar en producción)
// Para correr en consola del navegador o Node:
// import { detectarCuadros } from "./victoria-dictionaries.js";
//
// CASO 1: Separación clara
// detectarCuadros("mi perro llora cuando me voy, los vecinos se quejan")
// Esperado: separacion → confianza alta (n1: "cuando me voy", n2: "llora", n3: "vecinos")
//
// CASO 2: Separación excluida por co-ocurrencia
// detectarCuadros("está nervioso todo el día, incluso cuando estamos con él en casa, y también cuando nos vamos")
// Esperado: separacion → exclusion_textual=true; generalizada → confianza media/alta
//
// CASO 3: Reactividad clara
// detectarCuadros("se lanza a todos los perros que ve en el paseo, no puedo pasearlo")
// Esperado: reactividad → confianza alta (n1: "se lanza", "no puedo pasearlo")
//
// CASO 4: Miedos con detonante
// detectarCuadros("le tienen pánico las tormentas, se esconde debajo de la cama")
// Esperado: miedos → confianza alta, compound_hits: ["detonante_con_evitacion"]
//
// CASO 5: Ambiguo — pedir aclaración
// detectarCuadros("quiero mejorar la convivencia con mi perro")
// Esperado: basica → confianza baja, requiere_aclaracion: true
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE SERVICIOS LATERALES
// Función pura — solo detecta la keyword.
// La lógica de "ignorar si hay cuadro fuerte" vive en victoria.js (orquestador).
// ─────────────────────────────────────────────────────────────────────────────

export const DICT_LATERALES = {
  paseos_grupales: [
    "paseos grupales", "paseo grupal", "paseos en grupo", "paseo colectivo",
    "manada", "salida con otros perros", "paseo con más perros",
    "actividad en grupo", "quedada de perros",
  ],
  adopciones: [
    "adopción", "adoptar", "cachorro en adopción", "perro gratis",
    "regalar un perro", "dar en adopción", "protectora", "perrera",
  ],
  guarderia: [
    "guardería", "guardería canina", "alojamiento", "dejar al perro",
    "cuidador", "hotel canino", "dog hotel",
  ],
  peluqueria: [
    "peluquería", "peluquero canino", "pelo", "corte de pelo", "bañar", "baño canino", "esquila",
  ],
  veterinaria: [
    "veterinario", "veterinaria", "clínica veterinaria",
    "vacunas", "chip", "desparasitación", "revisión veterinaria",
  ],
};

/**
 * Detecta si el texto del cliente corresponde principalmente a un servicio lateral.
 * Devuelve el id del lateral o null.
 * La decisión de usarlo o ignorarlo (si hay cuadros fuertes) la toma victoria.js.
 *
 * @param {string} texto
 * @returns {string|null} id del lateral o null
 */
export function detectarLateral(texto) {
  const norm = normalizar(texto);
  for (const [id, keywords] of Object.entries(DICT_LATERALES)) {
    if (keywords.some((kw) => norm.includes(normalizar(kw)))) {
      return id;
    }
  }
  return null;
}
