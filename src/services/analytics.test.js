// src/services/analytics.test.js
// Tests de la integración con GA4 y Web Vitals (entorno Node, navegador simulado).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// web-vitals no funciona en Node: se reemplaza por funciones que guardan el callback.
const callbacksVitals = {}
vi.mock('web-vitals', () => {
  const registrar = (nombre) => (cb) => {
    callbacksVitals[nombre] = cb
  }
  return {
    onLCP: registrar('LCP'),
    onINP: registrar('INP'),
    onCLS: registrar('CLS'),
    onFCP: registrar('FCP'),
    onTTFB: registrar('TTFB')
  }
})

/** Navegador mínimo: window, document, navigator y sessionStorage. */
function simularNavegador({ url = 'http://localhost:5173/catalogo' } = {}) {
  const ubicacion = new URL(url)
  const almacen = new Map()
  const scripts = []
  globalThis.window = {
    location: { href: ubicacion.href, search: ubicacion.search, pathname: ubicacion.pathname },
    sessionStorage: {
      getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
      setItem: (k, v) => almacen.set(k, String(v))
    }
  }
  globalThis.document = {
    title: 'Subligol',
    head: { appendChild: (s) => scripts.push(s) },
    getElementById: () => null,
    createElement: () => ({})
  }
  const balizas = []
  vi.stubGlobal('navigator', {
    sendBeacon: (destino, cuerpo) => {
      balizas.push({ destino, cuerpo })
      return true
    }
  })
  return { scripts, balizas, almacen }
}

/** Importa una copia nueva del módulo (su estado interno se reinicia). */
async function cargarAnalitica() {
  vi.resetModules()
  return import('./analytics')
}

/** Eventos enviados con gtag('event', nombre, params) a dataLayer. */
const eventos = () =>
  (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === 'event').map(([, nombre, params]) => ({ nombre, params }))

const evento = (nombre) => eventos().find((e) => e.nombre === nombre)?.params

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', '')
})

afterEach(() => {
  delete globalThis.window
  delete globalThis.document
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('initGA', () => {
  it('sin ID no carga gtag.js ni define window.gtag, pero sí mide Web Vitals', async () => {
    const { scripts } = simularNavegador()
    const ga = await cargarAnalitica()
    ga.initGA({ id: '', debug: false })
    expect(scripts).toHaveLength(0)
    expect(window.gtag).toBeUndefined()
    expect(typeof callbacksVitals.LCP).toBe('function')
    // emitir sin gtag no falla
    expect(() => ga.trackSearch('taza')).not.toThrow()
  })

  it('con ID carga el script y configura sin page_view automático', async () => {
    const { scripts } = simularNavegador()
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-PRUEBA123')
    const config = window.dataLayer.map((a) => Array.from(a)).find((a) => a[0] === 'config')
    expect(config).toEqual(['config', 'G-PRUEBA123', { send_page_view: false }])
  })

  it('debug_mode se activa solo si se pide', async () => {
    simularNavegador()
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: true })
    const config = window.dataLayer.map((a) => Array.from(a)).find((a) => a[0] === 'config')
    expect(config[2]).toEqual({ send_page_view: false, debug_mode: true })
  })

  it('con debug activo, cada evento lleva debug_mode: true (DebugView)', async () => {
    simularNavegador()
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: true })
    ga.trackPageView('/catalogo', 'Catálogo')
    ga.trackSearch('taza')
    expect(eventos().map((e) => e.params.debug_mode)).toEqual([true, true])
  })

  it('una copia nueva del módulo (recarga en caliente de Vite) conserva debug_mode y escenario', async () => {
    simularNavegador({ url: 'http://localhost:5173/?escenario=normal' })
    const original = await cargarAnalitica()
    original.initGA({ id: 'G-PRUEBA123', debug: true })
    const recargado = await cargarAnalitica() // initGA no se vuelve a ejecutar
    expect(recargado).not.toBe(original)
    recargado.trackSearch('taza')
    expect(evento('search')).toEqual({ search_term: 'taza', debug_mode: true })
    expect(recargado.escenarioPrueba()).toBe('normal')
  })

  it('sin debug, los eventos NO llevan debug_mode (ni siquiera false)', async () => {
    simularNavegador()
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    ga.trackSearch('taza')
    expect(evento('search')).not.toHaveProperty('debug_mode')
  })

  it('se inicializa una sola vez', async () => {
    const { scripts } = simularNavegador()
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    expect(scripts).toHaveLength(1)
  })
})

describe('escenario_prueba', () => {
  it('se toma de ?escenario=, se recuerda y se aplica a todos los eventos con gtag("set")', async () => {
    const { almacen } = simularNavegador({ url: 'http://localhost:5173/?escenario=estres' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    expect(ga.escenarioPrueba()).toBe('estres')
    expect(almacen.get('subligol_escenario_prueba')).toBe('estres')
    const set = window.dataLayer.map((a) => Array.from(a)).find((a) => a[0] === 'set')
    expect(set).toEqual(['set', { escenario_prueba: 'estres' }])
  })

  it('sin parámetro usa el guardado en la visita y, si no hay, "real"', async () => {
    const nav = simularNavegador({ url: 'http://localhost:5173/catalogo' })
    let ga = await cargarAnalitica()
    expect(ga.leerEscenario()).toBe('real')
    nav.almacen.set('subligol_escenario_prueba', 'normal')
    ga = await cargarAnalitica()
    expect(ga.leerEscenario()).toBe('normal')
  })

  it('un escenario desconocido se ignora', async () => {
    simularNavegador({ url: 'http://localhost:5173/?escenario=<script>' })
    const ga = await cargarAnalitica()
    expect(ga.leerEscenario()).toBe('real')
  })
})

describe('Web Vitals', () => {
  it('envía el evento web_vitals con el formato de la guía y el respaldo a /api/vitals', async () => {
    const { balizas } = simularNavegador({ url: 'http://localhost:5173/producto/abc?escenario=normal' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    callbacksVitals.LCP({ name: 'LCP', value: 1834.6, rating: 'good', id: 'v1-1' })

    expect(evento('web_vitals')).toEqual({
      metric_name: 'LCP',
      metric_value: 1835,
      metric_rating: 'good',
      metric_id: 'v1-1',
      escenario_prueba: 'normal',
      non_interaction: true
    })
    expect(balizas).toHaveLength(1)
    expect(balizas[0].destino).toBe('/api/vitals')
    expect(JSON.parse(await balizas[0].cuerpo.text())).toEqual({
      metrica: 'LCP', valor: 1834.6, calificacion: 'good', pagina: 'producto', escenario: 'normal'
    })
  })

  it('CLS se escala ×1000 en GA4 y se envía sin escalar a la API', async () => {
    const { balizas } = simularNavegador({ url: 'http://localhost:5173/' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    callbacksVitals.CLS({ name: 'CLS', value: 0.123, rating: 'needs-improvement', id: 'v1-2' })
    expect(evento('web_vitals').metric_value).toBe(123)
    expect(JSON.parse(await balizas[0].cuerpo.text())).toMatchObject({ metrica: 'CLS', valor: 0.123, pagina: 'home' })
  })

  it.each([
    ['/', 'home'], ['/catalogo', 'catalogo'], ['/producto/1', 'producto'], ['/carrito', 'carrito'],
    ['/checkout', 'checkout'], ['/orden/1', 'orden'], ['/mis-pedidos', 'mis_pedidos'], ['/admin', 'otra']
  ])('paginaActual(%s) = %s', async (ruta, pagina) => {
    simularNavegador()
    const ga = await cargarAnalitica()
    expect(ga.paginaActual(ruta)).toBe(pagina)
  })
})

describe('Eventos de e-commerce', () => {
  const producto = { id: 'p1', sku: 'TAZ-0001', nombre: 'Taza', categoria_nombre: 'Tazas y Tazones', precio_venta: 4990 }
  const item = { ...producto, cantidad: 2 }
  let ga

  beforeEach(async () => {
    simularNavegador()
    ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
  })

  it('view_item_list con nombre de lista e índice según la paginación', () => {
    ga.trackViewItemList('Catálogo', [producto, { ...producto, sku: 'TAZ-0002' }], { desde: 12 })
    const p = evento('view_item_list')
    expect(p.item_list_name).toBe('Catálogo')
    expect(p.items.map((i) => i.index)).toEqual([12, 13])
    expect(p.items[0]).toMatchObject({ item_id: 'TAZ-0001', item_name: 'Taza', item_category: 'Tazas y Tazones', price: 4990, quantity: 1 })
  })

  it('view_item_list no se envía con una lista vacía', () => {
    ga.trackViewItemList('Catálogo', [])
    expect(evento('view_item_list')).toBeUndefined()
  })

  it('search con el término recortado; vacío no se envía', () => {
    ga.trackSearch('   ')
    ga.trackSearch('  taza mágica ')
    expect(eventos().filter((e) => e.nombre === 'search')).toEqual([{ nombre: 'search', params: { search_term: 'taza mágica' } }])
  })

  it('view_cart con el valor total de los items', () => {
    ga.trackViewCart([item, { ...producto, sku: 'X', precio_venta: 1000, cantidad: 1 }])
    expect(evento('view_cart')).toMatchObject({ currency: 'CLP', value: 4990 * 2 + 1000 })
  })

  it('add_shipping_info y add_payment_info', () => {
    ga.trackAddShippingInfo([item], 9980, 3990)
    ga.trackAddPaymentInfo([item], 13970)
    expect(evento('add_shipping_info')).toMatchObject({ shipping_tier: 'envio_estandar', value: 9980 })
    expect(evento('add_payment_info')).toMatchObject({ payment_type: 'simulado', value: 13970 })
    ga.trackAddShippingInfo([item], 40000, 0)
    expect(eventos().filter((e) => e.nombre === 'add_shipping_info')[1].params.shipping_tier).toBe('envio_gratis')
  })

  it('purchase con transacción, IVA incluido sobre el neto, envío, tipo de cliente e items', () => {
    ga.trackPurchase(
      {
        codigo: 'SUB-2026-500000', total: 15370, neto: 11380, costo_envio: 3990,
        items: [{ producto_id: 'p1', sku: 'TAZ-0001', nombre: 'Taza', cantidad: 2, precio_unitario: 5690 }]
      },
      { tipoCliente: 'invitado' }
    )
    expect(evento('purchase')).toEqual({
      transaction_id: 'SUB-2026-500000',
      value: 15370,
      tax: 1817, // 11380 × 19 / 119
      shipping: 3990,
      currency: 'CLP',
      tipo_cliente: 'invitado',
      items: [{ item_id: 'TAZ-0001', item_name: 'Taza', price: 5690, quantity: 2 }]
    })
  })

  it('login y sign_up con method "email"', () => {
    ga.trackLogin()
    ga.trackSignUp()
    expect(evento('login')).toEqual({ method: 'email' })
    expect(evento('sign_up')).toEqual({ method: 'email' })
  })

  it('una vista repetida idéntica en menos de 1 s se envía una sola vez (React.StrictMode)', () => {
    ga.trackViewItem(producto)
    ga.trackViewItem(producto)
    expect(eventos().filter((e) => e.nombre === 'view_item')).toHaveLength(1)
  })

  it('una vista repetida después de 1 s sí se vuelve a enviar', () => {
    vi.useFakeTimers()
    try {
      ga.trackViewItem(producto)
      vi.advanceTimersByTime(1500)
      ga.trackViewItem(producto)
      expect(eventos().filter((e) => e.nombre === 'view_item')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('las acciones nunca se descartan aunque se repitan (dos clics = dos add_to_cart)', () => {
    ga.trackAddToCart(producto, 1)
    ga.trackAddToCart(producto, 1)
    expect(eventos().filter((e) => e.nombre === 'add_to_cart')).toHaveLength(2)
  })

  it('remove_from_cart acepta varios items (vaciar carrito) y suma su valor', () => {
    ga.trackRemoveFromCart([item, { ...producto, sku: 'X', precio_venta: 1000, cantidad: 3 }])
    const p = evento('remove_from_cart')
    expect(p.value).toBe(4990 * 2 + 1000 * 3)
    expect(p.items.map((i) => i.quantity)).toEqual([2, 3])
  })

  it('datos incompletos no rompen el envío (sin NaN, valores por defecto)', () => {
    ga.trackAddToCart({ id: 'p9' }, 1)
    expect(evento('add_to_cart')).toEqual({
      currency: 'CLP', value: 0,
      items: [{ item_id: 'p9', item_name: 'Producto sin nombre', price: 0, quantity: 1 }]
    })
    expect(() => ga.trackRemoveFromCart(undefined)).not.toThrow()
    expect(() => ga.trackViewCart(undefined)).not.toThrow()
  })

  it('un error dentro de gtag no se propaga a la tienda', () => {
    const original = window.gtag
    window.gtag = () => {
      throw new Error('gtag roto')
    }
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => ga.trackLogin()).not.toThrow()
      expect(aviso).toHaveBeenCalled()
    } finally {
      window.gtag = original
      aviso.mockRestore()
    }
  })

  it('ningún evento incluye datos personales', () => {
    ga.trackPurchase({ codigo: 'SUB-1', total: 1000, neto: 1000, costo_envio: 0, cliente_email: 'a@b.cl', items: [] })
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/@/)
  })
})

describe('Tráfico interno (/admin)', () => {
  it('esRutaInterna reconoce /admin y sus subrutas, y nada más', async () => {
    const { esRutaInterna } = await cargarAnalitica()
    expect(esRutaInterna('/admin')).toBe(true)
    expect(esRutaInterna('/admin/')).toBe(true)
    expect(esRutaInterna('/admin/inventario')).toBe(true)
    expect(esRutaInterna('/administracion')).toBe(false)
    expect(esRutaInterna('/catalogo')).toBe(false)
    expect(esRutaInterna('/')).toBe(false)
    expect(esRutaInterna(undefined)).toBe(false)
  })

  it('en /admin no se envía page_view ni ningún otro evento', async () => {
    simularNavegador({ url: 'http://localhost:5173/admin' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    ga.trackPageView('/admin', 'Panel')
    ga.trackLogin()
    ga.trackSearch('taza')
    expect(eventos()).toEqual([])
  })

  it('trackPageView descarta una ruta /admin aunque la ubicación sea de la tienda', async () => {
    simularNavegador({ url: 'http://localhost:5173/catalogo' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    ga.trackPageView('/admin?tab=ventas', 'Panel')
    expect(evento('page_view')).toBeUndefined()
  })

  it('en /admin tampoco se envían Web Vitals (ni a GA4 ni a /api/vitals)', async () => {
    const { balizas } = simularNavegador({ url: 'http://localhost:5173/admin' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    callbacksVitals.LCP({ name: 'LCP', value: 900, rating: 'good', id: 'v1-9' })
    expect(evento('web_vitals')).toBeUndefined()
    expect(balizas).toHaveLength(0)
  })

  it('en la tienda sí se envían page_view y los demás eventos', async () => {
    simularNavegador({ url: 'http://localhost:5173/catalogo' })
    const ga = await cargarAnalitica()
    ga.initGA({ id: 'G-PRUEBA123', debug: false })
    ga.trackPageView('/catalogo', 'Catálogo')
    ga.trackLogin()
    expect(evento('page_view')).toMatchObject({ page_path: '/catalogo' })
    expect(evento('login')).toEqual({ method: 'email' })
  })
})
