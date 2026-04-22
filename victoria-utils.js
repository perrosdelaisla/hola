/**
 * victoria-utils.js
 * Perros de la Isla — Embudo Victoria
 * Utilidades compartidas entre todos los módulos
 * Versión 1.0 · Abril 2026
 */

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
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // elimina tildes y diacríticos (incluye ñ → n)
    .replace(/[^\w\s]/g, " ")        // elimina puntuación
    .replace(/\s+/g, " ")            // colapsa espacios
    .trim();
}

/**
 * Comprueba si una keyword normalizada aparece como palabra/frase
 * completa dentro de un texto normalizado.
 *
 * @param {string} textoNorm   — input del cliente ya normalizado
 * @param {string} keywordNorm — keyword ya normalizada
 * @returns {boolean}
 */
export function contieneKeyword(textoNorm, keywordNorm) {
  const escaped = keywordNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
  return regex.test(textoNorm);
}

/**
 * Filtra un array de keywords devolviendo solo las que aparecen en el texto.
 *
 * @param {string} textoNorm
 * @param {string[]} keywords — pueden estar con tildes/ñ (se normalizan aquí)
 * @returns {string[]} — keywords originales (sin normalizar) que hicieron match
 */
export function filtrarHits(textoNorm, keywords) {
  return keywords.filter((kw) => contieneKeyword(textoNorm, normalizar(kw)));
}
