// src/views/store/HomeStoreView.jsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Truck,
  ShieldCheck,
  ShoppingBag,
  Zap,
  Coffee,
  Shirt,
  FlaskConical,
  Gift,
  Package,
  Layers,
  Activity
} from 'lucide-react'
import { fetchProductosPublicos, fetchCategorias } from '../../services/api'
import { useCart } from '../../context/CartContext'

export default function HomeStoreView() {
  const [destacados, setDestacados] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadTimeMs, setLoadTimeMs] = useState(0)
  const { addToCart } = useCart()

  useEffect(() => {
    const startTime = performance.now()
    Promise.all([
      fetchProductosPublicos({ orden: 'destacado' }),
      fetchCategorias()
    ]).then(([prods, cats]) => {
      setDestacados(prods.slice(0, 6)) // Carga balanceada / ligera (6 productos)
      setCategorias(cats)
      const endTime = performance.now()
      setLoadTimeMs(Math.round(endTime - startTime))
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  const getCategoryIcon = (nombre) => {
    const n = nombre?.toLowerCase() || ''
    if (n.includes('taza')) return <Coffee className="w-5 h-5" />
    if (n.includes('polera') || n.includes('textil')) return <Shirt className="w-5 h-5" />
    if (n.includes('botella')) return <FlaskConical className="w-5 h-5" />
    if (n.includes('regalo') || n.includes('papelería')) return <Gift className="w-5 h-5" />
    return <Package className="w-5 h-5" />
  }

  return (
    <div className="space-y-12 pb-16">
      
      {/* Badge de Métricas para la Asignatura "Desempeño de Sistemas" */}
      <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Métrica de Rendimiento [Página 1: Home]:</span>
          <span>Carga equilibrada/editorial de 6 productos y 5 categorías</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300">
            Latencia: {loadTimeMs} ms
          </span>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300">
            Payload: ~35 KB
          </span>
        </div>
      </div>

      {/* Hero Banner Principal */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-950 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-6 sm:px-12 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Campaña Temporada Escolar & Merchandising 2026</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Insumos y Productos Premium para <span className="text-indigo-400">Sublimación</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
              Tazas de cerámica AAA, poleras tacto algodón, botellas térmicas y souvenirs listos para estampar. Entregas rápidas en todo Chile y pagos protegidos con Transbank Webpay Plus.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/catalogo"
                className="px-6 py-3.5 bg-white hover:bg-slate-100 text-indigo-900 text-sm font-extrabold rounded-2xl shadow-lg transition flex items-center gap-2 group"
              >
                <span>Explorar Catálogo Completo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/catalogo?temporada=Escolar"
                className="px-6 py-3.5 bg-indigo-700/60 hover:bg-indigo-700 text-white border border-indigo-500/40 text-sm font-bold rounded-2xl backdrop-blur-md transition flex items-center gap-2"
              >
                <span>Especial Escolar</span>
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-3 gap-4 border-t border-indigo-700/50 text-xs">
              <div>
                <p className="text-lg font-black text-white">+500</p>
                <p className="text-indigo-200 text-[11px]">Unidades en Bodega</p>
              </div>
              <div>
                <p className="text-lg font-black text-white">100%</p>
                <p className="text-indigo-200 text-[11px]">Garantía Polímero AAA</p>
              </div>
              <div>
                <p className="text-lg font-black text-white">24/48h</p>
                <p className="text-indigo-200 text-[11px]">Despacho en Santiago</p>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 group">
              <img
                src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80"
                alt="Tazas para Sublimación Subligol"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-6">
                <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-max mb-2">
                  Producto Estrella
                </span>
                <h3 className="text-lg font-bold text-white">Taza Cerámica Blanca 11oz AAA</h3>
                <p className="text-xs text-slate-300">Desde $4.500 CLP • Stock disponible</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Categorías Principales */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-600" />
              Categorías de Sublimación
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Selecciona una categoría para ver los productos e insumos disponibles.
            </p>
          </div>
          <Link
            to="/catalogo"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
          >
            <span>Ver todas las categorías</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categorias.map((cat) => (
            <Link
              key={cat.id}
              to={`/catalogo?categoriaId=${cat.id}`}
              className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col items-center text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
                {getCategoryIcon(cat.nombre)}
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {cat.nombre}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {cat.descripcion || 'Ver productos'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Sección de Productos Destacados */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>Lo Más Vendido en Chile</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Productos Destacados
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Los favoritos de los talleres de personalización y estampados.
            </p>
          </div>
          <Link
            to="/catalogo"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs animate-pulse space-y-3">
                <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destacados.map((producto) => (
              <div
                key={producto.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 flex flex-col group"
              >
                {/* Imagen y Badges */}
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-xs">
                      {producto.temporada}
                    </span>
                    {producto.stock_actual <= 0 ? (
                      <span className="px-2.5 py-1 bg-slate-900 text-rose-300 text-[11px] font-bold rounded-lg">
                        Agotado
                      </span>
                    ) : producto.stock_actual <= producto.stock_minimo ? (
                      <span className="px-2.5 py-1 bg-amber-500 text-slate-950 text-[11px] font-bold rounded-lg">
                        ¡Últimas {producto.stock_actual} un.!
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-xs">
                        Stock ({producto.stock_actual})
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      {producto.categoria_nombre || producto.categoria?.nombre || 'General'}
                    </span>
                    <Link
                      to={`/producto/${producto.id}`}
                      className="block text-sm font-extrabold text-slate-900 hover:text-indigo-600 transition-colors line-clamp-1 mt-1"
                    >
                      {producto.nombre}
                    </Link>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {producto.descripcion}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Precio Unitario</span>
                      <span className="text-base font-black text-slate-900">
                        {formatCLP(producto.precio_venta)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/producto/${producto.id}`}
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        Ver Detalle
                      </Link>
                      <button
                        type="button"
                        disabled={producto.stock_actual <= 0}
                        onClick={() => addToCart(producto, 1)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition"
                        title="Agregar al Carrito"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Banner de Llamada al Panel ERP Subligol */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
              Control Operativo en Vivo
            </span>
            <h3 className="text-2xl sm:text-3xl font-black">
              ¿Quieres ver cómo impacta cada compra en el Inventario?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Accede al panel de Bodega ERP de Subligol para comprobar la rebaja automática de stock, el historial de compras y el balance comercial.
            </p>
          </div>
          <Link
            to="/admin"
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-lg flex items-center gap-2 flex-shrink-0"
          >
            <span>Ir al Panel de Bodega ERP</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  )
}
