/**
 * victoria-breeds.js
 * Perros de la Isla — Embudo Victoria
 * Lista de razas PPP (Potencialmente Peligrosas) y clasificación por raza/peso
 * Versión 1.0 · Abril 2026
 *
 * Referencia normativa: Real Decreto 287/2002 (España) + normativa balear vigente.
 * Actualizar esta lista si cambia la normativa — es el único archivo que hay que tocar.
 */

import { normalizar } from "./victoria-utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// LISTA DE RAZAS PPP OFICIALES
// Incluye variantes ortográficas y nombres coloquiales frecuentes
// ─────────────────────────────────────────────────────────────────────────────

export const RAZAS_PPP = [
  // Pit Bull Terrier
  "pit bull", "pitbull", "pit bull terrier", "american pit bull terrier",

  // Rottweiler
  "rottweiler", "rottweiler puro",

  // Dogo Argentino
  "dogo argentino", "dogo",

  // Presa Canario
  "presa canario", "perro de presa canario", "dogo canario",

  // Fila Brasileiro
  "fila brasileiro", "fila",

  // Tosa Inu
  "tosa inu", "tosa",

  // Akita Inu
  "akita inu", "akita",

  // Mastín Napolitano
  "mastin napolitano", "mastín napolitano",

  // Bull Terrier (incluido en normativa española)
  "bull terrier", "staffordshire bull terrier",
  // Nota: American Staffordshire Terrier (Amstaff) NO está en lista PPP española
  // "american staffordshire" queda fuera intencionalmente — ver spec Principio 10
];

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — esPPP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina si una raza descrita en texto libre es PPP.
 *
 * @param {string} razaTextoLibre — input del cliente ("pitbull", "pit bull terrier", etc.)
 * @returns {boolean}
 */
export function esPPP(razaTextoLibre) {
  if (!razaTextoLibre) return false;
  const norm = normalizar(razaTextoLibre);
  return RAZAS_PPP.some((r) => norm.includes(normalizar(r)));
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASIFICACIÓN POR TAMAÑO
// Usada para el filtro de mordida: contacto grave + grande → etólogo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clasifica al perro por tamaño según peso.
 *
 * @param {number} peso_kg
 * @returns {'pequeño'|'mediano'|'grande'}
 */
export function clasificarTamano(peso_kg) {
  if (peso_kg < 10) return "pequeño";
  if (peso_kg < 25) return "mediano";
  return "grande";
}

// ─────────────────────────────────────────────────────────────────────────────
// CRITERIOS DE DERIVACIÓN AL ETÓLOGO POR RAZA + CONDUCTA
// Usados por victoria-matching.js en el Paso 1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina si el perfil del perro requiere derivación directa al etólogo.
 * Se activa ANTES de evaluar cuadros — es el primer filtro del árbol.
 *
 * Criterios (cualquiera de los siguientes):
 * 1. Raza PPP + señal conductual de cualquier tipo.
 * 2. Perro ≥10kg + mordida real con consecuencia grave.
 * 3. Perro grande (≥25kg) con descripción clara de agresión (no solo reactividad).
 *
 * @param {Object} params
 * @param {boolean} params.es_ppp
 * @param {number}  params.peso_kg
 * @param {boolean} params.hay_senal_conductual   — cualquier cuadro detectado con confianza ≥ baja
 * @param {string}  params.gravedad_mordida        — null | 'leve' | 'grave'
 *   'grave' = herida con sangre, hematoma importante, puntos
 * @param {boolean} params.descripcion_agresion   — cliente usa palabras de agresión activa
 * @returns {boolean}
 */
export function requiereEtologo({ es_ppp, peso_kg, hay_senal_conductual, gravedad_mordida, descripcion_agresion }) {
  // Criterio 1: PPP + cualquier señal conductual
  if (es_ppp && hay_senal_conductual) return true;

  // Criterio 2: ≥10kg + mordida grave
  if (peso_kg >= 10 && gravedad_mordida === "grave") return true;

  // Criterio 3: grande + agresión clara descrita
  if (peso_kg >= 25 && descripcion_agresion) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORDS DE AGRESIÓN PARA CRITERIO 3
// Expresiones que indican agresión activa (más allá de reactividad)
// ─────────────────────────────────────────────────────────────────────────────

export const KEYWORDS_AGRESION = [
  "mordió a una persona",
  "mordió a alguien",
  "mordió a un niño",
  "atacó",
  "ataque",
  "agresión real",
  "agredió",
  "mandíbula",
  "puntos",
  "fue al médico",
  "fue a urgencias",
  "herida",
  "sangró",
  "cicatriz",
];
