/**
 * Métricas de la API para Prometheus (prom-client).
 *
 * Cada llamada a crearMetricas() usa su propio registro: así varias apps
 * (por ejemplo, en los tests) no chocan por nombres repetidos.
 *
 * Las métricas se exponen en un servidor aparte (crearAppMetricas) que
 * escucha en un puerto interno (METRICAS_PUERTO, 9464) NO publicado: solo
 * Prometheus lo lee dentro de la red de Docker.
 */
import express from 'express'
import client from 'prom-client'

/** Ruta usada cuando la petición no coincidió con ningún router. */
export const RUTA_NO_ENCONTRADA = 'no_encontrada'

/** Buckets de latencia HTTP en segundos: de 5 ms a 10 s. */
const BUCKETS_HTTP = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

/** Buckets de argon2 en segundos (un hash típico demora 20-200 ms). */
const BUCKETS_CONTRASENAS = [0.01, 0.025, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2]

/**
 * @typedef {object} PoolObservable
 * @property {number} [totalCount]
 * @property {number} [idleCount]
 * @property {number} [waitingCount]
 * @property {{ max?: number }} [options]
 */

/**
 * Crea el registro y todas las métricas de la API.
 * @param {{ pool?: PoolObservable, predeterminadas?: boolean }} [opciones]
 *   predeterminadas: incluye CPU, memoria, heap y event loop del proceso Node
 */
export function crearMetricas({ pool, predeterminadas = true } = {}) {
  const registro = new client.Registry()
  if (predeterminadas) client.collectDefaultMetrics({ register: registro })

  const duracionHttp = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP en segundos',
    labelNames: ['metodo', 'ruta', 'estado'],
    buckets: BUCKETS_HTTP,
    registers: [registro]
  })

  const peticionesEnCurso = new client.Gauge({
    name: 'http_peticiones_en_curso',
    help: 'Peticiones HTTP que están siendo atendidas en este momento',
    registers: [registro]
  })

  // Se leen del pool en cada scrape (collect), sin costo por petición.
  new client.Gauge({
    name: 'api_pg_pool_conexiones',
    help: 'Conexiones del pool de PostgreSQL por estado (total, libres, en_espera)',
    labelNames: ['estado'],
    registers: [registro],
    collect() {
      this.set({ estado: 'total' }, pool?.totalCount ?? 0)
      this.set({ estado: 'libres' }, pool?.idleCount ?? 0)
      // Peticiones esperando una conexión libre: > 0 indica pool saturado.
      this.set({ estado: 'en_espera' }, pool?.waitingCount ?? 0)
    }
  })

  new client.Gauge({
    name: 'api_pg_pool_maximo',
    help: 'Tamaño máximo del pool de PostgreSQL (PG_POOL_MAX)',
    registers: [registro],
    collect() {
      this.set(pool?.options?.max ?? 0)
    }
  })

  const duracionContrasenas = new client.Histogram({
    name: 'api_contrasenas_duracion_segundos',
    help: 'Duración de argon2id por operación (hash, verificar)',
    labelNames: ['operacion'],
    buckets: BUCKETS_CONTRASENAS,
    registers: [registro]
  })

  const logins = new client.Counter({
    name: 'api_logins_total',
    help: 'Intentos de inicio de sesión por resultado (ok, fallido)',
    labelNames: ['resultado'],
    registers: [registro]
  })

  const compras = new client.Counter({
    name: 'api_compras_total',
    help: 'Intentos de checkout por resultado (ok, sin_stock, carrito_vacio, error)',
    labelNames: ['resultado'],
    registers: [registro]
  })

  // Series en 0 desde el inicio: los gráficos de tasa no quedan vacíos.
  for (const resultado of ['ok', 'fallido']) logins.inc({ resultado }, 0)
  for (const resultado of ['ok', 'sin_stock', 'carrito_vacio', 'error']) compras.inc({ resultado }, 0)

  /**
   * Middleware que mide cada petición. Debe registrarse antes de las rutas.
   * La ruta se etiqueta con la plantilla (/api/productos/:id) para no crear
   * una serie por cada id; ver etiquetarPrefijo().
   * @type {import('express').RequestHandler}
   */
  function medirHttp(req, res, next) {
    const fin = duracionHttp.startTimer()
    peticionesEnCurso.inc()
    // 'close' se emite tanto si la respuesta terminó como si el cliente cortó.
    res.once('close', () => {
      peticionesEnCurso.dec()
      fin({ metodo: req.method, ruta: rutaDe(req), estado: String(res.statusCode) })
    })
    next()
  }

  return { registro, medirHttp, duracionContrasenas, logins, compras }
}

/** @typedef {ReturnType<typeof crearMetricas>} Metricas */

/**
 * Middleware que anota el prefijo fijo con que se montó un router
 * (/api/productos). Junto con req.route.path forma la etiqueta de la ruta.
 * @param {string} prefijo
 * @returns {import('express').RequestHandler}
 */
export function etiquetarPrefijo(prefijo) {
  return (req, _res, next) => {
    req.prefijoMetricas = prefijo
    next()
  }
}

/**
 * Etiqueta de la ruta para las métricas.
 * - Ruta encontrada: prefijo + plantilla (/api/productos/:id).
 * - Rechazada por un middleware del router antes de elegir ruta (por
 *   ejemplo, 401 en /api/carrito) o sin ruta dentro del router: el prefijo.
 * - Fuera de todos los routers: "no_encontrada".
 * @param {import('express').Request & { prefijoMetricas?: string }} req
 * @returns {string}
 */
export function rutaDe(req) {
  if (!req.prefijoMetricas) return RUTA_NO_ENCONTRADA
  const plantilla = typeof req.route?.path === 'string' && req.route.path !== '/' ? req.route.path : ''
  return req.prefijoMetricas + plantilla
}

/**
 * App que solo expone GET /metrics (puerto interno, ver server.js).
 * @param {client.Registry} registro
 * @returns {import('express').Express}
 */
export function crearAppMetricas(registro) {
  const app = express()
  app.disable('x-powered-by')
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registro.contentType)
    res.end(await registro.metrics())
  })
  return app
}
