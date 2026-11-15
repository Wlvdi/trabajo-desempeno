/**
 * Construcción de la aplicación Express.
 * No llama a listen(): así los tests pueden usarla con Supertest
 * y entregarle un pool falso o uno de prueba.
 */
import express from 'express'
import { rutasSalud } from './rutas/salud.js'
import { rutasHome } from './rutas/home.js'
import { rutasCategorias } from './rutas/categorias.js'
import { rutasProductos } from './rutas/productos.js'
import { rutasBuscar } from './rutas/buscar.js'
import { rutasAuth } from './rutas/auth.js'
import { rutasCarrito } from './rutas/carrito.js'
import { rutasCheckout } from './rutas/checkout.js'
import { rutasOrdenes } from './rutas/ordenes.js'
import { rutasPagos } from './rutas/pagos.js'
import { rutasVitals } from './rutas/vitals.js'
import { rutasAdmin } from './rutas/admin.js'
import { rutaNoEncontrada, manejarErrores } from './middlewares/errores.js'
import { crearMetricas, etiquetarPrefijo } from './metricas.js'
import { crearClienteWebpay } from './pagos.js'

/**
 * @param {{ pool: { query: Function }, pagoMock?: boolean, metricas?: import('./metricas.js').Metricas,
 *   webpay?: import('./pagos.js').ClienteWebpay, urlPublica?: string }} dependencias
 *   pagoMock: reemplaza config.pagoMock (lo usan los tests)
 *   metricas: registro de métricas; si no se entrega, se crea uno nuevo
 *   webpay: cliente de Webpay (sandbox); los tests entregan uno falso
 *   urlPublica: reemplaza config.urlPublica (retorno desde Webpay)
 * @returns {import('express').Express} app.locals.metricas contiene las métricas
 */
export function crearApp({ pool, pagoMock, metricas = crearMetricas({ pool }), webpay = crearClienteWebpay(), urlPublica }) {
  const app = express()
  app.locals.metricas = metricas

  app.disable('x-powered-by')
  // Primero: mide todas las peticiones, incluidas las que fallan en el JSON.
  app.use(metricas.medirHttp)
  app.use(express.json({ limit: '100kb' }))

  /** Monta un router y anota su prefijo para la etiqueta "ruta" de las métricas. */
  const montar = (prefijo, router) => app.use(prefijo, etiquetarPrefijo(prefijo), router)

  montar('/api/salud', rutasSalud(pool))
  montar('/api/home', rutasHome(pool))
  montar('/api/categorias', rutasCategorias(pool))
  montar('/api/productos', rutasProductos(pool))
  montar('/api/buscar', rutasBuscar(pool))
  montar('/api/auth', rutasAuth(pool, { metricas }))
  montar('/api/carrito', rutasCarrito(pool))
  // undefined = el valor de config (pagoMock, urlPublica).
  const opcionales = Object.fromEntries(Object.entries({ pagoMock, urlPublica }).filter(([, v]) => v !== undefined))
  montar('/api/checkout', rutasCheckout(pool, { metricas, webpay, ...opcionales }))
  montar('/api/ordenes', rutasOrdenes(pool))
  montar('/api/pagos', rutasPagos(pool, { metricas, webpay, ...opcionales }))
  montar('/api/vitals', rutasVitals({ metricas }))
  montar('/api/admin', rutasAdmin(pool))

  app.use(rutaNoEncontrada)
  app.use(manejarErrores)

  return app
}
