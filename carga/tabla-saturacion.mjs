#!/usr/bin/env node
/**
 * Tabla de saturación de una prueba de estrés (guía, tabla 6.3 y sección 6.5).
 *
 * Por cada meseta (escalón de sesiones/s ofrecidas) cruza:
 *  - el CLIENTE (k6, <prefijo>.csv.gz): sesiones/s y peticiones/s logradas,
 *    p50/p95/p99, % de peticiones fallidas y sus códigos, VUs, descartadas;
 *  - el SERVIDOR (<prefijo>.servidor.csv): CPU de la VM y de api/db,
 *    pool en espera, event loop, argon2, p95 del servidor.
 * Usa solo el centro de cada meseta (descarta los primeros 20 s tras la subida).
 *
 * Uso:
 *   node carga/tabla-saturacion.mjs carga/resultados/ESTRES/estres_2026-11-15_1015
 *   (sin extensión; también acepta el .meta.json)
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import readline from 'node:readline'

const prefijo = (process.argv[2] || '').replace(/\.(meta\.json|csv\.gz|resumen\.json)$/, '')
if (!prefijo || !existsSync(`${prefijo}.meta.json`)) {
  console.error('Uso: node carga/tabla-saturacion.mjs <prefijo de la prueba de estrés>')
  process.exit(2)
}
const meta = JSON.parse(readFileSync(`${prefijo}.meta.json`, 'utf8'))
const escalones = (meta.estres_escalones || '20,50,100,150').split(',').map(Number)
const segundos = (d) => {
  const m = /^(?:(\d+)m)?(?:(\d+)s)?$/.exec(d || '')
  return m ? Number(m[1] || 0) * 60 + Number(m[2] || 0) : 150
}
const MESETA = segundos(meta.estres_meseta || '2m30s')
const CALENTAMIENTO = 60
const SUBIDA = 30
const DESCARTE = 20 // segundos iniciales de cada meseta que no se usan (transición)

// --- Cliente: CSV crudo de k6 -------------------------------------------------
const peticiones = []
const sesiones = []
const vus = []
const descartadas = []
let t0 = Infinity
let cab = null
const rl = readline.createInterface({ input: createReadStream(`${prefijo}.csv.gz`).pipe(createGunzip()) })
for await (const linea of rl) {
  const c = linea.split(',')
  if (!cab) { cab = c; continue }
  const f = Object.fromEntries(cab.map((h, i) => [h, c[i]]))
  const ts = Number(f.timestamp)
  if (f.metric_name === 'http_req_duration') {
    if (!/fase=medicion/.test(f.extra_tags)) continue
    t0 = Math.min(t0, ts)
    peticiones.push({ ts, dur: Number(f.metric_value), falla: f.expected_response === 'false', cod: f.error_code || f.status })
  } else if (f.metric_name === 'iterations' && /fase=medicion/.test(f.extra_tags)) sesiones.push(ts)
  else if (f.metric_name === 'vus') vus.push([ts, Number(f.metric_value)])
  else if (f.metric_name === 'dropped_iterations') descartadas.push(ts)
}
// t0 = primera petición de la medición ≈ fin del calentamiento.
const inicioMedicion = t0

// --- Servidor: servidor.csv ----------------------------------------------------
const servidor = existsSync(`${prefijo}.servidor.csv`)
  ? (() => {
      const [h, ...filas] = readFileSync(`${prefijo}.servidor.csv`, 'utf8').trim().split('\n')
      const cols = h.split(',')
      return filas.map((l) => {
        const v = l.split(',')
        const o = Object.fromEntries(cols.map((c, i) => [c, v[i] === '' ? NaN : Number(v[i])]))
        o.ts = Date.parse(v[0]) / 1000
        return o
      })
    })()
  : []

const pct = (xs, p) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '–')

console.log(`### Saturación: ${prefijo.split('/').pop()} (${meta.repeticion || ''})`)
console.log()
console.log(`Escalones ${escalones.join(', ')} sesiones/s · mesetas de ${MESETA} s (se usan los últimos ${MESETA - DESCARTE} s) · factor de pausas ${meta.factor_pausas ?? 1} · máx. ${meta.max_vus ?? 1000} VUs`)
console.log()
console.log('| Ofrecido (ses/s) | Logrado (ses/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error (%) | Errores (código: n) | VUs | Descartadas | CPU VM (%) | CPU api / db (% 1 núcleo) | Pool en espera | Event loop p99 (ms) | argon2 p95 (ms) |')
console.log('|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---:|---:|---:|')
escalones.forEach((ofrecido, i) => {
  const ini = inicioMedicion + SUBIDA + i * (SUBIDA + MESETA) + DESCARTE
  const fin = inicioMedicion + SUBIDA + i * (SUBIDA + MESETA) + MESETA
  const dur = fin - ini
  const p = peticiones.filter((x) => x.ts >= ini && x.ts < fin)
  if (p.length === 0) return
  const fallas = p.filter((x) => x.falla)
  const codigos = {}
  for (const x of fallas) codigos[x.cod] = (codigos[x.cod] || 0) + 1
  const s = servidor.filter((x) => x.ts >= ini && x.ts <= fin)
  const col = (c) => prom(s.map((x) => x[c]).filter(Number.isFinite))
  const maxCol = (c) => Math.max(...s.map((x) => x[c]).filter(Number.isFinite))
  console.log(
    `| ${ofrecido} | ${f(sesiones.filter((t) => t >= ini && t < fin).length / dur, 1)} | ${f(p.length / dur, 1)} | ` +
      `${f(pct(p.map((x) => x.dur), 0.5))} | ${f(pct(p.map((x) => x.dur), 0.95))} | ${f(pct(p.map((x) => x.dur), 0.99))} | ` +
      `${f((100 * fallas.length) / p.length, 1)} | ${Object.entries(codigos).map(([c, n]) => `${c}: ${n}`).join(', ') || '–'} | ` +
      `${f(Math.max(...vus.filter(([t]) => t >= ini && t < fin).map(([, v]) => v)))} | ${descartadas.filter((t) => t >= ini && t < fin).length} | ` +
      `${f(col('cpu_vm_pct'))} | ${f(col('cpu_api_pct'))} / ${f(col('cpu_db_pct'))} | ${f(maxCol('pool_en_espera'))} | ${f(col('eventloop_p99_ms'), 1)} | ${f(col('argon2_verificar_p95_ms'))} |`
  )
})
console.log()
console.log('Criterio de saturación (guía 6.5): primera meseta con p95 > 800 ms, o error > 1 %, o logrado < 90 % de lo ofrecido.')
