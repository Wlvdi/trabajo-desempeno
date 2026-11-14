/**
 * Consultas SQL del catálogo de productos.
 *
 * Reglas:
 * - Todos los valores viajan como parámetros ($1, $2, ...); nunca se
 *   concatenan en el SQL. Lo único dinámico son fragmentos fijos de este
 *   archivo y el número del placeholder.
 * - Los numeric de PostgreSQL se convierten a float8 en el SELECT para que
 *   el driver los entregue como número y no como texto.
 * - costo_unitario no se expone: es un dato interno del negocio.
 */

/** Columnas de una "tarjeta" de producto (home, catálogo, búsqueda, relacionados). */
const COLUMNAS_TARJETA = `
  p.id, p.sku, p.nombre, p.descripcion, p.categoria_id, c.nombre as categoria_nombre,
  p.temporada, p.precio_venta::float8 as precio_venta, p.stock_actual, p.stock_minimo,
  p.destacado, p.imagen_url`

const DESDE_PRODUCTOS = 'from productos p left join categorias c on c.id = p.categoria_id'

/** Lista blanca de órdenes del catálogo. p.id desempata para paginar de forma estable. */
export const ORDENES = Object.freeze({
  destacado: 'p.destacado desc, p.nombre asc, p.id asc',
  precio_asc: 'p.precio_venta asc, p.nombre asc, p.id asc',
  precio_desc: 'p.precio_venta desc, p.nombre asc, p.id asc',
  nombre_asc: 'p.nombre asc, p.id asc',
  nombre_desc: 'p.nombre desc, p.id asc',
  stock_desc: 'p.stock_actual desc, p.nombre asc, p.id asc'
})

/**
 * Orden de la búsqueda: primero los que coinciden en el nombre.
 * $1 es siempre el patrón de búsqueda (construirWhere lo agrega primero).
 */
export const ORDEN_BUSQUEDA = '(p.nombre ilike $1) desc, p.nombre asc, p.id asc'

/** @typedef {keyof typeof ORDENES} Orden */

/**
 * @typedef {object} FiltrosCatalogo
 * @property {string} [categoria] id de categoría (UUID)
 * @property {string} [temporada]
 * @property {number} [precioMin]
 * @property {number} [precioMax]
 * @property {boolean} [enStock]
 * @property {string} [texto] texto de búsqueda (ILIKE en nombre y descripcion)
 */

/**
 * Escapa los comodines de LIKE para que el texto se busque literal.
 * @param {string} texto
 * @returns {string}
 */
export function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Construye el WHERE del catálogo con fragmentos fijos y parámetros.
 * Solo se listan productos activos.
 * @param {FiltrosCatalogo} filtros
 * @returns {{ where: string, params: unknown[] }}
 */
function construirWhere(filtros) {
  const condiciones = ['p.activo']
  const params = []
  /** Agrega un parámetro y devuelve su placeholder. */
  const param = (valor) => {
    params.push(valor)
    return `$${params.length}`
  }

  if (filtros.texto !== undefined) {
    const patron = param(`%${escaparLike(filtros.texto)}%`)
    condiciones.push(`(p.nombre ilike ${patron} or p.descripcion ilike ${patron})`)
  }
  if (filtros.categoria !== undefined) condiciones.push(`p.categoria_id = ${param(filtros.categoria)}`)
  if (filtros.temporada !== undefined) condiciones.push(`p.temporada = ${param(filtros.temporada)}`)
  if (filtros.precioMin !== undefined) condiciones.push(`p.precio_venta >= ${param(filtros.precioMin)}`)
  if (filtros.precioMax !== undefined) condiciones.push(`p.precio_venta <= ${param(filtros.precioMax)}`)
  if (filtros.enStock === true) condiciones.push('p.stock_actual > 0')
  if (filtros.enStock === false) condiciones.push('p.stock_actual = 0')

  return { where: `where ${condiciones.join(' and ')}`, params }
}

/**
 * Página del catálogo: dos consultas en paralelo (total y página) con el mismo WHERE.
 * @param {import('pg').Pool} pool
 * @param {{ filtros: FiltrosCatalogo, orden: string, pagina: number, limite: number }} opciones
 *   orden: fragmento ORDER BY ya elegido de una lista blanca
 * @returns {Promise<{ items: object[], total: number, pagina: number, limite: number, totalPaginas: number }>}
 */
export async function paginaCatalogo(pool, { filtros, orden, pagina, limite }) {
  const { where, params } = construirWhere(filtros)
  const n = params.length

  const [conteo, pagin] = await Promise.all([
    pool.query(`select count(*)::int as total ${DESDE_PRODUCTOS} ${where}`, params),
    pool.query(
      `select ${COLUMNAS_TARJETA} ${DESDE_PRODUCTOS} ${where}
       order by ${orden}
       limit $${n + 1} offset $${n + 2}`,
      [...params, limite, (pagina - 1) * limite]
    )
  ])

  const total = conteo.rows[0].total
  return { items: pagin.rows, total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
}

/**
 * Productos activos y destacados para la home.
 * @param {import('pg').Pool} pool
 * @returns {Promise<object[]>}
 */
export async function destacados(pool) {
  const { rows } = await pool.query(
    `select ${COLUMNAS_TARJETA} ${DESDE_PRODUCTOS}
     where p.activo and p.destacado
     order by p.nombre asc, p.id asc`
  )
  return rows
}

/**
 * Producto activo con su categoría, galería y unidades vendidas en los
 * últimos 90 días (ventas no anuladas). Devuelve null si no existe.
 * @param {import('pg').Pool} pool
 * @param {string} id UUID ya validado
 * @returns {Promise<object | null>}
 */
export async function productoPorId(pool, id) {
  const { rows } = await pool.query(
    `select ${COLUMNAS_TARJETA}, p.descripcion_larga, p.especificaciones,
       coalesce(
         (select array_agg(pi.url order by pi.orden, pi.id)
            from producto_imagenes pi
           where pi.producto_id = p.id),
         '{}'
       ) as imagenes_galeria,
       (select coalesce(sum(dv.cantidad), 0)::int
          from detalle_ventas dv
          join ventas v on v.id = dv.venta_id
         where dv.producto_id = p.id
           and v.estado <> 'ANULADO'
           and v.fecha >= now() - interval '90 days') as unidades_vendidas_90d
     ${DESDE_PRODUCTOS}
     where p.id = $1 and p.activo`,
    [id]
  )
  return rows[0] ?? null
}

/**
 * Hasta `limite` productos activos de la misma categoría, ordenados por
 * unidades vendidas en todo el historial (join con detalle_ventas).
 * @param {import('pg').Pool} pool
 * @param {string} id UUID del producto de referencia
 * @param {number} [limite]
 * @returns {Promise<object[]>}
 */
export async function relacionados(pool, id, limite = 4) {
  const { rows } = await pool.query(
    `select ${COLUMNAS_TARJETA}, coalesce(vend.unidades, 0)::int as unidades_vendidas
     ${DESDE_PRODUCTOS}
     left join (
       select dv.producto_id, sum(dv.cantidad) as unidades
         from detalle_ventas dv
         join ventas v on v.id = dv.venta_id
        where v.estado <> 'ANULADO'
        group by dv.producto_id
     ) vend on vend.producto_id = p.id
     where p.activo
       and p.id <> $1
       and p.categoria_id = (select categoria_id from productos where id = $1)
     order by unidades_vendidas desc, p.nombre asc, p.id asc
     limit $2`,
    [id, limite]
  )
  return rows
}
