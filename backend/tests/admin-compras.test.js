/**
 * Compras a proveedores desde el panel: suman stock por trigger, auditan
 * COMPRA_ENTRADA con el admin y el total se calcula en el servidor.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo } from './ayudantes.js'
import { productosConStock, stockDe, tokensDePrueba } from './ayudantes-admin.js'

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

const comprar = (cuerpo) => request(app).post('/api/admin/compras').set('Authorization', tokens.admin).send(cuerpo)
const contar = async (tabla) => (await pool.query(`select count(*)::int as n from ${tabla}`)).rows[0].n

describe('POST /api/admin/compras', () => {
  it('suma stock, guarda el detalle y calcula el total en el servidor', async () => {
    const [a, b] = await productosConStock(pool, 2, 0)
    const antes = await stockDe(pool, [a.id, b.id])

    const r = await comprar({
      proveedor: 'Insumos Sublimación SpA',
      notas: 'Factura 123',
      total: 1, // se ignora
      items: [
        { producto_id: a.id, cantidad: 10, costo_unitario: 1250.5 },
        { producto_id: b.id, cantidad: 3, costo_unitario: 990 }
      ]
    })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({
      proveedor: 'Insumos Sublimación SpA',
      notas: 'Factura 123',
      total: 15475, // 10 × 1250,50 + 3 × 990
      usuario_email: 'admin@subligol.cl',
      productos_creados: []
    })
    expect(r.body.detalles).toHaveLength(2)
    for (const d of r.body.detalles) {
      expect(d).toMatchObject({ cantidad: expect.any(Number), costo_unitario: expect.any(Number), subtotal: expect.any(Number) })
      expect(d.producto).toMatchObject({ id: d.producto_id, nombre: expect.any(String) })
    }

    const despues = await stockDe(pool, [a.id, b.id])
    expect(despues[a.id]).toBe(antes[a.id] + 10)
    expect(despues[b.id]).toBe(antes[b.id] + 3)
    // El trigger también actualiza el costo del producto.
    const costo = await pool.query('select costo_unitario::float8 as c from productos where id = $1', [a.id])
    expect(costo.rows[0].c).toBe(1250.5)
  })

  it('deja COMPRA_ENTRADA en la auditoría a nombre del admin', async () => {
    const [p] = await productosConStock(pool, 1, 0)
    const r = await comprar({ items: [{ producto_id: p.id, cantidad: 4, costo_unitario: 500 }] })
    const { rows } = await pool.query(
      `select a.tipo_evento, u.email, (a.detalle->>'cantidad_ingresada')::int as cantidad
         from audit_logs a left join usuarios u on u.id = a.usuario_id
        where a.detalle->>'compra_id' = $1`,
      [r.body.id]
    )
    expect(rows).toEqual([{ tipo_evento: 'COMPRA_ENTRADA', email: 'admin@subligol.cl', cantidad: 4 }])
  })

  it('un artículo nuevo se crea inactivo y con precio 0 salvo que llegue precio_venta', async () => {
    const r = await comprar({
      proveedor: 'Proveedor nuevo',
      items: [
        { es_nuevo: true, nombre: 'Botella térmica de prueba', sku: 'TEST-CMP-NUEVO', temporada: 'Verano', cantidad: 12, costo_unitario: 2100 },
        { es_nuevo: true, nombre: 'Gorro con precio', cantidad: 2, costo_unitario: 1000, precio_venta: 3990 }
      ]
    })
    expect(r.status).toBe(201)
    expect(r.body.total).toBe(27200)
    const [botella, gorro] = r.body.productos_creados
    expect(botella).toMatchObject({ nombre: 'Botella térmica de prueba', activo: false, precio_venta: 0 })
    expect(gorro).toMatchObject({ nombre: 'Gorro con precio', activo: true, precio_venta: 3990 })

    const { rows } = await pool.query(
      `select stock_actual, costo_unitario::float8 as costo, temporada, activo from productos where id = $1`,
      [botella.id]
    )
    expect(rows[0]).toEqual({ stock_actual: 12, costo: 2100, temporada: 'Verano', activo: false })
    // Inactivo: la tienda no lo muestra.
    expect((await request(app).get(`/api/productos/${botella.id}`)).status).toBe(404)
  })

  it('un SKU nuevo repetido → 409 sin crear nada', async () => {
    const compras = await contar('compras')
    const productos = await contar('productos')
    const r = await comprar({
      items: [{ es_nuevo: true, nombre: 'Duplicado', sku: 'TEST-CMP-NUEVO', cantidad: 1, costo_unitario: 100 }]
    })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/TEST-CMP-NUEVO/)
    expect(await contar('compras')).toBe(compras)
    expect(await contar('productos')).toBe(productos)
  })

  it('valida el cuerpo con 400 y no registra nada', async () => {
    const [p] = await productosConStock(pool, 1, 0)
    const compras = await contar('compras')
    const casos = [
      {},
      { items: [] },
      { items: [{ producto_id: p.id, cantidad: 0, costo_unitario: 100 }] },
      { items: [{ producto_id: p.id, cantidad: 1, costo_unitario: '100' }] },
      { items: [{ producto_id: 'x', cantidad: 1, costo_unitario: 100 }] },
      { items: [{ es_nuevo: true, cantidad: 1, costo_unitario: 100 }] },
      { items: [{ producto_id: p.id, cantidad: 1, costo_unitario: 1 }, { producto_id: p.id, cantidad: 2, costo_unitario: 1 }] }
    ]
    for (const cuerpo of casos) {
      const r = await comprar(cuerpo)
      expect(r.status, JSON.stringify(cuerpo)).toBe(400)
      expect(typeof r.body.error).toBe('string')
    }
    const inexistente = await comprar({
      items: [{ producto_id: '00000000-0000-4000-8000-000000000000', cantidad: 1, costo_unitario: 1 }]
    })
    expect(inexistente.status).toBe(400)
    expect(inexistente.body.productos).toEqual(['00000000-0000-4000-8000-000000000000'])
    expect(await contar('compras')).toBe(compras)
  })
})

describe('GET /api/admin/compras', () => {
  it('devuelve las más recientes con su detalle y respeta el límite', async () => {
    const r = await request(app).get('/api/admin/compras').query({ limite: 3 }).set('Authorization', tokens.admin)
    expect(r.status).toBe(200)
    expect(r.body).toHaveLength(3)
    expect(r.body[0].proveedor).toBe('Proveedor nuevo')
    expect(typeof r.body[0].total).toBe('number')
    expect(r.body[0].detalles.length).toBeGreaterThan(0)
    const fechas = r.body.map((c) => new Date(c.fecha).getTime())
    expect(fechas).toEqual([...fechas].sort((x, y) => y - x))
  })

  it('15 por defecto y máximo 100', async () => {
    const r = await request(app).get('/api/admin/compras').set('Authorization', tokens.admin)
    expect(r.body).toHaveLength(15)
    const exceso = await request(app).get('/api/admin/compras').query({ limite: 101 }).set('Authorization', tokens.admin)
    expect(exceso.status).toBe(400)
  })
})
