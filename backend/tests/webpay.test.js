/**
 * Tests de integración del pago con Webpay Plus (sandbox) sobre subligol_test:
 * POST /api/checkout con medio_pago "webpay" y el retorno
 * /api/pagos/webpay/retorno. Usan un cliente de Webpay FALSO: no llaman a
 * Transbank (la conexión real se prueba a mano con las tarjetas de prueba).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import { firmarToken } from '../src/seguridad/tokens.js'
import { crearApp } from '../src/app.js'
import { prepararCatalogo } from './ayudantes.js'
import { DESPACHO, llenarCarrito } from './ayudantes-checkout.js'

const URL_PUBLICA = 'https://tienda.test'
const RETORNO = '/api/pagos/webpay/retorno'

let pool
let app
let cliente
let token
let productos
/** Respuesta que devolverá el próximo commit falso. */
let respuestaCommit
const webpay = {
  crear: vi.fn(async (_ordenCompra, sesion) => ({ token: `tok-${sesion}`, url: 'https://webpay.test/init' })),
  confirmar: vi.fn(async () => respuestaCommit)
}

const aprobada = (monto) => ({ status: 'AUTHORIZED', response_code: 0, authorization_code: '1213', amount: monto })
const rechazada = (monto) => ({ status: 'FAILED', response_code: -1, authorization_code: '000000', amount: monto })

beforeAll(async () => {
  let datos
  ;({ pool, datos } = await prepararCatalogo())
  app = crearApp({ pool, webpay, urlPublica: URL_PUBLICA })
  cliente = datos.clientes[0]
  token = firmarToken({ id: cliente.id, rol: 'cliente' })
  const { rows } = await pool.query(
    `select id, precio_venta::float8 as precio from productos
      where activo and stock_actual >= 30 and precio_venta between 2000 and 20000
      order by sku limit 3`
  )
  productos = rows
}, 120_000)

beforeEach(async () => {
  await pool.query('truncate table carrito_items, carritos')
  webpay.crear.mockClear()
  webpay.confirmar.mockClear()
})

afterAll(async () => {
  await pool.end()
})

const pagarConWebpay = (tk = token) => {
  const req = request(app).post('/api/checkout').send({ medio_pago: 'webpay', despacho: DESPACHO })
  return tk ? req.set('Authorization', `Bearer ${tk}`) : req
}
const stockDe = async (id) =>
  (await pool.query('select stock_actual from productos where id = $1', [id])).rows[0].stock_actual
const venta = async (id) =>
  (await pool.query('select estado, codigo_autorizacion, pago_token from ventas where id = $1', [id])).rows[0]
const itemsCarrito = async (carritoId) =>
  (await pool.query('select count(*)::int as n from carrito_items where carrito_id = $1', [carritoId])).rows[0].n

describe('POST /api/checkout con webpay', () => {
  it('crea la venta PENDIENTE, reserva stock, conserva el carrito y responde la URL de Webpay', async () => {
    const [a] = productos
    const carritoId = await llenarCarrito(pool, cliente.id, [[a.id, 2]])
    const stockAntes = await stockDe(a.id)

    const res = await pagarConWebpay()
    expect(res.status).toBe(201)
    expect(res.body.estado).toBe('PENDIENTE')
    expect(res.body.medio_pago).toBe('webpay')
    expect(res.body.codigo_autorizacion).toBeNull()
    expect(res.body.pago).toEqual({ url: 'https://webpay.test/init', token: `tok-${res.body.id}` })

    expect(webpay.crear).toHaveBeenCalledWith(res.body.codigo, res.body.id, Math.round(res.body.total), URL_PUBLICA + RETORNO)
    expect(await stockDe(a.id)).toBe(stockAntes - 2)
    expect(await itemsCarrito(carritoId)).toBe(1)
    expect((await venta(res.body.id)).pago_token).toBe(`tok-${res.body.id}`)
  })

  it('reintentar desde el mismo carrito anula la venta PENDIENTE anterior (el stock se reserva una sola vez)', async () => {
    const [a] = productos
    await llenarCarrito(pool, cliente.id, [[a.id, 3]])
    const stockAntes = await stockDe(a.id)

    const primera = await pagarConWebpay()
    const segunda = await pagarConWebpay()
    expect(segunda.status).toBe(201)
    expect((await venta(primera.body.id)).estado).toBe('ANULADO')
    expect((await venta(segunda.body.id)).estado).toBe('PENDIENTE')
    expect(await stockDe(a.id)).toBe(stockAntes - 3)
  })

  it('si Webpay no responde: 502, venta ANULADO y stock devuelto', async () => {
    const [a] = productos
    await llenarCarrito(pool, cliente.id, [[a.id, 1]])
    const stockAntes = await stockDe(a.id)
    webpay.crear.mockRejectedValueOnce(new Error('ECONNRESET'))

    const res = await pagarConWebpay()
    expect(res.status).toBe(502)
    const { rows } = await pool.query(`select estado from ventas where medio_pago = 'webpay' order by fecha desc limit 1`)
    expect(rows[0].estado).toBe('ANULADO')
    expect(await stockDe(a.id)).toBe(stockAntes)
  })

  it('como invitado entrega token_consulta junto con la URL de pago', async () => {
    const [a] = productos
    const carrito = await request(app).post('/api/carrito/items').send({ producto_id: a.id, cantidad: 1 })
    const res = await request(app)
      .post('/api/checkout')
      .set('X-Carrito-Id', carrito.body.id)
      .send({ medio_pago: 'webpay', despacho: { ...DESPACHO, email: 'invitado@ejemplo.cl' } })
    expect(res.status).toBe(201)
    expect(res.body.token_consulta).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.body.pago.url).toBe('https://webpay.test/init')
  })
})

describe('retorno desde Webpay', () => {
  /** Carrito con un producto + checkout webpay; devuelve la orden y el carrito. */
  async function pendiente(cantidad = 2) {
    const [a] = productos
    const carritoId = await llenarCarrito(pool, cliente.id, [[a.id, cantidad]])
    const res = await pagarConWebpay()
    expect(res.status).toBe(201)
    return { orden: res.body, carritoId, producto: a }
  }

  it('pago aprobado (POST token_ws): PAGADO, código de autorización, carrito vacío y redirección', async () => {
    const { orden, carritoId, producto } = await pendiente()
    const stockReservado = await stockDe(producto.id)
    respuestaCommit = aprobada(Math.round(orden.total))

    const res = await request(app).post(RETORNO).type('form').send({ token_ws: orden.pago.token })
    expect(res.status).toBe(303)
    expect(res.headers.location).toBe(`${URL_PUBLICA}/orden/${orden.id}?pago=aprobado`)
    expect(await venta(orden.id)).toMatchObject({ estado: 'PAGADO', codigo_autorizacion: '1213' })
    expect(await itemsCarrito(carritoId)).toBe(0)
    expect(await stockDe(producto.id)).toBe(stockReservado)

    // Recargar la página de retorno no confirma dos veces.
    const otra = await request(app).get(RETORNO).query({ token_ws: orden.pago.token })
    expect(otra.headers.location).toBe(`${URL_PUBLICA}/orden/${orden.id}?pago=aprobado`)
    expect(webpay.confirmar).toHaveBeenCalledTimes(1)
  })

  it('pago rechazado: ANULADO, stock devuelto y auditado, el carrito se conserva', async () => {
    const { orden, carritoId, producto } = await pendiente(2)
    const stockReservado = await stockDe(producto.id)
    respuestaCommit = rechazada(Math.round(orden.total))

    const res = await request(app).get(RETORNO).query({ token_ws: orden.pago.token })
    expect(res.headers.location).toBe(`${URL_PUBLICA}/orden/${orden.id}?pago=rechazado`)
    expect((await venta(orden.id)).estado).toBe('ANULADO')
    expect(await stockDe(producto.id)).toBe(stockReservado + 2)
    expect(await itemsCarrito(carritoId)).toBe(1)
    const { rows } = await pool.query(
      `select count(*)::int as n from audit_logs where tipo_evento = 'VENTA_ANULADA_ENTRADA' and detalle->>'venta_id' = $1`,
      [orden.id]
    )
    expect(rows[0].n).toBe(1)
  })

  it('monto distinto al de la venta: se trata como rechazado', async () => {
    const { orden } = await pendiente()
    respuestaCommit = aprobada(Math.round(orden.total) + 1)
    const res = await request(app).get(RETORNO).query({ token_ws: orden.pago.token })
    expect(res.headers.location).toMatch(/pago=rechazado$/)
    expect((await venta(orden.id)).estado).toBe('ANULADO')
  })

  it('error al confirmar con Transbank: ANULADO', async () => {
    const { orden } = await pendiente()
    webpay.confirmar.mockRejectedValueOnce(new Error('422 token vencido'))
    const res = await request(app).get(RETORNO).query({ token_ws: orden.pago.token })
    expect(res.headers.location).toMatch(/pago=rechazado$/)
    expect((await venta(orden.id)).estado).toBe('ANULADO')
  })

  it('anulado por el comprador (TBK_TOKEN): ANULADO sin confirmar con Transbank', async () => {
    const { orden, producto } = await pendiente(1)
    const stockReservado = await stockDe(producto.id)
    const res = await request(app)
      .post(RETORNO)
      .type('form')
      .send({ TBK_TOKEN: orden.pago.token, TBK_ORDEN_COMPRA: orden.codigo, TBK_ID_SESION: orden.id })
    expect(res.headers.location).toBe(`${URL_PUBLICA}/orden/${orden.id}?pago=cancelado`)
    expect((await venta(orden.id)).estado).toBe('ANULADO')
    expect(await stockDe(producto.id)).toBe(stockReservado + 1)
    expect(webpay.confirmar).not.toHaveBeenCalled()
  })

  it('tiempo agotado (solo orden de compra): exige también el id de sesión correcto', async () => {
    const { orden } = await pendiente()
    const ajena = await request(app)
      .post(RETORNO)
      .type('form')
      .send({ TBK_ORDEN_COMPRA: orden.codigo, TBK_ID_SESION: '00000000-0000-4000-8000-000000000000' })
    expect(ajena.headers.location).toBe(`${URL_PUBLICA}/checkout?pago=error`)
    expect((await venta(orden.id)).estado).toBe('PENDIENTE')

    const propia = await request(app)
      .post(RETORNO)
      .type('form')
      .send({ TBK_ORDEN_COMPRA: orden.codigo, TBK_ID_SESION: orden.id })
    expect(propia.headers.location).toBe(`${URL_PUBLICA}/orden/${orden.id}?pago=cancelado`)
    expect((await venta(orden.id)).estado).toBe('ANULADO')
  })

  it('token desconocido o sin parámetros: vuelve al checkout con error', async () => {
    for (const query of [{ token_ws: 'no-existe' }, {}]) {
      const res = await request(app).get(RETORNO).query(query)
      expect(res.status).toBe(303)
      expect(res.headers.location).toBe(`${URL_PUBLICA}/checkout?pago=error`)
    }
  })
})
