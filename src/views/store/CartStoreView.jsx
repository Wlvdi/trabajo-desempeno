// src/views/store/CartStoreView.jsx
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Truck,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react'
import { useCart } from '../../context/CartContext'

export default function CartStoreView() {
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    costoEnvio,
    total,
    totalItemsCount,
    iva
  } = useCart()

  const navigate = useNavigate()

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }


  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Tu Carrito de Compras está Vacío</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          No has agregado productos a tu orden aún. Visita nuestro catálogo para encontrar tazas, poleras, botellas e insumos de sublimación.
        </p>
        <Link
          to="/catalogo"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-indigo-200"
        >
          <span>Ir al Catálogo de Productos</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Carrito de Compras ({totalItemsCount} productos)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Revisa tus artículos antes de continuar al checkout (pago simulado en entorno de pruebas).
          </p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Vaciar Carrito</span>
        </button>
      </div>

      {/* Contenido en 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Tabla de Artículos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4 items-center">
                <img
                  src={item.imagen_url}
                  alt={item.nombre}
                  className="w-20 h-20 rounded-2xl object-cover border border-slate-100 flex-shrink-0"
                />

                <div className="flex-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">
                    {item.categoria_nombre || 'General'}
                  </span>
                  <Link
                    to={`/producto/${item.id}`}
                    className="block text-sm font-bold text-slate-900 hover:text-indigo-600 transition line-clamp-2"
                  >
                    {item.nombre}
                  </Link>
                  <p className="text-xs text-slate-400 font-mono">SKU: {item.sku || 'N/A'}</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {formatCLP(item.precio_venta)} c/u
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Selector Cantidad */}
                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                      className="p-1.5 hover:bg-slate-200 text-slate-600"
                      disabled={item.cantidad <= 1}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-slate-800 min-w-[24px] text-center">
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                      className="p-1.5 hover:bg-slate-200 text-slate-600"
                      disabled={item.cantidad >= item.stock_actual}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Subtotal del item */}
                  <div className="w-24 text-right">
                    <span className="text-sm font-black text-slate-900">
                      {formatCLP(item.precio_venta * item.cantidad)}
                    </span>
                  </div>

                  {/* Eliminar */}
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Eliminar producto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs">
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continuar comprando</span>
            </Link>
          </div>
        </div>

        {/* Resumen de Orden */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Resumen del Pedido
            </h3>


            {/* Desglose */}
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal (IVA incluido):</span>
                <span className="font-semibold text-slate-900">{formatCLP(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Despacho a Domicilio:</span>
                <span className="font-semibold text-slate-900">
                  {costoEnvio === 0 ? (
                    <span className="text-emerald-600 font-bold">¡GRATIS!</span>
                  ) : (
                    formatCLP(costoEnvio)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>IVA Estimado (19% incl.):</span>
                <span>{formatCLP(iva)}</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline text-base font-black text-slate-900">
                <span>Total a Pagar (CLP):</span>
                <span className="text-xl text-indigo-600">{formatCLP(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
            >
              <span>Continuar al Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Pago simulado – entorno de pruebas</span>
              </div>
              <p>La compra se aprueba de forma simulada: no se cobra dinero real ni se solicitan datos de tarjeta.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
