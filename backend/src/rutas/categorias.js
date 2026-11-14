/**
 * GET /api/categorias: listado de categorías con su cantidad de productos activos.
 */
import { Router } from 'express'
import { categoriasConConteo } from '../consultas/categorias.js'

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasCategorias(pool) {
  const router = Router()

  router.get('/', async (_req, res) => {
    res.json(await categoriasConConteo(pool))
  })

  return router
}
