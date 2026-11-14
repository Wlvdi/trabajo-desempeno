// src/components/store/CartDrawer.jsx
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Truck } from 'lucide-react'
import { useCart } from '../../context/CartContext'

export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    subtotal,
    costoEnvio,
    total,
    totalItemsCount
  } = useCart()

  const navigate = useNavigate()

  if (!isCartOpen) return null

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  const handleGoToCheckout = () => {
    closeCart()
    navigate('/checkout')
  }

  const handleGoToCart = () => {
    closeCart()
    navigate('/carrito')
  }

  const metaEnvioGratis = 30000
  const faltaParaGratis = Math.max(0, metaEnvioGratis - subtotal)
  const porcentajeGratis = Math.min(100, Math.round((subtotal / metaEnvioGratis) * 100))

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Fondo oscuro con desenfoque */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Header del Carrito */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Tu Carrito ({totalItemsCount})
              </h2>
            </div>
            <button
              type="button"
              onClick={closeCart}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              aria-label="Cerrar carrito"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de Progreso de Envío Gratis */}
          <div className="p-4 bg-indigo-50/60 border-b border-indigo-100/50">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-600" />
                {faltaParaGratis === 0 ? (
                  <span className="text-emerald-700 font-bold">¡Genial! Tienes Envío Gratis 🎉</span>
                ) : (
                  <span>
                    Agrega <strong>{formatCLP(faltaParaGratis)}</strong> más para <strong>Envío Gratis</strong>
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-indigo-600">{porcentajeGratis}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  porcentajeGratis >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${porcentajeGratis}%` }}
              />
            </div>
          </div>

          {/* Lista de Productos */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-700">Tu carrito está vacío</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Explora nuestro catálogo de insumos y productos para sublimación y añade tus favoritos.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    closeCart()
                    navigate('/catalogo')
                  }}
                  className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                >
                  Explorar Catálogo
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="pt-4 first:pt-0 flex gap-3">
                  <img
                    src={item.imagen_url}
                    alt={item.nombre}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          to={`/producto/${item.id}`}
                          onClick={closeCart}
                          className="text-xs font-bold text-slate-900 hover:text-indigo-600 transition line-clamp-2"
                        >
                          {item.nombre}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-500 transition p-1"
                          title="Eliminar del carrito"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">SKU: {item.sku || 'N/A'}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition"
                          disabled={item.cantidad <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800 min-w-[20px] text-center">
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition"
                          disabled={item.cantidad >= item.stock_actual}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900">
                          {formatCLP(item.precio_venta * item.cantidad)}
                        </span>
                        {item.cantidad > 1 && (
                          <p className="text-[10px] text-slate-400 font-medium">
                            {formatCLP(item.precio_venta)} c/u
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer del Carrito con Totales */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 space-y-3">
              <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">{formatCLP(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Despacho estimado:</span>
                  <span className="font-semibold text-slate-900">
                    {costoEnvio === 0 ? (
                      <span className="text-emerald-600 font-bold">¡GRATIS!</span>
                    ) : (
                      formatCLP(costoEnvio)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total a Pagar (CLP):</span>
                  <span className="text-indigo-600 text-base">{formatCLP(total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleGoToCart}
                  className="w-full py-2.5 px-3 border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition text-center shadow-2xs"
                >
                  Ver Carrito Completo
                </button>
                <button
                  type="button"
                  onClick={handleGoToCheckout}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200"
                >
                  <span>Ir al Checkout</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400">
                Pago simulado – entorno de pruebas (sin cobros reales)
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
