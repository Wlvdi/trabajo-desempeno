#!/usr/bin/env node
/**
 * Agrupa las repeticiones (R1, R2, R3…) de un escenario y genera la tabla
 * para el informe (guía 6.4.1): por página, el PROMEDIO de cada percentil
 * entre repeticiones y su RANGO [mínimo–máximo], más indicadores globales y
 * Web Vitals del navegador real. Solo usa la fase de medición.
 *
 * Uso:
 *   node carga/tabla-repeticiones.mjs carga/resultados/BAJA
 *   node carga/tabla-repeticiones.mjs carga/resultados/NORMAL > tabla-normal.md
 *
 * Solo considera ejecuciones con REPETICION = R<n> en su .meta.json
 * (se ignoran humo, piloto y ensayos).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir || !existsSync(dir)) {
  console.error('Uso: node carga/tabla-repeticiones.mjs <carpeta, p. ej. carga/resultados/BAJA>')
  process.exit(2)
}

const leer = (archivo) => (existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : null)

const ejecuciones = readdirSync(dir)
  .filter((f) => f.endsWith('.resumen.json'))
  .sort()
  .map((f) => {
    const base = path.join(dir, f.replace(/\.resumen\.json$/, ''))
    return {
      nombre: path.basename(base),
      meta: leer(`${base}.meta.json`) || {},
      m: leer(`${base}.resumen.json`).metrics,
      nav: leer(`${base}.navegador.json`)?.metrics || {}
    }
  })
  .filter((e) => /^R\d+$/.test(e.meta.repeticion || ''))
  .sort((a, b) => a.meta.repeticion.localeCompare(b.meta.repeticion, undefined, { numeric: true }))

if (ejecuciones.length === 0) {
  console.error(`No hay ejecuciones con REPETICION=R1, R2… en ${dir}`)
  process.exit(1)
}

/** "promedio [mín–máx]" de una lista de números (ignora indefinidos). */
function resumen(valores, decimales = 1) {
  const xs = valores.filter((x) => typeof x === 'number' && Number.isFinite(x))
  if (xs.length === 0) return '–'
  const prom = xs.reduce((s, x) => s + x, 0) / xs.length
  if (xs.length === 1) return prom.toFixed(decimales)
  return `${prom.toFixed(decimales)} [${Math.min(...xs).toFixed(decimales)}–${Math.max(...xs).toFixed(decimales)}]`
}

const reps = ejecuciones.map((e) => e.meta.repeticion).join(', ')
const escenario = ejecuciones[0].meta.escenario || path.basename(dir).toLowerCase()
console.log(`### Escenario \`${escenario}\`: ${ejecuciones.length} repeticiones (${reps})`)
console.log()
console.log('Valores: **promedio [mínimo–máximo]** entre repeticiones, en ms, solo fase de medición.')
console.log()
console.log('| Ejecución | Repetición | Inicio – fin (Chile) | Commit | Umbrales |')
console.log('|---|---|---|---|---|')
for (const e of ejecuciones) {
  const hora = (iso) => (iso ? iso.slice(11, 19) : '?')
  console.log(`| ${e.nombre} | ${e.meta.repeticion} | ${(e.meta.inicio || '').slice(0, 10)} ${hora(e.meta.inicio)} – ${hora(e.meta.fin)} | \`${e.meta.commit}\` | ${e.meta.umbrales_cumplidos ? 'cumplidos' : 'NO cumplidos'} |`)
}
console.log()

// --- Latencia por página ---------------------------------------------------
const filas = [['**Todas**', 'http_req_duration{fase:medicion}']].concat(
  ['home', 'listado', 'busqueda', 'detalle', 'carrito', 'login', 'checkout', 'orden'].map((p) => [
    p,
    `http_req_duration{fase:medicion,pagina:${p}}`
  ])
)
console.log('| Página | n (por repetición) | Promedio | Mediana | p90 | p95 | p99 | Máx |')
console.log('|---|---|---:|---:|---:|---:|---:|---:|')
for (const [nombre, clave] of filas) {
  const v = ejecuciones.map((e) => e.m[clave]?.values).filter((x) => x && x.count > 0)
  if (v.length === 0) continue
  const col = (k) => resumen(v.map((x) => x[k]))
  console.log(`| ${nombre} | ${v.map((x) => x.count).join(' / ')} | ${col('avg')} | ${col('med')} | ${col('p(90)')} | ${col('p(95)')} | ${col('p(99)')} | ${col('max')} |`)
}
console.log()

// --- Indicadores globales --------------------------------------------------
const de = (f) => ejecuciones.map(f)
console.log('| Indicador | Promedio [mín–máx] | Por repetición |')
console.log('|---|---:|---|')
const indicador = (nombre, f, dec = 2, sufijo = '') => {
  const xs = de(f)
  console.log(`| ${nombre} | ${resumen(xs, dec)}${sufijo} | ${xs.map((x) => (typeof x === 'number' ? x.toFixed(dec) : '–')).join(' / ')} |`)
}
indicador('Throughput (peticiones/s, toda la prueba)', (e) => e.m.http_reqs?.values.rate)
indicador('Sesiones por segundo (toda la prueba)', (e) => e.m.iterations?.values.rate, 3)
indicador('Duración media de sesión R+Z (s)', (e) => e.m.iteration_duration?.values.avg / 1000)
indicador('Tasa de error HTTP, medición (%)', (e) => (e.m['http_req_failed{fase:medicion}']?.values.rate ?? 0) * 100)
indicador('Checks exitosos, medición (%)', (e) => (e.m['checks{fase:medicion}']?.values.rate ?? 0) * 100)
indicador('Checkout completo p95 (ms)', (e) => e.m['duracion_checkout{fase:medicion}']?.values['p(95)'], 1)
indicador('Compras exitosas', (e) => e.m.compras_ok?.values.count ?? 0, 0)
indicador('Compras sin stock', (e) => e.m.compras_sin_stock?.values.count ?? 0, 0)
indicador('VUs máximos', (e) => e.m.vus_max?.values.max, 0)
indicador('Iteraciones descartadas', (e) => e.m.dropped_iterations?.values.count ?? 0, 0)
console.log()

// --- Web Vitals del navegador real -------------------------------------------
const vitals = [['TTFB (ms)', 'ttfb', 0], ['FCP (ms)', 'fcp', 0], ['LCP (ms)', 'lcp', 0], ['INP (ms)', 'inp', 0], ['CLS', 'cls', 3]]
const hayNav = ejecuciones.some((e) => Object.keys(e.nav).length > 0)
if (hayNav) {
  console.log('| Web Vital (p75, navegador real) | Promedio [mín–máx] | Por repetición | Muestras |')
  console.log('|---|---:|---|---|')
  for (const [nombre, k, dec] of vitals) {
    const v = de((e) => e.nav[`browser_web_vital_${k}`]?.values)
    if (v.every((x) => !x)) continue
    console.log(`| ${nombre} | ${resumen(v.map((x) => x?.['p(75)']), dec)} | ${v.map((x) => (x ? x['p(75)'].toFixed(dec) : '–')).join(' / ')} | ${v.map((x) => x?.count ?? 0).join(' / ')} |`)
  }
  console.log()
}
