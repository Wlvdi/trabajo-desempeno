/**
 * GET /api/home: página LIVIANA.
 * Productos destacados y categorías con su cantidad de productos.
 * Dos consultas pequeñas en paralelo; no toca ventas.
 */
import { Router } from 'express'
import { destacados } from '../consultas/productos.js'
import { categoriasConConteo } from '../consultas/categorias.js'

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasHome(pool) {
  const router = Router()

  router.get('/', async (_req, res) => {
    const [productos, categorias] = await Promise.all([destacados(pool), categoriasConConteo(pool)])
    res.json({ destacados: productos, categorias })
  })

  return router
}
