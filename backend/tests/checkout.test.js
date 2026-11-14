/**
 * Tests de integración de POST /api/checkout sobre subligol_test.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { firmarToken } from '../src/seguridad/tokens.js'
import { crearApp } from '../src/app.js'
import { COSTO_ENVIO, UMBRAL_ENVIO_GRATIS } from '../src/pagos.js'
import { prepararCatalogo } from './ayudantes.js'
import { DESPACHO, fotografia, llenarCarrito } from './ayudantes-checkout.js'

let pool
let app
let cliente
let token
/** Productos activos con stock holgado y precio entre 2000 y 20000. */
let productos

beforeAll(async () => {
  let datos
  ;({ pool, app, datos } = await prepararCatalogo())
  cliente = datos.clientes[0]
  token = firmarToken({ id: cliente.id, rol: 'cliente' })
  const { rows } = await pool.query(
    `select id, nombre, precio_venta::float8 as precio, stock_actual from productos
      where activo and stock_actual >= 30 and precio_venta between 2000 and 20000
      order by sku limit 10`
  )
  productos = rows
}, 120_000)

beforeEach(async () => {
  await pool.query('truncate table carrito_items, carritos')
})

afterAll(async () => {
  await pool.end()
})

const comprar = (cuerpo = { medio_pago: 'mock', despacho: DESPACHO }, tk = token, aplicacion = app) => {
  const req = request(aplicacion).post('/api/checkout').send(cuerpo)
  return tk ? req.set('Authorization', `Bearer ${tk}`) : req
}

const stockDe = async (id) =>
  (await pool.query('select stock_actual from productos where id = $1', [id])).rows[0].stock_actual

describe('POST /api/checkout: compra exitosa', () => {
  it('crea la orden, descuenta stock, audita y vacía el carrito', async () => {
    const [a, b] = productos
    // El carrito se arma con la API real del carrito.
    for (const [p, cantidad] of [[a, 2], [b, 1]]) {
      const r = await request(app)
        .post('/api/carrito/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ producto_id: p.id, cantidad })
      expect(r.status).toBeLessThan(300)
    }
    const stockAntes = { a: await stockDe(a.id), b: await stockDe(b.id) }

    const res = await comprar()
    expect(res.status).toBe(201)
    const orden = res.body
    expect(Object.keys(orden).sort()).toEqual(
      ['codigo', 'codigo_autorizacion', 'costo_envio', 'despacho', 'estado', 'fecha', 'id', 'items', 'medio_pago',
        'neto', 'total'].sort()
    )
    expect(orden).toMatchObject({ estado: 'PAGADO', medio_pago: 'mock', despacho: DESPACHO })
    expect(orden.codigo_autorizacion).toMatch(/^MOCK-\d{6}$/)

    // Código SUB-AAAA-NNNNNN con el año de Chile y número de la secuencia nueva.
    const anioChile = new Intl.DateTimeFormat('en', { timeZone: 'America/Santiago', year: 'numeric' }).format(new Date())
    expect(orden.codigo).toMatch(new RegExp(`^SUB-${anioChile}-\\d{6}$`))
    expect(Number(orden.codigo.slice(-6))).toBeGreaterThanOrEqual(500000)

    // Montos con precios actuales.
    const neto = a.precio * 2 + b.precio
    expect(orden.neto).toBe(neto)
    expect(orden.costo_envio).toBe(neto >= UMBRAL_ENVIO_GRATIS ? 0 : COSTO_ENVIO)
    expect(orden.total).toBe(neto + orden.costo_envio)
    expect(orden.items).toHaveLength(2)
    expect(orden.items.find((i) => i.producto_id === a.id)).toMatchObject({
      cantidad: 2,
      precio_unitario: a.precio,
      subtotal: a.precio * 2
    })

    // Stock descontado por el trigger.
    expect(await stockDe(a.id)).toBe(stockAntes.a - 2)
    expect(await stockDe(b.id)).toBe(stockAntes.b - 1)

    // Venta con cliente_id y usuario_id del usuario, canal Web.
    const venta = (await pool.query('select * from ventas where id = $1', [orden.id])).rows[0]
    expect(venta).toMatchObject({
      canal_venta: 'Web',
      estado: 'PAGADO',
      cliente_id: cliente.id,
      usuario_id: cliente.id,
      cliente_nombre: 'Camila González',
      codigo: orden.codigo
    })
    expect(Number(venta.total)).toBe(orden.total)

    // Auditoría VENTA_SALIDA atribuida al usuario, una por producto.
    const auditoria = await pool.query(
      `select entidad_id, usuario_id from audit_logs
        where tipo_evento = 'VENTA_SALIDA' and detalle->>'venta_id' = $1`,
      [orden.id]
    )
    expect(auditoria.rows).toHaveLength(2)
    expect(auditoria.rows.every((r) => r.usuario_id === cliente.id)).toBe(true)
    expect(auditoria.rows.map((r) => r.entidad_id).sort()).toEqual([a.id, b.id].sort())

    // Carrito vacío.
    const carrito = await request(app).get('/api/carrito').set('Authorization', `Bearer ${token}`)
    expect(carrito.body.items).toEqual([])
  })

  it('cobra envío si el neto es menor a 30000 y no lo cobra desde 30000', async () => {
    const [p] = productos
    await pool.query('update productos set precio_venta = $2 where id = $1', [p.id, UMBRAL_ENVIO_GRATIS - 1])
    await llenarCarrito(pool, cliente.id, [[p.id, 1]])
    const conEnvio = await comprar()
    expect(conEnvio.body).toMatchObject({
      neto: UMBRAL_ENVIO_GRATIS - 1,
      costo_envio: COSTO_ENVIO,
      total: UMBRAL_ENVIO_GRATIS - 1 + COSTO_ENVIO
    })

    await pool.query('update productos set precio_venta = $2 where id = $1', [p.id, UMBRAL_ENVIO_GRATIS])
    await llenarCarrito(pool, cliente.id, [[p.id, 1]])
    const sinEnvio = await comprar()
    expect(sinEnvio.body).toMatchObject({ neto: UMBRAL_ENVIO_GRATIS, costo_envio: 0, total: UMBRAL_ENVIO_GRATIS })

    await pool.query('update productos set precio_venta = $2 where id = $1', [p.id, p.precio])
  })

  it('usa el precio actual si cambió después de agregar al carrito', async () => {
    const [p] = productos
    await llenarCarrito(pool, cliente.id, [[p.id, 3]])
    const nuevoPrecio = p.precio + 1000
    await pool.query('update productos set precio_venta = $2 where id = $1', [p.id, nuevoPrecio])
    try {
      const res = await comprar()
      expect(res.status).toBe(201)
      expect(res.body.items[0].precio_unitario).toBe(nuevoPrecio)
      expect(res.body.neto).toBe(nuevoPrecio * 3)
    } finally {
      await pool.query('update productos set precio_venta = $2 where id = $1', [p.id, p.precio])
    }
  })

  it('los códigos de órdenes consecutivas son correlativos', async () => {
    await llenarCarrito(pool, cliente.id, [[productos[0].id, 1]])
    const uno = await comprar()
    await llenarCarrito(pool, cliente.id, [[productos[0].id, 1]])
    const dos = await comprar()
    expect(Number(dos.body.codigo.slice(-6))).toBe(Number(uno.body.codigo.slice(-6)) + 1)
  })
})

describe('POST /api/checkout: errores', () => {
  it('stock insuficiente → 409 con la lista y sin cambios en la base', async () => {
    const [a, b, c] = productos
    await pool.query('update productos set stock_actual = 2 where id = $1', [a.id])
    await pool.query('update productos set activo = false where id = $1', [c.id])
    try {
      await llenarCarrito(pool, cliente.id, [[a.id, 3], [b.id, 1], [c.id, 1]])
      const antes = await fotografia(pool, [a.id, b.id, c.id])

      const res = await comprar()
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Stock insuficiente para completar la compra')
      const esperado = [
        { producto_id: a.id, nombre: a.nombre, solicitado: 3, disponible: 2 },
        { producto_id: c.id, nombre: c.nombre, solicitado: 1, disponible: 0 }
      ].sort((x, y) => x.producto_id.localeCompare(y.producto_id))
      expect(res.body.productos).toEqual(esperado)

      expect(await fotografia(pool, [a.id, b.id, c.id])).toEqual(antes)
    } finally {
      await pool.query('update productos set stock_actual = $2 where id = $1', [a.id, a.stock_actual])
      await pool.query('update productos set activo = true where id = $1', [c.id])
    }
  })

  it('carrito inexistente o vacío → 400', async () => {
    const sinCarrito = await comprar()
    expect(sinCarrito.status).toBe(400)
    expect(sinCarrito.body.error).toBe('El carrito está vacío')

    await llenarCarrito(pool, cliente.id, [])
    expect((await comprar()).status).toBe(400)
  })

  it('sin sesión → 401', async () => {
    expect((await comprar(undefined, null)).status).toBe(401)
  })

  it('pago simulado deshabilitado → 400 y sin cambios', async () => {
    await llenarCarrito(pool, cliente.id, [[productos[0].id, 1]])
    const antes = await fotografia(pool, [productos[0].id])
    const appSinMock = crearApp({ pool, pagoMock: false })
    const res = await comprar(undefined, token, appSinMock)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/deshabilitado/)
    expect(await fotografia(pool, [productos[0].id])).toEqual(antes)
  })

  it('webpay → 501 no implementado', async () => {
    await llenarCarrito(pool, cliente.id, [[productos[0].id, 1]])
    const res = await comprar({ medio_pago: 'webpay', despacho: DESPACHO })
    expect(res.status).toBe(501)
    expect(res.body.error).toMatch(/no está implementado aún/)
  })

  const conDespacho = (cambios) => ({ medio_pago: 'mock', despacho: { ...DESPACHO, ...cambios } })

  it.each([
    [{ despacho: DESPACHO }, /"medio_pago" debe ser uno de: mock, webpay/],
    [{ medio_pago: 'transferencia', despacho: DESPACHO }, /"medio_pago"/],
    [{ medio_pago: 'mock' }, /"despacho" es obligatorio/],
    [{ medio_pago: 'mock', despacho: 'Santiago' }, /"despacho" es obligatorio/],
    [conDespacho({ nombre: undefined }), /"despacho.nombre" es obligatorio/],
    [conDespacho({ nombre: 'A' }), /"despacho.nombre" debe tener entre 2 y 60/],
    [conDespacho({ apellido: 'x'.repeat(61) }), /"despacho.apellido"/],
    [conDespacho({ telefono: '1234' }), /"despacho.telefono" debe tener entre 8 y 20/],
    [conDespacho({ telefono: '+56 9 abcd efgh' }), /solo admite dígitos/],
    [conDespacho({ region: '' }), /"despacho.region"/],
    [conDespacho({ comuna: 'x'.repeat(81) }), /"despacho.comuna"/],
    [conDespacho({ direccion: 'Av 1' }), /"despacho.direccion" debe tener entre 5 y 150/],
    [conDespacho({ depto: 'x'.repeat(51) }), /"despacho.depto"/],
    [conDespacho({ depto: 42 }), /"despacho.depto"/]
  ])('valida el cuerpo %#', async (cuerpo, mensaje) => {
    const res = await comprar(cuerpo)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })

  it('depto es opcional y no se guardan campos desconocidos (rut, email)', async () => {
    await llenarCarrito(pool, cliente.id, [[productos[0].id, 1]])
    const { depto: _depto, ...sinDepto } = DESPACHO
    const res = await comprar({ medio_pago: 'mock', despacho: { ...sinDepto, rut: '1-9', email: 'x@y.cl' } })
    expect(res.status).toBe(201)
    expect(res.body.despacho).toEqual(sinDepto)
  })
})
