// src/services/precios.js
// Utilidades de montos en pesos chilenos (CLP).

/** Tasa de IVA en Chile. */
export const TASA_IVA = 0.19

/**
 * Parte de IVA contenida en un monto que YA incluye IVA.
 * Ejemplo: en $11.900 (IVA incluido) el IVA es $1.900, no $2.261 (11.900 × 0,19).
 * @param {number} montoConIva
 * @returns {number} IVA redondeado al peso
 */
export function ivaIncluido(montoConIva) {
  const monto = Number(montoConIva) || 0
  return Math.round((monto * TASA_IVA) / (1 + TASA_IVA))
}
