/**
 * Rutas de autenticación:
 * - POST /api/auth/registro  crea un cliente y devuelve { usuario, token }.
 * - POST /api/auth/login     valida credenciales y devuelve { usuario, token }.
 * - GET  /api/auth/yo        datos del usuario del token (leídos de la base).
 *
 * Mejora de seguridad pendiente: no hay límite de intentos (rate limiting)
 * en login ni registro, porque interferiría con las pruebas de carga de la
 * Fase 2. Ver "Mejoras de seguridad pendientes" en el README.
 */
import { Router } from 'express'
import { hashear, verificar, verificarContraHashFicticio } from '../seguridad/contrasenas.js'
import { firmarToken } from '../seguridad/tokens.js'
import { autenticar } from '../middlewares/auth.js'
import { campoEmail, campoTexto, cuerpoObjeto } from '../validacion.js'

/** Código de PostgreSQL para violación de restricción única. */
const VIOLACION_UNICA = '23505'

const CREDENCIALES_INCORRECTAS = 'Correo o contraseña incorrectos'

/**
 * Datos públicos del usuario: nunca incluye hash_contrasena.
 * @param {{ id: string, email: string, nombre: string, rol: string }} fila
 */
const usuarioPublico = ({ id, email, nombre, rol }) => ({ id, email, nombre, rol })

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasAuth(pool) {
  const router = Router()

  router.post('/registro', async (req, res) => {
    const cuerpo = cuerpoObjeto(req.body)
    const nombre = campoTexto('nombre', cuerpo.nombre, { min: 2, max: 80 })
    const email = campoEmail(cuerpo.email)
    const contrasena = campoTexto('contrasena', cuerpo.contrasena, { min: 8, max: 128, recortar: false })
    // cuerpo.rol se ignora: el registro público siempre crea clientes.

    const hash = await hashear(contrasena)
    try {
      // Sin SELECT previo: el índice único uq_usuarios_email (lower(email))
      // resuelve también el caso de dos registros simultáneos.
      const { rows } = await pool.query(
        `insert into usuarios (email, nombre, hash_contrasena, rol)
         values ($1, $2, $3, 'cliente')
         returning id, email, nombre, rol`,
        [email, nombre, hash]
      )
      const usuario = usuarioPublico(rows[0])
      res.status(201).json({ usuario, token: firmarToken(usuario) })
    } catch (err) {
      if (err.code === VIOLACION_UNICA) {
        res.status(409).json({ error: 'El correo ya está registrado' })
        return
      }
      throw err
    }
  })

  router.post('/login', async (req, res) => {
    const cuerpo = cuerpoObjeto(req.body)
    const email = campoEmail(cuerpo.email)
    const contrasena = campoTexto('contrasena', cuerpo.contrasena, { min: 1, max: 128, recortar: false })

    const { rows } = await pool.query(
      'select id, email, nombre, rol, hash_contrasena from usuarios where lower(email) = lower($1)',
      [email]
    )
    const fila = rows[0]
    // Si el correo no existe se verifica igual contra un hash ficticio:
    // el tiempo de respuesta no revela qué correos están registrados.
    const valida = fila
      ? await verificar(fila.hash_contrasena, contrasena)
      : await verificarContraHashFicticio(contrasena)

    if (!valida) {
      res.status(401).json({ error: CREDENCIALES_INCORRECTAS })
      return
    }
    const usuario = usuarioPublico(fila)
    res.json({ usuario, token: firmarToken(usuario) })
  })

  router.get('/yo', autenticar, async (req, res) => {
    const { rows } = await pool.query('select id, email, nombre, rol from usuarios where id = $1', [req.usuario.id])
    if (!rows[0]) {
      res.status(401).json({ error: 'Token inválido o expirado' })
      return
    }
    res.json(usuarioPublico(rows[0]))
  })

  return router
}
