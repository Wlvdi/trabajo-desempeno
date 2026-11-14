/**
 * Configuración de la API leída desde variables de entorno.
 * Los valores por defecto sirven solo para desarrollo local.
 */

/**
 * Convierte un texto a entero positivo o devuelve el valor por defecto.
 * @param {string | undefined} valor
 * @param {number} porDefecto
 * @returns {number}
 */
function entero(valor, porDefecto) {
  const n = Number.parseInt(valor ?? '', 10)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

export const config = Object.freeze({
  entorno: process.env.NODE_ENV || 'development',
  puerto: entero(process.env.PORT, 3000),
  baseDatos: Object.freeze({
    url: process.env.DATABASE_URL || 'postgres://subligol:subligol@localhost:5432/subligol',
    // Tamaño máximo del pool de conexiones: es una de las palancas de la Fase 2.
    poolMax: entero(process.env.PG_POOL_MAX, 10),
    // Tiempo máximo (ms) esperando una conexión libre antes de fallar.
    timeoutConexionMs: entero(process.env.PG_TIMEOUT_CONEXION_MS, 5000)
  })
})
