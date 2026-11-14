/**
 * Consultas SQL del checkout y de las órdenes (tabla ventas).
 *
 * Las funciones de escritura reciben el cliente de una transacción abierta
 * (ver db/transaccion.js). Todos los valores viajan como parámetros.
 */

/** @typedef {{ query: import('pg').Pool['query'] }} Consultable */

/**
 * @typedef {object} LineaBloqueada
 * @property {string} id
 * @property {string} nombre
 * @property {number} precio_venta precio ACTUAL del producto
 * @property {number} stock_actual
 * @property {boolean} activo
 * @property {number} cantidad cantidad pedida en el carrito
 */

/**
 * Lee las líneas del carrito y BLOQUEA sus productos (FOR UPDATE) en orden
 * fijo de id. Como todas las compras bloquean en el mismo orden, dos
 * compras con los mismos productos no pueden esperarse en ciclo (sin
 * deadlocks). En READ COMMITTED, si otra compra tenía bloqueado un producto,
 * esta espera a que termine y recibe la versión ya actualizada del stock.
 * @param {Consultable} db
 * @param {string} carritoId
 * @returns {Promise<LineaBloqueada[]>}
 */
export async function bloquearLineasDelCarrito(db, carritoId) {
  const { rows } = await db.query(
    `select p.id, p.nombre, p.precio_venta::float8 as precio_venta, p.stock_actual, p.activo, ci.cantidad
       from carrito_items ci
       join productos p on p.id = ci.producto_id
      where ci.carrito_id = $1
      order by p.id
        for update of p`,
    [carritoId]
  )
  return rows
}

/**
 * Inserta la venta web con código SUB-AAAA-NNNNNN (año en hora de Chile y
 * número de la secuencia seq_codigo_venta, migración 003).
 * @param {Consultable} db
 * @param {{ usuarioId: string, medioPago: string, codigoAutorizacion: string, costoEnvio: number,
 *   total: number, despacho: Record<string, string>, clienteNombre: string }} venta
 * @returns {Promise<string>} id de la venta
 */
export async function insertarVenta(db, venta) {
  const { rows } = await db.query(
    `insert into ventas (codigo, canal_venta, estado, medio_pago, codigo_autorizacion,
                         costo_envio, total, despacho, cliente_id, usuario_id, cliente_nombre)
     values ('SUB-' || to_char(now() at time zone 'America/Santiago', 'YYYY') || '-'
               || lpad(nextval('seq_codigo_venta')::text, 6, '0'),
             'Web', 'PAGADO', $1, $2, $3, $4, $5, $6, $6, $7)
     returning id`,
    [
      venta.medioPago,
      venta.codigoAutorizacion,
      venta.costoEnvio,
      venta.total,
      JSON.stringify(venta.despacho),
      venta.usuarioId,
      venta.clienteNombre
    ]
  )
  return rows[0].id
}

/**
 * Inserta todas las líneas de la venta en un solo INSERT de varias filas.
 * El trigger trg_after_detalle_venta descuenta stock y escribe audit_logs.
 * @param {Consultable} db
 * @param {string} ventaId
 * @param {{ producto_id: string, cantidad: number, precio_unitario: number, subtotal: number }[]} lineas
 */
export async function insertarDetalle(db, ventaId, lineas) {
  const params = [ventaId]
  const filas = lineas.map((l) => {
    params.push(l.producto_id, l.cantidad, l.precio_unitario, l.subtotal)
    const n = params.length
    return `($1, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`
  })
  await db.query(
    `insert into detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
     values ${filas.join(', ')}`,
    params
  )
}

/**
 * Orden completa con sus items. Solo la devuelve si pertenece al usuario o
 * si `esAdmin`; en otro caso devuelve null (la ruta responde 404).
 * @param {Consultable} db
 * @param {string} ventaId
 * @param {{ usuarioId: string, esAdmin: boolean }} acceso
 * @returns {Promise<object | null>}
 */
export async function leerOrden(db, ventaId, { usuarioId, esAdmin }) {
  const { rows } = await db.query(
    `select v.id, v.codigo, v.fecha, v.estado, v.medio_pago, v.codigo_autorizacion,
            (v.total - v.costo_envio)::float8 as neto, v.costo_envio::float8 as costo_envio,
            v.total::float8 as total, v.despacho,
            coalesce((
              select json_agg(json_build_object(
                       'producto_id', dv.producto_id, 'nombre', p.nombre, 'sku', p.sku,
                       'imagen_url', p.imagen_url, 'cantidad', dv.cantidad,
                       'precio_unitario', dv.precio_unitario::float8, 'subtotal', dv.subtotal::float8)
                     order by p.nombre, dv.producto_id)
                from detalle_ventas dv
                join productos p on p.id = dv.producto_id
               where dv.venta_id = v.id
            ), '[]') as items
       from ventas v
      where v.id = $1 and (v.cliente_id = $2 or $3)`,
    [ventaId, usuarioId, esAdmin]
  )
  if (!rows[0]) return null
  const { id, codigo, fecha, estado, medio_pago, codigo_autorizacion, items, neto, costo_envio, total, despacho } =
    rows[0]
  return { id, codigo, fecha, estado, medio_pago, codigo_autorizacion, items, neto, costo_envio, total, despacho }
}

/**
 * Órdenes del usuario, de la más reciente a la más antigua (count y página
 * en paralelo, como el catálogo).
 * @param {import('pg').Pool} pool
 * @param {{ usuarioId: string, pagina: number, limite: number }} opciones
 */
export async function listarOrdenes(pool, { usuarioId, pagina, limite }) {
  const [conteo, pagin] = await Promise.all([
    pool.query('select count(*)::int as total from ventas where cliente_id = $1', [usuarioId]),
    pool.query(
      `select v.id, v.codigo, v.fecha, v.estado, v.medio_pago,
              (v.total - v.costo_envio)::float8 as neto, v.costo_envio::float8 as costo_envio,
              v.total::float8 as total,
              (select count(*)::int from detalle_ventas dv where dv.venta_id = v.id) as cantidad_productos
         from ventas v
        where v.cliente_id = $1
        order by v.fecha desc, v.id desc
        limit $2 offset $3`,
      [usuarioId, limite, (pagina - 1) * limite]
    )
  ])
  const total = conteo.rows[0].total
  return { items: pagin.rows, total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
}
