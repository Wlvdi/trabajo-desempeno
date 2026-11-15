/**
 * Ayudantes de los tests del panel de administración.
 */
import { firmarToken } from '../src/seguridad/tokens.js'

/**
 * Cabeceras de autorización para el admin y un cliente del seed.
 * @param {{ admin: { id: string }, clientes: { id: string }[] }} datos
 */
export function tokensDePrueba(datos) {
  return {
    admin: `Bearer ${firmarToken({ id: datos.admin.id, rol: 'admin' })}`,
    cliente: `Bearer ${firmarToken({ id: datos.clientes[0].id, rol: 'cliente' })}`
  }
}

/**
 * Stock actual de productos (por id).
 * @param {import('pg').Pool} pool
 * @param {string[]} ids
 * @returns {Promise<Record<string, number>>}
 */
export async function stockDe(pool, ids) {
  const { rows } = await pool.query('select id, stock_actual from productos where id = any($1::uuid[])', [ids])
  return Object.fromEntries(rows.map((r) => [r.id, r.stock_actual]))
}

/**
 * Productos activos con al menos `minimo` unidades.
 * @param {import('pg').Pool} pool
 * @param {number} cantidad
 * @param {number} [minimo]
 * @returns {Promise<{ id: string, nombre: string, precio_venta: number, stock_actual: number }[]>}
 */
export async function productosConStock(pool, cantidad, minimo = 5) {
  const { rows } = await pool.query(
    `select id, nombre, precio_venta::float8 as precio_venta, stock_actual
       from productos where activo and stock_actual >= $1 order by id limit $2`,
    [minimo, cantidad]
  )
  return rows
}
