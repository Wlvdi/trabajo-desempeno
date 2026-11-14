import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingBag,
  ShoppingCart,
  Share2,
  RefreshCw,
  Plus
} from 'lucide-react'
import { fetchDashboardData } from '../services/api'

export default function DashboardView({ onNavigate, onOpenNuevoProducto }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDashboardData()
      setData(res)
    } catch (err) {
      setError(err.message || 'Error al cargar los datos del dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium">Cargando métricas comerciales...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 my-6">
        <h3 className="font-bold text-base mb-1">No se pudieron cargar los datos</h3>
        <p className="text-sm mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const { inmovilizado, balance, criticos, canales } = data

  return (
    <div className="space-y-6 pb-12">
      
      {/* Barra Superior con Acciones Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Panel de Control Comercial</h1>
          <p className="text-sm text-slate-500">Resumen financiero, stock en tiempo real y balance de Subligol.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('ventas')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <ShoppingCart className="w-4 h-4" />
            Nueva Venta
          </button>
          <button
            onClick={() => onNavigate('compras')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <ShoppingBag className="w-4 h-4" />
            Ingresar Compra
          </button>
          <button
            onClick={loadData}
            title="Recargar métricas"
            className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerta de Stock Crítico / Agotado */}
      {criticos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-900">
                  ¡Atención! {criticos.length} {criticos.length === 1 ? 'producto requiere' : 'productos requieren'} reposición urgente
                </h3>
                <button
                  onClick={() => onNavigate('inventario', { estado: 'critico' })}
                  className="text-xs font-bold text-amber-800 hover:underline"
                >
                  Ver todos en inventario →
                </button>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                Pausa la oferta de estos productos en redes sociales o genera una nueva compra de insumos:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-3">
                {criticos.slice(0, 3).map((item) => (
                  <div key={item.id} className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-[170px]">
                        {item.nombre}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {item.sku || 'S/SKU'} • {item.temporada}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        item.stock_actual <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.stock_actual} unid.
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">mín: {item.stock_minimo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas KPI Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Capital Inmovilizado */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Capital en Bodega
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-extrabold text-slate-900">
              {formatCLP(inmovilizado.capital_inmovilizado_costo)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Valor costo de <strong className="text-slate-700">{inmovilizado.unidades_totales}</strong> unidades activas.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Venta proyectada:</span>
            <span className="font-semibold text-slate-700">{formatCLP(inmovilizado.valor_total_venta_estimado)}</span>
          </div>
        </div>

        {/* KPI 2: Total Ventas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Recaudado por Ventas
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-extrabold text-emerald-700">
              {formatCLP(balance.total_recaudado_ventas)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              En <strong className="text-slate-700">{balance.cantidad_ventas_realizadas}</strong> pedidos concretados.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Canal principal:</span>
            <span className="font-semibold text-slate-700">{canales[0]?.canal_venta || 'Sin ventas'}</span>
          </div>
        </div>

        {/* KPI 3: Invertido en Compras */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Invertido en Compras
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-extrabold text-slate-900">
              {formatCLP(balance.total_invertido_compras)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              En <strong className="text-slate-700">{balance.cantidad_compras_realizadas}</strong> ingresos de mercadería.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Margen potencial:</span>
            <span className="font-semibold text-slate-700">{formatCLP(inmovilizado.margen_bruto_potencial)}</span>
          </div>
        </div>

        {/* KPI 4: Balance Neto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Balance Comercial
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className={`text-2xl font-extrabold ${balance.balance_neto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatCLP(balance.balance_neto)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {balance.balance_neto >= 0 ? 'Superávit comercial acumulado' : 'Inversión en recuperación'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Fórmula:</span>
            <span className="font-medium text-slate-500">Ventas - Compras</span>
          </div>
        </div>

      </div>

      {/* Sección Inferior: Canales de Venta & Acceso a Catálogo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Desglose por Canales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-600" />
              Ventas por Canal
            </h3>
            <span className="text-xs text-slate-400">Instagram / WhatsApp</span>
          </div>

          {canales.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aún no hay ventas registradas por canales.
            </div>
          ) : (
            <div className="space-y-3">
              {canales.map((canal) => {
                const totalVentasGlobal = Number(balance.total_recaudado_ventas) || 1
                const porcentaje = Math.round((Number(canal.total_ingresos) / totalVentasGlobal) * 100) || 0
                return (
                  <div key={canal.canal_venta} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{canal.canal_venta}</span>
                      <span className="font-bold text-slate-900">{formatCLP(canal.total_ingresos)} ({canal.cantidad_pedidos})</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${Math.min(porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resumen de Catálogo & Temporadas */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Control de Catálogo y Temporadas
              </h3>
              <button
                onClick={() => onNavigate('inventario')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Abrir Catálogo Completo →
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Subligol opera con productos rotativos según festividades y temporadas. Puedes gestionar productos activos o archivarlos fuera de ciclo sin perder trazabilidad contable.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-lg font-bold text-slate-900 block">{inmovilizado.total_productos_activos}</span>
                <span className="text-[11px] text-slate-500">Productos Activos</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-lg font-bold text-slate-900 block">{inmovilizado.unidades_totales}</span>
                <span className="text-[11px] text-slate-500">Unidades en Stock</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center col-span-2 sm:col-span-1">
                <span className="text-lg font-bold text-amber-700 block">{criticos.length}</span>
                <span className="text-[11px] text-amber-800">Alertas de Stock</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={onOpenNuevoProducto}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              Añadir Nuevo Producto
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
