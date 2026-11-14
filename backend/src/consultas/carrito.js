/**
 * Consultas SQL del carrito persistente.
 *
 * - Un carrito pertenece a un usuario (usuario_id) o es anónimo
 *   (usuario_id null); el id del carrito anónimo funciona como token.
 * - Las funciones reciben un cliente de una transacción abierta
 *   (ver db/transaccion.js) salvo leerCarrito, que también acepta el pool.
 * - Las modificaciones bloquean la fila del carrito (FOR UPDATE) para que
 *   operaciones simultáneas sobre el mismo carrito se ejecuten en orden.
 * - El carrito no guarda precios: siempre se muestran los actuales.
 */

/** Unidades máximas de un mismo producto en el carrito. */
export const CANTIDAD_MAXIMA = 99
/** Productos distintos máximos por carrito. */
export const LINEAS_MAXIMAS = 50

/** @typedef {{ query: import('pg').Pool['query'] }} Consultable */

/**
 * Busca el carrito de un usuario. Con `bloquear` (dentro de una
 * transacción) bloquea su fila hasta el COMMIT.
 * @param {Consultable} db
 * @param {string} usuarioId
 * @param {{ bloquear?: boolean }} [opciones]
 * @returns {Promise<string | null>} id del carrito
 */
export async function buscarCarritoDeUsuario(db, usuarioId, { bloquear = true } = {}) {
  const { rows } = await db.query(
    `select id from carritos where usuario_id = $1${bloquear ? ' for update' : ''}`,
    [usuarioId]
  )
  return rows[0]?.id ?? null
}

/**
 * Busca un carrito anónimo por id (y bloquea su fila si `bloquear`).
 * Nunca devuelve el carrito de un usuario registrado.
 * @param {Consultable} db
 * @param {string} carritoId
 * @param {{ bloquear?: boolean }} [opciones]
 * @returns {Promise<string | null>}
 */
export async function buscarCarritoAnonimo(db, carritoId, { bloquear = true } = {}) {
  const { rows } = await db.query(
    `select id from carritos where id = $1 and usuario_id is null${bloquear ? ' for update' : ''}`,
    [carritoId]
  )
  return rows[0]?.id ?? null
}

/**
 * Devuelve el carrito del usuario, creándolo si no existe (seguro ante
 * dos peticiones simultáneas gracias a la restricción única usuario_id).
 * @param {Consultable} db
 * @param {string} usuarioId
 * @returns {Promise<string>}
 */
export async function obtenerOCrearCarritoDeUsuario(db, usuarioId) {
  const { rows } = await db.query(
    `insert into carritos (usuario_id) values ($1)
     on conflict (usuario_id) do update set updated_at = now()
     returning id`,
    [usuarioId]
  )
  return rows[0].id
}

/**
 * Crea un carrito anónimo.
 * @param {Consultable} db
 * @returns {Promise<string>}
 */
export async function crearCarritoAnonimo(db) {
  const { rows } = await db.query('insert into carritos default values returning id')
  return rows[0].id
}

/**
 * Marca el carrito como modificado.
 * @param {Consultable} db
 * @param {string} carritoId
 */
export async function tocarCarrito(db, carritoId) {
  await db.query('update carritos set updated_at = now() where id = $1', [carritoId])
}

/**
 * Datos del producto necesarios para validar el carrito.
 * @param {Consultable} db
 * @param {string} productoId
 * @returns {Promise<{ stock_actual: number, activo: boolean } | null>}
 */
export async function productoParaCarrito(db, productoId) {
  const { rows } = await db.query('select stock_actual, activo from productos where id = $1', [productoId])
  return rows[0] ?? null
}

/**
 * Cantidad actual de un producto en el carrito (0 si no está) y cantidad
 * de productos distintos del carrito.
 * @param {Consultable} db
 * @param {string} carritoId
 * @param {string} productoId
 * @returns {Promise<{ cantidad: number, lineas: number }>}
 */
export async function estadoLinea(db, carritoId, productoId) {
  const { rows } = await db.query(
    `select coalesce(sum(cantidad) filter (where producto_id = $2), 0)::int as cantidad,
            count(*)::int as lineas
       from carrito_items
      where carrito_id = $1`,
    [carritoId, productoId]
  )
  return rows[0]
}

/**
 * Suma unidades a una línea (la crea si no existe) en una sola sentencia.
 * @param {Consultable} db
 * @param {string} carritoId
 * @param {string} productoId
 * @param {number} cantidad
 * @returns {Promise<number>} cantidad resultante
 */
export async function sumarUnidades(db, carritoId, productoId, cantidad) {
  const { rows } = await db.query(
    `insert into carrito_items (carrito_id, producto_id, cantidad)
     values ($1, $2, $3)
     on conflict (carrito_id, producto_id)
     do update set cantidad = carrito_items.cantidad + excluded.cantidad
     returning cantidad`,
    [carritoId, productoId, cantidad]
  )
  return rows[0].cantidad
}

/**
 * Fija la cantidad de una línea existente.
 * @param {Consultable} db
 * @returns {Promise<boolean>} false si el producto no estaba en el carrito
 */
export async function fijarCantidad(db, carritoId, productoId, cantidad) {
  const { rowCount } = await db.query(
    'update carrito_items set cantidad = $3 where carrito_id = $1 and producto_id = $2',
    [carritoId, productoId, cantidad]
  )
  return rowCount > 0
}

/**
 * Quita un producto del carrito.
 * @param {Consultable} db
 */
export async function quitarProducto(db, carritoId, productoId) {
  await db.query('delete from carrito_items where carrito_id = $1 and producto_id = $2', [carritoId, productoId])
}

/**
 * Vacía el carrito (la fila del carrito se conserva).
 * @param {Consultable} db
 */
export async function vaciarCarrito(db, carritoId) {
  await db.query('delete from carrito_items where carrito_id = $1', [carritoId])
}

/**
 * Mueve las líneas del carrito anónimo al del usuario y borra el anónimo.
 * Las cantidades se suman con tope en el stock actual y en CANTIDAD_MAXIMA;
 * se omiten productos inactivos o sin stock.
 * @param {Consultable} db
 * @param {string} anonimoId
 * @param {string} destinoId
 */
export async function fusionarCarritos(db, anonimoId, destinoId) {
  await db.query(
    `insert into carrito_items (carrito_id, producto_id, cantidad)
     select $2, ci.producto_id, least(ci.cantidad, p.stock_actual, $3)
       from carrito_items ci
       join productos p on p.id = ci.producto_id
      where ci.carrito_id = $1 and p.activo and p.stock_actual > 0
     on conflict (carrito_id, producto_id) do update
       set cantidad = least(
             carrito_items.cantidad + excluded.cantidad,
             (select stock_actual from productos where id = excluded.producto_id),
             $3)`,
    [anonimoId, destinoId, CANTIDAD_MAXIMA]
  )
  await db.query('delete from carritos where id = $1', [anonimoId])
}

/**
 * Carrito con precio y stock actuales. Los productos desactivados no se muestran.
 * Los campos de cada ítem coinciden con los que usa CartContext.jsx.
 * @param {Consultable} db
 * @param {string | null} carritoId
 * @returns {Promise<{ id: string | null, items: object[], total_unidades: number, subtotal: number }>}
 */
export async function leerCarrito(db, carritoId) {
  if (!carritoId) return { id: null, items: [], total_unidades: 0, subtotal: 0 }
  const { rows } = await db.query(
    `select p.id, p.sku, p.nombre, p.precio_venta::float8 as precio_venta, p.imagen_url,
            c.nombre as categoria_nombre, p.stock_actual, ci.cantidad,
            (p.precio_venta * ci.cantidad)::float8 as subtotal
       from carrito_items ci
       join productos p on p.id = ci.producto_id
       left join categorias c on c.id = p.categoria_id
      where ci.carrito_id = $1 and p.activo
      order by ci.created_at asc, p.id asc`,
    [carritoId]
  )
  return {
    id: carritoId,
    items: rows,
    total_unidades: rows.reduce((s, i) => s + i.cantidad, 0),
    subtotal: rows.reduce((s, i) => s + i.subtotal, 0)
  }
}
