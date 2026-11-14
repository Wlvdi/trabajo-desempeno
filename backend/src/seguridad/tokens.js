/**
 * Firma y verificación de tokens JWT (HS256).
 * El algoritmo se fija también al verificar: así se rechazan tokens con
 * "alg": "none" o con un algoritmo distinto.
 */
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

const ALGORITMO = 'HS256'

/**
 * Firma un token con payload mínimo: sub (id del usuario) y rol.
 * @param {{ id: string, rol: string }} usuario
 * @param {{ secreto: string, expiracion: string }} [opcionesJwt]
 * @returns {string}
 */
export function firmarToken(usuario, opcionesJwt = config.jwt) {
  return jwt.sign({ rol: usuario.rol }, opcionesJwt.secreto, {
    algorithm: ALGORITMO,
    subject: usuario.id,
    expiresIn: /** @type {any} */ (opcionesJwt.expiracion)
  })
}

/**
 * Verifica firma, algoritmo y expiración. Lanza error si el token no es válido.
 * @param {string} token
 * @param {{ secreto: string }} [opcionesJwt]
 * @returns {{ id: string, rol: string }}
 */
export function verificarToken(token, opcionesJwt = config.jwt) {
  const payload = jwt.verify(token, opcionesJwt.secreto, { algorithms: [ALGORITMO] })
  if (typeof payload !== 'object' || typeof payload.sub !== 'string' || typeof payload.rol !== 'string') {
    throw new Error('Token sin los datos esperados')
  }
  return { id: payload.sub, rol: payload.rol }
}
