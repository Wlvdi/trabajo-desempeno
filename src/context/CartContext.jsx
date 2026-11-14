// src/context/CartContext.jsx
// Carrito persistente en la API (/api/carrito). La respuesta de la API es la
// fuente de verdad: después de cada operación se reemplaza el estado local
// por el carrito que devuelve el servidor (precios y stock actuales).
// - Sin sesión: carrito anónimo identificado por X-Carrito-Id (lo maneja api.js).
// - Con sesión: el carrito del usuario. Se recarga cada vez que cambia el usuario.
// - Un 409 (stock insuficiente) se muestra como aviso con las unidades disponibles.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { trackAddToCart, trackRemoveFromCart } from '../services/analytics'
import {
  CARRITO_VACIO,
  ErrorApi,
  agregarAlCarrito,
  cambiarCantidadCarrito,
  fetchCarrito,
  quitarDelCarrito,
  vaciarCarrito
} from '../services/api'
import { useAuth } from './AuthContext'

const CartContext = createContext()

/** Misma regla que el backend (backend/src/pagos.js); el monto definitivo lo calcula el checkout. */
const UMBRAL_ENVIO_GRATIS = 30000
const COSTO_ENVIO = 3990

/**
 * Convierte un error de la API en un texto para el usuario.
 * @param {unknown} err
 */
function mensajeDeError(err) {
  if (err instanceof ErrorApi && err.status === 409) {
    const disponible = err.detalle?.stock_disponible
    return disponible !== undefined
      ? `No hay stock suficiente: quedan ${disponible} unidades disponibles.`
      : err.message
  }
  return err?.message || 'No se pudo actualizar el carrito.'
}

export function CartProvider({ children }) {
  const { currentUser } = useAuth()
  const [carrito, setCarrito] = useState({ ...CARRITO_VACIO })
  const [cargando, setCargando] = useState(true)
  const [isCartOpen, setIsCartOpen] = useState(false)
  /** Aviso para el usuario: { tipo: 'error' | 'ok', texto } */
  const [aviso, setAviso] = useState(null)

  const recargar = useCallback(async () => {
    try {
      setCarrito(await fetchCarrito())
    } catch (err) {
      console.warn('No se pudo cargar el carrito:', err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  // Carga inicial y recarga al iniciar o cerrar sesión (tras la fusión).
  useEffect(() => {
    recargar()
  }, [currentUser?.id, recargar])

  /**
   * Ejecuta una operación del carrito y reemplaza el estado con la respuesta.
   * @param {() => Promise<object>} operacion
   * @returns {Promise<boolean>} true si salió bien
   */
  const ejecutar = async (operacion) => {
    try {
      setCarrito(await operacion())
      return true
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err) })
      // Si el carrito cambió en otra pestaña o el stock bajó, se resincroniza.
      if (err instanceof ErrorApi && [404, 409].includes(err.status)) recargar()
      return false
    }
  }

  const addToCart = async (producto, cantidad = 1) => {
    if (!producto) return false
    const ok = await ejecutar(() => agregarAlCarrito(producto.id, cantidad))
    if (ok) {
      // Evento GA4 e-commerce
      trackAddToCart(producto, cantidad)
      setIsCartOpen(true)
    }
    return ok
  }

  const removeFromCart = async (productoId) => {
    const item = carrito.items.find((i) => String(i.id) === String(productoId))
    const ok = await ejecutar(() => quitarDelCarrito(productoId))
    if (ok && item) trackRemoveFromCart(item)
    return ok
  }

  const updateQuantity = async (productoId, cantidad) => {
    if (cantidad <= 0) return removeFromCart(productoId)
    return ejecutar(() => cambiarCantidadCarrito(productoId, cantidad))
  }

  const clearCart = async () => ejecutar(() => vaciarCarrito())

  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)
  const cerrarAviso = () => setAviso(null)

  // Montos en pesos chilenos (CLP); el subtotal viene de la API.
  const items = carrito.items
  const subtotal = Number(carrito.subtotal) || 0
  const iva = Math.round(subtotal * 0.19) // 19% IVA incluido en el precio (solo informativo)
  const costoEnvio = subtotal >= UMBRAL_ENVIO_GRATIS || subtotal === 0 ? 0 : COSTO_ENVIO
  const total = subtotal + costoEnvio
  const totalItemsCount = Number(carrito.total_unidades) || 0

  return (
    <CartContext.Provider
      value={{
        items,
        cargando,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        recargarCarrito: recargar,
        isCartOpen,
        openCart,
        closeCart,
        aviso,
        mostrarAviso: setAviso,
        cerrarAviso,
        subtotal,
        iva,
        costoEnvio,
        total,
        totalItemsCount
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider')
  }
  return context
}
