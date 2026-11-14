/**
 * Tests de las métricas de la API (prom-client).
 * - Unitarios con pool falso: etiquetas de ruta, gauges del pool, /metrics.
 * - Integración con subligol_test: contadores de login y de compras.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { crearApp } from '../src/app.js'
import { crearMetricas, crearAppMetricas, RUTA_NO_ENCONTRADA } from '../src/metricas.js'
import { firmarToken } from '../src/seguridad/tokens.js'
import { prepararCatalogo } from './ayudantes.js'

const poolFalso = {
  query: async () => ({ rows: [{}] }),
  totalCount: 7,
  idleCount: 3,
  waitingCount: 2,
  options: { max: 10 }
}

/** Lee el valor de una serie desde el registro (o undefined si no existe). */
async function valor(registro, nombre, etiquetas = {}) {
  const metrica = await registro.getSingleMetric(nombre)?.get()
  const serie = metrica?.values.find(
    (v) => v.metricName !== `${nombre}_sum` && Object.entries(etiquetas).every(([k, x]) => v.labels[k] === x)
  )
  return serie?.value
}

/** Cantidad de observaciones del histograma HTTP para una ruta y estado. */
async function conteoHttp(registro, ruta, estado) {
  const metrica = await registro.getSingleMetric('http_request_duration_seconds').get()
  return metrica.values.find(
    (v) => v.metricName === 'http_request_duration_seconds_count' && v.labels.ruta === ruta && v.labels.estado === estado
  )?.value ?? 0
}

describe('crearMetricas', () => {
  it('cada llamada usa su propio registro (sin choques de nombres)', () => {
    const a = crearMetricas({ pool: poolFalso, predeterminadas: false })
    const b = crearMetricas({ pool: poolFalso, predeterminadas: false })
    expect(a.registro).not.toBe(b.registro)
  })

  it('incluye las métricas predeterminadas de Node (event loop, CPU, heap)', async () => {
    const { registro } = crearMetricas({ pool: poolFalso })
    const texto = await registro.metrics()
    for (const nombre of ['process_cpu_seconds_total', 'nodejs_eventloop_lag_p99_seconds', 'nodejs_heap_size_used_bytes']) {
      expect(texto).toContain(nombre)
    }
  })

  it('las métricas del pool reflejan sus contadores al momento del scrape', async () => {
    const { registro } = crearMetricas({ pool: poolFalso, predeterminadas: false })
    expect(await valor(registro, 'api_pg_pool_conexiones', { estado: 'total' })).toBe(7)
    expect(await valor(registro, 'api_pg_pool_conexiones', { estado: 'libres' })).toBe(3)
    expect(await valor(registro, 'api_pg_pool_conexiones', { estado: 'en_espera' })).toBe(2)
    expect(await valor(registro, 'api_pg_pool_maximo')).toBe(10)
    poolFalso.waitingCount = 5
    expect(await valor(registro, 'api_pg_pool_conexiones', { estado: 'en_espera' })).toBe(5)
    poolFalso.waitingCount = 2
  })

  it('los contadores de negocio parten en 0 con todas sus etiquetas', async () => {
    const { registro } = crearMetricas({ predeterminadas: false })
    for (const resultado of ['ok', 'fallido']) expect(await valor(registro, 'api_logins_total', { resultado })).toBe(0)
    for (const resultado of ['ok', 'sin_stock', 'carrito_vacio', 'error']) {
      expect(await valor(registro, 'api_compras_total', { resultado })).toBe(0)
    }
  })
})

describe('Middleware de medición HTTP', () => {
  const metricas = crearMetricas({ pool: poolFalso, predeterminadas: false })
  const app = crearApp({ pool: poolFalso, metricas })

  it('etiqueta la ruta con la plantilla, no con el id', async () => {
    await request(app).get('/api/productos/no-es-uuid')
    await request(app).get('/api/productos/otro-id')
    expect(await conteoHttp(metricas.registro, '/api/productos/:id', '404')).toBe(2)
  })

  it('etiqueta la raíz de un router con su prefijo', async () => {
    await request(app).get('/api/salud')
    expect(await conteoHttp(metricas.registro, '/api/salud', '200')).toBe(1)
  })

  it('las rutas inexistentes se agrupan en "no_encontrada"', async () => {
    await request(app).get('/api/no-existe/1')
    await request(app).get('/api/no-existe/2')
    expect(await conteoHttp(metricas.registro, RUTA_NO_ENCONTRADA, '404')).toBe(2)
  })

  it('un rechazo de un middleware del router queda con el prefijo', async () => {
    await request(app).get('/api/carrito').set('Authorization', 'Bearer no-es-token')
    expect(await conteoHttp(metricas.registro, '/api/carrito', '401')).toBe(1)
  })

  it('mide también las peticiones con JSON mal formado', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{ mal')
    expect(await conteoHttp(metricas.registro, RUTA_NO_ENCONTRADA, '400')).toBe(1)
  })

  it('peticiones en curso vuelve a 0 al terminar', async () => {
    await request(app).get('/api/salud')
    expect(await valor(metricas.registro, 'http_peticiones_en_curso')).toBe(0)
  })
})

describe('Servidor de métricas', () => {
  it('GET /metrics responde en la app de métricas con el formato de Prometheus', async () => {
    const metricas = crearMetricas({ pool: poolFalso, predeterminadas: false })
    const res = await request(crearAppMetricas(metricas.registro)).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.text).toContain('# TYPE http_request_duration_seconds histogram')
    expect(res.text).toContain('api_pg_pool_conexiones{estado="en_espera"} 2')
  })

  it('/metrics NO existe en la API pública', async () => {
    const res = await request(crearApp({ pool: poolFalso })).get('/metrics')
    expect(res.status).toBe(404)
  })
})

describe('Contadores de negocio (integración)', () => {
  let pool
  let app
  let metricas
  let datos

  beforeAll(async () => {
    ;({ pool, datos } = await prepararCatalogo())
    metricas = crearMetricas({ pool, predeterminadas: false })
    app = crearApp({ pool, pagoMock: true, metricas })
  }, 120_000)

  afterAll(async () => {
    await pool.end()
  })

  it('cuenta logins ok y fallidos y mide argon2 al verificar', async () => {
    await request(app).post('/api/auth/login').send({ email: 'test001@ejemplo.cl', contrasena: 'clave-cliente-test' })
    await request(app).post('/api/auth/login').send({ email: 'test001@ejemplo.cl', contrasena: 'incorrecta' })
    await request(app).post('/api/auth/login').send({ email: 'nadie@ejemplo.cl', contrasena: 'incorrecta' })
    expect(await valor(metricas.registro, 'api_logins_total', { resultado: 'ok' })).toBe(1)
    expect(await valor(metricas.registro, 'api_logins_total', { resultado: 'fallido' })).toBe(2)
    const histo = await metricas.registro.getSingleMetric('api_contrasenas_duracion_segundos').get()
    const conteo = histo.values.find(
      (v) => v.metricName === 'api_contrasenas_duracion_segundos_count' && v.labels.operacion === 'verificar'
    )
    expect(conteo.value).toBe(3)
  })

  it('cuenta compras ok, carrito vacío y sin stock', async () => {
    const token = firmarToken({ id: datos.clientes[10].id, rol: 'cliente' })
    const auth = { Authorization: `Bearer ${token}` }
    const despacho = {
      nombre: 'Ana', apellido: 'Rojas', telefono: '+56912345678',
      region: 'Región Metropolitana', comuna: 'Ñuñoa', direccion: 'Av. Siempre Viva 742'
    }
    const comprar = () => request(app).post('/api/checkout').set(auth).send({ medio_pago: 'mock', despacho })

    const { rows } = await pool.query('select id from productos where activo and stock_actual >= 5 order by sku limit 1')
    const productoId = rows[0].id

    await request(app).post('/api/carrito/items').set(auth).send({ producto_id: productoId, cantidad: 1 })
    expect((await comprar()).status).toBe(201)
    expect((await comprar()).status).toBe(400) // carrito vacío

    await request(app).post('/api/carrito/items').set(auth).send({ producto_id: productoId, cantidad: 2 })
    await pool.query('update productos set stock_actual = 1 where id = $1', [productoId])
    expect((await comprar()).status).toBe(409)

    expect(await valor(metricas.registro, 'api_compras_total', { resultado: 'ok' })).toBe(1)
    expect(await valor(metricas.registro, 'api_compras_total', { resultado: 'carrito_vacio' })).toBe(1)
    expect(await valor(metricas.registro, 'api_compras_total', { resultado: 'sin_stock' })).toBe(1)
  })
})

describe('Dashboard de Grafana (infra/grafana/dashboards/subligol.json)', async () => {
  const { readFile } = await import('node:fs/promises')
  const ruta = new URL('../../infra/grafana/dashboards/subligol.json', import.meta.url)
  const dashboard = JSON.parse(await readFile(ruta, 'utf8'))
  const paneles = dashboard.panels.filter((p) => p.type !== 'row')

  it('tiene uid fijo y paneles con consultas a la fuente "prometheus"', () => {
    expect(dashboard.uid).toBe('subligol')
    expect(paneles.length).toBeGreaterThanOrEqual(20)
    for (const p of paneles) {
      expect(p.targets.length).toBeGreaterThan(0)
      for (const t of p.targets) {
        expect(t.datasource.uid).toBe('prometheus')
        expect(t.expr.trim()).not.toBe('')
      }
    }
  })

  it('los ids de panel son únicos y no se superponen en la grilla', () => {
    const ids = dashboard.panels.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const ocupadas = new Set()
    for (const p of dashboard.panels) {
      const { x, y, w, h } = p.gridPos
      expect(x + w).toBeLessThanOrEqual(24)
      for (let i = x; i < x + w; i++) {
        for (let j = y; j < y + h; j++) {
          const celda = `${i},${j}`
          expect(ocupadas.has(celda)).toBe(false)
          ocupadas.add(celda)
        }
      }
    }
  })

  it('toda métrica propia de la API usada en el dashboard existe en el registro', async () => {
    const { registro } = crearMetricas({ pool: poolFalso })
    const disponibles = new Set((await registro.getMetricsAsJSON()).map((m) => m.name))
    const usadas = new Set(
      paneles.flatMap((p) => p.targets.flatMap((t) => t.expr.match(/\b(?:api|http|nodejs|process)_[a-z0-9_]+/g) ?? []))
    )
    expect(usadas.size).toBeGreaterThan(5)
    for (const nombre of usadas) {
      const base = nombre.replace(/_(bucket|count|sum)$/, '')
      expect(disponibles.has(nombre) || disponibles.has(base), nombre).toBe(true)
    }
  })
})
