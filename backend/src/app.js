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
import { rutasVitals } from './rutas/vitals.js'
import { rutasAdmin } from './rutas/admin.js'
import { rutaNoEncontrada, manejarErrores } from './middlewares/errores.js'
import { crearMetricas, etiquetarPrefijo } from './metricas.js'

/**
 * @param {{ pool: { query: Function }, pagoMock?: boolean, metricas?: import('./metricas.js').Metricas }} dependencias
 *   pagoMock: reemplaza config.pagoMock (lo usan los tests)
 *   metricas: registro de métricas; si no se entrega, se crea uno nuevo
 * @returns {import('express').Express} app.locals.metricas contiene las métricas
 */
export function crearApp({ pool, pagoMock, metricas = crearMetricas({ pool }) }) {
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
  montar('/api/checkout', rutasCheckout(pool, pagoMock === undefined ? { metricas } : { pagoMock, metricas }))
  montar('/api/ordenes', rutasOrdenes(pool))
  montar('/api/vitals', rutasVitals({ metricas }))
  montar('/api/admin', rutasAdmin(pool))

  app.use(rutaNoEncontrada)
  app.use(manejarErrores)

  return app
}
