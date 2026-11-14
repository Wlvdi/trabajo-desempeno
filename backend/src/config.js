/**
 * Configuración de la API leída desde variables de entorno.
 * Los valores por defecto sirven solo para desarrollo local.
 */
import { randomBytes } from 'node:crypto'

/** Largo mínimo del secreto JWT en producción (HS256 usa claves de 256 bits). */
export const LARGO_MINIMO_SECRETO = 32

/**
 * Convierte un texto a entero positivo o devuelve el valor por defecto.
 * @template T
 * @param {string | undefined} valor
 * @param {T} porDefecto
 * @returns {number | T}
 */
function entero(valor, porDefecto) {
  const n = Number.parseInt(valor ?? '', 10)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

/**
 * Lee la configuración del secreto JWT.
 * En producción es obligatorio (si falta o es corto, la API no arranca).
 * En desarrollo y test, si falta, se genera uno aleatorio por proceso:
 * los tokens dejan de valer al reiniciar.
 * @param {Record<string, string | undefined>} env
 * @param {string} entorno
 */
function leerJwt(env, entorno) {
  const secreto = env.JWT_SECRETO?.trim()
  const expiracion = env.JWT_EXPIRACION?.trim() || '2h'

  if (entorno === 'production') {
    if (!secreto || secreto.length < LARGO_MINIMO_SECRETO) {
      throw new Error(
        `JWT_SECRETO es obligatorio en producción y debe tener al menos ${LARGO_MINIMO_SECRETO} caracteres`
      )
    }
    return Object.freeze({ secreto, expiracion, secretoGenerado: false })
  }
  if (!secreto) {
    return Object.freeze({ secreto: randomBytes(32).toString('hex'), expiracion, secretoGenerado: true })
  }
  return Object.freeze({ secreto, expiracion, secretoGenerado: false })
}

/**
 * Lee PAGO_MOCK ("true" | "false"). Por defecto true fuera de producción y
 * false en producción. Un valor distinto lanza error (la API no arranca).
 * Motivo (guía, sección 5.3): bajo carga nunca se debe llamar al sandbox de
 * un tercero; el pago simulado permite medir el checkout completo.
 * @param {string | undefined} valor
 * @param {string} entorno
 * @returns {boolean}
 */
function leerPagoMock(valor, entorno) {
  const texto = valor?.trim().toLowerCase()
  if (!texto) return entorno !== 'production'
  if (texto === 'true') return true
  if (texto === 'false') return false
  throw new Error('PAGO_MOCK debe ser true o false')
}

/**
 * Construye la configuración a partir de un objeto de entorno.
 * Es una función pura para poder probarla sin reiniciar el proceso.
 * @param {Record<string, string | undefined>} env
 */
export function leerConfig(env) {
  const entorno = env.NODE_ENV || 'development'
  return Object.freeze({
    entorno,
    puerto: entero(env.PORT, 3000),
    baseDatos: Object.freeze({
      url: env.DATABASE_URL || 'postgres://subligol:subligol@localhost:5432/subligol',
      // Tamaño máximo del pool de conexiones: es una de las palancas de la Fase 2.
      poolMax: entero(env.PG_POOL_MAX, 10),
      // Tiempo máximo (ms) esperando una conexión libre antes de fallar.
      timeoutConexionMs: entero(env.PG_TIMEOUT_CONEXION_MS, 5000)
    }),
    jwt: leerJwt(env, entorno),
    // Parámetros de argon2id. undefined = valor por defecto de la librería
    // (64 MiB, 3 iteraciones, paralelismo 4). El hash es caro en CPU y
    // memoria: es otra palanca a medir en la Fase 2 (login).
    argon2: Object.freeze({
      memoryCost: entero(env.ARGON2_MEMORIA_KIB, undefined),
      timeCost: entero(env.ARGON2_ITERACIONES, undefined),
      parallelism: entero(env.ARGON2_PARALELISMO, undefined)
    }),
    // Habilita medio_pago "mock" en el checkout (aprobación simulada).
    pagoMock: leerPagoMock(env.PAGO_MOCK, entorno)
  })
}

export const config = leerConfig(process.env)
