/**
 * Ayudantes de los tests de integración del catálogo: siembra la base
 * subligol_test con el seed determinista y crea la app con un pool real.
 */
import { inject } from 'vitest'
import pg from 'pg'
import { sembrar } from '../seeds/seed.js'
import { generarDatos } from '../seeds/generador.js'
import { crearApp } from '../src/app.js'

/**
 * Siembra la base de prueba y devuelve pool, app y los datos generados.
 * Cada archivo de test la llama en su beforeAll (los archivos corren en serie).
 * @returns {Promise<{ pool: pg.Pool, app: import('express').Express, datos: ReturnType<typeof generarDatos> }>}
 */
export async function prepararCatalogo() {
  const pool = new pg.Pool({ connectionString: inject('urlBdPrueba') })
  await sembrar(pool, { contrasenaClientes: 'clave-cliente-test', contrasenaAdmin: 'clave-admin-test' })
  return { pool, app: crearApp({ pool }), datos: generarDatos() }
}

/** Campos que el frontend espera en una tarjeta de producto. */
export const CAMPOS_TARJETA = [
  'id', 'sku', 'nombre', 'descripcion', 'categoria_id', 'categoria_nombre', 'temporada',
  'precio_venta', 'stock_actual', 'stock_minimo', 'destacado', 'imagen_url'
]

/**
 * Verifica forma y tipos de una tarjeta de producto.
 * @param {Record<string, unknown>} p
 * @param {typeof import('vitest').expect} expect
 */
export function verificarTarjeta(p, expect) {
  for (const campo of CAMPOS_TARJETA) expect(p).toHaveProperty(campo)
  expect(typeof p.precio_venta).toBe('number')
  expect(typeof p.stock_actual).toBe('number')
  expect(typeof p.stock_minimo).toBe('number')
  expect(typeof p.destacado).toBe('boolean')
  expect(p).not.toHaveProperty('costo_unitario')
}
