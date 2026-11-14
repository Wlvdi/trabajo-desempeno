import { getSupabase } from './supabase'
import {
  INITIAL_CATEGORIAS,
  getLocalProductos,
  saveLocalProductos,
  getLocalOrders,
  saveLocalOrder
} from './mockData'

function getClientOrNull() {
  return getSupabase()
}

function checkClient() {
  const client = getSupabase()
  if (!client) {
    throw new Error('Supabase no está configurado. Por favor ingresa tus credenciales en Configuración.')
  }
  return client
}

// 1. Probar conexión
export async function testConnection() {
  const client = checkClient()
  const { data, error } = await client.from('categorias').select('count', { count: 'exact', head: true })
  if (error) throw error
  return true
}

// 2. Categorías
export async function fetchCategorias() {
  const client = getClientOrNull()
  if (!client) {
    return INITIAL_CATEGORIAS
  }

  try {
    const { data, error } = await client
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true })
    if (error || !data || data.length === 0) {
      return INITIAL_CATEGORIAS
    }
    return data
  } catch (err) {
    console.warn('Fallo al obtener categorías de Supabase, usando locales:', err)
    return INITIAL_CATEGORIAS
  }
}

export async function createCategoria({ nombre, descripcion = '' }) {
  const client = getClientOrNull()
  if (!client) {
    const nueva = {
      id: `cat-${Date.now()}`,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      icono: 'Tag',
      created_at: new Date().toISOString()
    }
    INITIAL_CATEGORIAS.push(nueva)
    return nueva
  }

  const { data, error } = await client
    .from('categorias')
    .insert([{ nombre: nombre.trim(), descripcion: descripcion?.trim() || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

// 3. Productos para el ERP
export async function fetchProductos({ busqueda = '', temporada = 'Todas', estado = 'todos' } = {}) {
  const client = getClientOrNull()
  if (!client) {
    let prods = getLocalProductos()
    if (temporada && temporada !== 'Todas') {
      prods = prods.filter(p => p.temporada === temporada)
    }
    if (estado === 'activos') {
      prods = prods.filter(p => p.activo !== false)
    } else if (estado === 'archivados') {
      prods = prods.filter(p => p.activo === false)
    } else if (estado === 'critico') {
      prods = prods.filter(p => p.stock_actual <= p.stock_minimo && p.stock_actual > 0)
    } else if (estado === 'agotado') {
      prods = prods.filter(p => p.stock_actual <= 0)
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      prods = prods.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      )
    }
    return prods
  }

  try {
    let query = client
      .from('productos')
      .select(`
        *,
        categoria:categorias ( id, nombre )
      `)
      .order('nombre', { ascending: true })

    if (temporada && temporada !== 'Todas') {
      query = query.eq('temporada', temporada)
    }

    if (estado === 'activos') {
      query = query.eq('activo', true)
    } else if (estado === 'archivados') {
      query = query.eq('activo', false)
    }

    if (busqueda.trim()) {
      query = query.or(`nombre.ilike.%${busqueda}%,sku.ilike.%${busqueda}%`)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) {
      return getLocalProductos()
    }

    if (estado === 'critico') {
      return data.filter(p => p.stock_actual <= p.stock_minimo && p.stock_actual > 0)
    }
    if (estado === 'agotado') {
      return data.filter(p => p.stock_actual <= 0)
    }

    return data
  } catch (err) {
    console.warn('Error en fetchProductos de Supabase, usando local:', err)
    return getLocalProductos()
  }
}

// 4. Catálogo Público para la Tienda E-commerce (Filtros, Búsqueda, Rango de Precios, Orden)
export async function fetchProductosPublicos({
  busqueda = '',
  categoriaId = 'Todas',
  temporada = 'Todas',
  precioMin = 0,
  precioMax = 999999,
  soloEnStock = false,
  orden = 'destacado'
} = {}) {
  // Obtenemos los productos (de Supabase o locales)
  let items = await fetchProductos({ busqueda, temporada: 'Todas', estado: 'activos' })

  if (!items || items.length === 0) {
    items = getLocalProductos()
  }

  // Filtrado por categoría
  if (categoriaId && categoriaId !== 'Todas') {
    items = items.filter(p => {
      const catId = p.categoria_id || (p.categoria && p.categoria.id)
      const catNombre = p.categoria_nombre || (p.categoria && p.categoria.nombre)
      return catId === categoriaId || catNombre === categoriaId
    })
  }

  // Filtrado por temporada
  if (temporada && temporada !== 'Todas') {
    items = items.filter(p => p.temporada === temporada)
  }

  // Filtrado por rango de precio
  if (precioMin > 0) {
    items = items.filter(p => Number(p.precio_venta) >= precioMin)
  }
  if (precioMax < 999999) {
    items = items.filter(p => Number(p.precio_venta) <= precioMax)
  }

  // Filtrado por stock
  if (soloEnStock) {
    items = items.filter(p => Number(p.stock_actual) > 0)
  }

  // Ordenamiento
  const sorted = [...items]
  switch (orden) {
    case 'precio_asc':
      sorted.sort((a, b) => Number(a.precio_venta) - Number(b.precio_venta))
      break
    case 'precio_desc':
      sorted.sort((a, b) => Number(b.precio_venta) - Number(a.precio_venta))
      break
    case 'nombre_asc':
      sorted.sort((a, b) => a.nombre.localeCompare(b.nombre))
      break
    case 'nombre_desc':
      sorted.sort((a, b) => b.nombre.localeCompare(a.nombre))
      break
    case 'stock_desc':
      sorted.sort((a, b) => Number(b.stock_actual) - Number(a.stock_actual))
      break
    case 'destacado':
    default:
      sorted.sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0))
      break
  }

  return sorted
}

// 5. Detalle de Producto por ID
export async function fetchProductoById(id) {
  const client = getClientOrNull()
  if (client) {
    try {
      const { data, error } = await client
        .from('productos')
        .select(`
          *,
          categoria:categorias ( id, nombre )
        `)
        .eq('id', id)
        .maybeSingle()
      if (data && !error) {
        // Enriquecer con campos mock si faltan para render completo
        const mockFallback = getLocalProductos().find(p => p.sku === data.sku || p.id === data.id)
        return {
          ...data,
          imagen_url: data.imagen_url || mockFallback?.imagen_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
          imagenes_galeria: mockFallback?.imagenes_galeria || [data.imagen_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'],
          descripcion_larga: mockFallback?.descripcion_larga || data.descripcion,
          especificaciones: mockFallback?.especificaciones || { material: 'Calidad Premium para Sublimación' }
        }
      }
    } catch (err) {
      console.warn('Error al buscar producto por id en Supabase:', err)
    }
  }

  // Buscar en local
  const prods = getLocalProductos()
  const found = prods.find(p => String(p.id) === String(id) || p.sku === id)
  if (!found) {
    return prods[0] || null
  }
  return found
}

// 6. Productos Relacionados
export async function fetchProductosRelacionados(categoriaId, productoIdActual, limit = 4) {
  const allProds = await fetchProductosPublicos({ categoriaId })
  return allProds
    .filter(p => String(p.id) !== String(productoIdActual))
    .slice(0, limit)
}

// 7. Procesar Orden de Compra Web (Disminuye stock y crea venta)
export async function procesarOrdenWeb({
  cliente,
  items,
  metodoPago = 'Webpay Plus',
  codigoAutorizacion = 'TBK-AUT-000000',
  total,
  costoEnvio = 0,
  notas = ''
}) {
  const client = getClientOrNull()
  const ordenId = `SUB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
  const fechaActual = new Date().toISOString()

  const nuevaOrden = {
    id: ordenId,
    fecha: fechaActual,
    cliente,
    items,
    metodoPago,
    codigoAutorizacion,
    costoEnvio,
    total,
    notas,
    estado: 'PAGADO_APROBADO'
  }

  // 1. Guardar siempre en local para historial de órdenes
  saveLocalOrder(nuevaOrden)

  // 2. Descontar stock en almacén local
  const prods = getLocalProductos()
  const prodsActualizados = prods.map(prod => {
    const comprado = items.find(i => String(i.id) === String(prod.id) || i.sku === prod.sku)
    if (comprado) {
      const nuevoStock = Math.max(0, Number(prod.stock_actual) - Number(comprado.cantidad))
      return { ...prod, stock_actual: nuevoStock }
    }
    return prod
  })
  saveLocalProductos(prodsActualizados)

  // 3. Si Supabase está conectado, sincronizar venta y rebajar stock
  if (client) {
    try {
      // Insertar cabecera venta
      const { data: venta, error: ventaError } = await client
        .from('ventas')
        .insert([{
          canal_venta: 'Web',
          cliente_nombre: `${cliente.nombre} ${cliente.apellido}`.trim(),
          total: Number(total),
          notas: `Orden E-commerce ${ordenId} | Webpay Auth: ${codigoAutorizacion} | Despacho: ${cliente.direccion}, ${cliente.comuna}, ${cliente.region}`
        }])
        .select()
        .single()

      if (!ventaError && venta) {
        // Insertar detalles
        const lineas = items.map(item => ({
          venta_id: venta.id,
          producto_id: item.id,
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio_venta),
          subtotal: Number(item.cantidad) * Number(item.precio_venta)
        }))
        await client.from('detalle_ventas').insert(lineas)
      }
    } catch (err) {
      console.warn('No se pudo replicar la orden web en Supabase:', err)
    }
  }

  return nuevaOrden
}

// 8. Consultar Orden por ID
export async function fetchOrdenById(id) {
  const orders = getLocalOrders()
  return orders.find(o => String(o.id) === String(id)) || null
}

// 9. Consultar Órdenes de un Usuario
export async function fetchMisOrdenes(email) {
  const orders = getLocalOrders()
  if (!email) return orders
  return orders.filter(o => o.cliente && o.cliente.email && o.cliente.email.toLowerCase() === email.toLowerCase())
}

// 10. CRUD de Productos para Admin
export async function createProducto(productoData) {
  const client = getClientOrNull()
  if (!client) {
    const prods = getLocalProductos()
    const nuevo = {
      ...productoData,
      id: `prod-${Date.now()}`,
      created_at: new Date().toISOString()
    }
    saveLocalProductos([nuevo, ...prods])
    return nuevo
  }

  const { data, error } = await client
    .from('productos')
    .insert([productoData])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProducto(id, productoData) {
  const client = getClientOrNull()
  if (!client) {
    const prods = getLocalProductos()
    const index = prods.findIndex(p => String(p.id) === String(id))
    if (index !== -1) {
      prods[index] = { ...prods[index], ...productoData }
      saveLocalProductos(prods)
      return prods[index]
    }
    return null
  }

  const { data, error } = await client
    .from('productos')
    .update(productoData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleActivoProducto(id, nuevoEstado) {
  const client = getClientOrNull()
  if (!client) {
    const prods = getLocalProductos()
    const target = prods.find(p => String(p.id) === String(id))
    if (target) {
      target.activo = nuevoEstado
      saveLocalProductos(prods)
      return target
    }
    return null
  }

  const { data, error } = await client
    .from('productos')
    .update({ activo: nuevoEstado })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// 11. Registrar Compra
export async function registrarCompra({ proveedor, total, notas, items }) {
  const client = getClientOrNull()
  if (!client) {
    // Aumentar stock local
    const prods = getLocalProductos()
    for (const item of items) {
      const prod = prods.find(p => String(p.id) === String(item.producto_id))
      if (prod) {
        prod.stock_actual = Number(prod.stock_actual) + Number(item.cantidad)
      }
    }
    saveLocalProductos(prods)
    return { id: `compra-${Date.now()}`, total, proveedor }
  }

  const itemsProcesados = []
  for (const item of items) {
    if (item.es_nuevo) {
      const { data: nuevoProd, error: prodError } = await client
        .from('productos')
        .insert([{
          sku: item.sku?.trim() || null,
          nombre: item.nombre.trim(),
          descripcion: item.descripcion?.trim() || null,
          categoria_id: item.categoria_id || null,
          temporada: item.temporada || 'General',
          costo_unitario: Number(item.costo_unitario) || 0,
          precio_venta: Number(item.precio_venta) || 0,
          stock_actual: 0,
          stock_minimo: Number(item.stock_minimo) || 5,
          activo: true
        }])
        .select()
        .single()

      if (prodError) throw prodError

      itemsProcesados.push({
        producto_id: nuevoProd.id,
        cantidad: Number(item.cantidad),
        costo_unitario: Number(item.costo_unitario)
      })
    } else {
      itemsProcesados.push({
        producto_id: item.producto_id,
        cantidad: Number(item.cantidad),
        costo_unitario: Number(item.costo_unitario)
      })
    }
  }

  const { data: compra, error: compraError } = await client
    .from('compras')
    .insert([{
      proveedor: proveedor || null,
      total: Number(total),
      notas: notas || null
    }])
    .select()
    .single()

  if (compraError) throw compraError

  const lineas = itemsProcesados.map(item => ({
    compra_id: compra.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    costo_unitario: item.costo_unitario,
    subtotal: item.cantidad * item.costo_unitario
  }))

  const { error: lineasError } = await client
    .from('detalle_compras')
    .insert(lineas)

  if (lineasError) throw lineasError

  return compra
}

// 12. Registrar Venta Manual desde el ERP
export async function registrarVenta({ canal_venta, cliente_nombre, total, notas, items }) {
  const client = getClientOrNull()
  if (!client) {
    const prods = getLocalProductos()
    for (const item of items) {
      const prod = prods.find(p => String(p.id) === String(item.producto_id))
      if (prod) {
        prod.stock_actual = Math.max(0, Number(prod.stock_actual) - Number(item.cantidad))
      }
    }
    saveLocalProductos(prods)
    return { id: `venta-${Date.now()}`, total, canal_venta }
  }

  const { data: venta, error: ventaError } = await client
    .from('ventas')
    .insert([{
      canal_venta,
      cliente_nombre: cliente_nombre || null,
      total: Number(total),
      notas: notas || null
    }])
    .select()
    .single()

  if (ventaError) throw ventaError

  const lineas = items.map(item => ({
    venta_id: venta.id,
    producto_id: item.producto_id,
    cantidad: Number(item.cantidad),
    precio_unitario: Number(item.precio_unitario),
    subtotal: Number(item.cantidad) * Number(item.precio_unitario)
  }))

  const { error: lineasError } = await client
    .from('detalle_ventas')
    .insert(lineas)

  if (lineasError) throw lineasError

  return venta
}

// 13. Consultas de Dashboard para el ERP
export async function fetchDashboardData() {
  const client = getClientOrNull()
  if (!client) {
    const prods = getLocalProductos()
    const orders = getLocalOrders()
    const totalRecaudado = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    const criticos = prods.filter(p => p.stock_actual <= p.stock_minimo && p.stock_actual > 0)
    const capitalInmovilizado = prods.reduce((sum, p) => sum + (Number(p.costo_unitario) * Number(p.stock_actual)), 0)
    const valorVentaTotal = prods.reduce((sum, p) => sum + (Number(p.precio_venta) * Number(p.stock_actual)), 0)

    return {
      inmovilizado: {
        total_productos_activos: prods.length,
        unidades_totales: prods.reduce((sum, p) => sum + Number(p.stock_actual), 0),
        capital_inmovilizado_costo: capitalInmovilizado,
        valor_total_venta_estimado: valorVentaTotal,
        margen_bruto_potencial: valorVentaTotal - capitalInmovilizado
      },
      balance: {
        total_invertido_compras: 120000,
        total_recaudado_ventas: totalRecaudado,
        balance_neto: totalRecaudado - 120000,
        cantidad_ventas_realizadas: orders.length,
        cantidad_compras_realizadas: 1
      },
      criticos,
      canales: [
        { canal_venta: 'Web', total_ventas: orders.length, monto_total: totalRecaudado }
      ]
    }
  }

  try {
    const [resInmovilizado, resBalance, resCriticos, resCanales] = await Promise.all([
      client.from('vista_capital_inmovilizado').select('*').maybeSingle(),
      client.from('vista_balance_comercial').select('*').maybeSingle(),
      client.from('vista_productos_stock_critico').select('*'),
      client.from('vista_ventas_por_canal').select('*')
    ])

    return {
      inmovilizado: resInmovilizado.data || {
        total_productos_activos: 0,
        unidades_totales: 0,
        capital_inmovilizado_costo: 0,
        valor_total_venta_estimado: 0,
        margen_bruto_potencial: 0
      },
      balance: resBalance.data || {
        total_invertido_compras: 0,
        total_recaudado_ventas: 0,
        balance_neto: 0,
        cantidad_ventas_realizadas: 0,
        cantidad_compras_realizadas: 0
      },
      criticos: resCriticos.data || [],
      canales: resCanales.data || []
    }
  } catch (err) {
    console.warn('Error al obtener datos de dashboard de Supabase:', err)
    return {
      inmovilizado: { total_productos_activos: 0, unidades_totales: 0, capital_inmovilizado_costo: 0, valor_total_venta_estimado: 0, margen_bruto_potencial: 0 },
      balance: { total_invertido_compras: 0, total_recaudado_ventas: 0, balance_neto: 0, cantidad_ventas_realizadas: 0, cantidad_compras_realizadas: 0 },
      criticos: [],
      canales: []
    }
  }
}

// 14. Historiales
export async function fetchAuditLogs(limit = 100) {
  const client = getClientOrNull()
  if (!client) {
    return [
      {
        id: 'aud-001',
        fecha: new Date().toISOString(),
        tipo_evento: 'INICIO_SISTEMA',
        entidad_afectada: 'productos',
        descripcion: 'Catálogo semilla Subligol cargado con éxito para entorno autónomo.'
      }
    ]
  }

  try {
    const { data, error } = await client
      .from('vista_historial_auditoria')
      .select('*')
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('Error al obtener logs de auditoría:', err)
    return []
  }
}

export async function fetchHistorialCompras(limit = 20) {
  const client = getClientOrNull()
  if (!client) return []
  try {
    const { data, error } = await client
      .from('compras')
      .select(`
        *,
        detalles:detalle_compras (
          id, cantidad, costo_unitario, subtotal,
          producto:productos ( id, nombre, sku )
        )
      `)
      .order('fecha', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (err) {
    return []
  }
}

export async function fetchHistorialVentas(limit = 20) {
  const client = getClientOrNull()
  if (!client) {
    const orders = getLocalOrders()
    return orders.map(o => ({
      id: o.id,
      fecha: o.fecha,
      canal_venta: 'Web',
      cliente_nombre: `${o.cliente?.nombre || ''} ${o.cliente?.apellido || ''}`,
      total: o.total,
      notas: `Webpay Auth: ${o.codigoAutorizacion}`,
      detalles: (o.items || []).map(i => ({
        id: `det-${i.id}`,
        cantidad: i.cantidad,
        precio_unitario: i.precio_venta,
        subtotal: i.cantidad * i.precio_venta,
        producto: { id: i.id, nombre: i.nombre, sku: i.sku }
      }))
    }))
  }

  try {
    const { data, error } = await client
      .from('ventas')
      .select(`
        *,
        detalles:detalle_ventas (
          id, cantidad, precio_unitario, subtotal,
          producto:productos ( id, nombre, sku )
        )
      `)
      .order('fecha', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (err) {
    return []
  }
}
