#!/usr/bin/env node
/**
 * Convierte uno o más resúmenes de k6 (*.resumen.json) en tablas Markdown
 * listas para el informe (guía 6.4.1): por cada ejecución, percentiles de
 * latencia por página, throughput, errores y compras. Solo usa datos de la
 * fase de medición (excluye el calentamiento).
 *
 * Uso:
 *   node carga/tabla-resumen.mjs carga/resultados/NORMAL/normal_*.resumen.json
 *   node carga/tabla-resumen.mjs carga/resultados/BAJA/baja_*.resumen.json > tabla-baja.md
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const PAGINAS = ['home', 'listado', 'busqueda', 'detalle', 'carrito', 'login', 'checkout', 'orden']
const archivos = process.argv.slice(2)
if (archivos.length === 0) {
  console.error('Uso: node carga/tabla-resumen.mjs <archivo.resumen.json> [...]')
  process.exit(2)
}

const ms = (v) => (v === undefined ? '–' : v.toFixed(1))
const pct = (v) => (v === undefined ? '–' : `${(v * 100).toFixed(2)} %`)

/** Fila de latencia (ms) de una submétrica de k6. */
function fila(nombre, m) {
  if (!m || !m.values.count) return null // página sin peticiones en esta ejecución
  const v = m.values
  return `| ${nombre} | ${v.count} | ${ms(v.avg)} | ${ms(v.med)} | ${ms(v['p(90)'])} | ${ms(v['p(95)'])} | ${ms(v['p(99)'])} | ${ms(v.max)} |`
}

for (const archivo of archivos) {
  const datos = JSON.parse(readFileSync(archivo, 'utf8'))
  const m = datos.metrics
  const meta = (() => {
    try {
      return JSON.parse(readFileSync(archivo.replace(/\.resumen\.json$/, '.meta.json'), 'utf8'))
    } catch {
      return {}
    }
  })()
  const duracionS = (datos.state?.testRunDurationMs ?? 0) / 1000

  console.log(`### ${path.basename(archivo, '.resumen.json')}${meta.repeticion ? ` (${meta.repeticion})` : ''}`)
  console.log()
  if (meta.inicio) console.log(`Commit \`${meta.commit}\` · ${meta.inicio} → ${meta.fin ?? '?'} · ${meta.base_url}`)
  console.log()
  console.log('| Página | n | Promedio (ms) | Mediana | p90 | p95 | p99 | Máx |')
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|')
  console.log(fila('**Todas**', m['http_req_duration{fase:medicion}']))
  for (const p of PAGINAS) {
    const f = fila(p, m[`http_req_duration{fase:medicion,pagina:${p}}`])
    if (f) console.log(f)
  }
  console.log()

  const reqs = m.http_reqs?.values
  const iter = m.iterations?.values
  const errores = m['http_req_failed{fase:medicion}']?.values?.rate
  const checks = m['checks{fase:medicion}']?.values?.rate
  const checkout = m['duracion_checkout{fase:medicion}']?.values
  console.log('| Indicador | Valor |')
  console.log('|---|---:|')
  console.log(`| Duración total (incluye calentamiento) | ${duracionS.toFixed(0)} s |`)
  console.log(`| Throughput (peticiones/s, toda la prueba) | ${reqs ? reqs.rate.toFixed(2) : '–'} |`)
  console.log(`| Sesiones (iteraciones) por segundo | ${iter ? iter.rate.toFixed(2) : '–'} |`)
  console.log(`| Tasa de error HTTP (medición) | ${pct(errores)} |`)
  console.log(`| Checks exitosos (medición) | ${pct(checks)} |`)
  console.log(`| Checkout p95 | ${checkout ? `${ms(checkout['p(95)'])} ms` : '–'} |`)
  console.log(`| Compras exitosas / sin stock / carrito vacío | ${m.compras_ok?.values.count ?? 0} / ${m.compras_sin_stock?.values.count ?? 0} / ${m.compras_carrito_vacio?.values.count ?? 0} |`)
  console.log(`| VUs máximos | ${m.vus_max?.values.max ?? '–'} |`)
  console.log(`| Iteraciones descartadas (generador sin VUs) | ${m.dropped_iterations?.values.count ?? 0} |`)
  const umbrales = Object.entries(m).filter(([, x]) => x.thresholds && !Object.keys(x.thresholds).every((t) => t.includes('>=')))
  const fallidos = umbrales.filter(([, x]) => !Object.values(x.thresholds).every((t) => t.ok)).map(([k]) => k)
  console.log(`| Umbrales (SLO) | ${fallidos.length ? `NO cumplidos: ${fallidos.join(', ')}` : 'todos cumplidos'} |`)
  console.log()
}
