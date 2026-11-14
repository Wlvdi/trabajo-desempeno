// src/components/store/PagoSimuladoModal.jsx
// Pago simulado – entorno de pruebas.
// NO se conecta con ningún medio de pago real ni con el sandbox de Transbank:
// al confirmar, el checkout envía medio_pago "mock" a la API, que aprueba la
// compra y genera un código de autorización MOCK-NNNNNN.
// Motivo (guía, sección 5.3): bajo carga nunca se debe llamar al sandbox de
// un tercero. La integración real con Webpay será otro commit.
// No pide datos de tarjeta: en un pago simulado no hay nada que cobrar.
import React from 'react'
import { AlertTriangle, CheckCircle2, FlaskConical, RotateCcw, X } from 'lucide-react'

const formatCLP = (val) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
    Number(val) || 0
  )

/**
 * @param {{
 *   isOpen: boolean,
 *   monto: number,
 *   procesando: boolean,
 *   onConfirmar: () => void,
 *   onRechazar: (mensaje: string) => void,
 *   onCancel: () => void
 * }} props
 */
export default function PagoSimuladoModal({ isOpen, monto, procesando, onConfirmar, onRechazar, onCancel }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={procesando ? undefined : onCancel} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pago-simulado"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10 my-8"
      >
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-300" />
            <h2 id="titulo-pago-simulado" className="font-extrabold text-sm">
              Pago simulado – entorno de pruebas
            </h2>
          </div>
          {!procesando && (
            <button type="button" onClick={onCancel} aria-label="Cerrar" className="p-1 rounded-md text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Este pago <strong>no es real</strong> y no se conecta con ningún banco ni pasarela de pago. Sirve para
              probar el flujo de compra y las pruebas de carga del proyecto. No se cobra dinero.
            </p>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <span className="text-slate-500 font-medium">Monto de la compra</span>
            <span className="text-lg font-black text-indigo-700">{formatCLP(monto)}</span>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={procesando}
              onClick={onConfirmar}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {procesando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando la compra...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar pago simulado</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={procesando}
                onClick={() => onRechazar('Pago simulado rechazado. No se realizó ningún cargo; puedes intentarlo de nuevo.')}
                className="py-2.5 px-3 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-700 rounded-xl font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simular rechazo</span>
              </button>
              <button
                type="button"
                disabled={procesando}
                onClick={onCancel}
                className="py-2.5 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
