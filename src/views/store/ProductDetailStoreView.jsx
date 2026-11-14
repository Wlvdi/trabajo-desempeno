// src/views/store/ProductDetailStoreView.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { fetchProductoById } from '../../services/api'
import { useCart } from '../../context/CartContext'
import { trackViewItem } from '../../services/analytics'
import {
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Truck,
  ShieldCheck,
  RotateCcw,
  Activity,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Thermometer,
  Clock,
  Layers
} from 'lucide-react'

export default function ProductDetailStoreView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()

  const [producto, setProducto] = useState(null)
  const [relacionados, setRelacionados] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [loadTimeMs, setLoadTimeMs] = useState(0)

  useEffect(() => {
    setLoading(true)
    const startTime = performance.now()

    // Página PESADA: GET /api/productos/:id ya trae galería y relacionados
    // (una sola petición). null si el producto no existe.
    fetchProductoById(id).then((prod) => {
      setProducto(prod)
      setSelectedImage(prod?.imagen_url || '')
      setCantidad(1)
      setRelacionados(prod?.relacionados || [])
      if (prod) trackViewItem(prod)

      const endTime = performance.now()
      setLoadTimeMs(Math.round(endTime - startTime))
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-8">
        <div className="h-6 bg-slate-200 rounded w-1/4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="aspect-square bg-slate-200 rounded-3xl" />
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-6 bg-slate-200 rounded w-1/3" />
            <div className="h-24 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-2xl font-black text-slate-800">Producto no encontrado</h2>
        <p className="text-slate-500 text-sm">El producto que buscas no existe o ha sido retirado.</p>
        <Link
          to="/catalogo"
          className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
        >
          Volver al Catálogo
        </Link>
      </div>
    )
  }

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  const stockDisponible = Number(producto.stock_actual) || 0
  const isAgotado = stockDisponible <= 0
  const isCritico = stockDisponible > 0 && stockDisponible <= Number(producto.stock_minimo)

  const handleComprarAhora = async () => {
    if (isAgotado) return
    // Solo se avanza al checkout si la API aceptó el producto en el carrito.
    if (await addToCart(producto, cantidad)) navigate('/checkout')
  }

  return (
    <div className="space-y-12 pb-16">
      
      {/* Badge de Rendimiento [Página 3: Detalle de Producto / Focused Load] */}
      <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="font-semibold text-white">Métrica de Rendimiento [Página 3: Ficha Técnica Profunda]:</span>
          <span>Consulta focalizada de producto individual, galería, stock en tiempo real y productos relacionados</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300">
            Latencia: {loadTimeMs} ms
          </span>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300">
            Payload: ~8.5 KB
          </span>
        </div>
      </div>

      {/* Migas de Pan (Breadcrumbs) */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/" className="hover:text-slate-700 transition">Inicio</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to="/catalogo" className="hover:text-slate-700 transition">Catálogo</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700 font-bold truncate max-w-xs">{producto.nombre}</span>
      </nav>

      {/* Tarjeta Principal de Detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-xs">
        
        {/* Galería de Fotos */}
        <div className="space-y-4">
          <div className="aspect-square bg-slate-50 rounded-3xl overflow-hidden border border-slate-200 relative group">
            <img
              src={selectedImage || producto.imagen_url}
              alt={producto.nombre}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm">
                {producto.temporada}
              </span>
            </div>
          </div>

          {/* Miniaturas */}
          {producto.imagenes_galeria && producto.imagenes_galeria.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {producto.imagenes_galeria.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition ${
                    selectedImage === img
                      ? 'border-indigo-600 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Información y Compra */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            
            {/* Categoría y SKU */}
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-600 uppercase tracking-wider">
                {producto.categoria_nombre || producto.categoria?.nombre || 'General'}
              </span>
              <span className="text-slate-400 font-mono">SKU: {producto.sku || 'N/A'}</span>
            </div>

            {/* Título */}
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {producto.nombre}
            </h1>

            {/* Estado del Stock */}
            <div>
              {isAgotado ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Agotado temporalmente en bodega</span>
                </div>
              ) : isCritico ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Stock Crítico: ¡Quedan sólo {stockDisponible} unidades disponibles!</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>En stock para despacho inmediato ({stockDisponible} unidades)</span>
                </div>
              )}
            </div>

            {/* Precio en CLP y Simulador Webpay */}
            <div className="pt-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-slate-900">
                  {formatCLP(producto.precio_venta)}
                </span>
                <span className="text-xs text-slate-400 font-semibold">IVA incluido</span>
              </div>

              {/* Banner de Cuotas Webpay */}
              <div className="mt-3 p-3 bg-red-50/60 border border-red-100 rounded-2xl flex items-center gap-3 text-xs text-slate-700">
                <div className="bg-red-600 text-white p-2 rounded-xl">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    Hasta 3 cuotas sin interés de {formatCLP(Math.round(producto.precio_venta / 3))}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Con tarjetas de crédito bancarias mediante Transbank Webpay Plus
                  </p>
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              <p>{producto.descripcion_larga || producto.descripcion}</p>
            </div>

            {/* Selector de Cantidad */}
            {!isAgotado && (
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Cantidad a comprar:
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setCantidad(c => Math.max(1, c - 1))}
                      className="p-2.5 hover:bg-slate-200 text-slate-700 transition"
                      disabled={cantidad <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 text-sm font-black text-slate-900 min-w-[36px] text-center">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCantidad(c => Math.min(stockDisponible, c + 1))}
                      className="p-2.5 hover:bg-slate-200 text-slate-700 transition"
                      disabled={cantidad >= stockDisponible}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">
                    Máximo: {stockDisponible} un.
                  </span>
                </div>
              </div>
            )}

            {/* Botones de Compra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <button
                type="button"
                disabled={isAgotado}
                onClick={() => addToCart(producto, cantidad)}
                className="w-full py-3.5 px-4 border-2 border-indigo-600 hover:bg-indigo-50 text-indigo-700 font-extrabold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Añadir al Carrito</span>
              </button>

              <button
                type="button"
                disabled={isAgotado}
                onClick={handleComprarAhora}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span>Comprar Ahora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Garantías */}
          <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-3 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Despachos a todo Chile</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Garantía de Sublimación</span>
            </div>
          </div>
        </div>

      </div>

      {/* Ficha Técnica y Parámetros de Sublimación */}
      <section className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          Especificaciones Técnicas para Taller & Sublimación
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Thermometer className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Temperatura Sugerida</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900">
              {producto.especificaciones?.temperatura_sublimacion || '180°C - 195°C'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Tiempo de Estampado</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900">
              {producto.especificaciones?.tiempo_estampado || '60 - 180 segundos'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Material Base</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900">
              {producto.especificaciones?.material || 'Polímero Calidad Grado AAA'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Presión de Plancha</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900">
              {producto.especificaciones?.presion || 'Media - Fuerte'}
            </p>
          </div>
        </div>
      </section>

      {/* Productos Relacionados */}
      {relacionados.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">
              Productos Relacionados
            </h3>
            <Link
              to={`/catalogo?categoriaId=${producto.categoria_id || ''}`}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Ver más de esta categoría
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relacionados.map((rel) => (
              <div
                key={rel.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all group flex flex-col justify-between"
              >
                <div className="aspect-square bg-slate-100 overflow-hidden relative">
                  <img
                    src={rel.imagen_url}
                    alt={rel.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded">
                      {rel.temporada}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <Link
                    to={`/producto/${rel.id}`}
                    className="block text-xs font-bold text-slate-900 hover:text-indigo-600 transition line-clamp-1"
                  >
                    {rel.nombre}
                  </Link>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-black text-slate-900">
                      {formatCLP(rel.precio_venta)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToCart(rel, 1)}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-lg transition"
                      title="Agregar al Carrito"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
