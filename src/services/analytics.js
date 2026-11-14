// src/services/analytics.js
// Integración oficial de Google Analytics 4 (GA4) y Core Web Vitals para Subligol (UTEM)
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals'

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-SUBLIGOLUTEM'

let isInitialized = false

// 1. Inicializar script gtag.js en el DOM
export function initGA() {
  if (typeof window === 'undefined' || isInitialized) return

  // Evitar duplicar script
  if (!document.getElementById('ga4-script')) {
    const script = document.createElement('script')
    script.id = 'ga4-script'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(script)

    window.dataLayer = window.dataLayer || []
    function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag = gtag
    gtag('js', new Date())
    gtag('config', GA_ID, {
      send_page_view: false // Se controla manualmente en SPA por react-router
    })

    isInitialized = true
    console.log(`[GA4] Google Analytics inicializado con ID: ${GA_ID}`)

    // Registrar Core Web Vitals automáticamente hacia GA4
    initWebVitals()
  }
}

// 2. Reporte de Core Web Vitals (LCP, INP, CLS, FCP, TTFB)
function sendVitalToGA({ name, delta, value, id }) {
  if (window.gtag) {
    window.gtag('event', name, {
      event_category: 'Web Vitals',
      event_label: id,
      value: Math.round(name === 'CLS' ? delta * 1000 : delta),
      non_interaction: true,
      metric_value: value,
      metric_delta: delta
    })
  }
  console.log(`[Web Vitals] ${name}:`, { value, delta, id })
}

export function initWebVitals() {
  try {
    onLCP(sendVitalToGA)
    onINP(sendVitalToGA)
    onCLS(sendVitalToGA)
    onFCP(sendVitalToGA)
    onTTFB(sendVitalToGA)
  } catch (err) {
    console.warn('[Web Vitals] No soportado o error:', err)
  }
}

// 3. Pageview en SPA (React Router)
export function trackPageView(path, title) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.href
    })
    console.log(`[GA4] PageView: ${path}`)
  }
}

// 4. Eventos E-Commerce Estándar de GA4

// A. Ver artículo en detalle (view_item)
export function trackViewItem(producto) {
  if (!producto || typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'view_item', {
    currency: 'CLP',
    value: Number(producto.precio_venta),
    items: [
      {
        item_id: producto.sku || producto.id,
        item_name: producto.nombre,
        item_category: producto.categoria_nombre || producto.categoria?.nombre || 'General',
        price: Number(producto.precio_venta),
        quantity: 1
      }
    ]
  })
  console.log(`[GA4 E-commerce] view_item:`, producto.nombre)
}

// B. Agregar al carrito (add_to_cart)
export function trackAddToCart(producto, cantidad = 1) {
  if (!producto || typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'add_to_cart', {
    currency: 'CLP',
    value: Number(producto.precio_venta) * cantidad,
    items: [
      {
        item_id: producto.sku || producto.id,
        item_name: producto.nombre,
        item_category: producto.categoria_nombre || 'General',
        price: Number(producto.precio_venta),
        quantity: cantidad
      }
    ]
  })
  console.log(`[GA4 E-commerce] add_to_cart: ${cantidad}x`, producto.nombre)
}

// C. Eliminar del carrito (remove_from_cart)
export function trackRemoveFromCart(producto) {
  if (!producto || typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'remove_from_cart', {
    currency: 'CLP',
    value: Number(producto.precio_venta) * (producto.cantidad || 1),
    items: [
      {
        item_id: producto.sku || producto.id,
        item_name: producto.nombre,
        price: Number(producto.precio_venta),
        quantity: producto.cantidad || 1
      }
    ]
  })
  console.log(`[GA4 E-commerce] remove_from_cart:`, producto.nombre)
}

// D. Iniciar Proceso de Checkout (begin_checkout)
export function trackBeginCheckout(items, total) {
  if (!items || typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'begin_checkout', {
    currency: 'CLP',
    value: Number(total),
    items: items.map(i => ({
      item_id: i.sku || i.id,
      item_name: i.nombre,
      price: Number(i.precio_venta),
      quantity: Number(i.cantidad)
    }))
  })
  console.log(`[GA4 E-commerce] begin_checkout: Total ${total}`)
}

// E. Compra Finalizada con Éxito (purchase)
// Recibe la orden que devuelve POST /api/checkout:
// { codigo, total, costo_envio, items: [{ producto_id, sku, nombre, cantidad, precio_unitario }] }
export function trackPurchase(orden) {
  if (!orden || typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'purchase', {
    transaction_id: orden.codigo,
    value: Number(orden.total),
    tax: Math.round(Number(orden.total) * 0.19),
    shipping: Number(orden.costo_envio || 0),
    currency: 'CLP',
    coupon: 'UTEM2026',
    items: (orden.items || []).map(i => ({
      item_id: i.sku || i.producto_id,
      item_name: i.nombre,
      price: Number(i.precio_unitario),
      quantity: Number(i.cantidad)
    }))
  })
  console.log(`[GA4 E-commerce] purchase completada:`, orden.codigo)
}
