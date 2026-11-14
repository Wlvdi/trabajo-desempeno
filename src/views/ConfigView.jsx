import React, { useState } from 'react'
import {
  Settings,
  Key,
  Globe,
  CheckCircle,
  AlertCircle,
  Save,
  Trash2,
  ExternalLink,
  ShieldAlert
} from 'lucide-react'
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials
} from '../services/supabase'
import { testConnection } from '../services/api'

export default function ConfigView({ onConfigUpdated }) {
  const current = getSupabaseCredentials()
  const [url, setUrl] = useState(current.url)
  const [anonKey, setAnonKey] = useState(current.anonKey)
  const [testing, setTesting] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const handleGuardarYProbar = async (e) => {
    e.preventDefault()
    setMensaje(null)

    if (!url.trim() || !anonKey.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor completa ambos campos (URL y Anon Key).' })
      return
    }

    // Guardar temporalmente para que el cliente lo tome
    saveSupabaseCredentials(url, anonKey)
    setTesting(true)

    try {
      await testConnection()
      setMensaje({
        tipo: 'exito',
        texto: '¡Conexión exitosa con Supabase! Tu base de datos y todas las tablas responden correctamente.'
      })
      if (onConfigUpdated) onConfigUpdated(true)
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: `No se pudo conectar a Supabase: ${err.message || 'Verifica que la URL y la Anon Key sean correctas.'}`
      })
      if (onConfigUpdated) onConfigUpdated(false)
    } finally {
      setTesting(false)
    }
  }

  const handleLimpiar = () => {
    if (confirm('¿Deseas borrar las credenciales guardadas en este navegador?')) {
      clearSupabaseCredentials()
      setUrl('')
      setAnonKey('')
      setMensaje({ tipo: 'info', texto: 'Credenciales eliminadas del navegador.' })
      if (onConfigUpdated) onConfigUpdated(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Conexión y Configuración de Supabase
        </h1>
        <p className="text-sm text-slate-500">
          Ingresa las credenciales de tu proyecto Supabase para conectar este frontend con tu base de datos en tiempo real.
        </p>
      </div>

      {/* Tarjeta de Formulario */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        
        {mensaje && (
          <div className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : mensaje.tipo === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {mensaje.tipo === 'exito' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{mensaje.tipo === 'exito' ? '¡Éxito!' : 'Aviso'}</p>
              <p className="mt-0.5">{mensaje.texto}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleGuardarYProbar} className="space-y-4">
          
          {/* Project URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-600" />
              Project URL de Supabase
            </label>
            <input
              type="url"
              required
              placeholder="https://xyzabcdefg.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Encuéntralo en tu proyecto Supabase: <strong>Project Settings → API → Project URL</strong>
            </p>
          </div>

          {/* Anon Public Key */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-600" />
              Project API Key (anon / public)
            </label>
            <textarea
              rows={3}
              required
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Encuéntralo en tu proyecto Supabase: <strong>Project Settings → API → Project API Keys → anon / public</strong>
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleLimpiar}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar Credenciales
            </button>

            <button
              type="submit"
              disabled={testing}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-100 disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              {testing ? 'Verificando Conexión...' : 'Guardar y Probar Conexión'}
            </button>
          </div>

        </form>

      </div>

      {/* Instructivo visual */}
      <div className="bg-slate-100/70 rounded-2xl border border-slate-200 p-5 space-y-2 text-xs text-slate-600">
        <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
          <ExternalLink className="w-4 h-4 text-slate-500" />
          ¿Cómo encontrar estas credenciales en Supabase?
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
          <li>Entra a tu panel en <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">supabase.com/dashboard</a>.</li>
          <li>Haz clic en tu proyecto (ej: <em>subligol-db</em>).</li>
          <li>En la barra lateral izquierda, baja hasta el ícono de engranaje (<strong>Project Settings</strong>).</li>
          <li>Selecciona <strong>API</strong> (o <em>Data API</em>).</li>
          <li>Copia la <strong>Project URL</strong> y la clave <strong>anon public</strong> y pégalas aquí arriba.</li>
        </ol>
      </div>

    </div>
  )
}
