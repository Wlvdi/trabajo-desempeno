import React, { useState, useEffect } from 'react'
import {
  ShoppingBag,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowDownRight,
  RefreshCw,
  Sparkles,
  Package,
  Layers,
  ArrowLeftRight
} from 'lucide-react'
import {
  fetchProductos,
  fetchCategorias,
  registrarCompra,
  fetchHistorialCompras
} from '../services/api'
import ModalNuevaCategoria from '../components/ModalNuevaCategoria'

export default function ComprasView({ onCompraExitosa }) {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingDatos, setLoadingDatos] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)
  const [isModalCategoriaOpen, setIsModalCategoriaOpen] = useState(false)
  const [targetIdxCategoria, setTargetIdxCategoria] = useState(null)

  // Cabecera de compra
  const [proveedor, setProveedor] = useState('')
  const [notas, setNotas] = useState('')

  // Temporadas disponibles
  const temporadas = [
    'General',
    'Escolar',
    'Día de la Madre',
    'Día del Padre',
    'Día del Niño',
    'Fiestas Patrias',
    'Navidad',
    'Verano'
  ]

  // Líneas de compra (por defecto 1 línea)
  const [items, setItems] = useState([
    {
      id: 1,
      es_nuevo: true,
      producto_id: '',
      nombre: '',
      sku: '',
      categoria_id: '',
      temporada: 'General',
      stock_minimo: '5',
      cantidad: 10,
      costo_unitario: 1500,
      subtotal: 15000
    }
  ])

  const loadData = async () => {
    setLoadingDatos(true)
    try {
      const [prods, cats, hist] = await Promise.all([
        fetchProductos({ estado: 'activos' }).catch(() => []),
        fetchCategorias().catch(() => []),
        fetchHistorialCompras(15).catch(() => [])
      ])
      
      setProductos(prods || [])
      setCategorias(cats || [])
      setHistorial(hist || [])

      if (prods && prods.length > 0) {
        setItems(prev => {
          if (prev.length === 1 && prev[0].nombre === '' && prev[0].producto_id === '') {
            const costo = prods[0].costo_unitario || 1000
            const cant = 10
            return [{
              ...prev[0],
              es_nuevo: false,
              producto_id: prods[0].id,
              costo_unitario: costo,
              subtotal: cant * costo
            }]
          }
          return prev
        })
      }
    } catch (err) {
      console.warn('Error al cargar datos en compras:', err)
    } finally {
      setLoadingDatos(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCategoriaCreada = (nuevaCat) => {
    setCategorias(prev => [...prev, nuevaCat])
    if (targetIdxCategoria !== null) {
      updateItemField(targetIdxCategoria, 'categoria_id', nuevaCat.id)
    }
  }

  // 1. Manejo reactivo de Cantidad
  const handleCantidadChange = (index, value) => {
    const newItems = [...items]
    const item = { ...newItems[index], cantidad: value }
    const cant = Number(value)
    const costo = Number(item.costo_unitario)
    const sub = Number(item.subtotal)

    if (cant > 0) {
      if (item.costo_unitario !== '' && !isNaN(costo) && costo > 0) {
        item.subtotal = Math.round(cant * costo)
      } else if (item.subtotal !== '' && !isNaN(sub) && sub > 0) {
        const unitario = sub / cant
        item.costo_unitario = Number.isInteger(unitario) ? unitario : Number(unitario.toFixed(2))
      }
    } else {
      item.subtotal = ''
    }

    newItems[index] = item
    setItems(newItems)
  }

  // 2. Manejo reactivo de Costo Unitario -> calcula Subtotal automáticamente
  const handleCostoUnitarioChange = (index, value) => {
    const newItems = [...items]
    const item = { ...newItems[index], costo_unitario: value }
    const cant = Number(item.cantidad)
    const costo = Number(value)

    if (value !== '' && !isNaN(costo) && cant > 0) {
      item.subtotal = Math.round(cant * costo)
    } else if (value === '') {
      item.subtotal = ''
    }

    newItems[index] = item
    setItems(newItems)
  }

  // 3. Manejo reactivo de Subtotal -> calcula Costo Unitario automáticamente
  const handleSubtotalChange = (index, value) => {
    const newItems = [...items]
    const item = { ...newItems[index], subtotal: value }
    const cant = Number(item.cantidad)
    const sub = Number(value)

    if (value !== '' && !isNaN(sub) && cant > 0) {
      const unitario = sub / cant
      item.costo_unitario = Number.isInteger(unitario) ? unitario : Number(unitario.toFixed(2))
    } else if (value === '') {
      item.costo_unitario = ''
    }

    newItems[index] = item
    setItems(newItems)
  }

  // Cambiar producto existente
  const handleSelectProductoExistente = (index, prodId) => {
    const cant = Number(items[index]?.cantidad || 10)
    if (prodId === '__NUEVO__') {
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        es_nuevo: true,
        producto_id: '',
        nombre: '',
        costo_unitario: 1000,
        subtotal: cant * 1000
      }
      setItems(newItems)
      return
    }

    const prod = productos.find(p => p.id === prodId)
    const newItems = [...items]
    const costo = prod ? prod.costo_unitario : (newItems[index].costo_unitario || 1000)
    newItems[index] = {
      ...newItems[index],
      producto_id: prodId,
      es_nuevo: false,
      costo_unitario: costo,
      subtotal: Math.round(cant * costo)
    }
    setItems(newItems)
  }

  // Modificar campo genérico de un item
  const updateItemField = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      [field]: value
    }
    setItems(newItems)
  }

  // Alternar entre modo existente o nuevo
  const toggleEsNuevo = (index, nuevoValor) => {
    const newItems = [...items]
    const defaultCosto = !nuevoValor && productos.length > 0 ? productos[0].costo_unitario : (newItems[index].costo_unitario || 1000)
    const cant = Number(newItems[index].cantidad || 10)
    newItems[index] = {
      ...newItems[index],
      es_nuevo: nuevoValor,
      producto_id: !nuevoValor && productos.length > 0 ? productos[0].id : '',
      costo_unitario: defaultCosto,
      subtotal: Math.round(cant * defaultCosto)
    }
    setItems(newItems)
  }

  // Añadir nueva fila
  const addItemRow = (esNuevo = false) => {
    const defaultProdId = (!esNuevo && productos.length > 0) ? productos[0].id : ''
    const defaultCosto = (!esNuevo && productos.length > 0) ? (productos[0].costo_unitario || 1000) : 1500
    const cant = 10

    setItems([
      ...items,
      {
        id: Date.now() + Math.random(),
        es_nuevo: esNuevo || productos.length === 0,
        producto_id: defaultProdId,
        nombre: '',
        sku: '',
        categoria_id: categorias[0]?.id || '',
        temporada: 'General',
        stock_minimo: '5',
        cantidad: cant,
        costo_unitario: defaultCosto,
        subtotal: cant * defaultCosto
      }
    ])
  }

  const removeItemRow = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const totalCompra = items.reduce((acc, item) => {
    const sub = item.subtotal !== '' && item.subtotal !== undefined
      ? Number(item.subtotal)
      : (Number(item.cantidad || 0) * Number(item.costo_unitario || 0))
    return acc + (isNaN(sub) ? 0 : sub)
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setExito(null)

    // Validaciones
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.es_nuevo && !it.nombre.trim()) {
        setError(`Línea #${i + 1}: Ingresa el nombre del nuevo artículo que estás comprando.`)
        return
      }
      if (!it.es_nuevo && !it.producto_id) {
        setError(`Línea #${i + 1}: Selecciona un producto del catálogo o marca la opción "Nuevo Artículo".`)
        return
      }
      if (Number(it.cantidad) <= 0) {
        setError(`Línea #${i + 1}: La cantidad debe ser mayor a cero.`)
        return
      }
      if (Number(it.costo_unitario) <= 0 && Number(it.subtotal) <= 0) {
        setError(`Línea #${i + 1}: Ingresa el costo unitario o el subtotal pagado.`)
        return
      }
    }

    setLoading(true)
    try {
      const payloadItems = items.map(it => {
        const costoFinal = Number(it.costo_unitario) > 0
          ? Number(it.costo_unitario)
          : (Number(it.cantidad) > 0 ? Number((Number(it.subtotal) / Number(it.cantidad)).toFixed(2)) : 0)

        if (it.es_nuevo) {
          return {
            es_nuevo: true,
            nombre: it.nombre.trim(),
            sku: it.sku.trim() || null,
            categoria_id: it.categoria_id || null,
            temporada: it.temporada || 'General',
            stock_minimo: Number(it.stock_minimo) || 5,
            cantidad: Number(it.cantidad),
            costo_unitario: costoFinal
          }
        } else {
          return {
            es_nuevo: false,
            producto_id: it.producto_id,
            cantidad: Number(it.cantidad),
            costo_unitario: costoFinal
          }
        }
      })

      await registrarCompra({
        proveedor: proveedor.trim(),
        notas: notas.trim(),
        total: totalCompra,
        items: payloadItems
      })

      setExito('¡Ingreso de mercadería registrado con éxito! El inventario, los nuevos artículos y el historial de auditoría se actualizaron en tiempo real.')
      setProveedor('')
      setNotas('')
      
      // Reiniciar líneas
      const defaultCosto = productos[0]?.costo_unitario || 1000
      setItems([{
        id: Date.now(),
        es_nuevo: false,
        producto_id: productos[0]?.id || '',
        nombre: '',
        sku: '',
        categoria_id: '',
        temporada: 'General',
        stock_minimo: '5',
        cantidad: 10,
        costo_unitario: defaultCosto,
        subtotal: 10 * defaultCosto
      }])

      // Recargar catálogo e historial
      await loadData()
      if (onCompraExitosa) onCompraExitosa()
    } catch (err) {
      setError(err.message || 'Error al procesar la compra')
    } finally {
      setLoading(false)
    }
  }

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  return (
    <div className="space-y-8 pb-12">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            Registro de Compras e Insumos
          </h1>
          <p className="text-sm text-slate-500">
            Ingresa compras de productos existentes o <strong>registra nuevos artículos al vuelo</strong> sin pasos extra.
          </p>
        </div>

        <button
          onClick={loadData}
          title="Actualizar catálogo"
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingDatos ? 'animate-spin' : ''}`} />
          Refrescar Catálogo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario Principal de Compra */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">
              Datos de la Compra / Factura
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Suma de stock inmediata
            </span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exito && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{exito}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Proveedor y Notas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor / Distribuidor
                </label>
                <input
                  type="text"
                  placeholder="Ej: Distribuidora Cerámicas Chile"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  N° Factura, Boleta o Nota
                </label>
                <input
                  type="text"
                  placeholder="Ej: Factura #9482 / Lote de Tazones"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Listado de Artículos a Ingresar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Artículos a Ingresar
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Puedes elegir productos que ya tienes o escribir nuevos artículos que cambiarán según la temporada.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addItemRow(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    + Artículo Nuevo
                  </button>
                  {productos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => addItemRow(false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Existente
                    </button>
                  )}
                </div>
              </div>

              {/* Contenedor de Líneas */}
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const prodSeleccionado = productos.find(p => p.id === item.producto_id)

                  return (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.es_nuevo
                          ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Barra superior de la línea: Selector de Modo (Existente vs Nuevo) */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Línea #{idx + 1}</span>

                          {/* Pestañas para alternar entre Existente y Nuevo */}
                          <div className="inline-flex p-0.5 rounded-lg bg-slate-200/80 text-xs font-medium">
                            {productos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleEsNuevo(idx, false)}
                                className={`px-2.5 py-1 rounded-md transition ${
                                  !item.es_nuevo
                                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Del Catálogo
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleEsNuevo(idx, true)}
                              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                                item.es_nuevo
                                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              Nuevo Artículo
                            </button>
                          </div>
                        </div>

                        {/* Botón eliminar línea */}
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Eliminar esta línea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* CASO A: ARTÍCULO NUEVO (Permite escribir el nombre libremente) */}
                      {item.es_nuevo ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            
                            {/* Nombre del nuevo artículo */}
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">
                                Nombre del Nuevo Artículo *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Ej: Tazón Mágico Cónico 12oz, Botella Térmica Pastel, etc."
                                value={item.nombre}
                                onChange={(e) => updateItemField(idx, 'nombre', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>

                            {/* SKU / Código (opcional) */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                Código / SKU (Opcional)
                              </label>
                              <input
                                type="text"
                                placeholder="Ej: TAZA-MAG-CON"
                                value={item.sku}
                                onChange={(e) => updateItemField(idx, 'sku', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>

                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            
                            {/* Categoría */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-semibold text-slate-700">
                                  Categoría
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetIdxCategoria(idx)
                                    setIsModalCategoriaOpen(true)
                                  }}
                                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                                >
                                  + Nueva Categoría
                                </button>
                              </div>
                              <select
                                value={item.categoria_id}
                                onChange={(e) => {
                                  if (e.target.value === '__NUEVA_CAT__') {
                                    setTargetIdxCategoria(idx)
                                    setIsModalCategoriaOpen(true)
                                  } else {
                                    updateItemField(idx, 'categoria_id', e.target.value)
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="">-- General / Sin categoría --</option>
                                {categorias.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                ))}
                                <option value="__NUEVA_CAT__">➕ + Crear nueva categoría...</option>
                              </select>
                            </div>

                            {/* Temporada */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Temporada / Campaña
                              </label>
                              <select
                                value={item.temporada}
                                onChange={(e) => updateItemField(idx, 'temporada', e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500"
                              >
                                {temporadas.map(temp => (
                                  <option key={temp} value={temp}>{temp}</option>
                                ))}
                              </select>
                            </div>

                          </div>

                          <div className="text-[11px] text-emerald-700 bg-emerald-100/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              Este artículo se creará automáticamente en tu catálogo y su stock quedará disponible para la venta de inmediato.
                            </span>
                          </div>
                        </div>
                      ) : (
                        
                        /* CASO B: PRODUCTO EXISTENTE DEL CATÁLOGO */
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase">
                            Seleccionar Producto del Catálogo
                          </label>
                          <select
                            value={item.producto_id}
                            onChange={(e) => handleSelectProductoExistente(idx, e.target.value)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                          >
                            {productos.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} ({p.sku || 'S/SKU'}) — Temporada: {p.temporada} — Stock actual: {p.stock_actual} unid.
                              </option>
                            ))}
                            <option value="__NUEVO__">➕ + Escribir nuevo artículo no registrado...</option>
                          </select>

                          {prodSeleccionado && (
                            <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                              <span>Stock actual: <strong className="text-slate-800">{prodSeleccionado.stock_actual} unid.</strong></span>
                              <span>•</span>
                              <span>Último costo registrado: <strong className="text-slate-800">{formatCLP(prodSeleccionado.costo_unitario)}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cantidad, Costo Unitario y Subtotal (Cálculo bidireccional automático) */}
                      <div className="pt-3 mt-3 border-t border-slate-200/60 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          
                          {/* 1. Cantidad */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Cantidad *
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              placeholder="Ej: 24"
                              value={item.cantidad}
                              onChange={(e) => handleCantidadChange(idx, e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                            />
                          </div>

                          {/* 2. Costo Unitario */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-700">
                                Costo Unitario (CLP)
                              </label>
                              <span className="text-[10px] text-indigo-600 font-semibold">calcula auto</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">$</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Ej: 1500"
                                value={item.costo_unitario}
                                onChange={(e) => handleCostoUnitarioChange(idx, e.target.value)}
                                className="w-full pl-7 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                              />
                            </div>
                          </div>

                          {/* 3. Subtotal Línea (Editable) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-700">
                                Subtotal Línea (CLP)
                              </label>
                              <span className="text-[10px] text-indigo-600 font-semibold">calcula auto</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">$</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Ej: 36000"
                                value={item.subtotal}
                                onChange={(e) => handleSubtotalChange(idx, e.target.value)}
                                className="w-full pl-7 pr-3 py-2 text-sm rounded-xl border border-indigo-200 bg-indigo-50/40 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-extrabold text-slate-900"
                              />
                            </div>
                          </div>

                        </div>

                        {/* Indicador de ayuda */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 px-1 pt-0.5">
                          <ArrowLeftRight className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                          <span>Ingresa <strong>Costo Unitario</strong> o <strong>Subtotal</strong>: el cálculo se hace en tiempo real en ambos sentidos.</span>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>

            </div>

            {/* Total e Inversión */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">
                  Inversión Total de la Compra:
                </span>
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {formatCLP(totalCompra)}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <ArrowDownRight className="w-5 h-5" />
                {loading ? 'Guardando Entrada...' : 'Confirmar Ingreso de Mercadería'}
              </button>
            </div>

          </form>

        </div>

        {/* Historial Reciente de Compras */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Últimas Compras
              </h3>
              <button onClick={loadData} className="p-1 text-slate-400 hover:text-slate-600">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {historial.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>No hay compras registradas aún.</p>
                <p className="text-[11px] mt-1 text-slate-400">Tus ingresos aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {historial.map((compra) => (
                  <div key={compra.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>{compra.proveedor || 'Proveedor General'}</span>
                      <span className="text-indigo-700 font-extrabold">{formatCLP(compra.total)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-1">
                      {new Date(compra.fecha).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {compra.detalles && compra.detalles.length > 0 && (
                      <div className="text-[11px] text-slate-600 border-t border-slate-200/60 pt-1 mt-1 space-y-0.5">
                        {compra.detalles.map((d, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="truncate max-w-[170px]">+{d.cantidad} {d.producto?.nombre}</span>
                            <span className="font-medium">{formatCLP(d.costo_unitario)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Cada compra actualiza automáticamente el inventario y crea un registro inmutable en auditoría.
          </div>
        </div>

      </div>

      {/* Modal para crear nueva categoría al vuelo */}
      <ModalNuevaCategoria
        isOpen={isModalCategoriaOpen}
        onClose={() => setIsModalCategoriaOpen(false)}
        onCategoriaCreada={handleCategoriaCreada}
      />

    </div>
  )
}
