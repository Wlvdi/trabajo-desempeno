// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSupabase } from '../services/supabase'

const AuthContext = createContext()

const STORAGE_USER_KEY = 'subligol_auth_user'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [loading, setLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalTab, setAuthModalTab] = useState('login') // 'login' | 'register'

  useEffect(() => {
    const supabase = getSupabase()
    if (supabase) {
      // Verificar sesión activa en Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const userObj = {
            id: session.user.id,
            email: session.user.email,
            nombre: session.user.user_metadata?.nombre || session.user.email.split('@')[0],
            rol: 'cliente'
          }
          setCurrentUser(userObj)
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj))
        }
        setLoading(false)
      }).catch(() => setLoading(false))

      // Escuchar cambios de estado en Supabase
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const userObj = {
            id: session.user.id,
            email: session.user.email,
            nombre: session.user.user_metadata?.nombre || session.user.email.split('@')[0],
            rol: 'cliente'
          }
          setCurrentUser(userObj)
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj))
        } else {
          setCurrentUser(null)
          localStorage.removeItem(STORAGE_USER_KEY)
        }
      })

      return () => {
        subscription?.unsubscribe()
      }
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const supabase = getSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })
        if (error) throw error

        const userObj = {
          id: data.user.id,
          email: data.user.email,
          nombre: data.user.user_metadata?.nombre || email.split('@')[0],
          rol: 'cliente'
        }
        setCurrentUser(userObj)
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj))
        setIsAuthModalOpen(false)
        return { success: true, user: userObj }
      } catch (err) {
        console.warn('Fallo login en Supabase, intentando fallback local:', err)
        // Si falla por credenciales o red, podemos permitir login en modo demo si el usuario lo desea
        throw err
      }
    } else {
      // Modo local simulado
      const simulatedUser = {
        id: `usr-${Date.now()}`,
        email: email.trim(),
        nombre: email.split('@')[0],
        rol: email.includes('admin') ? 'admin' : 'cliente'
      }
      setCurrentUser(simulatedUser)
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(simulatedUser))
      setIsAuthModalOpen(false)
      return { success: true, user: simulatedUser }
    }
  }

  const register = async (nombre, email, password) => {
    const supabase = getSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { nombre: nombre.trim() }
          }
        })
        if (error) throw error

        const userObj = {
          id: data.user?.id || `usr-${Date.now()}`,
          email: email.trim(),
          nombre: nombre.trim(),
          rol: 'cliente'
        }
        setCurrentUser(userObj)
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj))
        setIsAuthModalOpen(false)
        return { success: true, user: userObj }
      } catch (err) {
        throw err
      }
    } else {
      // Modo local simulado
      const simulatedUser = {
        id: `usr-${Date.now()}`,
        email: email.trim(),
        nombre: nombre.trim(),
        rol: 'cliente'
      }
      setCurrentUser(simulatedUser)
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(simulatedUser))
      setIsAuthModalOpen(false)
      return { success: true, user: simulatedUser }
    }
  }

  const logout = async () => {
    const supabase = getSupabase()
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.warn('Error al desloguear de Supabase:', err)
      }
    }
    setCurrentUser(null)
    localStorage.removeItem(STORAGE_USER_KEY)
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
