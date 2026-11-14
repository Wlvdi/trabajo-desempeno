/**
 * Tests de integración de GET /api/home y GET /api/categorias.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { TOTAL_DESTACADOS, TOTAL_PRODUCTOS } from '../seeds/generador.js'
import { prepararCatalogo, verificarTarjeta } from './ayudantes.js'

let pool
let app

beforeAll(async () => {
  ;({ pool, app } = await prepararCatalogo())
}, 120_000)

afterAll(async () => {
  await pool.end()
})

describe('GET /api/home', () => {
  it('devuelve los destacados activos con los campos del frontend', async () => {
    const res = await request(app).get('/api/home')
    expect(res.status).toBe(200)
    expect(res.body.destacados).toHaveLength(TOTAL_DESTACADOS)
    for (const p of res.body.destacados) {
      verificarTarjeta(p, expect)
      expect(p.destacado).toBe(true)
      expect(typeof p.categoria_nombre).toBe('string')
    }
  })

  it('devuelve las 5 categorías con su cantidad de productos', async () => {
    const res = await request(app).get('/api/home')
    expect(res.body.categorias).toHaveLength(5)
    const suma = res.body.categorias.reduce((s, c) => s + c.total_productos, 0)
    expect(suma).toBe(TOTAL_PRODUCTOS)
    for (const c of res.body.categorias) {
      expect(Object.keys(c).sort()).toEqual(['descripcion', 'id', 'nombre', 'total_productos'])
      expect(typeof c.total_productos).toBe('number')
    }
  })

  it('excluye productos inactivos de destacados y conteos', async () => {
    const { rows } = await pool.query('select id, categoria_id from productos where destacado limit 1')
    await pool.query('update productos set activo = false where id = $1', [rows[0].id])
    try {
      const res = await request(app).get('/api/home')
      expect(res.body.destacados).toHaveLength(TOTAL_DESTACADOS - 1)
      expect(res.body.destacados.map((p) => p.id)).not.toContain(rows[0].id)
      const suma = res.body.categorias.reduce((s, c) => s + c.total_productos, 0)
      expect(suma).toBe(TOTAL_PRODUCTOS - 1)
    } finally {
      await pool.query('update productos set activo = true where id = $1', [rows[0].id])
    }
  })
})

describe('GET /api/categorias', () => {
  it('lista las categorías ordenadas por nombre con conteos correctos', async () => {
    const res = await request(app).get('/api/categorias')
    expect(res.status).toBe(200)
    const { rows } = await pool.query(`
      select c.id, count(p.id)::int as total
        from categorias c left join productos p on p.categoria_id = c.id and p.activo
       group by c.id, c.nombre order by c.nombre`)
    expect(res.body.map((c) => c.id)).toEqual(rows.map((r) => r.id))
    expect(res.body.map((c) => c.total_productos)).toEqual(rows.map((r) => r.total))
  })
})
