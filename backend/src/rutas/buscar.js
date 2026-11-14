/**
 * GET /api/buscar?q=&categoria=&pagina=&limite=
 * Búsqueda con ILIKE en nombre y descripcion, paginada como /api/productos.
 * Decisión del grupo: SIN índices (pg_trgm queda como mejora medible en la Fase 2).
 */
import { Router } from 'express'
import { ORDEN_BUSQUEDA, paginaCatalogo } from '../consultas/productos.js'
import { paginacion, textoObligatorio, uuidOpcional } from '../validacion.js'

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasBuscar(pool) {
  const router = Router()

  router.get('/', async (req, res) => {
    const texto = textoObligatorio('q', req.query.q, { min: 2, max: 100 })
    const categoria = uuidOpcional('categoria', req.query.categoria)
    const { pagina, limite } = paginacion(req.query)
    res.json(await paginaCatalogo(pool, { filtros: { texto, categoria }, orden: ORDEN_BUSQUEDA, pagina, limite }))
  })

  return router
}
