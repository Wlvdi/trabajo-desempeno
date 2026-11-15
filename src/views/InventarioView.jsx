import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Layers,
  Tag
} from 'lucide-react'
import { fetchProductosPaginados, toggleActivoProducto } from '../services/api'
import ModalNuevaCategoria from '../components/ModalNuevaCategoria'

export default function InventarioView({
  onOpenNuevoProducto,
  onEditProducto,
  onCategoriaCreada,
  defaultEstado = 'todos'
}) {
  const [productos, setProductos] = useState([])
  // Total de productos que cumplen los filtros (puede superar a los recibidos).
  const [totalProductos, setTotalProductos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [temporadaFiltro, setTemporadaFiltro] = useState('Todas')
  const [estadoFiltro, setEstadoFiltro] = useState(defaultEstado)
  const [error, setError] = useState(null)
  const [isModalCategoriaOpen, setIsModalCategoriaOpen] = useState(false)

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

  const loadProductos = async () => {
    setLoading(true)
    setError(null)
    try {
      const pagina = await fetchProductosPaginados({
        busqueda,
        temporada: temporadaFiltro,
        estado: estadoFiltro
      })
      setProductos(pagina.items)
      setTotalProductos(pagina.total)
    } catch (err) {
      setError(err.message || 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProductos()
  }, [busqueda, temporadaFiltro, estadoFiltro])

  const handleToggleActivo = async (prod) => {
    try {
      await toggleActivoProducto(prod.id, !prod.activo)
      loadProductos()
    } catch (err) {
      alert('Error al cambiar estado del producto: ' + err.message)
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
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Catálogo e Inventario</h1>
          <p className="text-sm text-slate-500">
            Control de productos, stock en tiempo real y rotación de temporadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalCategoriaOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl shadow-xs transition"
          >
            <Tag className="w-4 h-4 text-indigo-600" />
            + Categoría
          </button>
          <button
            onClick={onOpenNuevoProducto}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
          <button
            onClick={loadProductos}
            title="Recargar inventario"
            className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Buscador */}
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Filtro Temporada */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={temporadaFiltro}
              onChange={(e) => setTemporadaFiltro(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {temporadasLista.map((temp) => (
                <option key={temp} value={temp}>Temporada: {temp}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado de Stock */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Solo activos</option>
              <option value="critico">Stock crítico (mínimo)</option>
              <option value="agotado">Agotados (stock 0)</option>
              <option value="archivados">Archivados fuera de temporada</option>
            </select>
          </div>

        </div>
      </div>

      {/* Error al cargar (antes se guardaba pero no se mostraba) */}
      {error && !loading && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          No se pudo cargar el inventario: {error}
        </div>
      )}

      {/* Aviso si hay más productos de los que el panel recibe de una vez */}
      {!loading && totalProductos > productos.length && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Mostrando {productos.length} de {totalProductos} productos. Usa la búsqueda o los filtros para encontrar el resto.
          </span>
        </div>
      )}

      {/* Lista / Tabla de Productos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
          <p className="text-sm">Cargando inventario...</p>
        </div>
      ) : productos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">No se encontraron productos</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Intenta cambiar los filtros de búsqueda o agrega un nuevo producto al catálogo.
          </p>
          <button
            onClick={onOpenNuevoProducto}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Añadir Producto
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Producto / SKU</th>
                  <th className="px-4 py-3.5">Temporada / Cat.</th>
                  <th className="px-4 py-3.5">Costo Unid.</th>
                  <th className="px-4 py-3.5">Precio Venta</th>
                  <th className="px-4 py-3.5 text-center">Stock Actual</th>
                  <th className="px-4 py-3.5 text-center">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productos.map((prod) => {
                  const esAgotado = prod.stock_actual <= 0
                  const esCritico = prod.stock_actual <= prod.stock_minimo && !esAgotado

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50/80 transition-colors ${!prod.activo ? 'opacity-60 bg-slate-50/40' : ''}`}
                    >
                      {/* Producto & SKU */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{prod.nombre}</span>
                          <span className="text-xs font-mono text-slate-400 mt-0.5">
                            {prod.sku || 'SIN SKU'}
                          </span>
                        </div>
                      </td>

                      {/* Temporada y Categoría */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {prod.temporada}
                          </span>
                          <span className="text-xs text-slate-500">
                            {prod.categoria?.nombre || 'General'}
                          </span>
                        </div>
                      </td>

                      {/* Costo Unitario */}
                      <td className="px-4 py-4 text-slate-600 font-medium">
                        {formatCLP(prod.costo_unitario)}
                      </td>

                      {/* Precio Venta */}
                      <td className="px-4 py-4 font-bold text-slate-900">
                        {formatCLP(prod.precio_venta)}
                      </td>

                      {/* Stock Actual con Badge de Alerta */}
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            esAgotado
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : esCritico
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {prod.stock_actual} unid.
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            mín: {prod.stock_minimo}
                          </span>
                        </div>
                      </td>

                      {/* Estado Activo / Archivado */}
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          prod.activo
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {prod.activo ? 'Activo' : 'Archivado'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditProducto(prod)}
                            title="Editar datos del producto"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActivo(prod)}
                            title={prod.activo ? 'Archivar producto fuera de temporada' : 'Reactivar producto'}
                            className={`p-1.5 rounded-lg transition ${
                              prod.activo
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {prod.activo ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Categoría */}
      <ModalNuevaCategoria
        isOpen={isModalCategoriaOpen}
        onClose={() => setIsModalCategoriaOpen(false)}
        onCategoriaCreada={(categoria) => {
          loadProductos()
          if (onCategoriaCreada) onCategoriaCreada(categoria)
        }}
      />

    </div>
  )
}
