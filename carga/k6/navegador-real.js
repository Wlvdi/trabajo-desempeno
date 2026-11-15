/**
 * Usuarios con navegador real (Chromium, módulo k6/browser) en paralelo a la
 * carga HTTP de escenarios.js (guía, sección 6.2.2).
 *
 * k6 HTTP no ejecuta JavaScript: no dispara GA4 ni mide Web Vitals. Estos 1-2
 * navegadores sí lo hacen, marcados con ?escenario=<escenario>, para comparar
 * la experiencia de usuario sin carga y bajo carga (GA4 y POST /api/vitals →
 * Grafana, fila "Experiencia de usuario").
 *
 * Uso (normalmente lo lanza carga/ejecutar.sh con NAVEGADOR=1):
 *   k6 run -e SITIO_URL=https://... -e ESCENARIO=normal -e DURACION=14m carga/k6/navegador-real.js
 *
 * Variables: SITIO_URL (por defecto la VM), ESCENARIO (real), NAVEGADORES (1),
 * DURACION (5m), SALIDA_JSON.
 * Requiere Chrome/Chromium instalado en el PC generador.
 */
import { browser } from 'k6/browser'
import { check, sleep } from 'k6'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js'

const SITIO = (__ENV.SITIO_URL || 'https://subligol-utem.chilecentral.cloudapp.azure.com').replace(/\/+$/, '')
const ESCENARIO = (__ENV.ESCENARIO || 'real').toLowerCase()

export const options = {
  scenarios: {
    navegador: {
      executor: 'constant-vus',
      vus: Number(__ENV.NAVEGADORES || 1),
      duration: __ENV.DURACION || '5m',
      options: { browser: { type: 'chromium' } }
    }
  },
  tags: { escenario: ESCENARIO, generador: 'navegador' },
  summaryTrendStats: ['avg', 'med', 'p(75)', 'p(90)', 'p(95)', 'max', 'count']
}

/** Pausa de lectura entre páginas. */
const pausa = (min, max) => sleep(min + Math.random() * (max - min))

/**
 * Recorrido de un usuario real: home → catálogo → producto → agregar → carrito.
 * Cada página se carga completa (goto), así cada una mide su LCP, FCP y TTFB.
 */
export default async function () {
  const contexto = await browser.newContext()
  const pagina = await contexto.newPage()
  try {
    // ?escenario= queda guardado en sessionStorage y viaja con todos los eventos.
    await pagina.goto(`${SITIO}/?escenario=${ESCENARIO}`, { waitUntil: 'networkidle' })
    check(await pagina.title(), { 'home cargó': (t) => t.length > 0 })
    pausa(2, 4)

    await pagina.goto(`${SITIO}/catalogo`, { waitUntil: 'networkidle' })
    const enlace = pagina.locator('a[href^="/producto/"]').first()
    const destino = await enlace.getAttribute('href')
    pausa(2, 4)

    if (destino) {
      await pagina.goto(`${SITIO}${destino}`, { waitUntil: 'networkidle' })
      pausa(1, 3)
      // XPath: k6/browser no admite el selector :has-text() de Playwright.
      const boton = pagina.locator('//button[contains(normalize-space(.), "Agregar al carrito")]').first()
      if (await boton.isVisible()) {
        await boton.click() // interacción: permite medir INP
        await pagina.waitForTimeout(1500)
      }
      await pagina.goto(`${SITIO}/carrito`, { waitUntil: 'networkidle' })
      check(pagina.url(), { 'carrito cargó': (u) => u.includes('/carrito') })
    }
    // Pasar a segundo plano entrega el CLS e INP finales (web-vitals los reporta al ocultar la página).
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    pausa(2, 4)
  } finally {
    await pagina.close()
    await contexto.close()
  }
}

export function handleSummary(data) {
  const salida = __ENV.SALIDA_JSON || `carga/resultados/navegador-${ESCENARIO}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [salida]: JSON.stringify(data, null, 2)
  }
}
