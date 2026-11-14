/**
 * Órdenes del usuario (requieren sesión):
 * - GET /api/ordenes      lista paginada, de la más reciente a la más antigua.
 * - GET /api/ordenes/:id  detalle con items. Solo el dueño o un admin; para
 *   cualquier otro (o si el id no es UUID) responde 404, no 403, para no
 *   revelar que la orden existe.
 */
import { Router } from 'express'
import { autenticar } from '../middlewares/auth.js'
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

  router.get('/:id', autenticar, async (req, res) => {
    if (!esUuid(req.params.id)) {
      res.status(404).json(NO_ENCONTRADA)
      return
    }
    const orden = await leerOrden(pool, req.params.id, {
      usuarioId: req.usuario.id,
      esAdmin: req.usuario.rol === 'admin'
    })
    if (!orden) {
      res.status(404).json(NO_ENCONTRADA)
      return
    }
    res.json(orden)
  })

  return router
}
