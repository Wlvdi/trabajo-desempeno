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
import { rutaNoEncontrada, manejarErrores } from './middlewares/errores.js'

/**
 * @param {{ pool: { query: Function }, pagoMock?: boolean }} dependencias
 *   pagoMock: reemplaza config.pagoMock (lo usan los tests)
 * @returns {import('express').Express}
 */
export function crearApp({ pool, pagoMock }) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/salud', rutasSalud(pool))
  app.use('/api/home', rutasHome(pool))
  app.use('/api/categorias', rutasCategorias(pool))
  app.use('/api/productos', rutasProductos(pool))
  app.use('/api/buscar', rutasBuscar(pool))
  app.use('/api/auth', rutasAuth(pool))
  app.use('/api/carrito', rutasCarrito(pool))
  app.use('/api/checkout', rutasCheckout(pool, pagoMock === undefined ? {} : { pagoMock }))
  app.use('/api/ordenes', rutasOrdenes(pool))

  app.use(rutaNoEncontrada)
  app.use(manejarErrores)

  return app
}
