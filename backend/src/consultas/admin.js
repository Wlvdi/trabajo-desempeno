/**
 * Consultas SQL del panel de administración (productos, categorías,
 * compras, ventas manuales, dashboard y auditoría).
 *
 * Reglas (las mismas del catálogo):
 * - Todos los valores viajan como parámetros; lo único dinámico son
 *   fragmentos fijos de este archivo y el número del placeholder.
 * - Los numeric se convierten a float8 y los conteos a int para que el
 *   driver los entregue como número y no como texto.
 * - Las funciones de escritura reciben el cliente de una transacción abierta
 *   (ver db/transaccion.js) en la que ya se fijó app.usuario_id.
 */
import { escaparLike } from './productos.js'

/** @typedef {{ query: import('pg').Pool['query'] }} Consultable */

// -----------------------------------------------------------------------------
// Productos
// -----------------------------------------------------------------------------

/** Columnas de un producto en el panel (incluye los datos internos: costo y stock mínimo). */
const COLUMNAS_PRODUCTO = `
  p.id, p.sku, p.nombre, p.descripcion, p.categoria_id,
  case when c.id is null then null else json_build_object('id', c.id, 'nombre', c.nombre) end as categoria,
  p.temporada, p.costo_unitario::float8 as costo_unitario, p.precio_venta::float8 as precio_venta,
  p.stock_actual, p.stock_minimo, p.activo, p.destacado, p.imagen_url, p.created_at, p.updated_at`

const DESDE_PRODUCTOS = 'from productos p left join categorias c on c.id = p.categoria_id'

/**
 * Filtros por estado. "critico" usa la misma definición que
 * vista_productos_stock_critico (activo y stock <= mínimo, incluye agotados)
 * para que el inventario y el dashboard muestren la misma cantidad.
 */
export const FILTROS_ESTADO = Object.freeze({
  todos: null,
  activos: 'p.activo',
  inactivos: 'not p.activo',
  critico: 'p.activo and p.stock_actual <= p.stock_minimo',
  agotado: 'p.activo and p.stock_actual <= 0'
})

/** @typedef {keyof typeof FILTROS_ESTADO} EstadoProducto */

/**
 * Página de productos del panel (activos e inactivos), ordenada por nombre.
 * @param {Consultable} pool
 * @param {{ busqueda?: string, temporada?: string, estado: EstadoProducto, pagina: number, limite: number }} opciones
 * @returns {Promise<{ items: object[], total: number, pagina: number, limite: number, totalPaginas: number }>}
 */
export async function listarProductos(pool, { busqueda, temporada, estado, pagina, limite }) {
  const condiciones = []
  const params = []
  if (busqueda) {
    params.push(`%${escaparLike(busqueda)}%`)
    condiciones.push(`(p.nombre ilike $${params.length} or p.sku ilike $${params.length})`)
  }
  if (temporada) {
    params.push(temporada)
    condiciones.push(`p.temporada = $${params.length}`)
  }
  if (FILTROS_ESTADO[estado]) condiciones.push(FILTROS_ESTADO[estado])
  const where = condiciones.length > 0 ? `where ${condiciones.join(' and ')}` : ''

  const n = params.length
  const [conteo, pagin] = await Promise.all([
    pool.query(`select count(*)::int as total from productos p ${where}`, params),
    pool.query(
      `select ${COLUMNAS_PRODUCTO} ${DESDE_PRODUCTOS} ${where}
        order by p.nombre asc, p.id asc
        limit $${n + 1} offset $${n + 2}`,
      [...params, limite, (pagina - 1) * limite]
    )
  ])
  const total = conteo.rows[0].total
  return { items: pagin.rows, total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
}

/**
 * Un producto del panel (activo o no).
 * @param {Consultable} db
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function productoAdmin(db, id) {
  const { rows } = await db.query(`select ${COLUMNAS_PRODUCTO} ${DESDE_PRODUCTOS} where p.id = $1`, [id])
  return rows[0] ?? null
}

/**
 * Columnas que el panel puede escribir. stock_actual solo se admite al crear
 * (después cambia únicamente con compras y ventas).
 */
export const COLUMNAS_EDITABLES = Object.freeze([
  'sku', 'nombre', 'descripcion', 'categoria_id', 'temporada', 'costo_unitario', 'precio_venta', 'stock_minimo',
  'activo'
])

/**
 * Inserta un producto. El trigger trg_after_insert_producto audita
 * CREACION_PRODUCTO con el usuario de la sesión.
 * @param {Consultable} db
 * @param {Record<string, unknown>} campos columnas de COLUMNAS_EDITABLES más stock_actual
 * @returns {Promise<string>} id del producto
 */
export async function insertarProducto(db, campos) {
  const columnas = Object.keys(campos)
  const { rows } = await db.query(
    `insert into productos (${columnas.join(', ')})
     values (${columnas.map((_, i) => `$${i + 1}`).join(', ')})
     returning id`,
    columnas.map((c) => campos[c])
  )
  return rows[0].id
}

/**
 * Actualiza las columnas indicadas (solo nombres de COLUMNAS_EDITABLES).
 * @param {Consultable} db
 * @param {string} id
 * @param {Record<string, unknown>} campos
 * @returns {Promise<boolean>} false si el producto no existe
 */
export async function actualizarProducto(db, id, campos) {
  const columnas = Object.keys(campos).filter((c) => COLUMNAS_EDITABLES.includes(c))
  const asignaciones = columnas.map((c, i) => `${c} = $${i + 2}`)
  const { rowCount } = await db.query(`update productos set ${asignaciones.join(', ')} where id = $1`, [
    id,
    ...columnas.map((c) => campos[c])
  ])
  return rowCount > 0
}

// -----------------------------------------------------------------------------
// Categorías
// -----------------------------------------------------------------------------

/**
 * Categorías con la cantidad de productos (todos y activos).
 * @param {Consultable} db
 * @param {string} [id] si se indica, solo esa categoría
 */
export async function listarCategorias(db, id) {
  const { rows } = await db.query(
    `select c.id, c.nombre, c.descripcion, c.created_at,
            count(p.id)::int as cantidad_productos,
            count(p.id) filter (where p.activo)::int as cantidad_activos
       from categorias c
       left join productos p on p.categoria_id = c.id
      where $1::uuid is null or c.id = $1::uuid
      group by c.id
      order by c.nombre asc`,
    [id ?? null]
  )
  return rows
}

/**
 * @param {Consultable} db
 * @param {{ nombre: string, descripcion: string | null }} categoria
 * @returns {Promise<string>} id
 */
export async function insertarCategoria(db, { nombre, descripcion }) {
  const { rows } = await db.query('insert into categorias (nombre, descripcion) values ($1, $2) returning id', [
    nombre,
    descripcion
  ])
  return rows[0].id
}

// -----------------------------------------------------------------------------
// Compras y ventas
// -----------------------------------------------------------------------------

/**
 * Productos existentes entre los ids dados. Con `bloquear`, los bloquea
 * FOR UPDATE en orden de id (mismo orden que el checkout: sin deadlocks).
 * @param {Consultable} db
 * @param {string[]} ids
 * @param {{ bloquear?: boolean }} [opciones]
 * @returns {Promise<{ id: string, nombre: string, precio_venta: number, stock_actual: number, activo: boolean }[]>}
 */
export async function productosPorIds(db, ids, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `select id, nombre, precio_venta::float8 as precio_venta, stock_actual, activo
       from productos
      where id = any($1::uuid[])
      order by id
      ${bloquear ? 'for update' : ''}`,
    [ids]
  )
  return rows
}

/**
 * @param {Consultable} db
 * @param {{ proveedor: string | null, notas: string | null, total: number, usuarioId: string }} compra
 * @returns {Promise<string>} id
 */
export async function insertarCompra(db, { proveedor, notas, total, usuarioId }) {
  const { rows } = await db.query(
    'insert into compras (proveedor, notas, total, usuario_id) values ($1, $2, $3, $4) returning id',
    [proveedor, notas, total, usuarioId]
  )
  return rows[0].id
}

/**
 * Inserta las líneas de la compra en un solo INSERT. El trigger
 * trg_after_detalle_compra suma stock, actualiza el costo y audita COMPRA_ENTRADA.
 * @param {Consultable} db
 * @param {string} compraId
 * @param {{ producto_id: string, cantidad: number, costo_unitario: number, subtotal: number }[]} lineas
 */
export async function insertarDetalleCompra(db, compraId, lineas) {
  const params = [compraId]
  const filas = lineas.map((l) => {
    params.push(l.producto_id, l.cantidad, l.costo_unitario, l.subtotal)
    const n = params.length
    return `($1, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`
  })
  await db.query(
    `insert into detalle_compras (compra_id, producto_id, cantidad, costo_unitario, subtotal)
     values ${filas.join(', ')}`,
    params
  )
}

/**
 * Venta manual (canal distinto de Web). Las líneas se insertan con
 * insertarDetalle de consultas/ordenes.js (el trigger descuenta stock).
 * @param {Consultable} db
 * @param {{ canal: string, clienteNombre: string | null, notas: string | null, total: number, usuarioId: string }} venta
 * @returns {Promise<string>} id
 */
export async function insertarVentaManual(db, { canal, clienteNombre, notas, total, usuarioId }) {
  const { rows } = await db.query(
    `insert into ventas (canal_venta, cliente_nombre, notas, total, usuario_id)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [canal, clienteNombre, notas, total, usuarioId]
  )
  return rows[0].id
}

/** Detalle de una compra como arreglo JSON (subconsulta correlacionada sobre c.id). */
const DETALLE_COMPRA = `coalesce((
    select json_agg(json_build_object(
             'producto_id', d.producto_id, 'cantidad', d.cantidad,
             'costo_unitario', d.costo_unitario::float8, 'subtotal', d.subtotal::float8,
             'producto', json_build_object('id', p.id, 'nombre', p.nombre, 'sku', p.sku))
           order by p.nombre, d.producto_id)
      from detalle_compras d
      join productos p on p.id = d.producto_id
     where d.compra_id = c.id
  ), '[]') as detalles`

/**
 * Compras más recientes con su detalle, o una sola si se indica `id`.
 * @param {Consultable} db
 * @param {{ limite?: number, id?: string }} opciones
 */
export async function listarCompras(db, { limite = 1, id } = {}) {
  const { rows } = await db.query(
    `select c.id, c.fecha, c.proveedor, c.notas, c.total::float8 as total, u.email as usuario_email,
            ${DETALLE_COMPRA}
       from compras c
       left join usuarios u on u.id = c.usuario_id
      where $2::uuid is null or c.id = $2::uuid
      order by c.fecha desc, c.id desc
      limit $1`,
    [limite, id ?? null]
  )
  return rows
}

/** Detalle de una venta como arreglo JSON (subconsulta correlacionada sobre v.id). */
const DETALLE_VENTA = `coalesce((
    select json_agg(json_build_object(
             'producto_id', d.producto_id, 'cantidad', d.cantidad,
             'precio_unitario', d.precio_unitario::float8, 'subtotal', d.subtotal::float8,
             'producto', json_build_object('id', p.id, 'nombre', p.nombre, 'sku', p.sku))
           order by p.nombre, d.producto_id)
      from detalle_ventas d
      join productos p on p.id = d.producto_id
     where d.venta_id = v.id
  ), '[]') as detalles`

/**
 * Ventas más recientes de todos los canales (incluidas las web), o una sola.
 * @param {Consultable} db
 * @param {{ limite?: number, id?: string }} opciones
 */
export async function listarVentas(db, { limite = 1, id, canal } = {}) {
  // En las ventas web se incluyen los datos de despacho y contacto para
  // preparar el envío (el panel es solo para administradores).
  const { rows } = await db.query(
    `select v.id, v.codigo, v.fecha, v.canal_venta, v.estado, v.cliente_nombre, v.notas,
            v.total::float8 as total, v.costo_envio::float8 as costo_envio,
            v.medio_pago, v.codigo_autorizacion, v.despacho, v.cliente_email,
            case when v.canal_venta <> 'Web' then null
                 when v.cliente_id is null then 'invitado'
                 else 'registrado' end as tipo_cliente,
            u.email as usuario_email,
            ${DETALLE_VENTA}
       from ventas v
       left join usuarios u on u.id = v.usuario_id
      where ($2::uuid is null or v.id = $2::uuid)
        and ($3::text is null or v.canal_venta = $3::text)
      order by v.fecha desc, v.id desc
      limit $1`,
    [limite, id ?? null, canal ?? null]
  )
  return rows
}

// -----------------------------------------------------------------------------
// Dashboard y auditoría
// -----------------------------------------------------------------------------

/**
 * Las 4 vistas del dashboard (migración 001) en paralelo.
 * @param {Consultable} pool
 */
export async function datosDashboard(pool) {
  const [inmovilizado, balance, criticos, canales] = await Promise.all([
    pool.query(
      `select total_productos_activos::int as total_productos_activos,
              unidades_totales::int as unidades_totales,
              capital_inmovilizado_costo::float8 as capital_inmovilizado_costo,
              valor_total_venta_estimado::float8 as valor_total_venta_estimado,
              margen_bruto_potencial::float8 as margen_bruto_potencial
         from vista_capital_inmovilizado`
    ),
    pool.query(
      `select total_invertido_compras::float8 as total_invertido_compras,
              total_recaudado_ventas::float8 as total_recaudado_ventas,
              balance_neto::float8 as balance_neto,
              cantidad_ventas_realizadas::int as cantidad_ventas_realizadas,
              cantidad_compras_realizadas::int as cantidad_compras_realizadas
         from vista_balance_comercial`
    ),
    pool.query(
      `select id, sku, nombre, categoria, temporada, stock_actual, stock_minimo, deficit_unidades, nivel_alerta
         from vista_productos_stock_critico
        order by stock_actual asc, nombre asc, id asc`
    ),
    pool.query(
      `select canal_venta, cantidad_pedidos::int as cantidad_pedidos, total_ingresos::float8 as total_ingresos
         from vista_ventas_por_canal
        order by total_ingresos desc, canal_venta asc`
    )
  ])
  return {
    inmovilizado: inmovilizado.rows[0],
    balance: balance.rows[0],
    criticos: criticos.rows,
    canales: canales.rows
  }
}

/**
 * Últimos eventos de auditoría.
 * @param {Consultable} pool
 * @param {number} limite
 */
export async function historialAuditoria(pool, limite) {
  const { rows } = await pool.query(
    `select id, fecha, tipo_evento, entidad_afectada, descripcion, detalle, usuario_responsable
       from vista_historial_auditoria
      order by fecha desc, id desc
      limit $1`,
    [limite]
  )
  return rows
}
