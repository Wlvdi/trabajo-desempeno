/**
 * Tests de la ruta /api/salud y de los manejadores de error.
 * Usan un pool falso: no requieren base de datos.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import { crearApp } from '../src/app.js'
import { ErrorHttp, manejarErrores } from '../src/middlewares/errores.js'

const poolOk = { query: async () => ({ rows: [{ '?column?': 1 }] }) }
const poolCaido = {
  query: async () => {
    throw new Error('connect ECONNREFUSED')
  }
}

describe('GET /api/salud', () => {
  it('responde 200 cuando la base de datos responde', async () => {
    const res = await request(crearApp({ pool: poolOk })).get('/api/salud')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ estado: 'ok', baseDatos: 'ok' })
    expect(typeof res.body.latenciaBdMs).toBe('number')
  })

  it('responde 503 cuando la base de datos no responde', async () => {
    const res = await request(crearApp({ pool: poolCaido })).get('/api/salud')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ estado: 'degradado', baseDatos: 'sin conexión' })
  })
})

describe('Manejo de errores', () => {
  it('responde 404 en JSON para rutas inexistentes', async () => {
    const res = await request(crearApp({ pool: poolOk })).get('/api/no-existe')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Ruta no encontrada')
  })

  it('responde 400 cuando el cuerpo JSON está mal formado', async () => {
    const res = await request(crearApp({ pool: poolOk }))
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .send('{ mal json')
    expect(res.status).toBe(400)
  })

  it('no expone la cabecera x-powered-by', async () => {
    const res = await request(crearApp({ pool: poolOk })).get('/api/salud')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('manejarErrores con errores 5xx', () => {
  const app = express()
  app.get('/intencional', () => {
    throw new ErrorHttp(501, 'No implementado aún')
  })
  app.get('/inesperado', () => {
    throw new Error('detalle interno que no debe salir')
  })
  app.use(manejarErrores)

  it('un ErrorHttp 5xx lanzado a propósito conserva su mensaje', async () => {
    const res = await request(app).get('/intencional')
    expect(res.status).toBe(501)
    expect(res.body).toEqual({ error: 'No implementado aún' })
  })

  it('un error inesperado responde 500 sin exponer detalles', async () => {
    const original = console.error
    console.error = () => {}
    try {
      const res = await request(app).get('/inesperado')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'Error interno del servidor' })
    } finally {
      console.error = original
    }
  })
})
