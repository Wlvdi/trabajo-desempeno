/**
 * Hash y verificación de contraseñas con argon2id.
 * Lo usan la API (registro y login) y el seed, para que ambos generen
 * hashes con los mismos parámetros (ver config.argon2).
 */
import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'
import { config } from '../config.js'

/**
 * Opciones de argon2id; se omiten los parámetros no definidos para que
 * la librería use sus valores por defecto.
 * @param {{ memoryCost?: number, timeCost?: number, parallelism?: number }} parametros
 */
function opciones(parametros) {
  const resultado = { type: argon2.argon2id }
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined) resultado[clave] = valor
  }
  return resultado
}

const OPCIONES = opciones(config.argon2)

/**
 * Calcula el hash argon2id de una contraseña.
 * @param {string} contrasena
 * @returns {Promise<string>}
 */
export function hashear(contrasena) {
  return argon2.hash(contrasena, OPCIONES)
}

/**
 * Verifica una contraseña contra su hash. Un hash mal formado cuenta como
 * contraseña incorrecta (no lanza error).
 * @param {string} hash
 * @param {string} contrasena
 * @returns {Promise<boolean>}
 */
export async function verificar(hash, contrasena) {
  try {
    return await argon2.verify(hash, contrasena)
  } catch {
    return false
  }
}

/** @type {Promise<string> | undefined} */
let hashFicticio

/**
 * Verifica contra un hash ficticio calculado con los mismos parámetros.
 * Se usa cuando el correo no existe, para que el tiempo de respuesta del
 * login no revele qué correos están registrados. Siempre devuelve false.
 * @param {string} contrasena
 * @returns {Promise<false>}
 */
export async function verificarContraHashFicticio(contrasena) {
  hashFicticio ??= hashear(randomBytes(32).toString('hex'))
  await verificar(await hashFicticio, contrasena)
  return false
}
