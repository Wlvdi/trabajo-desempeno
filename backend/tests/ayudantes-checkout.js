/**
 * Ayudantes compartidos por los tests de checkout y órdenes.
 */

/** Despacho válido (mismos campos que CheckoutStoreView.jsx). */
export const DESPACHO = Object.freeze({
  nombre: 'Camila',
  apellido: 'González',
  telefono: '+56 9 8765 4321',
  region: 'Región Metropolitana de Santiago',
  comuna: 'Santiago',
  direccion: 'Av. Dieciocho 390',
  depto: 'Oficina 402'
})

/**
 * Deja el carrito del usuario con exactamente estas líneas, en este orden
 * de inserción (created_at creciente).
 * @param {import('pg').Pool} pool
 * @param {string} usuarioId
 * @param {[string, number][]} lineas [producto_id, cantidad]
 * @returns {Promise<string>} id del carrito
 */
export async function llenarCarrito(pool, usuarioId, lineas) {
  const { rows } = await pool.query(
    `insert into carritos (usuario_id) values ($1)
     on conflict (usuario_id) do update set updated_at = now()
     returning id`,
    [usuarioId]
  )
  const carritoId = rows[0].id
  await pool.query('delete from carrito_items where carrito_id = $1', [carritoId])
  for (const [i, [productoId, cantidad]] of lineas.entries()) {
    await pool.query(
      `insert into carrito_items (carrito_id, producto_id, cantidad, created_at)
       values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [carritoId, productoId, cantidad, i]
    )
  }
  return carritoId
}

/**
 * Cuenta filas para comprobar que una operación no dejó cambios.
 * @param {import('pg').Pool} pool
 * @param {string[]} productoIds
 */
export async function fotografia(pool, productoIds) {
  const { rows } = await pool.query(
    `select (select count(*)::int from ventas) as ventas,
            (select count(*)::int from detalle_ventas) as detalle,
            (select count(*)::int from audit_logs) as auditoria,
            (select count(*)::int from carrito_items) as items_carrito,
            (select json_object_agg(id, stock_actual) from productos where id = any($1::uuid[])) as stock`,
    [productoIds]
  )
  return rows[0]
}
