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
    // Singular
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
    "cada vez que se queda solo",
    "cada vez que me voy",
    "cada vez que salgo",
    "siempre que me voy",
    "siempre que salgo",
    "cuando lo dejo solo",
    "cuando está solo",
    "cuando lo dejamos solo",
    "cuando está sin mí",
    "en cuanto me voy",
    "en cuanto salgo",
    "si me ausento",
    "apenas me voy",
    // Plural — cuando el tutor vive con pareja/familia
    "cuando nos vamos",
    "cuando salimos",
    "si salimos",
    "al irnos",
    "al marcharnos",
    "si lo dejamos solo",
    "no lo podemos dejar",
    "no lo dejamos solo",
    "cuando no estamos",
    "cuando no estamos en casa",
    "si nos vamos",
    "cada vez que nos vamos",
    "cada vez que salimos",
    "siempre que nos vamos",
    "siempre que salimos",
    "cuando está sin nosotros",
    "en cuanto nos vamos",
    "apenas nos vamos",
  ],

  n2: [
    "llora",
    "aúlla",
    "ladra sin parar",
    "ladra mucho",
    "no deja de ladrar",
    "ladra",
    "se pone a ladrar",
    "empieza a ladrar",
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
    // Singular
    "me sigue a todas partes",
    "no se separa de mí",
    "siempre pegado",
    // Plural
    "nos sigue a todas partes",
    "no se separa de nosotros",
    "siempre pegado a nosotros",
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

  exclusions_cooccurrence: [
    {
      condition: "Si 'generalizada' tiene confianza alta o media comparable → gana generalizada",
      loses_to: "generalizada",
    },
  ],

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
    "petardos", "fuegos artificiales", "tormentas", "truenos", "cohetes",
    "ruidos fuertes", "explosiones",
    "paraguas", "escobas", "aspiradora", "secador", "bolsas", "globos",
    "veterinario", "peluquería canina",
    "escaleras", "ascensor", "sitios nuevos",
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
      excludes_all_of: [
        "se esconde", "tiembla", "sale corriendo", "se paraliza",
        "se queda paralizado", "no se mueve", "se queda congelado",
        "intenta huir", "se bloquea",
        "ladra", "se lanza", "persigue", "se tira", "se abalanza",
      ],
      requires_also: null,
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
    "tira mucho de la correa",
    "tira muchísimo de la correa",
    "tira como loco de la correa",
    "tira todo el rato",
    "tira todo el tiempo",
    "tira siempre",
    "tira sin parar",
    "da tirones",
    "da muchos tirones",
    "me arrastra",
    "me lleva",
    "nos arrastra",
    "nos lleva",
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
    "no podemos pasearlo",
    "no podemos sacarlo tranquilo",
    "el paseo es un infierno",
    "imposible pasear",
    "se tira a morder",
    "se lanza encima",
    "se tira encima",
    "corre detrás",
    "corre detras",
    "sale corriendo a por",
    "se va detrás",
    "se va detras",
    "sale disparado",
    "sale disparado a por",
    "se vuelve loco",
    "como loco",
    "se me escapa",
    "no puedo sujetarlo",
    "no podemos sujetarlo",
    "me cuesta sujetarlo",
    "se me va",
    "tira para ir a por",
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
    "otros perros", "perros en la calle", "perros grandes", "perros pequeños",
    "bicicletas", "motos", "patinetes", "skates", "runners", "corredores",
    "personas", "desconocidos", "gente por la calle", "visitas", "gente en casa",
    "niños", "coches", "furgonetas",
    "timbre", "puerta", "llaman a la puerta", "tocan el timbre",
    "ventana", "balcón", "ve por la ventana", "mira por la ventana",
    "paseo", "sacar", "sacarlo",
    "hiperactivo",
    "demasiada energía",
    // Animales pequeños (instinto de presa)
    "gatos", "gato",
    "palomas", "paloma",
    "pájaros", "pajaros", "pájaro", "pajaro",
    "ardillas", "ardilla",
    "conejos", "conejo",
    "ratas", "rata", "ratones", "ratón", "raton",
    "lagartijas", "lagartija",
    "erizos", "erizo",
    // Animales grandes / rural Mallorca
    "ovejas", "oveja",
    "cabras", "cabra",
    "caballos", "caballo",
    "vacas", "vaca",
    "jabalíes", "jabalí", "jabalies", "jabali",
    "ciervos", "ciervo",
    // Variantes urbanas faltantes
    "bici", "bicis",
    "moto",
    "patinadores",
    "patinetes eléctricos", "patinete eléctrico",
    "carritos de la compra",
    "carrito de la compra",
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

  compound_rules: [
    {
      id: "detonante_con_respuesta_activa",
      description: "Detonante + conducta activa (ladrar, lanzarse, perseguir) = reactividad confirmada",
      requires_any_of: [
        "bicicletas", "motos", "perros", "personas", "corredores",
        "timbre", "ventana", "coches",
        "gatos", "palomas", "pájaros", "ardillas",
        "ovejas", "conejos", "jabalíes",
      ],
      requires_also: [
        "se lanza", "ladra", "tira de la correa", "persigue", "se descontrola",
        "se abalanza", "se tira",
        "corre", "sale corriendo", "se va detrás",
        "sale disparado",
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
    "ladra al acercarme",
    "reacciona si toco",
    "mirada fija",
    "me mira mal",
    "labio levantado",
    "colmillos",
    "dominante con",
    "se cree el jefe con",
    "me desafía con",
    "se pone entre",
    "se interpone",
    "celoso de",
  ],

  n3: [
    "comida", "plato", "hueso", "chuchería", "juguete", "pelota",
    "peluche", "cama", "sofá", "rincón", "sitio",
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
      loses_to: null,
    },
  ],

  compound_rules: [],
};


// ── 6. EDUCACIÓN BÁSICA (categoría por defecto) ───────────────────────────────

export const DICT_BASICA = {
  id: "basica",

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
    // Variantes con pronombre que faltaban — evita fallo del caso real
    "no me escucha",
    "no me escuchas",
    "no nos escucha",
    "no te escucha",
    "no le escucha",
    "no me hace ni caso",
    "no nos hace ni caso",
    "pasa de mí",
    "pasa de nosotros",
    // Pica — comer basura, cosas del suelo, cacas (muy frecuente en consultas)
    "come del suelo",
    "come todo del suelo",
    "come basura",
    "come cacas",
    "come cosas de la calle",
    "come lo que encuentra",
    "come todo lo que encuentra",
    "come todo lo que ve",
    "se come todo",
    "se come de todo",
    "come cualquier cosa",
    "traga lo que encuentra",
    "pica del suelo",
    "recoge cosas del suelo",
    "lame el suelo",
    "mete la boca en todo",
    // Llamada — conducta muy específica, N1
    "no viene cuando lo llamo",
    "no viene cuando le llamo",
    "no viene cuando la llamo",
    "no me viene",
    "no viene al llamarlo",
    "no responde a la llamada",
    "no responde cuando lo llamo",
    "no acude",
  ],

  n2: [
    // Paseo sin contexto reactivo
    "no sabe pasear",
    "no camina bien",
    "camina estirando",
    "camina tirando",
    "me saca a pasear",
    "me saca él a pasear",
    // Llamada — variantes cortas
    "no viene",
    "se escapa",
    "no regresa",
    "se distrae con todo",
    "se distrae con todos",
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
    // Variantes plurales frecuentes
    "no nos hace caso",
    "no me hace caso",
    "no nos obedece",
    "salta a nosotros",
    // Paseo con correa — variantes cortas de refuerzo (las largas están en reactividad N1)
    "no sabe ir con correa",
    // Robo de comida
    "me roba la comida",
    "nos roba la comida",
    "coge comida de la mesa",
    "se sube a la mesa a comer",
    "quita comida de la mano",
    "le robo la comida",
    // Saltos / manejo casa
    "salta a todo el mundo",
    "se sube encima",
    "se tira encima al saludar",
    "salta al saludar",
    // Gestión del paseo más coloquial
    "en la calle es igual",
    "en la calle no me escucha",
    "en la calle no hace caso",
    "fuera de casa no me escucha",
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
    // Contextos típicos de pica y paseo sin control
    "en el suelo",
    "cosas del suelo",
    "en la calle",
    "en el parque",
    "cuando lo suelto",
    "cuando lo saco",
    "en el paseo",
    "sin correa",
    "correa larga",
  ],

  exclusions_textual: [],

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
    "muerde todo",
    "muerde manos",
    "muerde cuando juega",
    "no sabe dónde ir",
    "no avisa",
    "marca la casa",
    "llora por las noches",
    "no se adapta",
    "primera vez fuera",
    "no conoce otros perros",
    "nunca ha salido",
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
// REGISTRO COMPLETO
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
 */
export function detectarCuadros(mensaje) {
  const textoNorm = normalizar(mensaje);

  const cuadros = TODOS_LOS_DICCIONARIOS.map((dict) => {
    const n1_hits = filtrarHits(textoNorm, dict.n1);
    const n2_hits = filtrarHits(textoNorm, dict.n2);
    const n3_hits = filtrarHits(textoNorm, dict.n3);

    const exclusion_textual = (dict.exclusions_textual || []).some((ex) =>
      textoNorm.includes(normalizar(ex))
    );

    const compound_hits = _evaluarCompoundRules(textoNorm, dict.compound_rules || []);

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

function _evaluarCompoundRules(textoNorm, compound_rules) {
  const hits = [];
  for (const rule of compound_rules) {
    const tieneDetonante = (rule.requires_any_of || []).some((kw) =>
      textoNorm.includes(normalizar(kw))
    );
    if (!tieneDetonante) continue;

    let dispara = false;

    if (rule.excludes_all_of) {
      const tieneConducta = rule.excludes_all_of.some((kw) =>
        textoNorm.includes(normalizar(kw))
      );
      dispara = !tieneConducta;
    } else if (Array.isArray(rule.requires_also) && rule.requires_also.length > 0) {
      dispara = rule.requires_also.some((kw) =>
        textoNorm.includes(normalizar(kw))
      );
    } else {
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
//
// CASO 6 (nuevo): Pica
// detectarCuadros("come todo lo que encuentra en la calle, basura, cacas, no me escucha")
// Esperado: basica → confianza alta (n1: "come todo lo que encuentra", "no me escucha")
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE SERVICIOS LATERALES
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
