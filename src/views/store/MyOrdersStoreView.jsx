// src/views/store/MyOrdersStoreView.jsx
// Historial de órdenes del usuario: GET /api/ordenes (paginado en el servidor).
// La lista trae un resumen por orden; el detalle (items y despacho) está en /orden/:id.
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Calendar,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { fetchMisOrdenes } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { nombreMedioPago } from '../../services/compraWebpay'

const ORDENES_POR_PAGINA = 10

/** Texto del medio de pago guardado en la orden. */

export default function MyOrdersStoreView() {
  const { currentUser, openAuthModal } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Al cambiar de usuario se vuelve a la primera página.
  useEffect(() => {
    setPagina(1)
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser) {
      setOrdenes([])
      setLoading(false)
      return
    }
    let cancelado = false
    setLoading(true)
    setError(null)
    fetchMisOrdenes({ pagina, limite: ORDENES_POR_PAGINA })
      .then((data) => {
        if (cancelado) return
        setOrdenes(data.items)
        setTotal(data.total)
        setTotalPaginas(Math.max(1, data.totalPaginas))
      })
      .catch((err) => !cancelado && setError(err.message))
      .finally(() => !cancelado && setLoading(false))
    return () => {
      cancelado = true
    }
  }, [currentUser?.id, pagina])

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">

      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600" />
            Mis Pedidos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser ? `Historial de compras de tu cuenta (${total} en total).` : 'Inicia sesión para ver tu historial de compras.'}
          </p>
        </div>

        {!currentUser && (
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition"
          >
            Iniciar Sesión con mi Cuenta
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Cargando tus pedidos...
        </div>
      ) : error ? (
        <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          No se pudieron cargar tus pedidos: {error}
        </div>
      ) : ordenes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Aún no tienes pedidos registrados
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cuando completes una compra en nuestro catálogo, aparecerá aquí.
          </p>
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-200"
          >
            <span>Ir a Comprar</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {ordenes.map((orden) => (
            <div
              key={orden.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 text-xs">
                <div>
                  <span className="font-extrabold text-slate-900 text-sm font-mono">
                    Orden {orden.codigo}
                  </span>
                  <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(orden.fecha).toLocaleString('es-CL')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-full text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {orden.estado} · {nombreMedioPago(orden.medio_pago)}
                  </span>
                  <Link
                    to={`/orden/${orden.id}`}
                    className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition"
                    title="Ver detalle de la orden"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Total y Resumen */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  {orden.cantidad_productos} {orden.cantidad_productos === 1 ? 'producto' : 'productos'} ·{' '}
                  Despacho: {orden.costo_envio === 0 ? 'gratis' : formatCLP(orden.costo_envio)}
                </span>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block font-semibold">Total Pagado</span>
                  <span className="text-base font-black text-slate-900">
                    {formatCLP(orden.total)}
                  </span>
                </div>
              </div>

            </div>
          ))}

          {/* Paginación del servidor */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 text-xs">
              <button
                type="button"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-slate-500 font-semibold">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
