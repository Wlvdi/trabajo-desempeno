/**
 * Pool de conexiones a PostgreSQL compartido por toda la API.
 */
import pg from 'pg'
import { config } from '../config.js'

/**
 * Crea un pool de conexiones con la configuración indicada.
 * @param {{ url: string, poolMax: number, timeoutConexionMs: number }} [opciones]
 * @returns {pg.Pool}
 */
export function crearPool(opciones = config.baseDatos) {
  const pool = new pg.Pool({
    connectionString: opciones.url,
    max: opciones.poolMax,
    connectionTimeoutMillis: opciones.timeoutConexionMs
  })

  // Un error en una conexión inactiva no debe botar el proceso.
  pool.on('error', (err) => {
    console.error('[bd] Error en una conexión inactiva del pool:', err.message)
  })

  return pool
}
