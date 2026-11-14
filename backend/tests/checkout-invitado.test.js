/**
 * Tests de integración de la compra sin cuenta (checkout como invitado) y
 * del acceso a la orden con X-Orden-Token, sobre subligol_test.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { firmarToken } from '../src/seguridad/tokens.js'
import { prepararCatalogo } from './ayudantes.js'
import { DESPACHO, fotografia } from './ayudantes-checkout.js'

let pool
let app
let datos
/** Productos activos con stock holgado. */
let productos

const EMAIL_INVITADO = 'invitado@ejemplo.cl'
const DESPACHO_INVITADO = Object.freeze({ ...DESPACHO, email: '  Invitado@Ejemplo.CL ' })

beforeAll(async () => {
  ;({ pool, app, datos } = await prepararCatalogo())
  const { rows } = await pool.query(
    `select id, precio_venta::float8 as precio, stock_actual from productos
      where activo and stock_actual >= 30 order by sku limit 5`
  )
  productos = rows
}, 120_000)

beforeEach(async () => {
  await pool.query('truncate table carrito_items, carritos')
})

afterAll(async () => {
  await pool.end()
})

/** Arma un carrito anónimo con la API real y devuelve su id. */
async function carritoAnonimo(lineas) {
  let id
  for (const [producto, cantidad] of lineas) {
    const req = request(app).post('/api/carrito/items').send({ producto_id: producto.id, cantidad })
    const res = await (id ? req.set('X-Carrito-Id', id) : req)
    expect(res.status).toBe(200)
    id = res.body.id
  }
  return id
}

const comprarComoInvitado = (carritoId, despacho = DESPACHO_INVITADO) => {
  const req = request(app).post('/api/checkout').send({ medio_pago: 'mock', despacho })
  return carritoId ? req.set('X-Carrito-Id', carritoId) : req
}

const verOrden = (id, { token, jwt } = {}) => {
  const req = request(app).get(`/api/ordenes/${id}`)
  if (token) req.set('X-Orden-Token', token)
  if (jwt) req.set('Authorization', `Bearer ${jwt}`)
  return req
}

describe('POST /api/checkout como invitado', () => {
  it('compra con el carrito anónimo: 201, descuenta stock, vacía el carrito y entrega token', async () => {
    const [a] = productos
    const carritoId = await carritoAnonimo([[a, 2]])
    const stockAntes = (await pool.query('select stock_actual from productos where id = $1', [a.id])).rows[0].stock_actual

    const res = await comprarComoInvitado(carritoId)
    expect(res.status).toBe(201)
    expect(res.body.codigo).toMatch(/^SUB-\d{4}-\d{6}$/)
    expect(res.body.cliente_email).toBe(EMAIL_INVITADO)
    expect(res.body.token_consulta).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.body.despacho).not.toHaveProperty('email')

    const stockDespues = (await pool.query('select stock_actual from productos where id = $1', [a.id])).rows[0].stock_actual
    expect(stockDespues).toBe(stockAntes - 2)

    const venta = (await pool.query('select cliente_id, usuario_id, cliente_email from ventas where id = $1', [res.body.id]))
      .rows[0]
    expect(venta).toEqual({ cliente_id: null, usuario_id: null, cliente_email: EMAIL_INVITADO })

    const carrito = await request(app).get('/api/carrito').set('X-Carrito-Id', carritoId)
    expect(carrito.body.items).toEqual([])
  })

  it('sin carrito anónimo → 400 carrito vacío', async () => {
    const res = await comprarComoInvitado(undefined)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('El carrito está vacío')
  })

  it('con el id del carrito de un usuario registrado → 400 (no lo puede usar)', async () => {
    const jwt = firmarToken({ id: datos.clientes[20].id, rol: 'cliente' })
    const r = await request(app).post('/api/carrito/items').set('Authorization', `Bearer ${jwt}`)
      .send({ producto_id: productos[0].id, cantidad: 1 })
    const res = await comprarComoInvitado(r.body.id)
    expect(res.status).toBe(400)
  })

  it.each([
    [{ ...DESPACHO }, /despacho\.email/],
    [{ ...DESPACHO, email: '' }, /despacho\.email/],
    [{ ...DESPACHO, email: 'no-es-correo' }, /email/]
  ])('email ausente o inválido → 400 sin cambios (%#)', async (despacho, mensaje) => {
    const carritoId = await carritoAnonimo([[productos[0], 1]])
    const antes = await fotografia(pool, [productos[0].id])
    const res = await comprarComoInvitado(carritoId, despacho)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
    expect(await fotografia(pool, [productos[0].id])).toEqual(antes)
  })

  it('X-Carrito-Id que no es UUID → 400', async () => {
    expect((await comprarComoInvitado('abc')).status).toBe(400)
  })

  it('stock insuficiente → 409 con la lista y sin cambios', async () => {
    const [a] = productos
    const carritoId = await carritoAnonimo([[a, 3]])
    await pool.query('update productos set stock_actual = 2 where id = $1', [a.id])
    try {
      const antes = await fotografia(pool, [a.id])
      const res = await comprarComoInvitado(carritoId)
      expect(res.status).toBe(409)
      expect(res.body.productos).toEqual([expect.objectContaining({ producto_id: a.id, solicitado: 3, disponible: 2 })])
      expect(await fotografia(pool, [a.id])).toEqual(antes)
    } finally {
      await pool.query('update productos set stock_actual = $2 where id = $1', [a.id, a.stock_actual])
    }
  })

  it('la auditoría de la venta queda sin usuario (Sistema)', async () => {
    const carritoId = await carritoAnonimo([[productos[1], 1]])
    const res = await comprarComoInvitado(carritoId)
    const { rows } = await pool.query(
      `select usuario_id from audit_logs where tipo_evento = 'VENTA_SALIDA' and detalle->>'venta_id' = $1`,
      [res.body.id]
    )
    expect(rows).toEqual([{ usuario_id: null }])
  })
})

describe('GET /api/ordenes/:id con X-Orden-Token', () => {
  let orden

  beforeAll(async () => {
    await pool.query('truncate table carrito_items, carritos')
    const carritoId = await carritoAnonimo([[productos[2], 1]])
    orden = (await comprarComoInvitado(carritoId)).body
  })

  it('con el token correcto ve la orden (sin token_consulta en la respuesta)', async () => {
    const res = await verOrden(orden.id, { token: orden.token_consulta })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: orden.id, codigo: orden.codigo, cliente_email: EMAIL_INVITADO })
    expect(res.body).not.toHaveProperty('token_consulta')
  })

  it('token incorrecto o que no es UUID → 404', async () => {
    expect((await verOrden(orden.id, { token: '00000000-0000-4000-8000-000000000000' })).status).toBe(404)
    expect((await verOrden(orden.id, { token: 'abc' })).status).toBe(404)
  })

  it('el token de una orden no sirve para otra', async () => {
    const carritoId = await carritoAnonimo([[productos[3], 1]])
    const otra = (await comprarComoInvitado(carritoId)).body
    expect((await verOrden(otra.id, { token: orden.token_consulta })).status).toBe(404)
  })

  it('sin sesión ni token → 401', async () => {
    expect((await verOrden(orden.id)).status).toBe(401)
  })

  it('un cliente con sesión no ve la orden del invitado; un admin sí', async () => {
    const cliente = firmarToken({ id: datos.clientes[5].id, rol: 'cliente' })
    const admin = firmarToken({ id: datos.admin.id, rol: 'admin' })
    expect((await verOrden(orden.id, { jwt: cliente })).status).toBe(404)
    expect((await verOrden(orden.id, { jwt: admin })).status).toBe(200)
  })
})

describe('POST /api/checkout con sesión (sin cambios)', () => {
  it('usa el email de la cuenta, ignora despacho.email y no entrega token', async () => {
    const usuario = datos.clientes[7]
    const jwt = firmarToken({ id: usuario.id, rol: 'cliente' })
    await request(app).post('/api/carrito/items').set('Authorization', `Bearer ${jwt}`)
      .send({ producto_id: productos[4].id, cantidad: 1 })
    const res = await request(app).post('/api/checkout').set('Authorization', `Bearer ${jwt}`)
      .send({ medio_pago: 'mock', despacho: { ...DESPACHO, email: 'otro@ejemplo.cl' } })
    expect(res.status).toBe(201)
    expect(res.body.cliente_email).toBe(usuario.email)
    expect(res.body).not.toHaveProperty('token_consulta')
  })
})
