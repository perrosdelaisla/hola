/**
 * victoria-zones.js
 * Perros de la Isla — Embudo Victoria
 * Mapa de cobertura geográfica y lógica de detección de zona
 * Versión 1.0 · Abril 2026
 */

// ─────────────────────────────────────────────
// EXCEPCIÓN POLÍTICA INTERNA
// ─────────────────────────────────────────────

export const EXCEPCION_INTERNA = ["son gotleu"];

// ─────────────────────────────────────────────
// LISTA BLANCA — ZONA PRESENCIAL
// Triángulo Palma–Inca–Llucmajor–Calvià
// ─────────────────────────────────────────────

export const ZONA_PRESENCIAL = [
  // Palma y barrios
  "palma", "palma de mallorca",
  "son armadams", "el terreno", "santa catalina", "son espanyolet",
  "el molinar", "es portixol", "ciudad jardín", "ciudad jardin",
  "coll d'en rabassa", "coll den rabassa",
  "can pastilla", "s'arenal de palma", "arenal de palma", "s'arenal", "arenal",
  "son sardina", "sa indioteria", "son rapinya", "son roca", "son cladera",
  "pont d'inca", "pont dinca", "s'aranjassa", "aranjassa",
  "son ferriol", "sant jordi", "son oliva",
  "génova", "genova", "son vida", "son quint", "cas capiscol",
  "pere garau", "la soledat", "la soledad", "bons aires",
  "es camp d'en serralta", "es rafal", "camp redó", "camp redo",
  "es vivero", "son gotleu", // Son Gotleu está en lista blanca geográfica pero tiene flag de excepción interna
  "polígon de llevant", "poligon de llevant", "son fuster",
  "can capes", "es secar de la real",

  // Marratxí
  "marratxí", "marratxi",
  "sa cabaneta", "pòrtol", "portol",
  "pla de na tesa", "es pont d'inca", "es figueral", "son nebot", "marratxinet",

  // Eje Palma–Inca (Ma-13)
  "santa maria del camí", "santa maria del cami", "santa maria",
  "consell",
  "binissalem",
  "lloseta",
  "alaró", "alaro",
  "inca",

  // Bunyola y núcleos bajos
  "bunyola", "palmanyola",
  // Excluidas: orient, fincas dispersas en sierra

  // Eje Palma–Llucmajor (Ma-19)
  "llucmajor",
  "s'arenal de llucmajor",
  "s'estanyol", "estanyol",
  "sa torre",
  "badia blava", "badia gran",
  "son verí", "son veri",
  "maioris",

  // Eje Palma–Calvià (Ma-1)
  "calvià", "calvia",
  "palmanova",
  "magaluf",
  "santa ponça", "santa ponca",
  "costa d'en blanes", "costa den blanes",
  "portals nous",
  "bendinat",
  "son ferrer",
  "el toro",
  "peguera",
];

// ─────────────────────────────────────────────
// LISTA FUERA DE COBERTURA — ONLINE O DERIVAR
// ─────────────────────────────────────────────

export const ZONA_FUERA = [
  // Serra de Tramuntana
  "sóller", "soller", "port de sóller", "port de soller",
  "fornalutx", "deià", "deia", "valldemossa", "banyalbufar",
  "estellencs", "esporles", "puigpunyent",
  "escorca", "lluc",
  "mancor de la vall", "mancor",
  "selva", "orient",

  // Norte pasado Inca
  "campanet", "búger", "buger",
  "sa pobla", "muro",
  "santa margalida", "can picafort",
  "alcúdia", "alcudia", "port d'alcúdia", "port d'alcudia", "port dalcudia",
  "pollença", "pollenca", "port de pollença", "port de pollenca",
  "cala sant vicenç", "cala sant vicenc", "formentor",

  // Pla interior
  "sencelles", "costitx", "sineu", "llubí", "llubi",
  "lloret de vistalegre", "lloret",
  "maria de la salut", "ariany", "sant joan",
  "santa eugènia", "santa eugenia",
  "algaida",

  // Eje Palma–Manacor
  "montuïri", "montuiri", "porreres",
  "vilafranca de bonany", "vilafranca",
  "petra", "manacor",

  // Levante
  "sant llorenç des cardassar", "sant llorenc",
  "son servera", "cala millor", "cala bona",
  "artà", "arta", "capdepera", "cala rajada",

  // Sur / Migjorn pasado Llucmajor
  "campos", "ses salines", "santanyí", "santanyi",
  "cala figuera", "cala d'or", "cala dor",
  "felanitx", "portocolom",

  // Oeste pasado Peguera
  "andratx", "port d'andratx", "port dandratx",
  "camp de mar", "sant elm",
];

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — detectarZona
// ─────────────────────────────────────────────

/**
 * Recibe el texto libre del cliente y devuelve la cobertura detectada.
 *
 * @param {string} inputUsuario — texto del cliente (ej: "estoy en Palmanova")
 * @returns {{
 *   zonaDetectada: string|null,   — nombre normalizado de la zona encontrada
 *   modalidad: 'presencial'|'online'|'derivar'|'desconocida',
 *   esSonGotleu: boolean,         — activa frase de excepción política interna
 *   necesitaAclaracion: boolean   — true si no se puede determinar la zona
 * }}
 */
export function detectarZona(inputUsuario) {
  if (!inputUsuario || typeof inputUsuario !== "string") {
    return _zonaDesconocida();
  }

  const texto = _normalizar(inputUsuario);

  // 1. Comprobar excepción interna (Son Gotleu)
  for (const excepcion of EXCEPCION_INTERNA) {
    if (texto.includes(excepcion)) {
      return {
        zonaDetectada: "Son Gotleu",
        modalidad: "presencial", // geográficamente dentro, pero excepción política
        esSonGotleu: true,
        necesitaAclaracion: false,
      };
    }
  }

  // 2. Buscar en lista blanca presencial
  const zonaPresencial = _buscarEnLista(texto, ZONA_PRESENCIAL);
  if (zonaPresencial) {
    return {
      zonaDetectada: zonaPresencial,
      modalidad: "presencial",
      esSonGotleu: false,
      necesitaAclaracion: false,
    };
  }

  // 3. Buscar en lista fuera de cobertura
  const zonaFuera = _buscarEnLista(texto, ZONA_FUERA);
  if (zonaFuera) {
    return {
      zonaDetectada: zonaFuera,
      modalidad: "online", // online o derivar — lo decide victoria-matching según el cuadro
      esSonGotleu: false,
      necesitaAclaracion: false,
    };
  }

  // 4. Detectar frases vagas que piden aclaración
  const vagasDetectadas = _detectarFrasesVagas(texto);
  if (vagasDetectadas) {
    return _zonaDesconocida();
  }

  // 5. No se reconoce la zona → pedir aclaración
  return _zonaDesconocida();
}

// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

/**
 * Normaliza texto: minúsculas, sin tildes, sin puntuación extra.
 * Mantiene espacios para matching de nombres compuestos.
 */
function _normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // eliminar tildes
    .replace(/[^\w\s]/g, " ")        // eliminar puntuación
    .replace(/\s+/g, " ")            // colapsar espacios
    .trim();
}

/**
 * Busca el primer match de la lista dentro del texto normalizado.
 * Ordena por longitud descendente para priorizar matches más específicos
 * ("port de soller" antes que "soller").
 */
function _buscarEnLista(textoNormalizado, lista) {
  const listaOrdenada = [...lista].sort((a, b) => b.length - a.length);
  for (const item of listaOrdenada) {
    const itemNorm = _normalizar(item);
    // Buscar como palabra/frase completa (con límites de palabra)
    const regex = new RegExp(`(^|\\s)${_escaparRegex(itemNorm)}(\\s|$)`);
    if (regex.test(textoNormalizado)) {
      return item; // Devuelve nombre original (con tildes) para mostrarlo
    }
  }
  return null;
}

/**
 * Detecta frases vagas que no identifican zona concreta.
 */
function _detectarFrasesVagas(textoNormalizado) {
  const FRASES_VAGAS = [
    "mallorca", "la isla", "baleares", "balears",
    "zona de montaña", "zona montana", "la sierra", "la tramuntana",
    "zona rural", "campo",
    "cerca de palma", "cerca de inca",
    "no se", "no lo se", "no recuerdo",
  ];
  return FRASES_VAGAS.some((f) => textoNormalizado.includes(_normalizar(f)));
}

function _escaparRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _zonaDesconocida() {
  return {
    zonaDetectada: null,
    modalidad: "desconocida",
    esSonGotleu: false,
    necesitaAclaracion: true,
  };
}

// ─────────────────────────────────────────────
// UTILIDAD — pregunta de aclaración de zona
// ─────────────────────────────────────────────

/**
 * Devuelve la pregunta estándar de Victoria cuando no se detecta zona.
 */
export function preguntaZona() {
  return "¿En qué zona de Mallorca estás? Con el municipio o barrio me vale para ver qué podemos ofrecerte.";
}

/**
 * Determina si una modalidad 'online' puede ofrecer el cuadro dado.
 * Cuadros NO compatibles con online: reactividad, posesión, miedos.
 *
 * @param {string} cuadro — identificador del cuadro detectado
 * @returns {boolean}
 */
export function esCompatibleOnline(cuadro) {
  const NO_ONLINE = ["reactividad", "posesion", "miedos"];
  return !NO_ONLINE.includes(cuadro);
}
