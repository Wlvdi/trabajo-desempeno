/**
 * Tests de integración de GET /api/productos/:id (detalle, página pesada).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo, verificarTarjeta } from './ayudantes.js'

let pool
let app
/** Producto con la galería más grande del seed. */
let producto

beforeAll(async () => {
  ;({ pool, app } = await prepararCatalogo())
  const { rows } = await pool.query(`
    select p.id, p.categoria_id
      from productos p join producto_imagenes pi on pi.producto_id = p.id
     where p.stock_actual >= 5
     group by p.id
     order by count(*) desc, p.sku
     limit 1`)
  producto = rows[0]
}, 120_000)

afterAll(async () => {
  await pool.end()
})

/** Unidades vendidas (no anuladas) en los últimos 90 días según SQL independiente. */
async function vendidas90(id) {
  const { rows } = await pool.query(
    `select coalesce(sum(dv.cantidad), 0)::int as n
       from detalle_ventas dv join ventas v on v.id = dv.venta_id
      where dv.producto_id = $1 and v.estado <> 'ANULADO' and v.fecha >= now() - interval '90 days'`,
    [id]
  )
  return rows[0].n
}

describe('GET /api/productos/:id', () => {
  it('devuelve el producto con su categoría y los campos del frontend', async () => {
    const res = await request(app).get(`/api/productos/${producto.id}`)
    expect(res.status).toBe(200)
    verificarTarjeta(res.body, expect)
    expect(res.body.id).toBe(producto.id)
    expect(res.body.categoria_id).toBe(producto.categoria_id)
    expect(typeof res.body.categoria_nombre).toBe('string')
    expect(typeof res.body.descripcion_larga).toBe('string')
    expect(typeof res.body.especificaciones).toBe('object')
    expect(res.body.especificaciones).toHaveProperty('color')
  })

  it('trae la galería ordenada', async () => {
    const res = await request(app).get(`/api/productos/${producto.id}`)
    const { rows } = await pool.query('select url from producto_imagenes where producto_id = $1 order by orden, id', [
      producto.id
    ])
    expect(rows.length).toBeGreaterThan(1)
    expect(res.body.imagenes_galeria).toEqual(rows.map((r) => r.url))
  })

  it('cuenta las unidades vendidas en los últimos 90 días', async () => {
    const antes = await request(app).get(`/api/productos/${producto.id}`)
    expect(antes.body.unidades_vendidas_90d).toBe(await vendidas90(producto.id))

    // Venta de hoy: no depende de la fecha fija del seed.
    const { rows } = await pool.query(`insert into ventas (canal_venta, total) values ('Web', 3000) returning id`)
    await pool.query(
      `insert into detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
       values ($1, $2, 3, 1000, 3000)`,
      [rows[0].id, producto.id]
    )
    // Una venta anulada no debe contar.
    const anulada = await pool.query(
      `insert into ventas (canal_venta, total, estado) values ('Web', 5000, 'ANULADO') returning id`
    )
    await pool.query(
      `insert into detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
       values ($1, $2, 1, 5000, 5000)`,
      [anulada.rows[0].id, producto.id]
    )

    const despues = await request(app).get(`/api/productos/${producto.id}`)
    expect(despues.body.unidades_vendidas_90d).toBe(antes.body.unidades_vendidas_90d + 3)
  })

  it('trae 4 relacionados de la misma categoría ordenados por unidades vendidas', async () => {
    const res = await request(app).get(`/api/productos/${producto.id}`)
    const rel = res.body.relacionados
    expect(rel).toHaveLength(4)
    rel.forEach((p) => verificarTarjeta(p, expect))
    expect(rel.every((p) => p.categoria_id === producto.categoria_id)).toBe(true)
    expect(rel.map((p) => p.id)).not.toContain(producto.id)
    const unidades = rel.map((p) => p.unidades_vendidas)
    expect(unidades.every((u, i) => i === 0 || unidades[i - 1] >= u)).toBe(true)

    const { rows } = await pool.query(
      `select p.id
         from productos p
         left join detalle_ventas dv on dv.producto_id = p.id
         left join ventas v on v.id = dv.venta_id and v.estado <> 'ANULADO'
        where p.activo and p.categoria_id = $1 and p.id <> $2
        group by p.id, p.nombre
        order by coalesce(sum(dv.cantidad) filter (where v.id is not null), 0) desc, p.nombre, p.id
        limit 4`,
      [producto.categoria_id, producto.id]
    )
    expect(rel.map((p) => p.id)).toEqual(rows.map((r) => r.id))
  })

  it('no incluye productos inactivos entre los relacionados', async () => {
    const primero = (await request(app).get(`/api/productos/${producto.id}`)).body.relacionados[0]
    await pool.query('update productos set activo = false where id = $1', [primero.id])
    try {
      const res = await request(app).get(`/api/productos/${producto.id}`)
      expect(res.body.relacionados.map((p) => p.id)).not.toContain(primero.id)
      expect(res.body.relacionados).toHaveLength(4)
    } finally {
      await pool.query('update productos set activo = true where id = $1', [primero.id])
    }
  })

  it('responde 404 si el id no es un UUID válido', async () => {
    const res = await request(app).get('/api/productos/prod-001')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Producto no encontrado')
  })

  it('responde 404 si el producto no existe', async () => {
    const res = await request(app).get('/api/productos/00000000-0000-4000-8000-000000000000')
    expect(res.status).toBe(404)
  })

  it('responde 404 si el producto está inactivo', async () => {
    await pool.query('update productos set activo = false where id = $1', [producto.id])
    try {
      expect((await request(app).get(`/api/productos/${producto.id}`)).status).toBe(404)
    } finally {
      await pool.query('update productos set activo = true where id = $1', [producto.id])
    }
  })
})
