/**
 * Dashboard y auditoría del panel: forma de la respuesta y números como número.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { prepararCatalogo } from './ayudantes.js'
import { tokensDePrueba } from './ayudantes-admin.js'

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

const pedir = (ruta, query = {}) => request(app).get(ruta).query(query).set('Authorization', tokens.admin)

describe('GET /api/admin/dashboard', () => {
  it('trae las 4 vistas con números como número', async () => {
    const r = await pedir('/api/admin/dashboard')
    expect(r.status).toBe(200)
    expect(Object.keys(r.body).sort()).toEqual(['balance', 'canales', 'criticos', 'inmovilizado'])

    for (const campo of ['total_productos_activos', 'unidades_totales', 'capital_inmovilizado_costo',
      'valor_total_venta_estimado', 'margen_bruto_potencial']) {
      expect(typeof r.body.inmovilizado[campo], campo).toBe('number')
    }
    for (const campo of ['total_invertido_compras', 'total_recaudado_ventas', 'balance_neto',
      'cantidad_ventas_realizadas', 'cantidad_compras_realizadas']) {
      expect(typeof r.body.balance[campo], campo).toBe('number')
    }
    expect(r.body.canales.length).toBeGreaterThan(0)
    for (const c of r.body.canales) {
      expect(c).toMatchObject({ canal_venta: expect.any(String), cantidad_pedidos: expect.any(Number), total_ingresos: expect.any(Number) })
    }
    for (const p of r.body.criticos) {
      expect(p).toMatchObject({ id: expect.any(String), nombre: expect.any(String), stock_actual: expect.any(Number), stock_minimo: expect.any(Number) })
      expect(['AGOTADO', 'CRITICO']).toContain(p.nivel_alerta)
    }
  })

  it('las cifras coinciden con las tablas', async () => {
    const r = await pedir('/api/admin/dashboard')
    const { rows } = await pool.query(
      `select (select count(*)::int from ventas) as ventas, (select count(*)::int from compras) as compras,
              (select count(*)::int from productos where activo) as activos,
              (select coalesce(sum(total), 0)::float8 from ventas) as recaudado`
    )
    expect(r.body.balance.cantidad_ventas_realizadas).toBe(rows[0].ventas)
    expect(r.body.balance.cantidad_compras_realizadas).toBe(rows[0].compras)
    expect(r.body.inmovilizado.total_productos_activos).toBe(rows[0].activos)
    expect(r.body.balance.total_recaudado_ventas).toBe(rows[0].recaudado)
    const sumaCanales = r.body.canales.reduce((s, c) => s + c.cantidad_pedidos, 0)
    expect(sumaCanales).toBe(rows[0].ventas)
  })

  it('canales ordenados por ingresos y críticos por stock ascendente', async () => {
    const { canales, criticos } = (await pedir('/api/admin/dashboard')).body
    const ingresos = canales.map((c) => c.total_ingresos)
    expect(ingresos).toEqual([...ingresos].sort((a, b) => b - a))
    const stocks = criticos.map((p) => p.stock_actual)
    expect(stocks).toEqual([...stocks].sort((a, b) => a - b))
  })
})

describe('GET /api/admin/auditoria', () => {
  it('devuelve los eventos más recientes con la forma que usa AuditoriaView', async () => {
    const r = await pedir('/api/admin/auditoria', { limite: 20 })
    expect(r.status).toBe(200)
    expect(r.body).toHaveLength(20)
    for (const e of r.body) {
      expect(Object.keys(e).sort()).toEqual(
        ['descripcion', 'detalle', 'entidad_afectada', 'fecha', 'id', 'tipo_evento', 'usuario_responsable'].sort()
      )
    }
    const fechas = r.body.map((e) => new Date(e.fecha).getTime())
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a))
    const conDetalle = r.body.find((e) => e.detalle?.stock_nuevo !== undefined)
    if (conDetalle) expect(typeof conDetalle.detalle.stock_nuevo).toBe('number')
  })

  it('100 por defecto, máximo 500', async () => {
    expect((await pedir('/api/admin/auditoria')).body).toHaveLength(100)
    expect((await pedir('/api/admin/auditoria', { limite: 500 })).body).toHaveLength(500)
    const r = await pedir('/api/admin/auditoria', { limite: 501 })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('El parámetro "limite" debe ser un entero entre 1 y 500')
  })
})
