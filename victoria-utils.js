/**
 * victoria-utils.js
 * Perros de la Isla — Embudo Victoria
 * Utilidades compartidas entre todos los módulos
 * Versión 1.0 · Abril 2026
 */

/**
 * Mapa de abreviaturas típicas de WhatsApp en español peninsular/mallorquín.
 * Se aplica ANTES de quitar tildes/puntuación para que funcione con límites
 * de palabra reales. Las claves son las abreviaturas, los valores la expansión.
 *
 * Ordenado de más largas a más cortas para evitar que "t" pise a "tb".
 */
const ABREVIATURAS_WHATSAPP = [
  // Más largas primero
  ["tmb", "tambien"],
  ["tng", "tengo"],
  ["sts", "estas"],
  ["dnd", "donde"],
  ["xq", "porque"],
  ["pq", "porque"],
  ["xa", "para"],
  ["tb", "tambien"],
  ["ns", "no se"],
  ["bn", "bien"],
  ["tq", "te quiero"],
  // De una letra (requieren límites de palabra estrictos)
  ["q", "que"],
  ["k", "que"],
  ["t", "te"],
  ["m", "me"],
  ["x", "por"],
  ["i", "y"]
];

/**
 * Expande abreviaturas típicas de WhatsApp móvil antes de normalizar.
 *
 * Ejemplos:
 *   "tng un perro q m muerde i no se q hacer"
 *   → "tengo un perro que me muerde y no se que hacer"
 *
 *   "Gracias i ya m diras"
 *   → "Gracias y ya me diras"
 *
 * Importante: opera sobre texto en minúsculas pero CONSERVANDO tildes/ñ,
 * porque se llama antes del paso de stripping de normalizar(). Usa regex
 * con límites de palabra (\b) para no romper palabras que contengan
 * la letra (ej. "que" no se convierte en "quque").
 *
 * @param {string} texto
 * @returns {string}
 */
export function expandirAbreviaturas(texto) {
  if (!texto || typeof texto !== "string") return "";
  let out = texto.toLowerCase();
  for (const [abrev, expansion] of ABREVIATURAS_WHATSAPP) {
    const regex = new RegExp(`\\b${abrev}\\b`, "g");
    out = out.replace(regex, expansion);
  }
  return out;
}

/**
 * Normaliza texto para matching:
 * minúsculas + sin tildes + sin ñ + sin puntuación + espacios colapsados.
 *
 * Se aplica TANTO al input del cliente COMO a las keywords de los diccionarios
 * antes de comparar — así las keywords pueden mantenerse legibles en el código
 * ("araña", "gruñe") y la normalización es responsabilidad del matcher.
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
  if (!texto || typeof texto !== "string") return "";
  return expandirAbreviaturas(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // elimina tildes y diacríticos (incluye ñ → n)
    .replace(/[^\w\s]/g, " ")        // elimina puntuación
    .replace(/\s+/g, " ")            // colapsa espacios
    .trim();
}

/**
 * Comprueba si una keyword normalizada aparece como palabra/frase
 * completa dentro de un texto normalizado.
 */
export function contieneKeyword(textoNorm, keywordNorm) {
  const escaped = keywordNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
  return regex.test(textoNorm);
}

/**
 * Filtra un array de keywords devolviendo solo las que aparecen en el texto.
 */
export function filtrarHits(textoNorm, keywords) {
  return keywords.filter((kw) => contieneKeyword(textoNorm, normalizar(kw)));
}
