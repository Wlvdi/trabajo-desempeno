// src/services/api.js
// Cliente HTTP de la API propia de Subligol (backend/ con Express + PostgreSQL).
//
// - Base: VITE_API_URL o, si no está definida, '/api' (mismo origen; en
//   desarrollo el proxy de vite.config.js la reenvía a http://localhost:3000).
//   Si VITE_API_URL apunta a otro origen, el backend necesitaría CORS.
// - Agrega "Authorization: Bearer <token>" si hay sesión y "X-Carrito-Id"
//   si hay carrito anónimo, y guarda el X-Carrito-Id que devuelva la API.
// - Los errores se lanzan como ErrorApi (status, mensaje y detalle con los
//   campos extra de la respuesta). Un 401 con sesión cierra la sesión local.
// - Los nombres de las funciones que usan las vistas se mantienen.

import {
  cerrarSesionLocal,
  guardarCarritoAnonimo,
  guardarOrdenInvitado,
  obtenerCarritoAnonimo,
  obtenerToken,
  obtenerTokenOrden
} from './sesion'

const CABECERA_CARRITO = 'X-Carrito-Id'

/** Error de la API con su código HTTP y los campos extra de la respuesta. */
export class ErrorApi extends Error {
  /**
   * @param {number} status código HTTP (0 si no hubo respuesta)
   * @param {string} mensaje
   * @param {Record<string, unknown>} [detalle] campos extra (stock_disponible, productos, ...)
   */
  constructor(status, mensaje, detalle = {}) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.detalle = detalle
  }
}

/** URL base de la API (se lee en cada llamada para poder cambiarla en los tests). */
export function urlBase() {
  const base = import.meta.env?.VITE_API_URL || '/api'
  return base.replace(/\/+$/, '')
}

/**
 * Arma "?a=1&b=2" omitiendo valores vacíos.
 * @param {Record<string, unknown>} [query]
 */
function armarQuery(query = {}) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === null || valor === '') continue
    params.set(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

/**
 * Hace una petición a la API.
 * @param {string} metodo
 * @param {string} ruta por ejemplo '/productos'
 * @param {{ cuerpo?: unknown, query?: Record<string, unknown>, cabeceras?: Record<string, string> }} [opciones]
 *   cabeceras: cabeceras adicionales (por ejemplo X-Orden-Token)
 * @returns {Promise<any>} cuerpo JSON de la respuesta
 */
export async function pedir(metodo, ruta, { cuerpo, query, cabeceras: extra = {} } = {}) {
  const token = obtenerToken()
  const carritoAnonimo = obtenerCarritoAnonimo()
  const cabeceras = { Accept: 'application/json', ...extra }
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'
  if (token) cabeceras.Authorization = `Bearer ${token}`
  if (carritoAnonimo) cabeceras[CABECERA_CARRITO] = carritoAnonimo

  let respuesta
  try {
    respuesta = await fetch(`${urlBase()}${ruta}${armarQuery(query)}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }

  // Sin sesión, la API identifica el carrito anónimo con esta cabecera.
  const idCarrito = respuesta.headers.get(CABECERA_CARRITO)
  if (idCarrito && !token) guardarCarritoAnonimo(idCarrito)

  let datos = null
  const texto = await respuesta.text()
  if (texto) {
    try {
      datos = JSON.parse(texto)
    } catch {
      datos = null
    }
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) cerrarSesionLocal()
    const { error, ...detalle } = datos && typeof datos === 'object' ? datos : {}
    throw new ErrorApi(respuesta.status, error || `Error ${respuesta.status} al comunicarse con el servidor`, detalle)
  }
  return datos
}

// ---------------------------------------------------------------------------
// Estado de la API
// ---------------------------------------------------------------------------

/** GET /api/salud: true si la API y la base de datos responden. */
export async function testConnection() {
  const salud = await pedir('GET', '/salud')
  return salud?.estado === 'ok'
}

/** GET /api/salud completo (lo muestra la pantalla de configuración del panel). */
export const fetchSalud = () => pedir('GET', '/salud')

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/** GET /api/home: { destacados, categorias } en una sola petición (página liviana). */
export const fetchHome = () => pedir('GET', '/home')

/** GET /api/categorias: [{ id, nombre, descripcion, total_productos }] */
export const fetchCategorias = () => pedir('GET', '/categorias')

/** Límite por página del catálogo (el backend admite hasta 48). */
export const PRODUCTOS_POR_PAGINA = 12

/**
 * Catálogo con filtros y paginación del servidor. Con texto de búsqueda
 * (2 o más caracteres) usa GET /api/buscar, que acepta los mismos filtros.
 * Los valores 'Todas' / 0 / false significan "sin filtro".
 * @returns {Promise<{ items: object[], total: number, pagina: number, limite: number, totalPaginas: number }>}
 */
export function fetchProductosPublicos({
  busqueda = '',
  categoriaId = 'Todas',
  temporada = 'Todas',
  precioMin = 0,
  precioMax,
  soloEnStock = false,
  orden,
  pagina = 1,
  limite = PRODUCTOS_POR_PAGINA
} = {}) {
  const texto = busqueda.trim()
  const query = {
    categoria: categoriaId && categoriaId !== 'Todas' ? categoriaId : undefined,
    temporada: temporada && temporada !== 'Todas' ? temporada : undefined,
    precio_min: precioMin > 0 ? precioMin : undefined,
    precio_max: precioMax,
    en_stock: soloEnStock ? 'true' : undefined,
    orden,
    pagina,
    limite
  }
  if (texto.length >= 2) return pedir('GET', '/buscar', { query: { q: texto, ...query } })
  return pedir('GET', '/productos', { query })
}

/**
 * GET /api/productos/:id: producto con galería, ventas de 90 días y
 * relacionados. Devuelve null si no existe.
 */
export async function fetchProductoById(id) {
  try {
    return await pedir('GET', `/productos/${encodeURIComponent(id)}`)
  } catch (err) {
    if (err instanceof ErrorApi && err.status === 404) return null
    throw err
  }
}

/**
 * Relacionados de un producto: los trae el mismo detalle (GET /api/productos/:id).
 * Se conserva por compatibilidad; las vistas usan producto.relacionados.
 */
export async function fetchProductosRelacionados(_categoriaId, productoIdActual, limit = 4) {
  const producto = await fetchProductoById(productoIdActual)
  return (producto?.relacionados || []).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

/** POST /api/auth/login → { usuario, token } */
export const iniciarSesion = (email, contrasena) => pedir('POST', '/auth/login', { cuerpo: { email, contrasena } })

/** POST /api/auth/registro → { usuario, token } */
export const registrarUsuario = (nombre, email, contrasena) =>
  pedir('POST', '/auth/registro', { cuerpo: { nombre, email, contrasena } })

/** GET /api/auth/yo → usuario de la sesión actual */
export const fetchUsuarioActual = () => pedir('GET', '/auth/yo')

// ---------------------------------------------------------------------------
// Carrito (la respuesta de la API es la fuente de verdad)
// ---------------------------------------------------------------------------

/** Respuesta de carrito vacío (sin carrito todavía). */
export const CARRITO_VACIO = Object.freeze({ id: null, items: [], total_unidades: 0, subtotal: 0 })

/** GET /api/carrito. Sin sesión ni carrito anónimo no hace la petición. */
export async function fetchCarrito() {
  if (!obtenerToken() && !obtenerCarritoAnonimo()) return { ...CARRITO_VACIO }
  const carrito = await pedir('GET', '/carrito')
  // Un id anónimo vencido o desconocido se descarta.
  if (!obtenerToken() && !carrito.id) guardarCarritoAnonimo(null)
  return carrito
}

/** POST /api/carrito/items (409 con stock_disponible si no alcanza). */
export const agregarAlCarrito = (productoId, cantidad = 1) =>
  pedir('POST', '/carrito/items', { cuerpo: { producto_id: productoId, cantidad } })

/** PATCH /api/carrito/items/:id con la cantidad final. */
export const cambiarCantidadCarrito = (productoId, cantidad) =>
  pedir('PATCH', `/carrito/items/${encodeURIComponent(productoId)}`, { cuerpo: { cantidad } })

/** DELETE /api/carrito/items/:id */
export const quitarDelCarrito = (productoId) => pedir('DELETE', `/carrito/items/${encodeURIComponent(productoId)}`)

/** DELETE /api/carrito */
export const vaciarCarrito = () => pedir('DELETE', '/carrito')

/**
 * POST /api/carrito/fusionar: mueve el carrito anónimo al del usuario recién
 * autenticado y olvida el id anónimo. Sin carrito anónimo no hace nada.
 */
export async function fusionarCarrito() {
  if (!obtenerCarritoAnonimo()) return null
  try {
    return await pedir('POST', '/carrito/fusionar')
  } finally {
    guardarCarritoAnonimo(null)
  }
}

// ---------------------------------------------------------------------------
// Checkout y órdenes
// ---------------------------------------------------------------------------

/**
 * POST /api/checkout con pago simulado (medio_pago "mock").
 * - Con sesión: usa el carrito del usuario; el email es el de la cuenta.
 * - Como invitado: usa el carrito anónimo y exige despacho.email. La API
 *   devuelve token_consulta, que se guarda para volver a ver la orden.
 * @param {{ despacho: { nombre: string, apellido: string, telefono: string, region: string,
 *   comuna: string, direccion: string, depto?: string, email?: string } }} datos
 * @returns {Promise<object>} la orden creada
 */
export async function procesarOrdenWeb({ despacho }) {
  const orden = await pedir('POST', '/checkout', { cuerpo: { medio_pago: 'mock', despacho } })
  if (orden?.token_consulta) guardarOrdenInvitado(orden.id, orden.token_consulta)
  return orden
}

/**
 * GET /api/ordenes/:id. La ve el dueño, un admin o, si la orden se compró
 * como invitado en este navegador, quien tenga su token (X-Orden-Token).
 */
export function fetchOrdenById(id) {
  const tokenOrden = obtenerTokenOrden(id)
  return pedir('GET', `/ordenes/${encodeURIComponent(id)}`, {
    cabeceras: tokenOrden ? { 'X-Orden-Token': tokenOrden } : {}
  })
}

/** ¿Esta orden se compró como invitado en este navegador? */
export const esOrdenDeInvitado = (id) => obtenerTokenOrden(id) !== null

/**
 * Datos de despacho del último pedido del usuario con sesión, para
 * completar el checkout. Devuelve null sin sesión o si no tiene pedidos.
 * @returns {Promise<Record<string, string> | null>}
 */
export async function fetchUltimoDespacho() {
  if (!obtenerToken()) return null
  const lista = await pedir('GET', '/ordenes', { query: { pagina: 1, limite: 1 } })
  const ultima = lista?.items?.[0]
  if (!ultima) return null
  const orden = await pedir('GET', `/ordenes/${encodeURIComponent(ultima.id)}`)
  return orden?.despacho && typeof orden.despacho === 'object' ? orden.despacho : null
}

/** GET /api/ordenes paginado: { items, total, pagina, limite, totalPaginas } */
export const fetchMisOrdenes = ({ pagina = 1, limite = 10 } = {}) => pedir('GET', '/ordenes', { query: { pagina, limite } })

// ---------------------------------------------------------------------------
// Panel de administración (/api/admin, exige sesión con rol admin).
// Las funciones conservan sus nombres y entregan los datos con la forma que
// esperan las vistas del panel. Los totales los calcula el servidor: el
// campo total que arman las vistas no se envía.
// ---------------------------------------------------------------------------

/** Máximo de productos que el panel pide de una vez (la API admite hasta 1000). */
export const LIMITE_PRODUCTOS_PANEL = 1000

/** Estados del inventario: la vista usa "archivados"; la API, "inactivos". */
const ESTADOS_API = { archivados: 'inactivos' }

/** Convierte a número un valor de formulario (texto) o devuelve undefined si está vacío. */
const numeroOpcional = (valor) => (valor === '' || valor === null || valor === undefined ? undefined : Number(valor))

/**
 * Página de productos del panel: { items, total, pagina, limite, totalPaginas }.
 * @param {{ busqueda?: string, temporada?: string, estado?: string, pagina?: number, limite?: number }} [filtros]
 */
export function fetchProductosPaginados({
  busqueda = '',
  temporada = 'Todas',
  estado = 'todos',
  pagina = 1,
  limite = LIMITE_PRODUCTOS_PANEL
} = {}) {
  return pedir('GET', '/admin/productos', {
    query: {
      busqueda: busqueda.trim() || undefined,
      temporada: temporada && temporada !== 'Todas' ? temporada : undefined,
      estado: ESTADOS_API[estado] ?? estado,
      pagina,
      limite
    }
  })
}

/** Arreglo de productos del panel (activos e inactivos) con costo y stock mínimo. */
export async function fetchProductos(filtros = {}) {
  return (await fetchProductosPaginados(filtros)).items
}

export const createProducto = (producto) => pedir('POST', '/admin/productos', { cuerpo: producto })

/** Edita un producto. El stock no se edita (cambia con compras y ventas). */
export function updateProducto(id, producto) {
  // eslint-disable-next-line no-unused-vars
  const { stock_actual, ...campos } = producto
  return pedir('PATCH', `/admin/productos/${encodeURIComponent(id)}`, { cuerpo: campos })
}

export const toggleActivoProducto = (id, activo) =>
  pedir('PATCH', `/admin/productos/${encodeURIComponent(id)}/activo`, { cuerpo: { activo: Boolean(activo) } })

export const createCategoria = ({ nombre, descripcion }) =>
  pedir('POST', '/admin/categorias', { cuerpo: { nombre, descripcion: descripcion || null } })

/**
 * Registra una compra a proveedor. Los items con es_nuevo crean el producto
 * (queda inactivo hasta ponerle precio y activarlo desde Inventario).
 */
export function registrarCompra({ proveedor, notas, items }) {
  return pedir('POST', '/admin/compras', {
    cuerpo: {
      proveedor: proveedor || null,
      notas: notas || null,
      items: items.map((it) => {
        const base = { cantidad: Number(it.cantidad), costo_unitario: Number(it.costo_unitario) }
        if (!it.es_nuevo) return { ...base, producto_id: it.producto_id }
        return {
          ...base,
          es_nuevo: true,
          nombre: it.nombre,
          sku: it.sku || null,
          categoria_id: it.categoria_id || null,
          temporada: it.temporada || 'General',
          stock_minimo: numeroOpcional(it.stock_minimo),
          precio_venta: numeroOpcional(it.precio_venta)
        }
      })
    }
  })
}

/** Registra una venta manual (Instagram, WhatsApp, Presencial u Otro). */
export function registrarVenta({ canal_venta, cliente_nombre, notas, items }) {
  return pedir('POST', '/admin/ventas', {
    cuerpo: {
      canal_venta,
      cliente_nombre: cliente_nombre || null,
      notas: notas || null,
      items: items.map((it) => ({
        producto_id: it.producto_id,
        cantidad: Number(it.cantidad),
        precio_unitario: numeroOpcional(it.precio_unitario)
      }))
    }
  })
}

/** { inmovilizado, balance, criticos, canales } */
export const fetchDashboardData = () => pedir('GET', '/admin/dashboard')

export const fetchAuditLogs = (limite = 100) => pedir('GET', '/admin/auditoria', { query: { limite } })

export const fetchHistorialCompras = (limite = 15) => pedir('GET', '/admin/compras', { query: { limite } })

export const fetchHistorialVentas = (limite = 15) => pedir('GET', '/admin/ventas', { query: { limite } })
