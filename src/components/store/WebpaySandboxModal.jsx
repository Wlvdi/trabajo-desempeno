// src/components/store/WebpaySandboxModal.jsx
import React, { useState } from 'react'
import {
  CreditCard,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react'

export default function WebpaySandboxModal({
  isOpen,
  monto,
  ordenCompra,
  cliente,
  onSuccess,
  onFailure,
  onCancel
}) {
  const [tipoTarjeta, setTipoTarjeta] = useState('debito') // 'debito' | 'credito'
  const [numeroTarjeta, setNumeroTarjeta] = useState('5970 2000 0000 1234')
  const [fechaExp, setFechaExp] = useState('12/28')
  const [cvv, setCvv] = useState('123')
  const [cuotas, setCuotas] = useState('1')
  const [procesando, setProcesando] = useState(false)
  const [errorSimulado, setErrorSimulado] = useState(null)

  if (!isOpen) return null

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  const handleCargarTarjetaPrueba = () => {
    if (tipoTarjeta === 'debito') {
      setNumeroTarjeta('5970 2000 0000 1234')
      setFechaExp('12/28')
      setCvv('123')
    } else {
      setNumeroTarjeta('6623 4810 9999 5678')
      setFechaExp('08/29')
      setCvv('888')
      setCuotas('3')
    }
    setErrorSimulado(null)
  }

  const handlePagar = () => {
    setErrorSimulado(null)
    setProcesando(true)

    // Simulación de latencia de red bancaria (1.5 segundos)
    setTimeout(() => {
      setProcesando(false)
      const authCode = `TBK-${Math.floor(100000 + Math.random() * 900000)}`
      const transId = `TX-${Date.now()}`
      const ultimos4 = numeroTarjeta.replace(/\s+/g, '').slice(-4) || '1234'

      if (onSuccess) {
        onSuccess({
          codigoAutorizacion: authCode,
          transaccionId: transId,
          tipoTarjeta: tipoTarjeta === 'debito' ? 'Débito (Redcompra)' : `Crédito (${cuotas} cuotas)`,
          ultimosCuatro: ultimos4,
          fecha: new Date().toISOString()
        })
      }
    }, 1500)
  }

  const handleSimularRechazo = () => {
    setProcesando(true)
    setErrorSimulado(null)

    setTimeout(() => {
      setProcesando(false)
      setErrorSimulado('Transacción rechazada por el emisor (código error TBK-ERR-51: Fondos insuficientes en tarjeta de prueba).')
      if (onFailure) {
        onFailure('Transacción rechazada en ambiente Sandbox')
      }
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Fondo oscuro institucional */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={procesando ? undefined : onCancel}
      />

      {/* Contenedor Modal estilo Transbank */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10 animate-in zoom-in-95 duration-200 my-8">
        
        {/* Cabecera Webpay Plus */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-md text-red-700 font-extrabold text-sm tracking-tight shadow-xs flex items-center gap-1">
              <span className="text-red-600 font-black">webpay</span>
              <span className="text-slate-800 text-xs font-bold uppercase">plus</span>
            </div>
            <div className="hidden sm:block text-xs font-medium text-red-100 border-l border-red-400 pl-3">
              Ambiente de Pruebas Oficial (Sandbox)
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] bg-red-800/60 px-2 py-0.5 rounded-full text-white font-mono">
              <Lock className="w-3 h-3 text-red-200" />
              <span>TLS 1.3</span>
            </div>
            {!procesando && (
              <button
                type="button"
                onClick={onCancel}
                className="p-1 rounded-md text-red-200 hover:text-white hover:bg-red-800/40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Resumen del Comercio y Orden */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="text-slate-500 font-medium">Establecimiento:</p>
            <p className="text-sm font-extrabold text-slate-900">Subligol SpA</p>
            <p className="text-[11px] text-slate-400">Orden: {ordenCompra}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-slate-500 font-medium">Monto a pagar:</p>
            <p className="text-lg font-black text-indigo-700">{formatCLP(monto)}</p>
            <p className="text-[11px] text-slate-400">Moneda: Peso Chileno (CLP)</p>
          </div>
        </div>

        {/* Cuerpo del Sandbox */}
        <div className="p-6 space-y-5">
          
          {/* Mensaje de Sandbox */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Modo de Pruebas Transbank Habilitado</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                No se realizarán cargos a dinero real. Puedes usar las tarjetas de prueba oficiales precargadas para validar la compra.
              </p>
            </div>
          </div>

          {errorSimulado && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error en Pasarela Bancaria</p>
                <p className="text-[11px] text-rose-800 mt-0.5">{errorSimulado}</p>
              </div>
            </div>
          )}

          {/* Selector Débito vs Crédito */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Selecciona el tipo de tarjeta:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTipoTarjeta('debito')
                  setNumeroTarjeta('5970 2000 0000 1234')
                  setCuotas('1')
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  tipoTarjeta === 'debito'
                    ? 'border-red-600 bg-red-50/60 text-red-700 ring-2 ring-red-100'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Débito (Redcompra)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTipoTarjeta('credito')
                  setNumeroTarjeta('6623 4810 9999 5678')
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  tipoTarjeta === 'credito'
                    ? 'border-red-600 bg-red-50/60 text-red-700 ring-2 ring-red-100'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Tarjeta de Crédito</span>
              </button>
            </div>
          </div>

          {/* Formulario de Tarjeta */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Número de Tarjeta</label>
                <button
                  type="button"
                  onClick={handleCargarTarjetaPrueba}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Rellenar datos de prueba
                </button>
              </div>
              <input
                type="text"
                value={numeroTarjeta}
                onChange={(e) => setNumeroTarjeta(e.target.value)}
                placeholder="5970 0000 0000 0000"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vencimiento (MM/AA)
                </label>
                <input
                  type="text"
                  value={fechaExp}
                  onChange={(e) => setFechaExp(e.target.value)}
                  placeholder="12/28"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-red-500 text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código CVV
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="123"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-red-500 text-center"
                />
              </div>
            </div>

            {tipoTarjeta === 'credito' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cuotas sin interés
                </label>
                <select
                  value={cuotas}
                  onChange={(e) => setCuotas(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-red-500"
                >
                  <option value="1">1 cuota de {formatCLP(monto)} (Sin interés)</option>
                  <option value="3">3 cuotas de {formatCLP(Math.round(monto / 3))} (Sin interés)</option>
                  <option value="6">6 cuotas de {formatCLP(Math.round(monto / 6))} (Sin interés)</option>
                  <option value="12">12 cuotas de {formatCLP(Math.round(monto / 12))} (Sin interés)</option>
                </select>
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={procesando}
              onClick={handlePagar}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-red-200 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {procesando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando pago con banco emisor...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pagar {formatCLP(monto)} con Webpay</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                disabled={procesando}
                onClick={handleSimularRechazo}
                className="py-2.5 px-3 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-700 rounded-xl font-bold transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simular Rechazo</span>
              </button>

              <button
                type="button"
                disabled={procesando}
                onClick={onCancel}
                className="py-2.5 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancelar Compra</span>
              </button>
            </div>
          </div>

          {/* Sellos de Seguridad Transbank */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-4 text-[10px] text-slate-400 font-medium">
            <span>Transbank Webpay Plus Oficial</span>
            <span>•</span>
            <span>Cifrado SSL 256 bits</span>
            <span>•</span>
            <span>PCI-DSS Nivel 1</span>
          </div>

        </div>

      </div>
    </div>
  )
}
