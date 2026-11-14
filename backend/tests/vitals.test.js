/**
 * Tests de POST /api/vitals (Web Vitals de los navegadores → Prometheus).
 * Usan un pool falso: no requieren base de datos.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { crearApp } from '../src/app.js'
import { crearMetricas } from '../src/metricas.js'

const poolFalso = { query: async () => ({ rows: [{}] }) }

function nuevaApp() {
  const metricas = crearMetricas({ pool: poolFalso, predeterminadas: false })
  return { app: crearApp({ pool: poolFalso, metricas }), metricas }
}

/** Cantidad de observaciones (_count) de un histograma para unas etiquetas. */
async function conteo(registro, nombre, etiquetas) {
  const m = await registro.getSingleMetric(nombre).get()
  return m.values
    .filter((v) => v.metricName === `${nombre}_count`)
    .filter((v) => Object.entries(etiquetas).every(([k, x]) => v.labels[k] === x))
    .reduce((s, v) => s + v.value, 0)
}

/** Suma (_sum) de un histograma para unas etiquetas. */
async function suma(registro, nombre, etiquetas) {
  const m = await registro.getSingleMetric(nombre).get()
  return m.values.find(
    (v) => v.metricName === `${nombre}_sum` && Object.entries(etiquetas).every(([k, x]) => v.labels[k] === x)
  )?.value
}

const enviar = (app, cuerpo) => request(app).post('/api/vitals').send(cuerpo)

describe('POST /api/vitals', () => {
  it('registra un LCP en segundos con página y escenario, y cuenta la calificación', async () => {
    const { app, metricas } = nuevaApp()
    const res = await enviar(app, { metrica: 'LCP', valor: 1830, calificacion: 'good', pagina: 'catalogo', escenario: 'normal' })
    expect(res.status).toBe(204)
    expect(res.text).toBe('')
    const etiquetas = { metrica: 'LCP', pagina: 'catalogo', escenario: 'normal' }
    expect(await conteo(metricas.registro, 'api_web_vitals_segundos', etiquetas)).toBe(1)
    expect(await suma(metricas.registro, 'api_web_vitals_segundos', etiquetas)).toBeCloseTo(1.83)
    const total = await metricas.registro.getSingleMetric('api_web_vitals_total').get()
    expect(total.values.find((v) => v.labels.metrica === 'LCP' && v.labels.calificacion === 'good').value).toBe(1)
  })

  it('registra CLS sin convertir unidades en su propio histograma', async () => {
    const { app, metricas } = nuevaApp()
    await enviar(app, { metrica: 'CLS', valor: 0.12, calificacion: 'needs-improvement', pagina: 'home' })
    expect(await conteo(metricas.registro, 'api_web_vitals_cls', { pagina: 'home', escenario: 'real' })).toBe(1)
    expect(await suma(metricas.registro, 'api_web_vitals_cls', { pagina: 'home', escenario: 'real' })).toBeCloseTo(0.12)
    expect(await conteo(metricas.registro, 'api_web_vitals_segundos', {})).toBe(0)
  })

  it('usa pagina "otra" y escenario "real" por defecto; la calificación es opcional', async () => {
    const { app, metricas } = nuevaApp()
    expect((await enviar(app, { metrica: 'TTFB', valor: 120 })).status).toBe(204)
    expect(await conteo(metricas.registro, 'api_web_vitals_segundos', { metrica: 'TTFB', pagina: 'otra', escenario: 'real' }))
      .toBe(1)
  })

  it('acepta el cuerpo que envía sendBeacon (JSON en un Blob application/json)', async () => {
    const { app } = nuevaApp()
    const res = await request(app)
      .post('/api/vitals')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ metrica: 'INP', valor: 80, pagina: 'producto' }))
    expect(res.status).toBe(204)
  })

  it.each([
    [{}, /metrica/],
    [{ metrica: 'XYZ', valor: 1 }, /metrica/],
    [{ metrica: 'LCP', valor: 1, pagina: '/producto/123' }, /pagina/],
    [{ metrica: 'LCP', valor: 1, escenario: 'inventado' }, /escenario/],
    [{ metrica: 'LCP', valor: 1, calificacion: 'excelente' }, /calificacion/],
    [{ metrica: 'LCP', valor: '1200' }, /valor/],
    [{ metrica: 'LCP', valor: -1 }, /valor/],
    [{ metrica: 'LCP', valor: 120_000 }, /valor/],
    [{ metrica: 'CLS', valor: 50 }, /valor/]
  ])('cuerpo inválido %j → 400 sin registrar nada', async (cuerpo, mensaje) => {
    const { app, metricas } = nuevaApp()
    const res = await enviar(app, cuerpo)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
    expect(await conteo(metricas.registro, 'api_web_vitals_segundos', {})).toBe(0)
    expect(await conteo(metricas.registro, 'api_web_vitals_cls', {})).toBe(0)
  })

  it('aparece en /metrics con la ruta /api/vitals', async () => {
    const { app, metricas } = nuevaApp()
    await enviar(app, { metrica: 'FCP', valor: 900 })
    const texto = await metricas.registro.metrics()
    expect(texto).toContain('api_web_vitals_segundos_bucket{le="1",metrica="FCP",pagina="otra",escenario="real"} 1')
    expect(texto).toContain('ruta="/api/vitals"')
  })
})
