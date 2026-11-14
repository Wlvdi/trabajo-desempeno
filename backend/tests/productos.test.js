/**
 * Tests de integración de GET /api/productos (catálogo con filtros y paginación).
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

/** Cuenta productos activos que cumplen una condición SQL fija del test. */
async function contar(condicion = 'true', params = []) {
  const { rows } = await pool.query(`select count(*)::int as n from productos where activo and ${condicion}`, params)
  return rows[0].n
}

/** Verifica que los valores estén ordenados (asc o desc). */
function ordenados(valores, sentido) {
  return valores.every((v, i) => i === 0 || (sentido === 'asc' ? valores[i - 1] <= v : valores[i - 1] >= v))
}

describe('GET /api/productos: paginación', () => {
  it('usa pagina 1 y limite 12 por defecto', async () => {
    const res = await request(app).get('/api/productos')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: TOTAL_PRODUCTOS,
      pagina: 1,
      limite: 12,
      totalPaginas: Math.ceil(TOTAL_PRODUCTOS / 12)
    })
    expect(res.body.items).toHaveLength(12)
    res.body.items.forEach((p) => verificarTarjeta(p, expect))
  })

  it('las páginas no se repiten y la última trae el resto', async () => {
    const [p1, p2] = await Promise.all([
      request(app).get('/api/productos?pagina=1&limite=20'),
      request(app).get('/api/productos?pagina=2&limite=20')
    ])
    const ids1 = new Set(p1.body.items.map((p) => p.id))
    expect(p2.body.items.some((p) => ids1.has(p.id))).toBe(false)

    const ultima = Math.ceil(TOTAL_PRODUCTOS / 48)
    const res = await request(app).get(`/api/productos?pagina=${ultima}&limite=48`)
    expect(res.body.items).toHaveLength(TOTAL_PRODUCTOS - (ultima - 1) * 48)
  })

  it('recorrer todas las páginas entrega cada producto exactamente una vez', async () => {
    const ids = new Set()
    for (let pagina = 1; pagina <= Math.ceil(TOTAL_PRODUCTOS / 48); pagina++) {
      const res = await request(app).get(`/api/productos?pagina=${pagina}&limite=48&orden=precio_asc`)
      res.body.items.forEach((p) => ids.add(p.id))
    }
    expect(ids.size).toBe(TOTAL_PRODUCTOS)
  })

  it('una página fuera de rango responde 200 con items vacíos y el total', async () => {
    const res = await request(app).get('/api/productos?pagina=999')
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
    expect(res.body.total).toBe(TOTAL_PRODUCTOS)
  })

  it('acepta limite 48 y rechaza 49, 0 y valores no numéricos', async () => {
    expect((await request(app).get('/api/productos?limite=48')).body.items).toHaveLength(48)
    for (const q of ['limite=49', 'limite=0', 'limite=abc', 'pagina=0', 'pagina=-2']) {
      const res = await request(app).get(`/api/productos?${q}`)
      expect(res.status, q).toBe(400)
      expect(res.body.error).toMatch(/^El parámetro "(limite|pagina)"/)
    }
  })
})

describe('GET /api/productos: filtros', () => {
  it('filtra por categoría', async () => {
    const { rows } = await pool.query('select id from categorias order by nombre limit 1')
    const categoria = rows[0].id
    const res = await request(app).get(`/api/productos?categoria=${categoria}&limite=48`)
    expect(res.body.total).toBe(await contar('categoria_id = $1', [categoria]))
    expect(res.body.items.every((p) => p.categoria_id === categoria)).toBe(true)
  })

  it('filtra por temporada', async () => {
    const res = await request(app).get(`/api/productos?temporada=${encodeURIComponent('Navidad')}&limite=48`)
    const esperado = await contar("temporada = 'Navidad'")
    expect(esperado).toBeGreaterThan(0)
    expect(res.body.total).toBe(esperado)
    expect(res.body.items.every((p) => p.temporada === 'Navidad')).toBe(true)
  })

  it('filtra por rango de precio', async () => {
    const res = await request(app).get('/api/productos?precio_min=5000&precio_max=10000&limite=48')
    expect(res.body.total).toBe(await contar('precio_venta between 5000 and 10000'))
    expect(res.body.items.every((p) => p.precio_venta >= 5000 && p.precio_venta <= 10000)).toBe(true)

    const soloMin = await request(app).get('/api/productos?precio_min=20000')
    expect(soloMin.body.total).toBe(await contar('precio_venta >= 20000'))
    const soloMax = await request(app).get('/api/productos?precio_max=3000')
    expect(soloMax.body.total).toBe(await contar('precio_venta <= 3000'))
  })

  it('filtra por stock disponible o agotado', async () => {
    const [con, sin] = await Promise.all([
      request(app).get('/api/productos?en_stock=true'),
      request(app).get('/api/productos?en_stock=false&limite=48')
    ])
    expect(sin.body.total).toBe(await contar('stock_actual = 0'))
    expect(sin.body.total).toBeGreaterThan(0)
    expect(con.body.total + sin.body.total).toBe(TOTAL_PRODUCTOS)
    expect(sin.body.items.every((p) => p.stock_actual === 0)).toBe(true)
  })

  it('combina filtros', async () => {
    const { rows } = await pool.query('select id from categorias order by nombre limit 1')
    const res = await request(app).get(
      `/api/productos?categoria=${rows[0].id}&en_stock=true&precio_max=15000&limite=48`
    )
    expect(res.body.total).toBe(
      await contar('categoria_id = $1 and stock_actual > 0 and precio_venta <= 15000', [rows[0].id])
    )
  })

  it('excluye productos inactivos', async () => {
    const { rows } = await pool.query('select id from productos order by sku limit 1')
    await pool.query('update productos set activo = false where id = $1', [rows[0].id])
    try {
      const res = await request(app).get('/api/productos')
      expect(res.body.total).toBe(TOTAL_PRODUCTOS - 1)
    } finally {
      await pool.query('update productos set activo = true where id = $1', [rows[0].id])
    }
  })

  it.each([
    ['categoria=no-es-uuid', /categoria.*UUID/],
    ['precio_min=-5', /precio_min/],
    ['precio_max=barato', /precio_max/],
    ['precio_min=9000&precio_max=1000', /no puede ser mayor/],
    ['en_stock=si', /en_stock.*true o false/],
    ['temporada=' + 'x'.repeat(51), /temporada/]
  ])('responde 400 con ?%s', async (q, mensaje) => {
    const res = await request(app).get(`/api/productos?${q}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })
})

describe('GET /api/productos: orden', () => {
  it('destacado (por defecto) pone primero los destacados', async () => {
    const res = await request(app).get('/api/productos?limite=24')
    const marcas = res.body.items.map((p) => p.destacado)
    expect(marcas.slice(0, TOTAL_DESTACADOS).every(Boolean)).toBe(true)
    expect(marcas.slice(TOTAL_DESTACADOS).some(Boolean)).toBe(false)
  })

  it.each([
    ['precio_asc', 'precio_venta', 'asc'],
    ['precio_desc', 'precio_venta', 'desc'],
    ['stock_desc', 'stock_actual', 'desc']
  ])('%s ordena por %s', async (orden, campo, sentido) => {
    const res = await request(app).get(`/api/productos?orden=${orden}&limite=48`)
    expect(ordenados(res.body.items.map((p) => p[campo]), sentido)).toBe(true)
  })

  it.each([
    ['nombre_asc', 'asc'],
    ['nombre_desc', 'desc']
  ])('%s ordena por nombre según la collation de PostgreSQL', async (orden, sentido) => {
    const res = await request(app).get(`/api/productos?orden=${orden}&limite=48`)
    const { rows } = await pool.query(
      `select id from productos where activo order by nombre ${sentido === 'asc' ? 'asc' : 'desc'}, id limit 48`
    )
    expect(res.body.items.map((p) => p.id)).toEqual(rows.map((r) => r.id))
  })

  it('rechaza un orden fuera de la lista blanca', async () => {
    const res = await request(app).get('/api/productos?orden=' + encodeURIComponent('precio_venta; drop table productos'))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/orden.*destacado, precio_asc/)
  })
})
