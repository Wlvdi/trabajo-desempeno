/**
 * Tests de integración de GET /api/buscar.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo, verificarTarjeta } from './ayudantes.js'

let pool
let app
let datos

beforeAll(async () => {
  ;({ pool, app, datos } = await prepararCatalogo())
}, 120_000)

afterAll(async () => {
  await pool.end()
})

/** Cantidad esperada según SQL independiente (ILIKE en nombre o descripcion). */
async function esperados(texto, categoria) {
  const { rows } = await pool.query(
    `select count(*)::int as n from productos
      where activo and (nombre ilike $1 or descripcion ilike $1)
        and ($2::uuid is null or categoria_id = $2)`,
    [`%${texto}%`, categoria ?? null]
  )
  return rows[0].n
}

const buscar = (query) => request(app).get('/api/buscar').query(query)

describe('GET /api/buscar', () => {
  it('encuentra un producto conocido del seed por su nombre completo', async () => {
    const conocido = datos.productos[0]
    const res = await buscar({ q: conocido.nombre })
    expect(res.status).toBe(200)
    expect(res.body.items[0].id).toBe(conocido.id)
    res.body.items.forEach((p) => verificarTarjeta(p, expect))
  })

  it('no distingue mayúsculas y busca también en la descripción', async () => {
    const conocido = datos.productos[1]
    // La descripción del seed termina en "listo para sublimar.", que no está en el nombre.
    const res = await buscar({ q: 'LISTO PARA SUBLIMAR', limite: 48 })
    expect(res.body.total).toBe(await esperados('listo para sublimar'))
    expect(res.body.total).toBeGreaterThan(0)

    const enMinusculas = await buscar({ q: conocido.nombre.toLowerCase() })
    expect(enMinusculas.body.items.map((p) => p.id)).toContain(conocido.id)
  })

  it('el total coincide con la consulta SQL y los que coinciden en el nombre van primero', async () => {
    const res = await buscar({ q: 'navidad', limite: 48 })
    expect(res.body.total).toBe(await esperados('navidad'))
    expect(res.body.total).toBeGreaterThan(0)
    const enNombre = res.body.items.map((p) => /navidad/i.test(p.nombre))
    const primerSinNombre = enNombre.indexOf(false)
    if (primerSinNombre !== -1) expect(enNombre.slice(primerSinNombre).some(Boolean)).toBe(false)
  })

  it('filtra por categoría', async () => {
    const { rows } = await pool.query('select id from categorias order by nombre limit 1')
    const res = await buscar({ q: 'diseño', categoria: rows[0].id, limite: 48 })
    expect(res.body.total).toBe(await esperados('diseño', rows[0].id))
    expect(res.body.items.every((p) => p.categoria_id === rows[0].id)).toBe(true)
  })

  it('pagina igual que /api/productos', async () => {
    const total = await esperados('diseño')
    const [p1, p2] = await Promise.all([
      buscar({ q: 'diseño', limite: 5, pagina: 1 }),
      buscar({ q: 'diseño', limite: 5, pagina: 2 })
    ])
    expect(p1.body).toMatchObject({ total, pagina: 1, limite: 5, totalPaginas: Math.ceil(total / 5) })
    expect(p1.body.items).toHaveLength(5)
    const ids1 = new Set(p1.body.items.map((p) => p.id))
    expect(p2.body.items.some((p) => ids1.has(p.id))).toBe(false)
  })

  it('sin resultados responde 200 con total 0', async () => {
    const res = await buscar({ q: 'zzzz-no-existe' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], total: 0, pagina: 1, limite: 12, totalPaginas: 0 })
  })

  it('trata % y _ como texto literal, no como comodines', async () => {
    expect((await buscar({ q: '%%' })).body.total).toBe(0)
    expect((await buscar({ q: '__' })).body.total).toBe(0)
  })

  it('excluye productos inactivos', async () => {
    const conocido = datos.productos[0]
    await pool.query('update productos set activo = false where id = $1', [conocido.id])
    try {
      const res = await buscar({ q: conocido.nombre })
      expect(res.body.items.map((p) => p.id)).not.toContain(conocido.id)
    } finally {
      await pool.query('update productos set activo = true where id = $1', [conocido.id])
    }
  })

  it.each([
    [{}, /"q" es obligatorio/],
    [{ q: 'a' }, /entre 2 y 100/],
    [{ q: '   ' }, /"q" es obligatorio/],
    [{ q: 'x'.repeat(101) }, /entre 2 y 100/],
    [{ q: 'taza', categoria: '123' }, /categoria.*UUID/],
    [{ q: 'taza', limite: 49 }, /limite/]
  ])('responde 400 con %o', async (query, mensaje) => {
    const res = await buscar(query)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })
})

describe('GET /api/buscar: filtros y orden del catálogo', () => {
  /** Cantidad esperada con ILIKE + una condición SQL fija del test. */
  async function esperadosCon(texto, condicion, params = []) {
    const { rows } = await pool.query(
      `select count(*)::int as n from productos
        where activo and (nombre ilike $1 or descripcion ilike $1) and ${condicion}`,
      [`%${texto}%`, ...params]
    )
    return rows[0].n
  }

  it('filtra por temporada', async () => {
    const res = await buscar({ q: 'taza', temporada: 'Navidad', limite: 48 })
    expect(res.body.total).toBe(await esperadosCon('taza', "temporada = 'Navidad'"))
    expect(res.body.total).toBeGreaterThan(0)
    expect(res.body.items.every((p) => p.temporada === 'Navidad')).toBe(true)
  })

  it('filtra por rango de precio y por stock', async () => {
    const precio = await buscar({ q: 'diseño', precio_min: 5000, precio_max: 12000, limite: 48 })
    expect(precio.body.total).toBe(await esperadosCon('diseño', 'precio_venta between 5000 and 12000'))
    expect(precio.body.items.every((p) => p.precio_venta >= 5000 && p.precio_venta <= 12000)).toBe(true)

    const [con, sin] = await Promise.all([
      buscar({ q: 'diseño', en_stock: 'true' }),
      buscar({ q: 'diseño', en_stock: 'false', limite: 48 })
    ])
    expect(sin.body.total).toBe(await esperadosCon('diseño', 'stock_actual = 0'))
    expect(con.body.total + sin.body.total).toBe(await esperados('diseño'))
    expect(sin.body.items.every((p) => p.stock_actual === 0)).toBe(true)
  })

  it('acepta los órdenes del catálogo', async () => {
    const asc = await buscar({ q: 'diseño', orden: 'precio_asc', limite: 48 })
    const precios = asc.body.items.map((p) => p.precio_venta)
    expect(precios.every((v, i) => i === 0 || precios[i - 1] <= v)).toBe(true)

    const stock = await buscar({ q: 'diseño', orden: 'stock_desc', limite: 48 })
    const unidades = stock.body.items.map((p) => p.stock_actual)
    expect(unidades.every((v, i) => i === 0 || unidades[i - 1] >= v)).toBe(true)
  })

  it('"relevancia" es el orden por defecto (coincidencias en el nombre primero)', async () => {
    const [porDefecto, relevancia] = await Promise.all([
      buscar({ q: 'navidad', limite: 48 }),
      buscar({ q: 'navidad', orden: 'relevancia', limite: 48 })
    ])
    expect(relevancia.body.items.map((p) => p.id)).toEqual(porDefecto.body.items.map((p) => p.id))
  })

  it.each([
    [{ q: 'taza', orden: 'aleatorio' }, /orden.*relevancia, destacado/],
    [{ q: 'taza', precio_min: 9000, precio_max: 1000 }, /no puede ser mayor/],
    [{ q: 'taza', en_stock: 'si' }, /en_stock/]
  ])('responde 400 con %o', async (query, mensaje) => {
    const res = await buscar(query)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })
})
