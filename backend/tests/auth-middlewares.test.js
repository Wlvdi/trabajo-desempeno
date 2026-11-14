/**
 * Tests de los middlewares autenticar, autenticarOpcional y requerirRol
 * sobre una mini app de Express (no usan base de datos).
 */
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { autenticar, autenticarOpcional, requerirRol } from '../src/middlewares/auth.js'
import { firmarToken } from '../src/seguridad/tokens.js'

const ID = '3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const tokenCliente = firmarToken({ id: ID, rol: 'cliente' })
const tokenAdmin = firmarToken({ id: ID, rol: 'admin' })

const app = express()
app.get('/privado', autenticar, (req, res) => res.json(req.usuario))
app.get('/admin', autenticar, requerirRol('admin'), (_req, res) => res.json({ ok: true }))
app.get('/admin-sin-autenticar', requerirRol('admin'), (_req, res) => res.json({ ok: true }))
app.get('/opcional', autenticarOpcional, (req, res) => res.json({ usuario: req.usuario ?? null }))

const get = (ruta, token) => {
  const req = request(app).get(ruta)
  return token ? req.set('Authorization', `Bearer ${token}`) : req
}

describe('autenticar', () => {
  it('deja req.usuario = { id, rol } con un token válido', async () => {
    const res = await get('/privado', tokenCliente)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: ID, rol: 'cliente' })
  })

  it('acepta el esquema "bearer" en minúsculas', async () => {
    const res = await request(app).get('/privado').set('Authorization', `bearer ${tokenCliente}`)
    expect(res.status).toBe(200)
  })
})

describe('requerirRol', () => {
  it('responde 403 a un cliente', async () => {
    const res = await get('/admin', tokenCliente)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('No tienes permisos para esta acción')
  })

  it('deja pasar a un admin', async () => {
    const res = await get('/admin', tokenAdmin)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('responde 401 sin token', async () => {
    expect((await get('/admin')).status).toBe(401)
  })

  it('responde 401 si se usa sin autenticar antes', async () => {
    expect((await get('/admin-sin-autenticar', tokenAdmin)).status).toBe(401)
  })
})

describe('autenticarOpcional', () => {
  it('sin cabecera sigue como anónimo', async () => {
    const res = await get('/opcional')
    expect(res.status).toBe(200)
    expect(res.body.usuario).toBeNull()
  })

  it('con token válido deja req.usuario', async () => {
    const res = await get('/opcional', tokenCliente)
    expect(res.body.usuario).toEqual({ id: ID, rol: 'cliente' })
  })

  it('con token inválido responde 401 (no lo trata como anónimo)', async () => {
    expect((await get('/opcional', 'token.invalido.xx')).status).toBe(401)
    expect((await request(app).get('/opcional').set('Authorization', 'Basic abc')).status).toBe(401)
  })
})
