/**
 * Ventas manuales desde el panel: descuentan stock, 409 sin cambios si falta
 * stock, canal "Web" reservado y sin sobreventa con ventas simultáneas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo } from './ayudantes.js'
import { productosConStock, stockDe, tokensDePrueba } from './ayudantes-admin.js'
import { DESPACHO } from './ayudantes-checkout.js'
import { firmarToken } from '../src/seguridad/tokens.js'

let pool
let app
let tokens
let datos

beforeAll(async () => {
  ;({ pool, app, datos } = await prepararCatalogo())
  tokens = tokensDePrueba(datos)
}, 120_000)

afterAll(async () => {
  await pool.end()
})

const vender = (cuerpo) => request(app).post('/api/admin/ventas').set('Authorization', tokens.admin).send(cuerpo)
const contar = async (tabla) => (await pool.query(`select count(*)::int as n from ${tabla}`)).rows[0].n

describe('POST /api/admin/ventas', () => {
  it('descuenta stock, usa el precio actual por defecto y calcula el total en el servidor', async () => {
    const [a, b] = await productosConStock(pool, 2, 5)
    const antes = await stockDe(pool, [a.id, b.id])

    const r = await vender({
      canal_venta: 'Instagram',
      cliente_nombre: 'Camila González',
      notas: 'Retira en feria',
      total: 1, // se ignora
      items: [
        { producto_id: a.id, cantidad: 2 },
        { producto_id: b.id, cantidad: 1, precio_unitario: 1000 }
      ]
    })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({
      canal_venta: 'Instagram',
      cliente_nombre: 'Camila González',
      notas: 'Retira en feria',
      codigo: null,
      estado: 'PAGADO',
      usuario_email: 'admin@subligol.cl',
      total: (Math.round(a.precio_venta * 100) * 2 + 100000) / 100
    })
    const lineaA = r.body.detalles.find((d) => d.producto_id === a.id)
    expect(lineaA).toMatchObject({ cantidad: 2, precio_unitario: a.precio_venta, producto: { nombre: a.nombre } })

    const despues = await stockDe(pool, [a.id, b.id])
    expect(despues[a.id]).toBe(antes[a.id] - 2)
    expect(despues[b.id]).toBe(antes[b.id] - 1)

    const auditoria = await pool.query(
      `select count(*)::int as n from audit_logs a join usuarios u on u.id = a.usuario_id
        where a.tipo_evento = 'VENTA_SALIDA' and a.detalle->>'venta_id' = $1 and u.email = 'admin@subligol.cl'`,
      [r.body.id]
    )
    expect(auditoria.rows[0].n).toBe(2)
  })

  it('si falta stock responde 409 con la lista y no cambia nada', async () => {
    const [a, b] = await productosConStock(pool, 2, 5)
    const antes = await stockDe(pool, [a.id, b.id])
    const ventas = await contar('ventas')

    const r = await vender({
      canal_venta: 'WhatsApp',
      items: [
        { producto_id: a.id, cantidad: 1 },
        { producto_id: b.id, cantidad: antes[b.id] + 1 }
      ]
    })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('Stock insuficiente para registrar la venta')
    expect(r.body.productos).toEqual([
      { producto_id: b.id, nombre: b.nombre, solicitado: antes[b.id] + 1, disponible: antes[b.id] }
    ])
    expect(await stockDe(pool, [a.id, b.id])).toEqual(antes)
    expect(await contar('ventas')).toBe(ventas)
  })

  it('un producto inactivo figura con disponible 0', async () => {
    const [p] = await productosConStock(pool, 1, 5)
    await pool.query('update productos set activo = false where id = $1', [p.id])
    const r = await vender({ canal_venta: 'Presencial', items: [{ producto_id: p.id, cantidad: 1 }] })
    await pool.query('update productos set activo = true where id = $1', [p.id])
    expect(r.status).toBe(409)
    expect(r.body.productos[0]).toMatchObject({ producto_id: p.id, disponible: 0 })
  })

  it('el canal "Web" está reservado al checkout (400)', async () => {
    const [p] = await productosConStock(pool, 1, 5)
    const r = await vender({ canal_venta: 'Web', items: [{ producto_id: p.id, cantidad: 1 }] })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('El canal "Web" está reservado para las compras de la tienda')
  })

  it('valida el cuerpo con 400', async () => {
    const [p] = await productosConStock(pool, 1, 5)
    const casos = [
      { items: [{ producto_id: p.id, cantidad: 1 }] },
      { canal_venta: 'Feria', items: [{ producto_id: p.id, cantidad: 1 }] },
      { canal_venta: 'Otro', items: [] },
      { canal_venta: 'Otro', items: [{ producto_id: p.id, cantidad: '1' }] },
      { canal_venta: 'Otro', items: [{ producto_id: p.id, cantidad: 1, precio_unitario: -5 }] },
      { canal_venta: 'Otro', items: [{ producto_id: p.id, cantidad: 1 }, { producto_id: p.id, cantidad: 1 }] },
      { canal_venta: 'Otro', items: [{ producto_id: '00000000-0000-4000-8000-000000000000', cantidad: 1 }] }
    ]
    for (const cuerpo of casos) {
      const r = await vender(cuerpo)
      expect(r.status, JSON.stringify(cuerpo)).toBe(400)
      expect(typeof r.body.error).toBe('string')
    }
  })

  it('10 ventas simultáneas sobre un producto con stock 3: exactamente 3 se registran', async () => {
    const [p] = await productosConStock(pool, 1, 5)
    await pool.query('update productos set stock_actual = 3 where id = $1', [p.id])
    const lineasAntes = (await pool.query('select count(*)::int as n from detalle_ventas where producto_id = $1', [p.id]))
      .rows[0].n

    const respuestas = await Promise.all(
      Array.from({ length: 10 }, () => vender({ canal_venta: 'Otro', items: [{ producto_id: p.id, cantidad: 1 }] }))
    )
    const estados = respuestas.map((r) => r.status)
    expect(estados.filter((s) => s === 201)).toHaveLength(3)
    expect(estados.filter((s) => s === 409)).toHaveLength(7)

    const { rows } = await pool.query(
      `select stock_actual, (select count(*)::int from detalle_ventas where producto_id = $1) as lineas
         from productos where id = $1`,
      [p.id]
    )
    expect(rows[0].stock_actual).toBe(0)
    expect(rows[0].lineas - lineasAntes).toBe(3)
  })

  it('ventas simultáneas con los mismos productos en distinto orden terminan sin deadlock', async () => {
    const [a, b] = await productosConStock(pool, 2, 5)
    await pool.query('update productos set stock_actual = 100 where id = any($1::uuid[])', [[a.id, b.id]])
    const respuestas = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        vender({
          canal_venta: 'Otro',
          items: i % 2 === 0
            ? [{ producto_id: a.id, cantidad: 1 }, { producto_id: b.id, cantidad: 1 }]
            : [{ producto_id: b.id, cantidad: 1 }, { producto_id: a.id, cantidad: 1 }]
        })
      )
    )
    expect(respuestas.every((r) => r.status === 201)).toBe(true)
    expect(await stockDe(pool, [a.id, b.id])).toEqual({ [a.id]: 92, [b.id]: 92 })
  })
})

describe('GET /api/admin/ventas', () => {
  it('devuelve las más recientes de todos los canales con su detalle', async () => {
    const r = await request(app).get('/api/admin/ventas').query({ limite: 5 }).set('Authorization', tokens.admin)
    expect(r.status).toBe(200)
    expect(r.body).toHaveLength(5)
    expect(r.body[0]).toMatchObject({ canal_venta: 'Otro', total: expect.any(Number), detalles: expect.any(Array) })
    expect(r.body[0].detalles[0]).toMatchObject({ precio_unitario: expect.any(Number), producto: { nombre: expect.any(String) } })
  })

  it('15 por defecto y máximo 100', async () => {
    expect((await request(app).get('/api/admin/ventas').set('Authorization', tokens.admin)).body).toHaveLength(15)
    const exceso = await request(app).get('/api/admin/ventas').query({ limite: 0 }).set('Authorization', tokens.admin)
    expect(exceso.status).toBe(400)
  })
})

describe('GET /api/admin/ventas: datos de despacho de los pedidos web', () => {
  /** Compra en la tienda (con sesión si se entrega usuario; si no, como invitado). */
  async function comprarEnTienda(producto, usuario) {
    const auth = usuario ? { Authorization: `Bearer ${firmarToken({ id: usuario.id, rol: 'cliente' })}` } : {}
    const carrito = await request(app).post('/api/carrito/items').set(auth).send({ producto_id: producto.id, cantidad: 1 })
    const req = request(app).post('/api/checkout').set(auth)
    if (!usuario) req.set('X-Carrito-Id', carrito.body.id)
    const despacho = usuario ? DESPACHO : { ...DESPACHO, email: 'invitado.despacho@ejemplo.cl' }
    const r = await req.send({ medio_pago: 'mock', despacho })
    expect(r.status).toBe(201)
    return r.body
  }

  it('?canal=Web devuelve solo pedidos web con despacho, correo, envío, pago y tipo de cliente', async () => {
    const [p1, p2] = await productosConStock(pool, 2, 5)
    const invitado = await comprarEnTienda(p1)
    const registrado = await comprarEnTienda(p2, datos.clientes[30])

    const r = await request(app).get('/api/admin/ventas').query({ canal: 'Web', limite: 2 }).set('Authorization', tokens.admin)
    expect(r.status).toBe(200)
    expect(r.body.every((v) => v.canal_venta === 'Web')).toBe(true)
    const porCodigo = Object.fromEntries(r.body.map((v) => [v.codigo, v]))

    expect(porCodigo[invitado.codigo]).toMatchObject({
      tipo_cliente: 'invitado',
      cliente_email: 'invitado.despacho@ejemplo.cl',
      despacho: { direccion: DESPACHO.direccion, comuna: DESPACHO.comuna, region: DESPACHO.region, telefono: DESPACHO.telefono },
      medio_pago: 'mock',
      codigo_autorizacion: expect.stringMatching(/^MOCK-/),
      costo_envio: expect.any(Number)
    })
    expect(porCodigo[registrado.codigo]).toMatchObject({
      tipo_cliente: 'registrado',
      cliente_email: datos.clientes[30].email
    })
  })

  it('las ventas manuales no traen despacho ni tipo de cliente', async () => {
    const r = await request(app).get('/api/admin/ventas').query({ canal: 'Instagram', limite: 3 }).set('Authorization', tokens.admin)
    expect(r.status).toBe(200)
    expect(r.body.length).toBeGreaterThan(0)
    for (const v of r.body) {
      expect(v.canal_venta).toBe('Instagram')
      expect(v.despacho).toBeNull()
      expect(v.tipo_cliente).toBeNull()
    }
  })

  it('canal desconocido → 400', async () => {
    const r = await request(app).get('/api/admin/ventas').query({ canal: 'Tiktok' }).set('Authorization', tokens.admin)
    expect(r.status).toBe(400)
  })
})
