/**
 * POST /api/vitals: Web Vitals medidos en el navegador (respaldo de GA4).
 *
 * El frontend los envía con navigator.sendBeacon sin esperar respuesta. Se
 * guardan como histogramas de Prometheus (no en la base de datos) para
 * calcular p75 por métrica, página y escenario de prueba en Grafana.
 *
 * Es un endpoint público: para que nadie pueda crear series sin límite en
 * Prometheus, métrica, página, escenario y calificación se validan contra
 * listas fijas (400 si no coinciden).
 */
import { Router } from 'express'
import { ErrorValidacion, cuerpoObjeto, unoDe } from '../validacion.js'

export const METRICAS_VITALS = Object.freeze(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])
export const PAGINAS_VITALS = Object.freeze([
  'home', 'catalogo', 'producto', 'carrito', 'checkout', 'orden', 'mis_pedidos', 'otra'
])
/** Los mismos escenarios que usa el frontend (src/services/analytics.js). */
export const ESCENARIOS_VITALS = Object.freeze(['real', 'baja', 'normal', 'estres', 'piloto', 'humo'])
export const CALIFICACIONES_VITALS = Object.freeze(['good', 'needs-improvement', 'poor'])

/** Valor máximo aceptado: 60 s para las de tiempo (en ms) y 10 para CLS. */
const MAXIMO = { CLS: 10, otras: 60_000 }

/**
 * @param {{ metricas?: import('../metricas.js').Metricas }} [opciones]
 * @returns {import('express').Router}
 */
export function rutasVitals({ metricas } = {}) {
  const router = Router()

  router.post('/', (req, res) => {
    const cuerpo = cuerpoObjeto(req.body)
    const metrica = unoDe('metrica', cuerpo.metrica, METRICAS_VITALS, undefined)
    if (metrica === undefined) throw new ErrorValidacion('El campo "metrica" es obligatorio')
    const pagina = unoDe('pagina', cuerpo.pagina, PAGINAS_VITALS, 'otra')
    const escenario = unoDe('escenario', cuerpo.escenario, ESCENARIOS_VITALS, 'real')
    const calificacion = unoDe('calificacion', cuerpo.calificacion, CALIFICACIONES_VITALS, undefined)

    const valor = cuerpo.valor
    const maximo = metrica === 'CLS' ? MAXIMO.CLS : MAXIMO.otras
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
      throw new ErrorValidacion(`El campo "valor" debe ser un número entre 0 y ${maximo}`)
    }

    if (metricas) {
      if (metrica === 'CLS') metricas.webVitalsCls.observe({ pagina, escenario }, valor)
      // web-vitals entrega los tiempos en milisegundos; Prometheus usa segundos.
      else metricas.webVitalsSegundos.observe({ metrica, pagina, escenario }, valor / 1000)
      if (calificacion) metricas.webVitalsTotal.inc({ metrica, calificacion, escenario })
    }
    res.status(204).end()
  })

  return router
}
