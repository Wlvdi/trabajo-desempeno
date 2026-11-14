/**
 * Middlewares de autenticación y autorización con JWT.
 * - autenticar: exige un token válido y deja req.usuario = { id, rol }.
 * - autenticarOpcional: sin cabecera sigue como anónimo; con un token
 *   inválido responde 401 (un token vencido no se trata como anónimo).
 * - requerirRol(rol): exige que req.usuario tenga ese rol (403 si no).
 */
import { verificarToken } from '../seguridad/tokens.js'

/**
 * Extrae el token de "Authorization: Bearer <token>".
 * @param {import('express').Request} req
 * @returns {string | null | undefined} undefined si no hay cabecera, null si está mal formada
 */
function leerToken(req) {
  const cabecera = req.headers.authorization
  if (cabecera === undefined) return undefined
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(cabecera.trim())
  return coincidencia ? coincidencia[1] : null
}

/**
 * Valida el token y deja req.usuario. Responde 401 si no es válido.
 * @returns {boolean} true si el token fue válido
 */
function aplicarToken(token, req, res) {
  try {
    req.usuario = verificarToken(token)
    return true
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
    return false
  }
}

/** Exige un token válido. */
export function autenticar(req, res, next) {
  const token = leerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Debes iniciar sesión' })
    return
  }
  if (aplicarToken(token, req, res)) next()
}

/** Acepta peticiones anónimas, pero si viene un token debe ser válido. */
export function autenticarOpcional(req, res, next) {
  const token = leerToken(req)
  if (token === undefined) {
    next()
    return
  }
  if (token === null) {
    res.status(401).json({ error: 'Token inválido o expirado' })
    return
  }
  if (aplicarToken(token, req, res)) next()
}

/**
 * Exige un rol. Debe ir después de autenticar.
 * @param {'cliente' | 'admin'} rol
 * @returns {import('express').RequestHandler}
 */
export function requerirRol(rol) {
  return (req, res, next) => {
    if (!req.usuario) {
      res.status(401).json({ error: 'Debes iniciar sesión' })
      return
    }
    if (req.usuario.rol !== rol) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' })
      return
    }
    next()
  }
}
