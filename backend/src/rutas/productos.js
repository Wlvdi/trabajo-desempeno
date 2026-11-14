/**
 * Rutas de productos:
 * - GET /api/productos      página MEDIA: catálogo con filtros y paginación.
 * - GET /api/productos/:id  página PESADA: detalle con galería, ventas de
 *   90 días y relacionados ordenados por unidades vendidas.
 */
import { Router } from 'express'
import { ORDENES, paginaCatalogo, productoPorId, relacionados } from '../consultas/productos.js'
import {
  ErrorValidacion,
  booleano,
  esUuid,
  numeroNoNegativo,
  paginacion,
  textoOpcional,
  unoDe,
  uuidOpcional
} from '../validacion.js'

const NOMBRES_ORDEN = /** @type {(keyof typeof ORDENES)[]} */ (Object.keys(ORDENES))

/**
 * Lee y valida los filtros del catálogo.
 * @param {Record<string, unknown>} query
 */
function leerFiltros(query) {
  const filtros = {
    categoria: uuidOpcional('categoria', query.categoria),
    temporada: textoOpcional('temporada', query.temporada, 50),
    precioMin: numeroNoNegativo('precio_min', query.precio_min),
    precioMax: numeroNoNegativo('precio_max', query.precio_max),
    enStock: booleano('en_stock', query.en_stock)
  }
  if (filtros.precioMin !== undefined && filtros.precioMax !== undefined && filtros.precioMin > filtros.precioMax) {
    throw new ErrorValidacion('El parámetro "precio_min" no puede ser mayor que "precio_max"')
  }
  return filtros
}

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasProductos(pool) {
  const router = Router()

  router.get('/', async (req, res) => {
    const { pagina, limite } = paginacion(req.query)
    const filtros = leerFiltros(req.query)
    const orden = unoDe('orden', req.query.orden, NOMBRES_ORDEN, 'destacado')
    res.json(await paginaCatalogo(pool, { filtros, orden: ORDENES[orden], pagina, limite }))
  })

  router.get('/:id', async (req, res) => {
    const { id } = req.params
    // Un id que no es UUID no puede existir: 404 sin consultar la base.
    if (!esUuid(id)) {
      res.status(404).json({ error: 'Producto no encontrado' })
      return
    }
    const [producto, lista] = await Promise.all([productoPorId(pool, id), relacionados(pool, id)])
    if (!producto) {
      res.status(404).json({ error: 'Producto no encontrado' })
      return
    }
    res.json({ ...producto, relacionados: lista })
  })

  return router
}
