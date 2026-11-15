// src/views/store/OrderSuccessStoreView.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
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
  ExternalLink,
  XCircle,
  Clock
} from 'lucide-react'
import { esOrdenDeInvitado, fetchOrdenById } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { trackPurchase } from '../../services/analytics'
import { nombreMedioPago, tomarCompraWebpayPendiente } from '../../services/compraWebpay'

export default function OrderSuccessStoreView() {
  const { id } = useParams()
  const { currentUser, isAdmin, openAuthModal } = useAuth()
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  // ?pago=aprobado|rechazado|cancelado: la API redirige aquí al volver de Webpay.
  const [searchParams] = useSearchParams()
  const resultadoWebpay = searchParams.get('pago')
  const { recargarCarrito } = useCart()

  // Una orden comprada como invitado en este navegador se ve con su token.
  const deInvitado = esOrdenDeInvitado(id)

  // GET /api/ordenes/:id: el dueño, un admin o el invitado con su token (404 para cualquier otro).
  useEffect(() => {
    if (!currentUser && !deInvitado) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchOrdenById(id)
      .then(setOrden)
      .catch(() => setOrden(null))
      .finally(() => setLoading(false))
  }, [id, currentUser?.id, deInvitado])

  // Vuelta desde Webpay: el carrito cambió en el servidor (vacío si se aprobó).
  useEffect(() => {
    if (resultadoWebpay) recargarCarrito()
  }, [resultadoWebpay])

  // GA4: purchase recién con el pago aprobado, una sola vez por orden
  // (misma función que el pago simulado; ver services/compraWebpay.js).
  useEffect(() => {
    if (resultadoWebpay !== 'aprobado' || orden?.estado !== 'PAGADO') return
    const tipoCliente = tomarCompraWebpayPendiente(orden.id)
    if (tipoCliente) trackPurchase(orden, { tipoCliente })
  }, [orden, resultadoWebpay])

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

  if (!currentUser && !deInvitado) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Inicia sesión para ver tu orden</h2>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="inline-block px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
        >
          Iniciar sesión
        </button>
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
      
      {/* Pago con Webpay no completado (rechazado, anulado o pendiente) */}
      {orden.estado !== 'PAGADO' && (
        <div
          role="alert"
          className={`${orden.estado === 'ANULADO' ? 'bg-rose-600' : 'bg-amber-500'} text-white p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center gap-6`}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            {orden.estado === 'ANULADO' ? <XCircle className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-black">
              {orden.estado === 'ANULADO'
                ? resultadoWebpay === 'cancelado'
                  ? 'Pago anulado en Webpay'
                  : 'Pago rechazado por Webpay'
                : 'Pago pendiente en Webpay'}
            </h1>
            <p className="text-xs sm:text-sm text-white/90">
              {orden.estado === 'ANULADO'
                ? 'No se realizó ningún cobro y la orden quedó anulada. Tus productos siguen en el carrito para intentarlo de nuevo.'
                : 'Todavía no recibimos la confirmación de Webpay para esta orden.'}
            </p>
            <Link
              to="/checkout"
              className="inline-block px-4 py-2 bg-white text-slate-900 text-xs font-bold rounded-xl print:hidden"
            >
              Volver al checkout
            </Link>
          </div>
        </div>
      )}

      {/* Banner de Confirmación */}
      {orden.estado === 'PAGADO' && (
      <div className="bg-emerald-600 text-white p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wide uppercase">
            Transacción Exitosa
          </span>
          <h1 className="text-2xl sm:text-3xl font-black">
            {orden.medio_pago === 'webpay' ? '¡Pago aprobado por Webpay!' : '¡Compra registrada con pago simulado!'}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            Tu compra ha sido procesada correctamente y el stock en bodega ya fue actualizado.
          </p>
        </div>
      </div>
      )}

      {!currentUser && deInvitado && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs print:hidden">
          Compraste como invitado: esta orden queda guardada solo en este navegador. Para ver tus pedidos desde
          cualquier dispositivo, crea una cuenta con el mismo correo en tu próxima compra.
        </div>
      )}

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
              Comprobante de compra ({orden.medio_pago === 'webpay' ? 'Webpay Plus, ambiente de pruebas de Transbank' : 'pago simulado, entorno de pruebas'})
            </p>
          </div>

          <div className="text-left sm:text-right text-xs space-y-1">
            <p className="font-bold text-slate-900">Orden de Compra: <span className="font-mono text-indigo-600">{orden.codigo}</span></p>
            <p className="text-slate-500">Fecha: {new Date(orden.fecha).toLocaleString('es-CL')}</p>
            {orden.codigo_autorizacion && (
              <p className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg inline-block">
                Código Autorización: {orden.codigo_autorizacion}
              </p>
            )}
          </div>
        </div>

        {/* Datos de Facturación y Despacho */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="font-extrabold text-slate-900 uppercase tracking-wider block text-[11px]">
              Cliente & Facturación
            </span>
            <p className="font-bold text-slate-800">{orden.despacho?.nombre} {orden.despacho?.apellido}</p>
            <p className="text-slate-500">Email: {orden.cliente_email || currentUser?.email}</p>
            <p className="text-slate-500">Teléfono: {orden.despacho?.telefono}</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="font-extrabold text-slate-900 uppercase tracking-wider block text-[11px]">
              Destino de Entrega (Chile)
            </span>
            <p className="font-bold text-slate-800">{orden.despacho?.direccion} {orden.despacho?.depto && `(${orden.despacho.depto})`}</p>
            <p className="text-slate-500">{orden.despacho?.comuna}, {orden.despacho?.region}</p>
            <p className="text-slate-500">Método de Pago: <strong className="text-slate-800">{nombreMedioPago(orden.medio_pago)}</strong></p>
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
                      {formatCLP(item.precio_unitario)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCLP(item.subtotal)}
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
              <span>Neto:</span>
              <span className="font-semibold text-slate-900">{formatCLP(orden.neto)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Despacho:</span>
              <span className="font-semibold text-slate-900">
                {orden.costo_envio === 0 ? 'GRATIS' : formatCLP(orden.costo_envio)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>{orden.estado === 'PAGADO' ? 'Total Pagado:' : 'Total:'}</span>
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

          {isAdmin && (
            <Link
              to="/admin"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Verificar impacto en Bodega ERP</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

      </div>

    </div>
  )
}
