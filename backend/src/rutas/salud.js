/**
 * Ruta de salud: indica si la API está viva y si la base de datos responde.
 * La usa el healthcheck de Docker y sirve como prueba de humo.
 */
import { Router } from 'express'

/**
 * @param {{ query: (sql: string) => Promise<unknown> }} pool
 * @returns {import('express').Router}
 */
export function rutasSalud(pool) {
  const router = Router()

  router.get('/', async (_req, res) => {
    const inicio = process.hrtime.bigint()
    try {
      await pool.query('SELECT 1')
      const latenciaMs = Number(process.hrtime.bigint() - inicio) / 1e6
      res.json({ estado: 'ok', baseDatos: 'ok', latenciaBdMs: Math.round(latenciaMs * 100) / 100 })
    } catch (err) {
      res.status(503).json({ estado: 'degradado', baseDatos: 'sin conexión', detalle: err.message })
    }
  })

  return router
}
