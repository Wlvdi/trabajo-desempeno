// src/services/api.test.js
// Tests del cliente HTTP de la API propia, con fetch simulado (entorno Node).
import { describe, it, expect, vi } from 'vitest'
import {
  ErrorApi,
  fetchCarrito,
  fetchProductoById,
  fetchProductosPublicos,
  fusionarCarrito,
  agregarAlCarrito,
  fetchProductos,
  fetchProductosPaginados,
  createProducto,
  updateProducto,
  toggleActivoProducto,
  createCategoria,
  registrarCompra,
  registrarVenta,
  fetchDashboardData,
  fetchAuditLogs,
  fetchHistorialCompras,
  fetchHistorialVentas,
  pedir,
  procesarOrdenWeb,
  urlBase,
  esOrdenDeInvitado,
  fetchOrdenById,
  fetchUltimoDespacho
} from './api'
import {
  alCerrarSesion,
  guardarCarritoAnonimo,
  guardarSesion,
  obtenerCarritoAnonimo,
  obtenerToken,
  obtenerUsuario
} from './sesion'

const USUARIO = { id: 'u-1', email: 'test001@ejemplo.cl', nombre: 'Test', rol: 'cliente' }
const ID_CARRITO = '3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b'

/**
 * Reemplaza fetch por una función que responde en orden las respuestas dadas.
 * @param {...{ status?: number, cuerpo?: unknown, cabeceras?: Record<string, string> }} respuestas
 */
function simularFetch(...respuestas) {
  const fetchFalso = vi.fn(async () => {
    const { status = 200, cuerpo = {}, cabeceras = {} } = respuestas.shift() ?? {}
    return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), {
      status,
      headers: { 'Content-Type': 'application/json', ...cabeceras }
    })
  })
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

/** URL y cabeceras de la llamada número `n` a fetch. */
function llamada(fetchFalso, n = 0) {
  const [url, opciones] = fetchFalso.mock.calls[n]
  return { url, opciones, cabeceras: opciones.headers }
}

describe('URL base', () => {
  it('usa /api en el mismo origen si VITE_API_URL no está definida', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const f = simularFetch({ cuerpo: { estado: 'ok' } })
    await pedir('GET', '/salud')
    expect(urlBase()).toBe('/api')
    expect(llamada(f).url).toBe('/api/salud')
  })

  it('usa VITE_API_URL si está definida (sin barra final duplicada)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.subligol.test/api/')
    const f = simularFetch({ cuerpo: {} })
    await pedir('GET', '/home')
    expect(llamada(f).url).toBe('https://api.subligol.test/api/home')
  })

  it('arma la query omitiendo valores vacíos', async () => {
    const f = simularFetch({ cuerpo: { items: [] } })
    await pedir('GET', '/productos', { query: { pagina: 2, temporada: '', categoria: undefined, en_stock: 'true' } })
    expect(llamada(f).url).toBe('/api/productos?pagina=2&en_stock=true')
  })
})

describe('Cabeceras', () => {
  it('sin sesión ni carrito no envía Authorization ni X-Carrito-Id', async () => {
    const f = simularFetch({ cuerpo: {} })
    await pedir('GET', '/home')
    expect(llamada(f).cabeceras.Authorization).toBeUndefined()
    expect(llamada(f).cabeceras['X-Carrito-Id']).toBeUndefined()
  })

  it('con sesión agrega Authorization: Bearer <token>', async () => {
    guardarSesion({ token: 'jwt.de.prueba', usuario: USUARIO })
    const f = simularFetch({ cuerpo: USUARIO })
    await pedir('GET', '/auth/yo')
    expect(llamada(f).cabeceras.Authorization).toBe('Bearer jwt.de.prueba')
  })

  it('con carrito anónimo agrega X-Carrito-Id', async () => {
    guardarCarritoAnonimo(ID_CARRITO)
    const f = simularFetch({ cuerpo: { id: ID_CARRITO, items: [] } })
    await pedir('GET', '/carrito')
    expect(llamada(f).cabeceras['X-Carrito-Id']).toBe(ID_CARRITO)
  })

  it('envía el cuerpo como JSON', async () => {
    const f = simularFetch({ status: 201, cuerpo: { id: 'o-1' } })
    await procesarOrdenWeb({ despacho: { nombre: 'Ana' } })
    const { opciones, cabeceras } = llamada(f)
    expect(opciones.method).toBe('POST')
    expect(cabeceras['Content-Type']).toBe('application/json')
    expect(JSON.parse(opciones.body)).toEqual({ medio_pago: 'mock', despacho: { nombre: 'Ana' } })
  })

  it('con medioPago "webpay" lo envía en el cuerpo', async () => {
    const f = simularFetch({ status: 201, cuerpo: { id: 'o-2', pago: { url: 'https://webpay', token: 't' } } })
    const orden = await procesarOrdenWeb({ despacho: { nombre: 'Ana' }, medioPago: 'webpay' })
    expect(JSON.parse(llamada(f).opciones.body)).toEqual({ medio_pago: 'webpay', despacho: { nombre: 'Ana' } })
    expect(orden.pago).toEqual({ url: 'https://webpay', token: 't' })
  })
})

describe('Carrito anónimo', () => {
  it('guarda el X-Carrito-Id que devuelve la API cuando no hay sesión', async () => {
    simularFetch({ cuerpo: { id: ID_CARRITO, items: [] }, cabeceras: { 'X-Carrito-Id': ID_CARRITO } })
    await agregarAlCarrito('p-1', 1)
    expect(obtenerCarritoAnonimo()).toBe(ID_CARRITO)
  })

  it('con sesión no guarda un id anónimo', async () => {
    guardarSesion({ token: 'jwt', usuario: USUARIO })
    simularFetch({ cuerpo: { id: 'c-usuario', items: [] }, cabeceras: { 'X-Carrito-Id': ID_CARRITO } })
    await agregarAlCarrito('p-1', 1)
    expect(obtenerCarritoAnonimo()).toBeNull()
  })

  it('sin sesión ni carrito, fetchCarrito no hace la petición', async () => {
    const f = simularFetch()
    expect(await fetchCarrito()).toMatchObject({ id: null, items: [] })
    expect(f).not.toHaveBeenCalled()
  })

  it('descarta un id anónimo que la API ya no reconoce', async () => {
    guardarCarritoAnonimo(ID_CARRITO)
    simularFetch({ cuerpo: { id: null, items: [], total_unidades: 0, subtotal: 0 } })
    await fetchCarrito()
    expect(obtenerCarritoAnonimo()).toBeNull()
  })

  it('fusionarCarrito envía token e id anónimo y luego olvida el id', async () => {
    guardarSesion({ token: 'jwt', usuario: USUARIO })
    guardarCarritoAnonimo(ID_CARRITO)
    const f = simularFetch({ cuerpo: { id: 'c-usuario', items: [] } })
    await fusionarCarrito()
    expect(llamada(f).url).toBe('/api/carrito/fusionar')
    expect(llamada(f).cabeceras).toMatchObject({ Authorization: 'Bearer jwt', 'X-Carrito-Id': ID_CARRITO })
    expect(obtenerCarritoAnonimo()).toBeNull()
  })

  it('fusionarCarrito sin carrito anónimo no hace nada', async () => {
    const f = simularFetch()
    expect(await fusionarCarrito()).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
})

describe('ErrorApi', () => {
  it('lanza ErrorApi con status, mensaje y los campos extra (409 del carrito)', async () => {
    simularFetch({ status: 409, cuerpo: { error: 'No hay stock suficiente', stock_disponible: 3 } })
    const err = await agregarAlCarrito('p-1', 5).catch((e) => e)
    expect(err).toBeInstanceOf(ErrorApi)
    expect(err.status).toBe(409)
    expect(err.message).toBe('No hay stock suficiente')
    expect(err.detalle).toEqual({ stock_disponible: 3 })
  })

  it('conserva la lista de productos del 409 del checkout', async () => {
    const productos = [{ producto_id: 'p-1', nombre: 'Taza', solicitado: 3, disponible: 1 }]
    simularFetch({ status: 409, cuerpo: { error: 'Stock insuficiente para completar la compra', productos } })
    const err = await procesarOrdenWeb({ despacho: {} }).catch((e) => e)
    expect(err.detalle.productos).toEqual(productos)
  })

  it('un error de red se convierte en ErrorApi con status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    const err = await pedir('GET', '/home').catch((e) => e)
    expect(err).toBeInstanceOf(ErrorApi)
    expect(err.status).toBe(0)
  })

  it('un cuerpo de error que no es JSON igual produce un mensaje', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad Gateway', { status: 502 })))
    const err = await pedir('GET', '/home').catch((e) => e)
    expect(err.status).toBe(502)
    expect(err.message).toMatch(/502/)
  })

  it('fetchProductoById devuelve null ante un 404', async () => {
    simularFetch({ status: 404, cuerpo: { error: 'Producto no encontrado' } })
    expect(await fetchProductoById('no-existe')).toBeNull()
  })

})

describe('Cierre de sesión ante 401', () => {
  it('un 401 con sesión borra token y usuario y avisa a los suscriptores', async () => {
    guardarSesion({ token: 'jwt-vencido', usuario: USUARIO })
    const aviso = vi.fn()
    const anular = alCerrarSesion(aviso)
    simularFetch({ status: 401, cuerpo: { error: 'Token inválido o expirado' } })

    const err = await pedir('GET', '/auth/yo').catch((e) => e)
    anular()

    expect(err.status).toBe(401)
    expect(obtenerToken()).toBeNull()
    expect(obtenerUsuario()).toBeNull()
    expect(aviso).toHaveBeenCalledTimes(1)
  })

  it('un 401 sin sesión (credenciales incorrectas) no avisa cierre de sesión', async () => {
    const aviso = vi.fn()
    const anular = alCerrarSesion(aviso)
    simularFetch({ status: 401, cuerpo: { error: 'Correo o contraseña incorrectos' } })
    const err = await pedir('POST', '/auth/login', { cuerpo: {} }).catch((e) => e)
    anular()
    expect(err.message).toBe('Correo o contraseña incorrectos')
    expect(aviso).not.toHaveBeenCalled()
  })
})

describe('fetchProductosPublicos', () => {
  it('sin texto usa /productos con los filtros del servidor', async () => {
    const f = simularFetch({ cuerpo: { items: [], total: 0, pagina: 2, limite: 12, totalPaginas: 0 } })
    await fetchProductosPublicos({
      categoriaId: 'cat-1',
      temporada: 'Navidad',
      precioMax: 15000,
      soloEnStock: true,
      orden: 'precio_asc',
      pagina: 2
    })
    const url = new URL(llamada(f).url, 'http://x')
    expect(url.pathname).toBe('/api/productos')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      categoria: 'cat-1',
      temporada: 'Navidad',
      precio_max: '15000',
      en_stock: 'true',
      orden: 'precio_asc',
      pagina: '2',
      limite: '12'
    })
  })

  it('"Todas" y los valores por defecto no se envían como filtro', async () => {
    const f = simularFetch({ cuerpo: { items: [] } })
    await fetchProductosPublicos({ categoriaId: 'Todas', temporada: 'Todas' })
    expect(llamada(f).url).toBe('/api/productos?pagina=1&limite=12')
  })

  it('con texto de 2 o más caracteres usa /buscar con los mismos filtros', async () => {
    const f = simularFetch({ cuerpo: { items: [] } })
    await fetchProductosPublicos({ busqueda: '  taza ', temporada: 'Verano', orden: 'relevancia' })
    const url = new URL(llamada(f).url, 'http://x')
    expect(url.pathname).toBe('/api/buscar')
    expect(url.searchParams.get('q')).toBe('taza')
    expect(url.searchParams.get('temporada')).toBe('Verano')
    expect(url.searchParams.get('orden')).toBe('relevancia')
  })

  it('con texto de 1 carácter no busca (el servidor exige 2)', async () => {
    const f = simularFetch({ cuerpo: { items: [] } })
    await fetchProductosPublicos({ busqueda: 't' })
    expect(new URL(llamada(f).url, 'http://x').pathname).toBe('/api/productos')
  })
})

describe('Compra como invitado', () => {
  const ORDEN_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
  const TOKEN_ORDEN = '11111111-2222-4333-8444-555555555555'
  const DESPACHO = {
    nombre: 'Ana', apellido: 'Rojas', telefono: '+56912345678',
    region: 'Región Metropolitana', comuna: 'Ñuñoa', direccion: 'Av. Siempre Viva 742', email: 'ana@ejemplo.cl'
  }

  it('envía el email del invitado y el X-Carrito-Id, sin Authorization', async () => {
    guardarCarritoAnonimo(ID_CARRITO)
    const f = simularFetch({ status: 201, cuerpo: { id: ORDEN_ID, codigo: 'SUB-2026-500000', token_consulta: TOKEN_ORDEN } })
    await procesarOrdenWeb({ despacho: DESPACHO })
    const { opciones, cabeceras } = llamada(f)
    expect(JSON.parse(opciones.body)).toEqual({ medio_pago: 'mock', despacho: DESPACHO })
    expect(cabeceras['X-Carrito-Id']).toBe(ID_CARRITO)
    expect(cabeceras.Authorization).toBeUndefined()
  })

  it('guarda el token de la orden y lo envía al consultarla después', async () => {
    simularFetch({ status: 201, cuerpo: { id: ORDEN_ID, token_consulta: TOKEN_ORDEN } })
    await procesarOrdenWeb({ despacho: DESPACHO })
    expect(esOrdenDeInvitado(ORDEN_ID)).toBe(true)

    const f = simularFetch({ cuerpo: { id: ORDEN_ID } })
    await fetchOrdenById(ORDEN_ID)
    expect(llamada(f).cabeceras['X-Orden-Token']).toBe(TOKEN_ORDEN)
  })

  it('una orden sin token guardado se consulta sin X-Orden-Token', async () => {
    const f = simularFetch({ cuerpo: {} })
    await fetchOrdenById('00000000-0000-4000-8000-000000000000')
    expect(llamada(f).cabeceras['X-Orden-Token']).toBeUndefined()
    expect(esOrdenDeInvitado('00000000-0000-4000-8000-000000000000')).toBe(false)
  })

  it('una compra con sesión (sin token_consulta) no guarda nada', async () => {
    guardarSesion({ token: 'jwt', usuario: USUARIO })
    simularFetch({ status: 201, cuerpo: { id: 'otra-orden' } })
    await procesarOrdenWeb({ despacho: DESPACHO })
    expect(esOrdenDeInvitado('otra-orden')).toBe(false)
  })
})

describe('fetchUltimoDespacho', () => {
  it('sin sesión devuelve null sin llamar a la API', async () => {
    const f = simularFetch()
    expect(await fetchUltimoDespacho()).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('con sesión devuelve el despacho del último pedido', async () => {
    guardarSesion({ token: 'jwt', usuario: USUARIO })
    const despacho = { region: 'Biobío', comuna: 'Concepción', direccion: 'Calle Soto 1234' }
    const f = simularFetch(
      { cuerpo: { items: [{ id: 'orden-1' }], total: 3 } },
      { cuerpo: { id: 'orden-1', despacho } }
    )
    expect(await fetchUltimoDespacho()).toEqual(despacho)
    expect(llamada(f, 0).url).toBe('/api/ordenes?pagina=1&limite=1')
    expect(llamada(f, 1).url).toBe('/api/ordenes/orden-1')
  })

  it('con sesión y sin pedidos devuelve null', async () => {
    guardarSesion({ token: 'jwt', usuario: USUARIO })
    simularFetch({ cuerpo: { items: [], total: 0 } })
    expect(await fetchUltimoDespacho()).toBeNull()
  })
})

describe('Panel de administración', () => {
  const ID = '11111111-2222-4333-8444-555555555555'
  const cuerpoDe = (f) => JSON.parse(llamada(f).opciones.body)

  it('fetchProductos devuelve el arreglo de items y envía filtros, límite 1000 y token', async () => {
    guardarSesion({ token: 'jwt-admin', usuario: { ...USUARIO, rol: 'admin' } })
    const f = simularFetch({ cuerpo: { items: [{ id: 'p-1' }], total: 1, pagina: 1, limite: 1000, totalPaginas: 1 } })
    expect(await fetchProductos({ busqueda: ' taza ', temporada: 'Navidad', estado: 'activos' })).toEqual([{ id: 'p-1' }])
    const url = new URL(llamada(f).url, 'http://x')
    expect(url.pathname).toBe('/api/admin/productos')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      busqueda: 'taza', temporada: 'Navidad', estado: 'activos', pagina: '1', limite: '1000'
    })
    expect(llamada(f).cabeceras.Authorization).toBe('Bearer jwt-admin')
  })

  it('"archivados" de la vista se envía como "inactivos" y "Todas" no filtra', async () => {
    const f = simularFetch({ cuerpo: { items: [], total: 0 } })
    await fetchProductosPaginados({ estado: 'archivados', temporada: 'Todas' })
    expect(llamada(f).url).toBe('/api/admin/productos?estado=inactivos&pagina=1&limite=1000')
  })

  it('fetchProductosPaginados entrega el total para el aviso "Mostrando X de Y"', async () => {
    simularFetch({ cuerpo: { items: [{ id: 'p-1' }], total: 1200, pagina: 1, limite: 1000, totalPaginas: 2 } })
    expect(await fetchProductosPaginados()).toMatchObject({ total: 1200, items: [{ id: 'p-1' }] })
  })

  it('crear, editar (sin stock) y activar productos', async () => {
    const f = simularFetch({ status: 201, cuerpo: { id: ID } }, { cuerpo: { id: ID } }, { cuerpo: { id: ID } })
    await createProducto({ nombre: 'Taza', stock_actual: 5 })
    await updateProducto(ID, { nombre: 'Taza 2', stock_actual: 9, precio_venta: 4990 })
    await toggleActivoProducto(ID, false)

    expect(llamada(f, 0)).toMatchObject({ url: '/api/admin/productos', opciones: { method: 'POST' } })
    expect(cuerpoDe(f)).toEqual({ nombre: 'Taza', stock_actual: 5 })
    expect(llamada(f, 1)).toMatchObject({ url: `/api/admin/productos/${ID}`, opciones: { method: 'PATCH' } })
    expect(JSON.parse(llamada(f, 1).opciones.body)).toEqual({ nombre: 'Taza 2', precio_venta: 4990 })
    expect(llamada(f, 2)).toMatchObject({ url: `/api/admin/productos/${ID}/activo`, opciones: { method: 'PATCH' } })
    expect(JSON.parse(llamada(f, 2).opciones.body)).toEqual({ activo: false })
  })

  it('createCategoria envía nombre y descripción (vacía como null)', async () => {
    const f = simularFetch({ status: 201, cuerpo: { id: ID } })
    await createCategoria({ nombre: 'Llaveros', descripcion: '' })
    expect(llamada(f).url).toBe('/api/admin/categorias')
    expect(cuerpoDe(f)).toEqual({ nombre: 'Llaveros', descripcion: null })
  })

  it('registrarCompra convierte los textos a número, no envía el total y arma los artículos nuevos', async () => {
    const f = simularFetch({ status: 201, cuerpo: { id: 'c-1', productos_creados: [] } })
    await registrarCompra({
      proveedor: 'Proveedor',
      notas: '',
      total: 999,
      items: [
        { es_nuevo: false, producto_id: ID, cantidad: '10', costo_unitario: '1250.5' },
        { es_nuevo: true, nombre: 'Botella', sku: '', categoria_id: '', temporada: 'Verano', stock_minimo: '5', cantidad: 2, costo_unitario: 900 }
      ]
    })
    expect(llamada(f).url).toBe('/api/admin/compras')
    expect(cuerpoDe(f)).toEqual({
      proveedor: 'Proveedor',
      notas: null,
      items: [
        { producto_id: ID, cantidad: 10, costo_unitario: 1250.5 },
        { es_nuevo: true, nombre: 'Botella', sku: null, categoria_id: null, temporada: 'Verano', stock_minimo: 5, cantidad: 2, costo_unitario: 900 }
      ]
    })
  })

  it('registrarVenta convierte los textos a número, omite un precio vacío y no envía el total', async () => {
    const f = simularFetch({ status: 201, cuerpo: { id: 'v-1' } })
    await registrarVenta({
      canal_venta: 'WhatsApp',
      cliente_nombre: 'Ana',
      notas: '',
      total: 1,
      items: [{ producto_id: ID, cantidad: '2', precio_unitario: '3990' }, { producto_id: 'p-2', cantidad: 1, precio_unitario: '' }]
    })
    expect(cuerpoDe(f)).toEqual({
      canal_venta: 'WhatsApp',
      cliente_nombre: 'Ana',
      notas: null,
      items: [{ producto_id: ID, cantidad: 2, precio_unitario: 3990 }, { producto_id: 'p-2', cantidad: 1 }]
    })
  })

  it('el 409 de una venta conserva la lista de productos', async () => {
    const productos = [{ producto_id: ID, nombre: 'Taza', solicitado: 3, disponible: 1 }]
    simularFetch({ status: 409, cuerpo: { error: 'Stock insuficiente para registrar la venta', productos } })
    const err = await registrarVenta({ canal_venta: 'Otro', items: [{ producto_id: ID, cantidad: 3 }] }).catch((e) => e)
    expect(err).toBeInstanceOf(ErrorApi)
    expect(err.detalle.productos).toEqual(productos)
  })

  it('el historial de ventas puede filtrar solo los pedidos web', async () => {
    const f = simularFetch({ cuerpo: [] })
    await fetchHistorialVentas(15, { canal: 'Web' })
    expect(f.mock.calls[0][0]).toBe('/api/admin/ventas?limite=15&canal=Web')
  })

  it('dashboard, auditoría e historiales usan sus rutas y límites', async () => {
    const f = simularFetch({ cuerpo: {} }, { cuerpo: [] }, { cuerpo: [] }, { cuerpo: [] }, { cuerpo: [] })
    await fetchDashboardData()
    await fetchAuditLogs()
    await fetchAuditLogs(500)
    await fetchHistorialCompras(15)
    await fetchHistorialVentas()
    expect(f.mock.calls.map(([url]) => url)).toEqual([
      '/api/admin/dashboard',
      '/api/admin/auditoria?limite=100',
      '/api/admin/auditoria?limite=500',
      '/api/admin/compras?limite=15',
      '/api/admin/ventas?limite=15'
    ])
  })

  it('un 403 (cuenta sin rol admin) no cierra la sesión', async () => {
    guardarSesion({ token: 'jwt-cliente', usuario: USUARIO })
    simularFetch({ status: 403, cuerpo: { error: 'No tienes permisos para esta acción' } })
    const err = await fetchDashboardData().catch((e) => e)
    expect(err.status).toBe(403)
    expect(obtenerToken()).toBe('jwt-cliente')
  })
})
