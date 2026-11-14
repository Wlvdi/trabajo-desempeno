// src/components/store/AuthModal.jsx
import React, { useState } from 'react'
import { X, User, Mail, Lock, AlertCircle, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalTab, setAuthModalTab, login, register } = useAuth()
  
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  if (!isAuthModalOpen) return null

  const resetForm = () => {
    setNombre('')
    setEmail('')
    setPassword('')
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  const handleTabChange = (tab) => {
    resetForm()
    setAuthModalTab(tab)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (authModalTab === 'login') {
        if (!email.trim() || !password) {
          throw new Error('Por favor ingresa tu correo y contraseña.')
        }
        await login(email, password)
        resetForm()
      } else {
        if (!nombre.trim() || !email.trim() || !password) {
          throw new Error('Todos los campos son obligatorios.')
        }
        if (password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres.')
        }
        await register(nombre, email, password)
        resetForm()
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemoFill = () => {
    setEmail('cliente.demo@subligol.cl')
    setPassword('demo123456')
    setNombre('Leonardo Solís')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo desenfocado */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white relative">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight">
            {authModalTab === 'login' ? 'Bienvenido a Subligol' : 'Crea tu Cuenta'}
          </h3>
          <p className="text-xs text-indigo-100 mt-1">
            {authModalTab === 'login'
              ? 'Inicia sesión para gestionar tus pedidos y agilizar tu compra.'
              : 'Regístrate para comprar y guardar tu historial de pedidos.'}
          </p>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-slate-100 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleTabChange('login')}
            className={`flex-1 py-3 text-center transition-colors ${
              authModalTab === 'login'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('register')}
            className={`flex-1 py-3 text-center transition-colors ${
              authModalTab === 'register'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Crear Cuenta Nueva
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {authModalTab === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre Completo
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.cl"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                required
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Procesando...</span>
            ) : (
              <>
                <span>{authModalTab === 'login' ? 'Iniciar Sesión' : 'Registrarme'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {/* Relleno Rápido de Prueba (Demo) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleQuickDemoFill}
              className="w-full py-2 px-3 border border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Autocompletar con usuario Demo para pruebas</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
