/**
 * Tests de integración de /api/carrito sobre subligol_test.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { firmarToken } from '../src/seguridad/tokens.js'
import { CANTIDAD_MAXIMA, LINEAS_MAXIMAS } from '../src/consultas/carrito.js'
import { prepararCatalogo } from './ayudantes.js'

let pool
let app
/** Productos activos con stock holgado, ordenados por sku. */
let productos
/** Tokens de dos clientes del seed. */
let tokenA
let tokenB

const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000'

beforeAll(async () => {
  let datos
  ;({ pool, app, datos } = await prepararCatalogo())
  const { rows } = await pool.query(
    `select id, precio_venta::float8 as precio, stock_actual from productos
      where activo and stock_actual >= 20 order by sku limit 60`
  )
  productos = rows
  tokenA = firmarToken({ id: datos.clientes[0].id, rol: 'cliente' })
  tokenB = firmarToken({ id: datos.clientes[1].id, rol: 'cliente' })
}, 120_000)

beforeEach(async () => {
  await pool.query('truncate table carrito_items, carritos')
})

afterAll(async () => {
  await pool.end()
})

/** Agrega opciones de identificación a una petición de Supertest. */
function identificar(req, { token, carrito } = {}) {
  if (token) req.set('Authorization', `Bearer ${token}`)
  if (carrito) req.set('X-Carrito-Id', carrito)
  return req
}
const ver = (id) => identificar(request(app).get('/api/carrito'), id)
const agregar = (cuerpo, id) => identificar(request(app).post('/api/carrito/items').send(cuerpo), id)
const cambiar = (productoId, cuerpo, id) =>
  identificar(request(app).patch(`/api/carrito/items/${productoId}`).send(cuerpo), id)
const quitar = (productoId, id) => identificar(request(app).delete(`/api/carrito/items/${productoId}`), id)
const vaciar = (id) => identificar(request(app).delete('/api/carrito'), id)
const fusionar = (id) => identificar(request(app).post('/api/carrito/fusionar'), id)

describe('Carrito anónimo', () => {
  it('sin cabecera devuelve un carrito vacío y no crea nada', async () => {
    const res = await ver()
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: null, items: [], total_unidades: 0, subtotal: 0 })
    const { rowCount } = await pool.query('select 1 from carritos')
    expect(rowCount).toBe(0)
  })

  it('al agregar crea el carrito y devuelve su id en el cuerpo y en la cabecera', async () => {
    const p = productos[0]
    const res = await agregar({ producto_id: p.id, cantidad: 2 })
    expect(res.status).toBe(200)
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers['x-carrito-id']).toBe(res.body.id)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({ id: p.id, cantidad: 2, precio_venta: p.precio, subtotal: p.precio * 2 })
    expect(res.body).toMatchObject({ total_unidades: 2, subtotal: p.precio * 2 })
  })

  it('devuelve los campos que usa CartContext.jsx, con números como número', async () => {
    const res = await agregar({ producto_id: productos[0].id })
    const item = res.body.items[0]
    expect(Object.keys(item).sort()).toEqual(
      ['cantidad', 'categoria_nombre', 'id', 'imagen_url', 'nombre', 'precio_venta', 'sku', 'stock_actual', 'subtotal']
    )
    for (const campo of ['cantidad', 'precio_venta', 'stock_actual', 'subtotal']) expect(typeof item[campo]).toBe('number')
  })

  it('sumar el mismo producto acumula unidades; cantidad por defecto es 1', async () => {
    const p = productos[0]
    const { body } = await agregar({ producto_id: p.id, cantidad: 2 })
    const res = await agregar({ producto_id: p.id }, { carrito: body.id })
    expect(res.body.id).toBe(body.id)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].cantidad).toBe(3)
  })

  it('flujo completo: agregar, cambiar cantidad, quitar y vaciar', async () => {
    const [p1, p2] = productos
    const { body } = await agregar({ producto_id: p1.id })
    const id = { carrito: body.id }
    await agregar({ producto_id: p2.id, cantidad: 3 }, id)

    let res = await cambiar(p1.id, { cantidad: 5 }, id)
    expect(res.status).toBe(200)
    expect(res.body.total_unidades).toBe(8)

    res = await quitar(p2.id, id)
    expect(res.body.items.map((i) => i.id)).toEqual([p1.id])

    res = await vaciar(id)
    expect(res.body).toMatchObject({ id: body.id, items: [], total_unidades: 0, subtotal: 0 })
    expect((await ver(id)).body.items).toEqual([])
  })

  it('un id anónimo desconocido se reemplaza por un carrito nuevo al agregar', async () => {
    const res = await agregar({ producto_id: productos[0].id }, { carrito: UUID_INEXISTENTE })
    expect(res.status).toBe(200)
    expect(res.body.id).not.toBe(UUID_INEXISTENTE)
    expect((await ver({ carrito: UUID_INEXISTENTE })).body.id).toBeNull()
  })

  it('X-Carrito-Id que no es UUID → 400', async () => {
    const res = await ver({ carrito: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/X-Carrito-Id/)
  })
})

describe('Carrito con sesión', () => {
  it('se crea al agregar y se recupera con el token', async () => {
    const p = productos[0]
    await agregar({ producto_id: p.id, cantidad: 2 }, { token: tokenA })
    const res = await ver({ token: tokenA })
    expect(res.status).toBe(200)
    expect(res.body.items[0]).toMatchObject({ id: p.id, cantidad: 2 })
    expect(res.headers['x-carrito-id']).toBeUndefined()
  })

  it('sin carrito todavía devuelve vacío sin crear nada', async () => {
    const res = await ver({ token: tokenA })
    expect(res.body).toEqual({ id: null, items: [], total_unidades: 0, subtotal: 0 })
  })

  it('un usuario no ve el carrito de otro', async () => {
    await agregar({ producto_id: productos[0].id }, { token: tokenA })
    expect((await ver({ token: tokenB })).body.items).toEqual([])
  })

  it('con el id del carrito de un usuario no se puede acceder sin token', async () => {
    const { body } = await agregar({ producto_id: productos[0].id }, { token: tokenA })
    const res = await ver({ carrito: body.id })
    expect(res.body).toMatchObject({ id: null, items: [] })
    const intento = await agregar({ producto_id: productos[1].id }, { carrito: body.id })
    expect(intento.body.id).not.toBe(body.id)
    expect((await ver({ token: tokenA })).body.items).toHaveLength(1)
  })

  it('token inválido → 401 (no se trata como anónimo)', async () => {
    const res = await ver({ token: 'no.es.token' })
    expect(res.status).toBe(401)
  })

  it('token de un usuario que ya no existe → 401 al agregar', async () => {
    const token = firmarToken({ id: UUID_INEXISTENTE, rol: 'cliente' })
    const res = await agregar({ producto_id: productos[0].id }, { token })
    expect(res.status).toBe(401)
  })
})

describe('Validaciones y stock', () => {
  it('producto inexistente o inactivo → 404', async () => {
    expect((await agregar({ producto_id: UUID_INEXISTENTE })).status).toBe(404)
    const p = productos[5]
    await pool.query('update productos set activo = false where id = $1', [p.id])
    try {
      expect((await agregar({ producto_id: p.id })).status).toBe(404)
    } finally {
      await pool.query('update productos set activo = true where id = $1', [p.id])
    }
  })

  it.each([
    [{}, /producto_id/],
    [{ producto_id: 'abc' }, /producto_id/],
    [{ producto_id: UUID_INEXISTENTE, cantidad: 0 }, /cantidad/],
    [{ producto_id: UUID_INEXISTENTE, cantidad: 100 }, /cantidad/],
    [{ producto_id: UUID_INEXISTENTE, cantidad: 1.5 }, /cantidad/],
    [{ producto_id: UUID_INEXISTENTE, cantidad: '2' }, /cantidad/]
  ])('cuerpo inválido %j → 400', async (cuerpo, mensaje) => {
    const res = await agregar(cuerpo)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })

  it('superar el stock → 409 con stock disponible, sin cambiar el carrito', async () => {
    const p = productos[0]
    const { body } = await agregar({ producto_id: p.id, cantidad: 1 })
    const res = await agregar({ producto_id: p.id, cantidad: p.stock_actual }, { carrito: body.id })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ stock_disponible: p.stock_actual, cantidad_en_carrito: 1 })
    expect((await ver({ carrito: body.id })).body.items[0].cantidad).toBe(1)
  })

  it('PATCH por sobre el stock → 409; producto fuera del carrito → 404', async () => {
    const [p1, p2] = productos
    const { body } = await agregar({ producto_id: p1.id })
    const id = { carrito: body.id }
    expect((await cambiar(p1.id, { cantidad: p1.stock_actual + 1 }, id)).status).toBe(p1.stock_actual + 1 > CANTIDAD_MAXIMA ? 400 : 409)
    expect((await cambiar(p2.id, { cantidad: 1 }, id)).status).toBe(404)
    expect((await cambiar('no-uuid', { cantidad: 1 }, id)).status).toBe(404)
    expect((await cambiar(p1.id, { cantidad: 1 })).status).toBe(404) // sin carrito
  })

  it('no permite más de 99 unidades de un producto', async () => {
    await pool.query('update productos set stock_actual = 500 where id = $1', [productos[0].id])
    const { body } = await agregar({ producto_id: productos[0].id, cantidad: 60 })
    const res = await agregar({ producto_id: productos[0].id, cantidad: 40 }, { carrito: body.id })
    expect(res.status).toBe(400)
    expect(res.body.cantidad_en_carrito).toBe(60)
  })

  it(`no permite más de ${LINEAS_MAXIMAS} productos distintos`, async () => {
    const { body } = await agregar({ producto_id: productos[0].id })
    const id = { carrito: body.id }
    for (const p of productos.slice(1, LINEAS_MAXIMAS)) {
      expect((await agregar({ producto_id: p.id }, id)).status).toBe(200)
    }
    const res = await agregar({ producto_id: productos[LINEAS_MAXIMAS].id }, id)
    expect(res.status).toBe(400)
    // Sumar a un producto que ya está sigue permitido.
    expect((await agregar({ producto_id: productos[0].id }, id)).status).toBe(200)
  })

  it('quitar un producto que no está o vaciar sin carrito es idempotente', async () => {
    expect((await quitar(productos[0].id)).status).toBe(200)
    expect((await vaciar()).status).toBe(200)
  })

  it('muestra el precio y stock actuales y oculta productos desactivados', async () => {
    const [p1, p2] = productos
    const { body } = await agregar({ producto_id: p1.id })
    const id = { carrito: body.id }
    await agregar({ producto_id: p2.id }, id)
    await pool.query('update productos set precio_venta = precio_venta + 1000 where id = $1', [p1.id])
    await pool.query('update productos set activo = false where id = $1', [p2.id])
    try {
      const res = await ver(id)
      expect(res.body.items.map((i) => i.id)).toEqual([p1.id])
      expect(res.body.items[0].precio_venta).toBe(p1.precio + 1000)
    } finally {
      await pool.query('update productos set precio_venta = $2, activo = true where id = $1', [p1.id, p1.precio])
      await pool.query('update productos set activo = true where id = $1', [p2.id])
    }
  })
})

describe('Concurrencia', () => {
  it('10 "agregar" simultáneos al mismo carrito dejan la cantidad exacta', async () => {
    const p = productos[0]
    await agregar({ producto_id: p.id }, { token: tokenA })
    const respuestas = await Promise.all(
      Array.from({ length: 10 }, () => agregar({ producto_id: p.id }, { token: tokenA }))
    )
    expect(respuestas.every((r) => r.status === 200)).toBe(true)
    expect((await ver({ token: tokenA })).body.items[0].cantidad).toBe(11)
  })

  it('crear el carrito de un usuario en paralelo no genera duplicados', async () => {
    const respuestas = await Promise.all(
      productos.slice(0, 5).map((p) => agregar({ producto_id: p.id }, { token: tokenB }))
    )
    expect(respuestas.every((r) => r.status === 200)).toBe(true)
    const { rowCount } = await pool.query('select 1 from carritos')
    expect(rowCount).toBe(1)
    expect((await ver({ token: tokenB })).body.items).toHaveLength(5)
  })
})

describe('POST /api/carrito/fusionar', () => {
  it('suma cantidades con tope en el stock y borra el carrito anónimo', async () => {
    const [p1, p2] = productos
    await pool.query('update productos set stock_actual = 5 where id = $1', [p1.id])
    try {
      await agregar({ producto_id: p1.id, cantidad: 3 }, { token: tokenA })
      const { body } = await agregar({ producto_id: p1.id, cantidad: 4 })
      await agregar({ producto_id: p2.id, cantidad: 2 }, { carrito: body.id })

      const res = await fusionar({ token: tokenA, carrito: body.id })
      expect(res.status).toBe(200)
      const cantidades = Object.fromEntries(res.body.items.map((i) => [i.id, i.cantidad]))
      expect(cantidades).toEqual({ [p1.id]: 5, [p2.id]: 2 })

      const { rowCount } = await pool.query('select 1 from carritos where id = $1', [body.id])
      expect(rowCount).toBe(0)
    } finally {
      await pool.query('update productos set stock_actual = $2 where id = $1', [p1.id, p1.stock_actual])
    }
  })

  it('omite productos sin stock y crea el carrito del usuario si no existía', async () => {
    const [p1, p2] = productos
    const { body } = await agregar({ producto_id: p1.id })
    await agregar({ producto_id: p2.id }, { carrito: body.id })
    await pool.query('update productos set stock_actual = 0 where id = $1', [p2.id])
    try {
      const res = await fusionar({ token: tokenB, carrito: body.id })
      expect(res.body.items.map((i) => i.id)).toEqual([p1.id])
    } finally {
      await pool.query('update productos set stock_actual = $2 where id = $1', [p2.id, p2.stock_actual])
    }
  })

  it('con un carrito anónimo desconocido devuelve el del usuario sin cambios', async () => {
    await agregar({ producto_id: productos[0].id }, { token: tokenA })
    const res = await fusionar({ token: tokenA, carrito: UUID_INEXISTENTE })
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
  })

  it('no permite tomar el carrito de otro usuario como si fuera anónimo', async () => {
    const { body } = await agregar({ producto_id: productos[0].id }, { token: tokenB })
    await fusionar({ token: tokenA, carrito: body.id })
    expect((await ver({ token: tokenB })).body.items).toHaveLength(1)
    expect((await ver({ token: tokenA })).body.items).toEqual([])
  })

  it('sin sesión → 401; sin cabecera → 400', async () => {
    expect((await fusionar({ carrito: UUID_INEXISTENTE })).status).toBe(401)
    expect((await fusionar({ token: tokenA })).status).toBe(400)
  })
})
