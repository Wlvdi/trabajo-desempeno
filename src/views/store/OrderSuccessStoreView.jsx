// src/views/store/OrderSuccessStoreView.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CheckCircle,
  Download,
  Printer,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  MapPin,
  Calendar,
  Layers,
  ExternalLink
} from 'lucide-react'
import { fetchOrdenById } from '../../services/api'

export default function OrderSuccessStoreView() {
  const { id } = useParams()
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrdenById(id).then(data => {
      setOrden(data)
      setLoading(false)
    })
  }, [id])

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-slate-500">
        Cargando comprobante de pago...
      </div>
    )
  }

  if (!orden) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Orden no encontrada</h2>
        <p className="text-xs text-slate-500">No encontramos un registro para el identificador {id}.</p>
        <Link to="/" className="inline-block px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl">
          Volver a la Tienda
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      
      {/* Banner de Confirmación Transbank */}
      <div className="bg-emerald-600 text-white p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wide uppercase">
            Transacción Exitosa
          </span>
          <h1 className="text-2xl sm:text-3xl font-black">
            ¡Pago Aprobado por Webpay Plus!
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            Tu compra ha sido procesada correctamente y el stock en bodega ya fue actualizado.
          </p>
        </div>
      </div>

      {/* Comprobante Oficial Imprimible */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-8 print:border-none print:shadow-none">
        
        {/* Cabecera del Voucher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-900">Subligol SpA</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                RUT: 76.543.210-K
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Comprobante de Venta Electrónica Webpay Plus
            </p>
          </div>

          <div className="text-left sm:text-right text-xs space-y-1">
            <p className="font-bold text-slate-900">Orden de Compra: <span className="font-mono text-indigo-600">{orden.id}</span></p>
            <p className="text-slate-500">Fecha: {new Date(orden.fecha).toLocaleString('es-CL')}</p>
            <p className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg inline-block">
              Código Autorización: {orden.codigoAutorizacion}
            </p>
          </div>
        </div>

        {/* Datos de Facturación y Despacho */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="font-extrabold text-slate-900 uppercase tracking-wider block text-[11px]">
              Cliente & Facturación
            </span>
            <p className="font-bold text-slate-800">{orden.cliente?.nombre} {orden.cliente?.apellido}</p>
            <p className="text-slate-500">RUT: {orden.cliente?.rut}</p>
            <p className="text-slate-500">Email: {orden.cliente?.email}</p>
            <p className="text-slate-500">Teléfono: {orden.cliente?.telefono}</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="font-extrabold text-slate-900 uppercase tracking-wider block text-[11px]">
              Destino de Entrega (Chile)
            </span>
            <p className="font-bold text-slate-800">{orden.cliente?.direccion} {orden.cliente?.depto && `(${orden.cliente?.depto})`}</p>
            <p className="text-slate-500">{orden.cliente?.comuna}, {orden.cliente?.region}</p>
            <p className="text-slate-500">Método de Pago: <strong className="text-slate-800">{orden.metodoPago}</strong></p>
          </div>
        </div>

        {/* Tabla de Artículos Comprados */}
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Detalle de Artículos Adquiridos
          </h3>
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
                  <th className="py-3 px-4 text-right">Precio Unitario</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orden.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{item.nombre}</span>
                      <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {item.cantidad}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600">
                      {formatCLP(item.precio_venta)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCLP(item.precio_venta * item.cantidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Final */}
        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Despacho:</span>
              <span className="font-semibold text-slate-900">
                {orden.costoEnvio === 0 ? 'GRATIS' : formatCLP(orden.costoEnvio)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Pagado:</span>
              <span className="text-indigo-600 text-lg">{formatCLP(orden.total)}</span>
            </div>
            <p className="text-[10px] text-slate-400 text-right">IVA del 19% incluido</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Imprimir Comprobante</span>
            </button>
            <Link
              to="/catalogo"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-200"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Volver a la Tienda</span>
            </Link>
          </div>

          <Link
            to="/admin"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>Verificar impacto en Bodega ERP</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

    </div>
  )
}
