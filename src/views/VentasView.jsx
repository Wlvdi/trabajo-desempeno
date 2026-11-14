import React, { useState, useEffect } from 'react'
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  MessageCircle,
  Store
} from 'lucide-react'
import { fetchProductos, registrarVenta, fetchHistorialVentas } from '../services/api'

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

export default function VentasView({ onVentaExitosa }) {
  const [productos, setProductos] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistorial, setLoadingHistorial] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  // Formulario
  const [canalVenta, setCanalVenta] = useState('Instagram')
  const [clienteNombre, setClienteNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState([
    { producto_id: '', cantidad: 1, precio_unitario: 0 }
  ])

  const canalesDisponibles = [
    { id: 'Instagram', label: 'Instagram', icon: InstagramIcon },
    { id: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'Presencial', label: 'Presencial / Feria', icon: Store },
    { id: 'Web', label: 'Web', icon: ShoppingCart },
    { id: 'Otro', label: 'Otro Canal', icon: Plus }
  ]

  const loadData = async () => {
    try {
      const [prods, hist] = await Promise.all([
        fetchProductos({ estado: 'activos' }),
        fetchHistorialVentas(15)
      ])
      setProductos(prods)
      setHistorial(hist)
      if (prods.length > 0 && items[0].producto_id === '') {
        setItems([
          {
            producto_id: prods[0].id,
            cantidad: 1,
            precio_unitario: prods[0].precio_venta || 0
          }
        ])
      }
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoadingHistorial(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleProductoChange = (index, prodId) => {
    const prod = productos.find(p => p.id === prodId)
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      producto_id: prodId,
      precio_unitario: prod ? prod.precio_venta : 0
    }
    setItems(newItems)
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      [field]: value
    }
    setItems(newItems)
  }

  const addItemRow = () => {
    if (productos.length === 0) return
    setItems([
      ...items,
      {
        producto_id: productos[0].id,
        cantidad: 1,
        precio_unitario: productos[0].precio_venta || 0
      }
    ])
  }

  const removeItemRow = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const totalVenta = items.reduce((acc, item) => {
    return acc + (Number(item.cantidad) * Number(item.precio_unitario))
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setExito(null)

    // Validar stock disponible
    for (const item of items) {
      const prod = productos.find(p => p.id === item.producto_id)
      if (prod && Number(item.cantidad) > prod.stock_actual) {
        setError(`No hay suficiente stock para "${prod.nombre}". Solicitado: ${item.cantidad}, Disponible: ${prod.stock_actual}.`)
        return
      }
    }

    setLoading(true)
    try {
      await registrarVenta({
        canal_venta: canalVenta,
        cliente_nombre: clienteNombre.trim(),
        notas: notas.trim(),
        total: totalVenta,
        items
      })

      setExito(`¡Venta de ${formatCLP(totalVenta)} registrada con éxito! El inventario se descontó automáticamente.`)
      setClienteNombre('')
      setNotas('')
      if (productos.length > 0) {
        setItems([{ producto_id: productos[0].id, cantidad: 1, precio_unitario: productos[0].precio_venta || 0 }])
      }

      loadData()
      if (onVentaExitosa) onVentaExitosa()
    } catch (err) {
      setError(err.message || 'Error al procesar la venta')
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
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-emerald-600" />
          Registro de Ventas (Salidas de Stock)
        </h1>
        <p className="text-sm text-slate-500">
          Formulario rápido diseñado para pedidos de Instagram, WhatsApp y venta presencial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario de Venta */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Nuevo Pedido / Venta</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
              Descuento automático de stock
            </span>
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exito && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{exito}</span>
            </div>
          )}

          {productos.length === 0 && !loadingHistorial && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aún no hay productos disponibles para venta</p>
                <p className="mt-0.5 text-amber-700">
                  Para poder registrar ventas, primero ingresa mercadería en la pestaña <strong>Compras (+Stock)</strong> o verifica tu conexión a Supabase en <strong>Configuración</strong>.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Selector de Canales */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                Canal de Venta
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {canalesDisponibles.map((canal) => {
                  const Icon = canal.icon
                  const isSelected = canalVenta === canal.id
                  return (
                    <button
                      key={canal.id}
                      type="button"
                      onClick={() => setCanalVenta(canal.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                      {canal.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Datos del Cliente y Notas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cliente / Usuario en Redes (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: @maria_perez o +56912345678"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notas del Pedido (Diseño / Personalización)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Estampado con foto familiar + frase"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Líneas de Productos a Descontar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Productos Vendidos
                </label>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir otro producto
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const prodSeleccionado = productos.find(p => p.id === item.producto_id)
                  const stockDisponible = prodSeleccionado ? prodSeleccionado.stock_actual : 0
                  const sinStock = stockDisponible <= 0

                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
                      
                      {/* Selector de Producto */}
                      <div className="flex-1 w-full">
                        <select
                          value={item.producto_id}
                          onChange={(e) => handleProductoChange(idx, e.target.value)}
                          className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          {productos.map(p => (
                            <option key={p.id} value={p.id} disabled={p.stock_actual <= 0}>
                              {p.nombre} ({p.sku || 'S/SKU'}) — Stock: {p.stock_actual} unid.
                            </option>
                          ))}
                        </select>
                        <span className={`text-[11px] block mt-1 ${sinStock ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                          {sinStock ? '¡Sin stock disponible!' : `Stock actual: ${stockDisponible} unidades`}
                        </span>
                      </div>

                      {/* Cantidad */}
                      <div className="w-full sm:w-28">
                        <label className="block text-[10px] text-slate-400 font-medium sm:hidden">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          max={stockDisponible > 0 ? stockDisponible : 1}
                          required
                          placeholder="Cant."
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                          className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-center"
                        />
                      </div>

                      {/* Precio Venta */}
                      <div className="w-full sm:w-36">
                        <label className="block text-[10px] text-slate-400 font-medium sm:hidden">Precio Venta</label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          required
                          placeholder="Precio"
                          value={item.precio_unitario}
                          onChange={(e) => handleItemChange(idx, 'precio_unitario', e.target.value)}
                          className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="w-full sm:w-28 text-right font-bold text-sm text-slate-800">
                        {formatCLP(Number(item.cantidad) * Number(item.precio_unitario))}
                      </div>

                      {/* Botón Eliminar fila */}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                    </div>
                  )
                })}
              </div>
            </div>

            {/* Total y Botón de Envío */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block">Total a Cobrar al Cliente:</span>
                <span className="text-2xl font-black text-emerald-700">{formatCLP(totalVenta)}</span>
              </div>

              <button
                type="submit"
                disabled={loading || productos.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-100 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4" />
                {loading ? 'Procesando Venta...' : 'Confirmar Venta y Descontar Stock'}
              </button>
            </div>

          </form>
        </div>

        {/* Historial Reciente de Ventas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Últimas Ventas
              </h3>
              <button onClick={loadData} className="p-1 text-slate-400 hover:text-slate-600">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingHistorial ? (
              <p className="text-xs text-slate-400 text-center py-8">Cargando ventas...</p>
            ) : historial.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No hay ventas registradas aún.</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {historial.map((venta) => (
                  <div key={venta.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {venta.canal_venta}
                      </span>
                      <span className="text-emerald-700 font-extrabold">{formatCLP(venta.total)}</span>
                    </div>
                    {venta.cliente_nombre && (
                      <p className="text-[11px] text-slate-600 mb-1">Cliente: {venta.cliente_nombre}</p>
                    )}
                    <div className="text-[10px] text-slate-400 mb-1">
                      {new Date(venta.fecha).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {venta.detalles && venta.detalles.length > 0 && (
                      <div className="text-[11px] text-slate-600 border-t border-slate-200/60 pt-1 mt-1">
                        {venta.detalles.map((d, i) => (
                          <div key={i} className="flex justify-between">
                            <span>-{d.cantidad} unid. {d.producto?.nombre}</span>
                            <span>{formatCLP(d.precio_unitario)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
