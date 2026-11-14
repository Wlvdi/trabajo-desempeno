// src/context/CartContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { trackAddToCart, trackRemoveFromCart } from '../services/analytics'

const CartContext = createContext()

const STORAGE_KEY = 'subligol_cart_v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [isCartOpen, setIsCartOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (err) {
      console.error('Error al guardar carrito en localStorage:', err)
    }
  }, [items])

  const addToCart = (producto, cantidad = 1) => {
    if (!producto) return

    setItems(prevItems => {
      const existingIndex = prevItems.findIndex(i => String(i.id) === String(producto.id))
      const stockDisponible = Number(producto.stock_actual) || 99

      if (existingIndex > -1) {
        const itemActual = prevItems[existingIndex]
        const nuevaCantidad = Math.min(itemActual.cantidad + cantidad, stockDisponible)
        
        const copy = [...prevItems]
        copy[existingIndex] = {
          ...itemActual,
          cantidad: nuevaCantidad
        }
        return copy
      } else {
        const nuevaCantidad = Math.min(cantidad, stockDisponible)
        return [
          ...prevItems,
          {
            id: producto.id,
            sku: producto.sku,
            nombre: producto.nombre,
            precio_venta: Number(producto.precio_venta),
            imagen_url: producto.imagen_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
            stock_actual: stockDisponible,
            categoria_nombre: producto.categoria_nombre || producto.categoria?.nombre || 'General',
            cantidad: nuevaCantidad
          }
        ]
      }
    })

    // Evento GA4 e-commerce
    trackAddToCart(producto, cantidad)

    setIsCartOpen(true)
  }

  const updateQuantity = (productoId, cantidad) => {
    if (cantidad <= 0) {
      removeFromCart(productoId)
      return
    }

    setItems(prevItems =>
      prevItems.map(item => {
        if (String(item.id) === String(productoId)) {
          const maxStock = Number(item.stock_actual) || 99
          return {
            ...item,
            cantidad: Math.min(cantidad, maxStock)
          }
        }
        return item
      })
    )
  }

  const removeFromCart = (productoId) => {
    const itemToRemove = items.find(item => String(item.id) === String(productoId))
    if (itemToRemove) {
      trackRemoveFromCart(itemToRemove)
    }
    setItems(prevItems => prevItems.filter(item => String(item.id) !== String(productoId)))
  }

  const clearCart = () => {
    setItems([])
    localStorage.removeItem(STORAGE_KEY)
  }

  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)

  // Cálculos financieros en Pesos Chilenos (CLP)
  const subtotal = items.reduce((sum, item) => sum + (Number(item.precio_venta) * Number(item.cantidad)), 0)
  const iva = Math.round(subtotal * 0.19) // 19% IVA en Chile
  // Envío gratis en compras sobre $30.000 CLP, si no $3.990
  const costoEnvio = subtotal >= 30000 || subtotal === 0 ? 0 : 3990
  const total = subtotal + costoEnvio
  const totalItemsCount = items.reduce((sum, item) => sum + Number(item.cantidad), 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        isCartOpen,
        openCart,
        closeCart,
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
