// src/views/ConfigView.jsx
// Estado de la API propia: URL base que usa el frontend y resultado de
// GET /api/salud (API y base de datos). Reemplaza la antigua pantalla de
// credenciales de Supabase.
import React, { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle, Globe, RefreshCw, Settings } from 'lucide-react'
import { fetchSalud, urlBase } from '../services/api'

/**
 * @param {{ onConfigUpdated?: (conectado: boolean) => void }} props
 */
export default function ConfigView({ onConfigUpdated }) {
  const [salud, setSalud] = useState(null)
  const [error, setError] = useState(null)
  const [probando, setProbando] = useState(false)

  const probar = async () => {
    setProbando(true)
    setError(null)
    try {
      const datos = await fetchSalud()
      setSalud(datos)
      onConfigUpdated?.(datos?.estado === 'ok')
    } catch (err) {
      setSalud(null)
      setError(err.message)
      onConfigUpdated?.(false)
    } finally {
      setProbando(false)
    }
  }

  useEffect(() => {
    probar()
  }, [])

  const ok = salud?.estado === 'ok'

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Estado de la API
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          El frontend consume la API propia de Subligol (Node.js + Express + PostgreSQL). Ya no se usan credenciales de
          Supabase.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 text-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">URL base:</span>
          <code className="font-mono font-bold text-slate-900">{urlBase()}</code>
          <span className="text-slate-400">(VITE_API_URL o, por defecto, /api en el mismo origen)</span>
        </div>

        {ok ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">La API y la base de datos responden.</p>
              <p className="flex items-center gap-1 mt-1">
                <Activity className="w-3.5 h-3.5" /> Latencia de la base de datos: {salud.latenciaBdMs} ms
              </p>
            </div>
          </div>
        ) : (
          (error || salud) && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">La API no está disponible.</p>
                <p className="mt-1">{error || `Base de datos: ${salud?.baseDatos}`}</p>
                <p className="mt-1">Levanta el backend con: <code className="font-mono">docker compose up -d</code></p>
              </div>
            </div>
          )
        )}

        <button
          type="button"
          onClick={probar}
          disabled={probando}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${probando ? 'animate-spin' : ''}`} />
          Probar conexión
        </button>
      </div>
    </div>
  )
}
