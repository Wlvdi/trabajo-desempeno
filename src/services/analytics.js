// src/services/analytics.js
// Google Analytics 4 (gtag.js), eventos de e-commerce y Core Web Vitals.
//
// - ID: VITE_GA_MEASUREMENT_ID. Si no está definido, GA4 NO se carga (los
//   eventos solo se muestran en la consola en desarrollo).
// - debug_mode: activo en `npm run dev` o con VITE_GA_DEBUG=true (DebugView).
// - escenario_prueba: se toma de la URL (?escenario=normal), se recuerda
//   durante la visita y viaja con TODOS los eventos (Fase 2: comparar la
//   experiencia sin carga y bajo carga). Por defecto: "real".
// - Web Vitals: evento único "web_vitals" (guía, sección 6.2.2) y, además,
//   respaldo en la API propia (POST /api/vitals → Prometheus), porque GA4
//   puede descartar tráfico de navegadores automatizados.
// - Ningún evento incluye datos personales (email, nombre ni dirección).
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals'
import { ivaIncluido } from './precios'
import { urlBase } from './api'

const MONEDA = 'CLP'

/** Escenarios válidos de escenario_prueba (los mismos que acepta /api/vitals). */
export const ESCENARIOS = Object.freeze(['real', 'baja', 'normal', 'estres', 'piloto', 'humo'])
const CLAVE_ESCENARIO = 'subligol_escenario_prueba'

let inicializado = false
let escenarioActual = 'real'

/** Entorno de Vite (en los tests puede no existir). */
const env = () => import.meta.env ?? {}

/** Muestra el evento en la consola solo en desarrollo. */
function registrarEnConsola(nombre, parametros) {
  if (env().DEV) console.debug(`[GA4] ${nombre}`, parametros)
}

/**
 * Envía un evento a GA4 (si está cargado).
 * @param {string} nombre
 * @param {Record<string, unknown>} [parametros]
 */
export function emitir(nombre, parametros = {}) {
  registrarEnConsola(nombre, parametros)
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', nombre, parametros)
  }
}

// ---------------------------------------------------------------------------
// Escenario de prueba
// ---------------------------------------------------------------------------

/**
 * Lee ?escenario= de la URL (y lo recuerda en sessionStorage). Un valor
 * desconocido se ignora.
 * @returns {string}
 */
export function leerEscenario() {
  try {
    const desdeUrl = new URLSearchParams(window.location.search).get('escenario')?.toLowerCase()
    if (desdeUrl && ESCENARIOS.includes(desdeUrl)) {
      window.sessionStorage?.setItem(CLAVE_ESCENARIO, desdeUrl)
      return desdeUrl
    }
    const guardado = window.sessionStorage?.getItem(CLAVE_ESCENARIO)
    return guardado && ESCENARIOS.includes(guardado) ? guardado : 'real'
  } catch {
    return 'real'
  }
}

/** Escenario de prueba de esta visita. */
export const escenarioPrueba = () => escenarioActual

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------

/**
 * Carga gtag.js (si hay ID) y empieza a medir Web Vitals. Se llama una vez,
 * antes de renderizar la app (main.jsx), para no perder la primera vista.
 * @param {{ id?: string, debug?: boolean }} [opciones] por defecto, las variables de entorno
 */
export function initGA({
  id = env().VITE_GA_MEASUREMENT_ID,
  debug = Boolean(env().DEV) || env().VITE_GA_DEBUG === 'true'
} = {}) {
  if (typeof window === 'undefined' || inicializado) return
  inicializado = true
  escenarioActual = leerEscenario()

  if (id) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    // escenario_prueba acompaña a todos los eventos siguientes.
    window.gtag('set', { escenario_prueba: escenarioActual })
    window.gtag('config', id, {
      send_page_view: false, // las vistas se envían a mano en cada cambio de ruta (SPA)
      ...(debug ? { debug_mode: true } : {})
    })
    if (!document.getElementById('ga4-script')) {
      const script = document.createElement('script')
      script.id = 'ga4-script'
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
      // Un bloqueador de anuncios impide cargar gtag.js: se avisa en la consola.
      script.onerror = () => console.warn('[GA4] No se pudo cargar gtag.js (¿bloqueador de anuncios?). No llegarán eventos a GA4.')
      document.head.appendChild(script)
    }
    if (env().DEV) {
      console.info(`[GA4] Inicializado con ${id} | debug_mode: ${debug ? 'activo (DebugView)' : 'no'} | escenario_prueba: ${escenarioActual}`)
    }
  } else if (env().DEV) {
    console.info('[GA4] VITE_GA_MEASUREMENT_ID no está definido: GA4 deshabilitado (los eventos solo se muestran aquí).')
  }

  initWebVitals()
}

// ---------------------------------------------------------------------------
// Web Vitals
// ---------------------------------------------------------------------------

/** Páginas que acepta /api/vitals (la etiqueta "pagina" de Prometheus). */
export function paginaActual(ruta = typeof window !== 'undefined' ? window.location.pathname : '/') {
  if (ruta === '/') return 'home'
  if (ruta.startsWith('/catalogo')) return 'catalogo'
  if (ruta.startsWith('/producto/')) return 'producto'
  if (ruta.startsWith('/carrito')) return 'carrito'
  if (ruta.startsWith('/checkout')) return 'checkout'
  if (ruta.startsWith('/orden/')) return 'orden'
  if (ruta.startsWith('/mis-pedidos')) return 'mis_pedidos'
  return 'otra'
}

/**
 * Envía una medición de Web Vitals a GA4 (evento "web_vitals") y a la API.
 * @param {{ name: string, value: number, rating: string, id: string }} metrica
 */
export function reportarVital({ name, value, rating, id }) {
  emitir('web_vitals', {
    metric_name: name, // LCP, INP, CLS, FCP, TTFB
    metric_value: name === 'CLS' ? Math.round(value * 1000) : Math.round(value), // CLS escalado ×1000; el resto en ms
    metric_rating: rating, // good | needs-improvement | poor
    metric_id: id,
    escenario_prueba: escenarioActual,
    non_interaction: true
  })
  enviarVitalALaApi({ metrica: name, valor: value, calificacion: rating, pagina: paginaActual(), escenario: escenarioActual })
}

/**
 * Respaldo en la API propia: no espera respuesta ni afecta la navegación.
 * @param {{ metrica: string, valor: number, calificacion: string, pagina: string, escenario: string }} datos
 */
function enviarVitalALaApi(datos) {
  try {
    const url = `${urlBase()}/vitals`
    const cuerpo = JSON.stringify(datos)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([cuerpo], { type: 'application/json' }))
    } else if (typeof fetch === 'function') {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(() => {})
    }
  } catch {
    // El respaldo nunca debe romper la página.
  }
}

export function initWebVitals() {
  try {
    for (const medir of [onLCP, onINP, onCLS, onFCP, onTTFB]) medir(reportarVital)
  } catch (err) {
    console.warn('[Web Vitals] No soportado:', err)
  }
}

// ---------------------------------------------------------------------------
// Vistas de página (SPA)
// ---------------------------------------------------------------------------

export function trackPageView(path, title) {
  if (typeof window === 'undefined') return
  emitir('page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href
  })
}

// ---------------------------------------------------------------------------
// E-commerce (nombres y parámetros recomendados por GA4; guía, tabla 4.1)
// ---------------------------------------------------------------------------

/**
 * Producto (de la API o del carrito) en el formato "item" de GA4.
 * @param {Record<string, any>} p
 * @param {{ cantidad?: number, index?: number, lista?: string }} [extra]
 */
export function aItem(p, { cantidad, index, lista } = {}) {
  const item = {
    item_id: p.sku || p.producto_id || p.id,
    item_name: p.nombre,
    item_category: p.categoria_nombre || p.categoria?.nombre || undefined,
    price: Number(p.precio_venta ?? p.precio_unitario),
    quantity: Number(cantidad ?? p.cantidad ?? 1)
  }
  if (index !== undefined) item.index = index
  if (lista) item.item_list_name = lista
  if (item.item_category === undefined) delete item.item_category
  return item
}

/** Valor total (precio × cantidad) de una lista de items del carrito. */
const valorDe = (items) => items.reduce((s, i) => s + Number(i.precio_venta) * Number(i.cantidad || 1), 0)

/**
 * view_item_list: se muestra un listado (catálogo, búsqueda, destacados).
 * @param {string} nombreLista
 * @param {object[]} productos
 * @param {{ desde?: number }} [opciones] desde: posición del primer producto (paginación)
 */
export function trackViewItemList(nombreLista, productos, { desde = 0 } = {}) {
  if (!productos?.length) return
  emitir('view_item_list', {
    item_list_name: nombreLista,
    items: productos.map((p, i) => aItem(p, { index: desde + i, lista: nombreLista, cantidad: 1 }))
  })
}

/** search: el usuario busca un término. */
export function trackSearch(termino) {
  const texto = termino?.trim()
  if (!texto) return
  emitir('search', { search_term: texto })
}

export function trackViewItem(producto) {
  if (!producto) return
  emitir('view_item', {
    currency: MONEDA,
    value: Number(producto.precio_venta),
    items: [aItem(producto, { cantidad: 1 })]
  })
}

export function trackAddToCart(producto, cantidad = 1) {
  if (!producto) return
  emitir('add_to_cart', {
    currency: MONEDA,
    value: Number(producto.precio_venta) * cantidad,
    items: [aItem(producto, { cantidad })]
  })
}

export function trackRemoveFromCart(item) {
  if (!item) return
  emitir('remove_from_cart', {
    currency: MONEDA,
    value: Number(item.precio_venta) * Number(item.cantidad || 1),
    items: [aItem(item)]
  })
}

/** view_cart: se abre el carrito (página o carrito lateral). */
export function trackViewCart(items) {
  if (!items?.length) return
  emitir('view_cart', { currency: MONEDA, value: valorDe(items), items: items.map((i) => aItem(i)) })
}

export function trackBeginCheckout(items, total) {
  if (!items?.length) return
  emitir('begin_checkout', { currency: MONEDA, value: Number(total), items: items.map((i) => aItem(i)) })
}

/** add_shipping_info: se confirman los datos de despacho. */
export function trackAddShippingInfo(items, total, costoEnvio) {
  if (!items?.length) return
  emitir('add_shipping_info', {
    currency: MONEDA,
    value: Number(total),
    shipping_tier: Number(costoEnvio) === 0 ? 'envio_gratis' : 'envio_estandar',
    items: items.map((i) => aItem(i))
  })
}

/** add_payment_info: se elige el medio de pago (simulado). */
export function trackAddPaymentInfo(items, total) {
  if (!items?.length) return
  emitir('add_payment_info', {
    currency: MONEDA,
    value: Number(total),
    payment_type: 'simulado',
    items: items.map((i) => aItem(i))
  })
}

/**
 * purchase: compra exitosa. Recibe la orden de POST /api/checkout:
 * { codigo, total, neto, costo_envio, items: [{ producto_id, sku, nombre, cantidad, precio_unitario }] }
 * @param {object} orden
 * @param {{ tipoCliente?: 'invitado' | 'registrado' }} [opciones]
 */
export function trackPurchase(orden, { tipoCliente } = {}) {
  if (!orden) return
  const envio = Number(orden.costo_envio || 0)
  emitir('purchase', {
    transaction_id: orden.codigo,
    value: Number(orden.total),
    // IVA contenido en el neto (los precios incluyen IVA; el envío no se grava aquí).
    tax: ivaIncluido(orden.neto ?? Number(orden.total) - envio),
    shipping: envio,
    currency: MONEDA,
    ...(tipoCliente ? { tipo_cliente: tipoCliente } : {}),
    items: (orden.items || []).map((i) => aItem(i))
  })
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

export const trackLogin = (metodo = 'email') => emitir('login', { method: metodo })
export const trackSignUp = (metodo = 'email') => emitir('sign_up', { method: metodo })
