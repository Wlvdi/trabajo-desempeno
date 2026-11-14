/**
 * Órdenes:
 * - GET /api/ordenes      (requiere sesión) lista paginada, de la más
 *   reciente a la más antigua.
 * - GET /api/ordenes/:id  detalle con items. La ve el dueño, un admin, o
 *   quien envíe la cabecera X-Orden-Token correcta (compra como invitado).
 *   Sin sesión ni token → 401. Para cualquier otro (o si el id o el token no
 *   son UUID) responde 404, no 403, para no revelar que la orden existe.
 */
import { Router } from 'express'
import { autenticar, autenticarOpcional } from '../middlewares/auth.js'
import { leerOrden, listarOrdenes } from '../consultas/ordenes.js'
import { esUuid, paginacion } from '../validacion.js'

const NO_ENCONTRADA = { error: 'Orden no encontrada' }

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasOrdenes(pool) {
  const router = Router()

  router.get('/', autenticar, async (req, res) => {
    const { pagina, limite } = paginacion(req.query)
    res.json(await listarOrdenes(pool, { usuarioId: req.usuario.id, pagina, limite }))
  })

  router.get('/:id', autenticarOpcional, async (req, res) => {
    const token = req.get('X-Orden-Token')
    if (!req.usuario && token === undefined) {
      res.status(401).json({ error: 'Debes iniciar sesión' })
      return
    }
    if (!esUuid(req.params.id) || (token !== undefined && !esUuid(token))) {
      res.status(404).json(NO_ENCONTRADA)
      return
    }
    const orden = await leerOrden(pool, req.params.id, {
      usuarioId: req.usuario?.id ?? null,
      esAdmin: req.usuario?.rol === 'admin',
      token: token ?? null
    })
    if (!orden) {
      res.status(404).json(NO_ENCONTRADA)
      return
    }
    res.json(orden)
  })

  return router
}
