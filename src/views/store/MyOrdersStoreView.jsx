// src/views/store/MyOrdersStoreView.jsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Calendar,
  CreditCard,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { fetchMisOrdenes } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function MyOrdersStoreView() {
  const { currentUser, openAuthModal } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMisOrdenes(currentUser?.email).then(data => {
      setOrdenes(data)
      setLoading(false)
    })
  }, [currentUser])

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
            Historial de compras realizadas con Webpay Plus y estado de entrega.
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
      ) : ordenes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Aún no tienes pedidos registrados
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cuando completes una compra en nuestro catálogo usando el Sandbox de Webpay Plus, aparecerá aquí detallada.
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
                  <span className="font-extrabold text-slate-900 text-sm">
                    Orden {orden.id}
                  </span>
                  <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(orden.fecha).toLocaleString('es-CL')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-full text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pagado por Webpay Plus
                  </span>
                  <Link
                    to={`/orden/${orden.id}`}
                    className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition"
                    title="Ver comprobante oficial"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {orden.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/70">
                    <img src={item.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    <div className="truncate text-xs">
                      <p className="font-bold text-slate-900 truncate">{item.nombre}</p>
                      <p className="text-slate-500 text-[11px]">
                        {item.cantidad} x {formatCLP(item.precio_venta)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total y Resumen */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Despacho a: <strong>{orden.cliente?.comuna}, {orden.cliente?.region}</strong>
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
        </div>
      )}

    </div>
  )
}
