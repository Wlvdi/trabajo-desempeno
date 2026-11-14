// src/views/store/CatalogStoreView.jsx
import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  ShoppingBag,
  RotateCcw,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check
} from 'lucide-react'
import { fetchProductosPublicos, fetchCategorias, PRODUCTOS_POR_PAGINA } from '../../services/api'
import { useCart } from '../../context/CartContext'

/** Tope del deslizador de precio: en este valor el filtro queda "sin límite". */
const PRECIO_TOPE = 30000
/** Espera (ms) tras el último tecleo antes de buscar en el servidor. */
const ESPERA_BUSQUEDA_MS = 300

/**
 * Números de página a mostrar (con "…" cuando hay muchas páginas).
 * @param {number} actual
 * @param {number} total
 * @returns {(number | '…')[]}
 */
function paginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const paginas = new Set([1, total, actual, actual - 1, actual + 1])
  if (actual <= 3) [2, 3, 4].forEach((p) => paginas.add(p))
  if (actual >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => paginas.add(p))
  const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const resultado = []
  ordenadas.forEach((p, i) => {
    if (i > 0 && p - ordenadas[i - 1] > 1) resultado.push('…')
    resultado.push(p)
  })
  return resultado
}

export default function CatalogStoreView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToCart } = useCart()

  // Estados de Filtros
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '')
  const [categoriaId, setCategoriaId] = useState(searchParams.get('categoriaId') || 'Todas')
  const [temporada, setTemporada] = useState(searchParams.get('temporada') || 'Todas')
  const [precioMax, setPrecioMax] = useState(PRECIO_TOPE)
  const [soloEnStock, setSoloEnStock] = useState(false)
  const [orden, setOrden] = useState('destacado')
  // Texto que realmente se busca (con espera tras el último tecleo).
  const [busquedaAplicada, setBusquedaAplicada] = useState(searchParams.get('q') || '')

  // Datos (una página del servidor)
  const [productos, setProductos] = useState([])
  const [totalProductos, setTotalProductos] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [errorCarga, setErrorCarga] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // Métricas para "Desempeño de Sistemas"
  const [benchmarkMetrics, setBenchmarkMetrics] = useState({
    latencyMs: 0,
    totalRecords: 0,
    filteredRecords: 0,
    simulatedPayloadKb: 0
  })

  // Paginación del servidor (pagina y limite)
  const [currentPage, setCurrentPage] = useState(1)

  const temporadasLista = [
    'Todas',
    'General',
    'Escolar',
    'Día de la Madre',
    'Día del Padre',
    'Día del Niño',
    'Fiestas Patrias',
    'Navidad',
    'Verano'
  ]

  // Cargar Categorías
  useEffect(() => {
    fetchCategorias().then(setCategorias)
  }, [])

  // Sincronizar URL params cuando cambian
  useEffect(() => {
    const q = searchParams.get('q')
    const cat = searchParams.get('categoriaId')
    const temp = searchParams.get('temporada')

    if (q !== null) setBusqueda(q)
    if (cat !== null) setCategoriaId(cat)
    if (temp !== null) setTemporada(temp)
  }, [searchParams])

  // Búsqueda: espera ESPERA_BUSQUEDA_MS tras el último tecleo y solo busca
  // desde 2 caracteres (el servidor exige q de 2 a 100 caracteres).
  useEffect(() => {
    const texto = busqueda.trim()
    const temporizador = setTimeout(() => setBusquedaAplicada(texto.length >= 2 ? texto : ''), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  const buscando = busquedaAplicada.length >= 2
  // Con texto de búsqueda el orden por defecto es "relevancia".
  const ordenEfectivo = buscando && orden === 'destacado' ? 'relevancia' : orden

  // Al cambiar cualquier filtro se vuelve a la página 1.
  useEffect(() => {
    setCurrentPage(1)
  }, [busquedaAplicada, categoriaId, temporada, precioMax, soloEnStock, orden])

  // Cargar una página de productos desde el servidor.
  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setErrorCarga(null)
    const startTime = performance.now()

    fetchProductosPublicos({
      busqueda: busquedaAplicada,
      categoriaId,
      temporada,
      precioMax: precioMax < PRECIO_TOPE ? Number(precioMax) : undefined,
      soloEnStock,
      orden: ordenEfectivo,
      pagina: currentPage,
      limite: PRODUCTOS_POR_PAGINA
    })
      .then((data) => {
        if (cancelado) return
        const latency = Math.round(performance.now() - startTime)
        const payloadEst = Math.round((JSON.stringify(data).length / 1024) * 10) / 10
        setProductos(data.items)
        setTotalProductos(data.total)
        setTotalPages(Math.max(1, data.totalPaginas))
        setBenchmarkMetrics({
          latencyMs: latency,
          totalRecords: data.total,
          filteredRecords: data.items.length,
          simulatedPayloadKb: payloadEst
        })
      })
      .catch((err) => {
        if (cancelado) return
        console.error('Error cargando catálogo:', err)
        setErrorCarga(err.message)
        setProductos([])
        setTotalProductos(0)
        setTotalPages(1)
      })
      .finally(() => !cancelado && setLoading(false))

    return () => {
      cancelado = true
    }
  }, [busquedaAplicada, categoriaId, temporada, precioMax, soloEnStock, ordenEfectivo, currentPage])

  const handleResetFilters = () => {
    setBusqueda('')
    setCategoriaId('Todas')
    setTemporada('Todas')
    setPrecioMax(PRECIO_TOPE)
    setSoloEnStock(false)
    setOrden('destacado')
    setSearchParams({})
  }

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  // La página actual ya viene del servidor.
  const currentItems = productos
  const textoPrecio = precioMax < PRECIO_TOPE ? formatCLP(precioMax) : 'Sin límite'

  return (
    <div className="space-y-6 pb-16">
      
      {/* Badge de Rendimiento [Página 2: Carga Pesada] */}
      <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-semibold text-white">Métrica de Rendimiento [Página 2: Catálogo Completo / Heavy Load]:</span>
          <span>Filtros, ordenamiento y paginación en el servidor (GET /api/productos o /api/buscar)</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="bg-slate-800 px-2 py-0.5 rounded text-amber-300">
            Latencia: {benchmarkMetrics.latencyMs} ms
          </span>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300">
            Registros: {benchmarkMetrics.filteredRecords} / {benchmarkMetrics.totalRecords}
          </span>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300">
            Payload: {benchmarkMetrics.simulatedPayloadKb} KB
          </span>
        </div>
      </div>

      {/* Encabezado y Barra de Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Catálogo de Productos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Explora {totalProductos} insumos y productos listos para personalizar en Chile.
          </p>
        </div>

        {/* Buscador y Botón Filtros Móvil */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o descripción..."
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="lg:hidden p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl flex items-center gap-1.5 text-xs font-bold"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtros</span>
          </button>
        </div>
      </div>

      {/* Disposición Principal (Filtros Laterales + Grilla de Productos) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Panel Lateral de Filtros (Desktop) */}
        <aside className="hidden lg:block bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600" />
              Filtros Multicriterio
            </h3>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Limpiar
            </button>
          </div>

          {/* Filtro Categorías */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Categoría
            </label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setCategoriaId('Todas')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  categoriaId === 'Todas'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todas las categorías
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaId(cat.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                    categoriaId === cat.id
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{cat.nombre}</span>
                  {categoriaId === cat.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro Temporada */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Temporada / Campaña
            </label>
            <select
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
            >
              {temporadasLista.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filtro Rango de Precio */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 uppercase tracking-wider">
              <span>Precio Máximo</span>
              <span className="text-indigo-600 font-mono font-black">{textoPrecio}</span>
            </div>
            <input
              type="range"
              min="1000"
              max={PRECIO_TOPE}
              step="500"
              value={precioMax}
              onChange={(e) => setPrecioMax(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>$1.000</span>
              <span>Sin límite</span>
            </div>
          </div>

          {/* Solo con Stock Disponible */}
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={soloEnStock}
                onChange={(e) => setSoloEnStock(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
              />
              <span>Sólo con Stock en Bodega</span>
            </label>
          </div>
        </aside>

        {/* Contenido Principal (Grilla y Barra de Ordenación) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Barra Superior de Ordenación y Conteo */}
          <div className="bg-white px-5 py-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 font-medium">
              Mostrando <strong className="text-slate-900">{productos.length}</strong> de{' '}
              <strong className="text-slate-900">{totalProductos}</strong> productos
              {totalPages > 1 && <> (página {currentPage} de {totalPages})</>}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Ordenar por:</span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-600"
              >
                <option value="destacado">{buscando ? 'Más relevantes' : 'Destacados de Temporada'}</option>
                <option value="precio_asc">Precio: Menor a Mayor</option>
                <option value="precio_desc">Precio: Mayor a Menor</option>
                <option value="nombre_asc">Nombre: A - Z</option>
                <option value="nombre_desc">Nombre: Z - A</option>
                <option value="stock_desc">Mayor Disponibilidad</option>
              </select>
            </div>
          </div>

          {/* Grilla de Productos */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs animate-pulse space-y-3">
                  <div className="w-full aspect-square bg-slate-200 rounded-2xl" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : errorCarga ? (
            <div role="alert" className="bg-rose-50 rounded-3xl border border-rose-200 p-8 text-center text-xs text-rose-800 font-semibold">
              No se pudo cargar el catálogo: {errorCarga}
            </div>
          ) : currentItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                No encontramos productos con esos filtros
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Intenta ajustando el rango de precios, la temporada o eliminando palabras de búsqueda.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                Restablecer Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {currentItems.map((producto) => (
                <div
                  key={producto.id}
                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col group"
                >
                  {/* Foto y Badges */}
                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
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
                          Últimas {producto.stock_actual} un.
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-xs">
                          Stock ({producto.stock_actual})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalle */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                        {producto.categoria_nombre || producto.categoria?.nombre || 'General'}
                      </span>
                      <Link
                        to={`/producto/${producto.id}`}
                        className="block text-sm font-extrabold text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2 mt-1"
                      >
                        {producto.nombre}
                      </Link>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        SKU: {producto.sku || 'N/A'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Precio CLP</span>
                        <span className="text-lg font-black text-slate-900">
                          {formatCLP(producto.precio_venta)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/producto/${producto.id}`}
                          className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Ficha
                        </Link>
                        <button
                          type="button"
                          disabled={producto.stock_actual <= 0}
                          onClick={() => addToCart(producto, 1)}
                          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition"
                          title="Añadir al Carrito"
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

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {paginasVisibles(currentPage, totalPages).map((page, i) => page === '…' ? (
                <span key={`salto-${i}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Modal / Drawer de Filtros para Móviles */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-xs bg-white h-full p-6 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">Filtros del Catálogo</h3>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-6 flex-1">
              {/* Categorías Móvil */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase">Categoría</label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="Todas">Todas las categorías</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Temporadas Móvil */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase">Temporada</label>
                <select
                  value={temporada}
                  onChange={(e) => setTemporada(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  {temporadasLista.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Precio Máximo Móvil */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>Precio Máximo:</span>
                  <span className="text-indigo-600">{textoPrecio}</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max={PRECIO_TOPE}
                  step="500"
                  value={precioMax}
                  onChange={(e) => setPrecioMax(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={soloEnStock}
                    onChange={(e) => setSoloEnStock(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Sólo con Stock</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Ver {totalProductos} Resultados
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
