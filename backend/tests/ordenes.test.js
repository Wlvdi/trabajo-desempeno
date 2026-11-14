/**
 * Tests de integración de GET /api/ordenes y GET /api/ordenes/:id.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { firmarToken } from '../src/seguridad/tokens.js'
import { prepararCatalogo } from './ayudantes.js'
import { DESPACHO, llenarCarrito } from './ayudantes-checkout.js'

let pool
let app
/** Cliente del seed con varias órdenes web. */
let dueno
let tokenDueno
let tokenOtro
let tokenAdmin
let tokenSinOrdenes
/** Orden creada en el beforeAll con el checkout. */
let orden

beforeAll(async () => {
  let datos
  ;({ pool, app, datos } = await prepararCatalogo())
  const { rows } = await pool.query(
    `select cliente_id as id from ventas where cliente_id is not null
      group by cliente_id having count(*) >= 5 order by count(*) desc, cliente_id limit 2`
  )
  dueno = rows[0].id
  tokenDueno = firmarToken({ id: dueno, rol: 'cliente' })
  tokenOtro = firmarToken({ id: rows[1].id, rol: 'cliente' })
  tokenAdmin = firmarToken({ id: datos.admin.id, rol: 'admin' })
  tokenSinOrdenes = firmarToken({ id: datos.admin.id, rol: 'cliente' })

  const p = await pool.query('select id from productos where activo and stock_actual >= 10 order by sku limit 2')
  await llenarCarrito(pool, dueno, [[p.rows[0].id, 2], [p.rows[1].id, 1]])
  const res = await request(app)
    .post('/api/checkout')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ medio_pago: 'mock', despacho: DESPACHO })
  orden = res.body
}, 120_000)

afterAll(async () => {
  await pool.end()
})

const get = (ruta, token) => {
  const req = request(app).get(ruta)
  return token ? req.set('Authorization', `Bearer ${token}`) : req
}

describe('GET /api/ordenes', () => {
  it('lista las órdenes del usuario, de la más reciente a la más antigua', async () => {
    const res = await get('/api/ordenes?limite=48', tokenDueno)
    expect(res.status).toBe(200)
    const { rows } = await pool.query('select count(*)::int as n from ventas where cliente_id = $1', [dueno])
    expect(res.body.total).toBe(rows[0].n)
    expect(res.body.items[0].id).toBe(orden.id)
    const fechas = res.body.items.map((o) => new Date(o.fecha).getTime())
    expect(fechas.every((f, i) => i === 0 || fechas[i - 1] >= f)).toBe(true)

    const item = res.body.items[0]
    expect(Object.keys(item).sort()).toEqual(
      ['cantidad_productos', 'codigo', 'costo_envio', 'estado', 'fecha', 'id', 'medio_pago', 'neto', 'total'].sort()
    )
    expect(item).toMatchObject({ codigo: orden.codigo, total: orden.total, neto: orden.neto, cantidad_productos: 2 })
  })

  it('pagina con pagina y limite', async () => {
    const [p1, p2] = await Promise.all([
      get('/api/ordenes?limite=2&pagina=1', tokenDueno),
      get('/api/ordenes?limite=2&pagina=2', tokenDueno)
    ])
    expect(p1.body).toMatchObject({ pagina: 1, limite: 2, totalPaginas: Math.ceil(p1.body.total / 2) })
    expect(p1.body.items).toHaveLength(2)
    expect(p2.body.items).toHaveLength(2)
    const ids1 = new Set(p1.body.items.map((o) => o.id))
    expect(p2.body.items.some((o) => ids1.has(o.id))).toBe(false)
  })

  it('un usuario sin órdenes recibe una lista vacía', async () => {
    const res = await get('/api/ordenes', tokenSinOrdenes)
    expect(res.body).toEqual({ items: [], total: 0, pagina: 1, limite: 12, totalPaginas: 0 })
  })

  it('valida la paginación y exige sesión', async () => {
    expect((await get('/api/ordenes?limite=49', tokenDueno)).status).toBe(400)
    expect((await get('/api/ordenes')).status).toBe(401)
  })
})

describe('GET /api/ordenes/:id', () => {
  it('el dueño ve su orden con los mismos datos que devolvió el checkout', async () => {
    const res = await get(`/api/ordenes/${orden.id}`, tokenDueno)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(orden)
    expect(res.body.items).toHaveLength(2)
  })

  it('el dueño ve también sus órdenes históricas del seed', async () => {
    const { rows } = await pool.query(
      `select id, (select count(*)::int from detalle_ventas where venta_id = v.id) as lineas
         from ventas v where cliente_id = $1 and id <> $2 limit 1`,
      [dueno, orden.id]
    )
    const res = await get(`/api/ordenes/${rows[0].id}`, tokenDueno)
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(rows[0].lineas)
    expect(res.body.medio_pago).toBe('Webpay Plus')
  })

  it('otro cliente recibe 404 (no 403)', async () => {
    const res = await get(`/api/ordenes/${orden.id}`, tokenOtro)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Orden no encontrada')
  })

  it('un admin puede ver cualquier orden', async () => {
    const res = await get(`/api/ordenes/${orden.id}`, tokenAdmin)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(orden.id)
  })

  it('404 si el id no es UUID o no existe; 401 sin sesión', async () => {
    expect((await get('/api/ordenes/SUB-2026-500000', tokenDueno)).status).toBe(404)
    expect((await get('/api/ordenes/00000000-0000-4000-8000-000000000000', tokenAdmin)).status).toBe(404)
    expect((await get(`/api/ordenes/${orden.id}`)).status).toBe(401)
  })
})
