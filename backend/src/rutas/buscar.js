/**
 * GET /api/buscar?q=&categoria=&temporada=&precio_min=&precio_max=&en_stock=&orden=&pagina=&limite=
 * Búsqueda con ILIKE en nombre y descripcion, con los mismos filtros y la
 * misma paginación que /api/productos.
 * - orden: "relevancia" (por defecto: primero los que coinciden en el
 *   nombre) o cualquiera de los órdenes del catálogo.
 * Decisión del grupo: SIN índices (pg_trgm queda como mejora medible en la Fase 2).
 */
import { Router } from 'express'
import { ORDENES, ORDEN_BUSQUEDA, paginaCatalogo } from '../consultas/productos.js'
import { paginacion, textoObligatorio, unoDe } from '../validacion.js'
import { NOMBRES_ORDEN, leerFiltros } from './productos.js'

const ORDENES_BUSQUEDA = ['relevancia', ...NOMBRES_ORDEN]

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasBuscar(pool) {
  const router = Router()

  router.get('/', async (req, res) => {
    const texto = textoObligatorio('q', req.query.q, { min: 2, max: 100 })
    const filtros = leerFiltros(req.query)
    const orden = unoDe('orden', req.query.orden, ORDENES_BUSQUEDA, 'relevancia')
    const { pagina, limite } = paginacion(req.query)
    res.json(
      await paginaCatalogo(pool, {
        // El texto va primero: ORDEN_BUSQUEDA usa $1 como patrón de búsqueda.
        filtros: { texto, ...filtros },
        orden: orden === 'relevancia' ? ORDEN_BUSQUEDA : ORDENES[orden],
        pagina,
        limite
      })
    )
  })

  return router
}
