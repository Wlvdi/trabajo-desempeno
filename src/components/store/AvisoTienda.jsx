// src/components/store/AvisoTienda.jsx
// Aviso flotante de la tienda (por ejemplo, "No hay stock suficiente").
// Lee el aviso del CartContext y se oculta solo después de unos segundos.
import React, { useEffect } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { useCart } from '../../context/CartContext'

const DURACION_MS = 6000

export default function AvisoTienda() {
  const { aviso, cerrarAviso } = useCart()

  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(cerrarAviso, DURACION_MS)
    return () => clearTimeout(temporizador)
  }, [aviso, cerrarAviso])

  if (!aviso) return null
  const esError = aviso.tipo === 'error'

  return (
    <div
      role={esError ? 'alert' : 'status'}
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md flex items-start gap-3 p-4 rounded-2xl border shadow-lg text-xs sm:text-sm ${
        esError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
      }`}
    >
      {esError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
      <span className="flex-1 font-semibold">{aviso.texto}</span>
      <button type="button" onClick={cerrarAviso} aria-label="Cerrar aviso" className="shrink-0 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
