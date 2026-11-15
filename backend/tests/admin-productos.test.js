/**
 * Productos y categorías del panel de administración.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo } from './ayudantes.js'
import { tokensDePrueba } from './ayudantes-admin.js'

let pool
let app
let tokens
let categoriaId

beforeAll(async () => {
  let datos
  ;({ pool, app, datos } = await prepararCatalogo())
  tokens = tokensDePrueba(datos)
  categoriaId = (await pool.query('select id from categorias order by nombre limit 1')).rows[0].id
}, 120_000)

afterAll(async () => {
  await pool.end()
})

const listar = (query = {}) =>
  request(app).get('/api/admin/productos').query(query).set('Authorization', tokens.admin)
const crear = (cuerpo) => request(app).post('/api/admin/productos').set('Authorization', tokens.admin).send(cuerpo)
const editar = (id, cuerpo) =>
  request(app).patch(`/api/admin/productos/${id}`).set('Authorization', tokens.admin).send(cuerpo)
const activar = (id, activo) =>
  request(app).patch(`/api/admin/productos/${id}/activo`).set('Authorization', tokens.admin).send({ activo })

const NUEVO = {
  sku: 'TEST-ADM-001',
  nombre: 'Taza de prueba del panel',
  descripcion: 'Creada por los tests',
  temporada: 'Navidad',
  costo_unitario: 1500.5,
  precio_venta: 4990,
  stock_actual: 7,
  stock_minimo: 3,
  activo: true
}

describe('GET /api/admin/productos', () => {
  it('incluye los datos internos y los numeric salen como número', async () => {
    const r = await listar({ limite: 5 })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ pagina: 1, limite: 5 })
    expect(r.body.total).toBe(500)
    expect(r.body.totalPaginas).toBe(100)
    const p = r.body.items[0]
    for (const campo of ['costo_unitario', 'stock_minimo', 'activo', 'categoria_id', 'categoria', 'temporada', 'sku']) {
      expect(p).toHaveProperty(campo)
    }
    expect(typeof p.costo_unitario).toBe('number')
    expect(typeof p.precio_venta).toBe('number')
    expect(typeof p.stock_actual).toBe('number')
    expect(p.categoria).toMatchObject({ id: p.categoria_id, nombre: expect.any(String) })
  })

  it('por defecto pagina de a 50 y admite hasta 1000 (todo el seed en una página)', async () => {
    expect((await listar()).body.items).toHaveLength(50)
    const r = await listar({ limite: 1000 })
    expect(r.body.items).toHaveLength(500)
    expect((await listar({ limite: 1001 })).status).toBe(400)
  })

  it('pagina sin repetir', async () => {
    const [p1, p2] = await Promise.all([listar({ limite: 10, pagina: 1 }), listar({ limite: 10, pagina: 2 })])
    const ids = new Set(p1.body.items.map((p) => p.id))
    expect(p2.body.items).toHaveLength(10)
    expect(p2.body.items.some((p) => ids.has(p.id))).toBe(false)
  })

  it('busca por nombre o SKU sin distinguir mayúsculas', async () => {
    const { rows } = await pool.query('select sku, nombre from productos where sku is not null order by id limit 1')
    const porSku = await listar({ busqueda: rows[0].sku.toLowerCase() })
    expect(porSku.body.items.map((p) => p.sku)).toContain(rows[0].sku)
    const palabra = rows[0].nombre.split(' ')[0]
    const porNombre = await listar({ busqueda: palabra.toUpperCase(), limite: 1000 })
    expect(porNombre.body.total).toBeGreaterThan(0)
    for (const p of porNombre.body.items) {
      expect(`${p.nombre} ${p.sku}`.toLowerCase()).toContain(palabra.toLowerCase())
    }
  })

  it('los comodines de LIKE se buscan literales', async () => {
    expect((await listar({ busqueda: '%' })).body.total).toBe(0)
  })

  it('filtra por temporada ("Todas" no filtra)', async () => {
    const r = await listar({ temporada: 'Navidad', limite: 1000 })
    expect(r.body.total).toBeGreaterThan(0)
    expect(r.body.items.every((p) => p.temporada === 'Navidad')).toBe(true)
    expect((await listar({ temporada: 'Todas' })).body.total).toBe(500)
  })

  it('filtra por estado: activos, inactivos, critico y agotado', async () => {
    const { rows } = await pool.query('select id from productos order by id limit 3')
    const [inactivo, agotado, critico] = rows.map((r) => r.id)
    await pool.query('update productos set activo = false where id = $1', [inactivo])
    await pool.query('update productos set stock_actual = 0 where id = $1', [agotado])
    await pool.query('update productos set stock_actual = 2, stock_minimo = 5 where id = $1', [critico])

    const ids = async (estado) => (await listar({ estado, limite: 1000 })).body.items.map((p) => p.id)
    const [activos, inactivos, criticos, agotados] = await Promise.all(
      ['activos', 'inactivos', 'critico', 'agotado'].map(ids)
    )
    expect(inactivos).toContain(inactivo)
    expect(activos).not.toContain(inactivo)
    expect(activos.length + inactivos.length).toBe(500)
    expect(agotados).toContain(agotado)
    // "critico" incluye los agotados (misma definición que el dashboard).
    expect(criticos).toEqual(expect.arrayContaining([agotado, critico]))

    const dashboard = await request(app).get('/api/admin/dashboard').set('Authorization', tokens.admin)
    expect(criticos).toHaveLength(dashboard.body.criticos.length)

    await pool.query('update productos set activo = true where id = $1', [inactivo])
  })

  it('valida los parámetros con 400 en español', async () => {
    const r = await listar({ estado: 'archivados' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/"estado" debe ser uno de: todos, activos, inactivos, critico, agotado/)
    expect((await listar({ pagina: 0 })).status).toBe(400)
  })
})

describe('POST y PATCH /api/admin/productos', () => {
  let creado

  it('crea un producto (201) y audita CREACION_PRODUCTO con el admin', async () => {
    const r = await crear({ ...NUEVO, categoria_id: categoriaId })
    expect(r.status).toBe(201)
    creado = r.body
    expect(creado).toMatchObject({ ...NUEVO, categoria_id: categoriaId, categoria: { id: categoriaId } })

    const { rows } = await pool.query(
      `select usuario_responsable from vista_historial_auditoria
        where tipo_evento = 'CREACION_PRODUCTO' and detalle->>'sku' = $1`,
      [NUEVO.sku]
    )
    expect(rows).toEqual([{ usuario_responsable: 'admin@subligol.cl' }])
  })

  it('aplica valores por defecto (solo nombre)', async () => {
    const r = await crear({ nombre: 'Producto mínimo de prueba' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({
      sku: null, categoria_id: null, categoria: null, temporada: 'General', costo_unitario: 0, precio_venta: 0,
      stock_actual: 0, stock_minimo: 5, activo: true
    })
  })

  it('SKU duplicado → 409', async () => {
    const r = await crear({ ...NUEVO, nombre: 'Otro nombre' })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('Ya existe un producto con el SKU "TEST-ADM-001"')
  })

  it('categoría inexistente → 400', async () => {
    const r = await crear({ nombre: 'Sin categoría real', categoria_id: '00000000-0000-4000-8000-000000000000' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('La categoría indicada no existe')
  })

  it('valida el cuerpo con 400', async () => {
    expect((await crear({})).body.error).toMatch(/"nombre"/)
    expect((await crear({ nombre: 'Ok nombre', precio_venta: '4990' })).status).toBe(400)
    expect((await crear({ nombre: 'Ok nombre', costo_unitario: -1 })).status).toBe(400)
    expect((await crear({ nombre: 'Ok nombre', stock_actual: 1.5 })).status).toBe(400)
  })

  it('edita los campos enviados y conserva el resto', async () => {
    const r = await editar(creado.id, { nombre: 'Taza editada', precio_venta: 5490, sku: null })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ nombre: 'Taza editada', precio_venta: 5490, sku: null, temporada: 'Navidad', stock_actual: 7 })
  })

  it('no permite editar el stock ni un cuerpo vacío', async () => {
    const r = await editar(creado.id, { stock_actual: 100 })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/compras y ventas/)
    expect((await editar(creado.id, {})).body.error).toBe('No hay campos para actualizar')
  })

  it('editar un SKU a uno existente → 409; un producto inexistente → 404', async () => {
    const otro = (await pool.query('select sku from productos where sku is not null limit 1')).rows[0].sku
    expect((await editar(creado.id, { sku: otro })).status).toBe(409)
    expect((await editar('00000000-0000-4000-8000-000000000000', { nombre: 'Nada' })).status).toBe(404)
    expect((await editar('no-es-uuid', { nombre: 'Nada' })).status).toBe(404)
  })

  it('desactivar lo quita de la tienda; reactivar lo devuelve', async () => {
    const off = await activar(creado.id, false)
    expect(off.status).toBe(200)
    expect(off.body.activo).toBe(false)
    expect((await request(app).get(`/api/productos/${creado.id}`)).status).toBe(404)
    const busqueda = await request(app).get('/api/buscar').query({ q: 'Taza editada' })
    expect(busqueda.body.items.map((p) => p.id)).not.toContain(creado.id)

    const on = await activar(creado.id, true)
    expect(on.body.activo).toBe(true)
    expect((await request(app).get(`/api/productos/${creado.id}`)).status).toBe(200)
  })

  it('PATCH /activo exige un booleano', async () => {
    expect((await activar(creado.id, 'false')).status).toBe(400)
  })
})

describe('/api/admin/categorias', () => {
  const crearCategoria = (cuerpo) =>
    request(app).post('/api/admin/categorias').set('Authorization', tokens.admin).send(cuerpo)

  it('lista las categorías con sus conteos como número', async () => {
    const r = await request(app).get('/api/admin/categorias').set('Authorization', tokens.admin)
    expect(r.status).toBe(200)
    expect(r.body.length).toBeGreaterThan(0)
    expect(r.body[0]).toMatchObject({
      id: expect.any(String), nombre: expect.any(String), cantidad_productos: expect.any(Number),
      cantidad_activos: expect.any(Number)
    })
  })

  it('crea una categoría (201) y la tienda la ve', async () => {
    const r = await crearCategoria({ nombre: '  Llaveros  ', descripcion: 'Llaveros sublimados' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ nombre: 'Llaveros', descripcion: 'Llaveros sublimados', cantidad_productos: 0 })
    const tienda = await request(app).get('/api/categorias')
    expect(tienda.body.map((c) => c.nombre)).toContain('Llaveros')
  })

  it('nombre duplicado → 409; sin nombre → 400', async () => {
    const r = await crearCategoria({ nombre: 'Llaveros' })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('Ya existe la categoría "Llaveros"')
    expect((await crearCategoria({ descripcion: 'x' })).status).toBe(400)
  })
})
