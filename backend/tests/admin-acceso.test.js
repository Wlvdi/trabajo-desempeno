/**
 * Control de acceso de /api/admin: sin sesión 401, cliente 403, admin OK.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo } from './ayudantes.js'
import { tokensDePrueba } from './ayudantes-admin.js'

let pool
let app
let tokens

beforeAll(async () => {
  let datos
  ;({ pool, app, datos } = await prepararCatalogo())
  tokens = tokensDePrueba(datos)
}, 120_000)

afterAll(async () => {
  await pool.end()
})

const ID = '00000000-0000-4000-8000-000000000000'

/** Un endpoint representativo de cada grupo (método, ruta y cuerpo). */
const ENDPOINTS = [
  ['get', '/api/admin/productos'],
  ['post', '/api/admin/productos', { nombre: 'X' }],
  ['patch', `/api/admin/productos/${ID}`, { nombre: 'X' }],
  ['patch', `/api/admin/productos/${ID}/activo`, { activo: false }],
  ['get', '/api/admin/categorias'],
  ['post', '/api/admin/categorias', { nombre: 'X' }],
  ['get', '/api/admin/compras'],
  ['post', '/api/admin/compras', { items: [] }],
  ['get', '/api/admin/ventas'],
  ['post', '/api/admin/ventas', { items: [] }],
  ['get', '/api/admin/dashboard'],
  ['get', '/api/admin/auditoria']
]

describe('Acceso a /api/admin', () => {
  it.each(ENDPOINTS)('%s %s sin sesión → 401', async (metodo, ruta, cuerpo) => {
    const r = await request(app)[metodo](ruta).send(cuerpo)
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('Debes iniciar sesión')
  })

  it.each(ENDPOINTS)('%s %s con rol cliente → 403', async (metodo, ruta, cuerpo) => {
    const r = await request(app)[metodo](ruta).set('Authorization', tokens.cliente).send(cuerpo)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('No tienes permisos para esta acción')
  })

  it('un token alterado → 401', async () => {
    const r = await request(app).get('/api/admin/dashboard').set('Authorization', `${tokens.admin.slice(0, -2)}xx`)
    expect(r.status).toBe(401)
  })

  it('el admin accede', async () => {
    const r = await request(app).get('/api/admin/dashboard').set('Authorization', tokens.admin)
    expect(r.status).toBe(200)
  })

  it('una ruta inexistente bajo /api/admin no se revela sin sesión (401, no 404)', async () => {
    const r = await request(app).get('/api/admin/no-existe')
    expect(r.status).toBe(401)
  })
})
