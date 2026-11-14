/**
 * Punto de entrada: crea el pool, levanta la API y la cierra ordenadamente.
 */
import { config } from './config.js'
import { crearPool } from './db/pool.js'
import { crearApp } from './app.js'

const pool = crearPool()
const app = crearApp({ pool })

const servidor = app.listen(config.puerto, () => {
  console.log(`[api] Subligol API escuchando en el puerto ${config.puerto} (${config.entorno})`)
  if (config.jwt.secretoGenerado) {
    console.warn('[api] JWT_SECRETO no está definido: se usa uno aleatorio y los tokens dejarán de valer al reiniciar.')
  }
})

/**
 * Deja de aceptar conexiones, espera las peticiones en curso y cierra el pool.
 * @param {string} senal
 */
function apagar(senal) {
  console.log(`[api] Recibida ${senal}, cerrando...`)
  servidor.close(async () => {
    await pool.end()
    process.exit(0)
  })
  // Si algo queda colgado, forzar la salida a los 10 s.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => apagar('SIGTERM'))
process.on('SIGINT', () => apagar('SIGINT'))
