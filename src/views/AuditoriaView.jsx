import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Filter,
  RefreshCw,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  PlusCircle,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { fetchAuditLogs } from '../services/api'

export default function AuditoriaView() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [error, setError] = useState(null)
  const [expandedLogId, setExpandedLogId] = useState(null)

  const loadLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAuditLogs(100)
      setLogs(data)
    } catch (err) {
      setError(err.message || 'Error al cargar logs de auditoría')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const logsFiltrados = logs.filter((log) => {
    if (filtroTipo === 'TODOS') return true
    return log.tipo_evento === filtroTipo
  })

  const getEventBadge = (tipo) => {
    switch (tipo) {
      case 'COMPRA_ENTRADA':
        return {
          label: 'Entrada por Compra',
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: ArrowDownRight
        }
      case 'VENTA_SALIDA':
        return {
          label: 'Salida por Venta',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: ArrowUpRight
        }
      case 'CREACION_PRODUCTO':
        return {
          label: 'Nuevo Producto',
          classes: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: PlusCircle
        }
      default:
        return {
          label: tipo,
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Clock
        }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Historial de Auditoría Inmutable</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Lock className="w-3 h-3" /> Blindado
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Registro cronológico protegido contra borrado o edición. Garantiza la integridad de inventario y balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            title="Recargar logs"
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Nota de Integridad */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 leading-relaxed">
          <strong>Garantía de Integridad:</strong> Esta tabla es alimentada automáticamente por triggers de PostgreSQL. Cualquier intento de modificar (<code className="bg-indigo-100 px-1 py-0.5 rounded">UPDATE</code>) o eliminar (<code className="bg-indigo-100 px-1 py-0.5 rounded">DELETE</code>) registros es rechazado por el motor de base de datos para preservar la trazabilidad fiscal y operativa de Subligol.
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Filtrar por evento:</span>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos los eventos</option>
            <option value="COMPRA_ENTRADA">Solo Compras (Entradas)</option>
            <option value="VENTA_SALIDA">Solo Ventas (Salidas)</option>
            <option value="CREACION_PRODUCTO">Creación de Productos</option>
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Mostrando {logsFiltrados.length} registros
        </span>
      </div>

      {/* Lista de Eventos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
          <p className="text-sm">Cargando registros de auditoría...</p>
        </div>
      ) : logsFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">No hay registros de auditoría</h3>
          <p className="text-xs text-slate-400 mt-1">Los eventos aparecerán automáticamente al registrar compras o ventas.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
          {logsFiltrados.map((log) => {
            const badge = getEventBadge(log.tipo_evento)
            const Icon = badge.icon
            const isExpanded = expandedLogId === log.id

            return (
              <div key={log.id} className="p-4 hover:bg-slate-50/70 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  
                  {/* Tipo de evento y Descripción */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl border flex-shrink-0 mt-0.5 bg-slate-50 border-slate-200">
                      <Icon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border ${badge.classes}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(log.fecha).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {log.descripcion}
                      </p>
                    </div>
                  </div>

                  {/* Responsable & Botón Detalle */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:pl-4">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Responsable</span>
                      <span className="text-xs font-medium text-slate-700">{log.usuario_responsable || 'Sistema'}</span>
                    </div>

                    {log.detalle && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Ver detalle JSON"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                </div>

                {/* Detalle JSON desplegable */}
                {isExpanded && log.detalle && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto">
                      {JSON.stringify(log.detalle, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
