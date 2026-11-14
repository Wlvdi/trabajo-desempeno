// src/context/AuthContext.jsx
// Sesión del usuario contra la API propia (JWT).
// - Al cargar la app valida el token guardado con GET /api/auth/yo.
// - Al iniciar sesión o registrarse, si había carrito anónimo, lo fusiona con
//   el del usuario (POST /api/carrito/fusionar) ANTES de fijar el usuario,
//   para que el carrito se recargue ya fusionado.
// - Si la API responde 401 con sesión, api.js cierra la sesión local y este
//   contexto se entera por alCerrarSesion.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ErrorApi, fetchUsuarioActual, fusionarCarrito, iniciarSesion, registrarUsuario } from '../services/api'
import { trackLogin, trackSignUp } from '../services/analytics'
import {
  alCerrarSesion,
  cerrarSesionLocal,
  guardarSesion,
  guardarUsuario,
  obtenerToken,
  obtenerUsuario
} from '../services/sesion'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  // Se pinta de inmediato con el usuario guardado; luego se valida contra la API.
  const [currentUser, setCurrentUser] = useState(() => (obtenerToken() ? obtenerUsuario() : null))
  const [loading, setLoading] = useState(Boolean(obtenerToken()))
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalTab, setAuthModalTab] = useState('login') // 'login' | 'register'

  // Cierre de sesión forzado por la API (token vencido o inválido).
  useEffect(() => alCerrarSesion(() => setCurrentUser(null)), [])

  // Validar la sesión guardada al cargar la app.
  useEffect(() => {
    if (!obtenerToken()) return
    let cancelado = false
    fetchUsuarioActual()
      .then((usuario) => {
        if (cancelado) return
        guardarUsuario(usuario)
        setCurrentUser(usuario)
      })
      .catch((err) => {
        // Un 401 ya cerró la sesión en api.js; un error de red conserva la sesión local.
        if (!(err instanceof ErrorApi) || err.status !== 401) {
          console.warn('No se pudo validar la sesión:', err.message)
        }
      })
      .finally(() => !cancelado && setLoading(false))
    return () => {
      cancelado = true
    }
  }, [])

  /** Guarda la sesión, fusiona el carrito anónimo y fija el usuario. */
  const abrirSesion = useCallback(async ({ usuario, token }) => {
    guardarSesion({ usuario, token })
    try {
      await fusionarCarrito()
    } catch (err) {
      // La sesión es válida aunque la fusión falle; el carrito anónimo se pierde.
      console.warn('No se pudo fusionar el carrito anónimo:', err.message)
    }
    setCurrentUser(usuario)
    setIsAuthModalOpen(false)
    return { success: true, user: usuario }
  }, [])

  const login = async (email, password) => {
    const sesion = await iniciarSesion(email.trim(), password)
    trackLogin('email')
    return abrirSesion(sesion)
  }

  const register = async (nombre, email, password) => {
    const sesion = await registrarUsuario(nombre.trim(), email.trim(), password)
    trackSignUp('email')
    return abrirSesion(sesion)
  }

  const logout = async () => {
    // El JWT no se invalida en el servidor: basta con olvidarlo.
    cerrarSesionLocal()
    setCurrentUser(null)
  }

  const openAuthModal = (tab = 'login') => {
    setAuthModalTab(tab)
    setIsAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setIsAuthModalOpen(false)
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isAuthenticated: Boolean(currentUser),
        isAdmin: currentUser?.rol === 'admin',
        login,
        register,
        logout,
        isAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        openAuthModal,
        closeAuthModal
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}
