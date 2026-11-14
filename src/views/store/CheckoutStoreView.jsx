// src/views/store/CheckoutStoreView.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CreditCard,
  ShieldCheck,
  Lock,
  ArrowRight,
  Truck,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Building,
  Sparkles
} from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { procesarOrdenWeb } from '../../services/api'
import { trackBeginCheckout, trackPurchase } from '../../services/analytics'
import PagoSimuladoModal from '../../components/store/PagoSimuladoModal'

// Regiones y Comunas de Chile para el checkout
const REGIONES_CHILE = [
  {
    nombre: 'Región Metropolitana de Santiago',
    comunas: ['Santiago', 'Providencia', 'Las Condes', 'Ñuñoa', 'Maipú', 'La Florida', 'Puente Alto', 'San Miguel', 'San Bernardo']
  },
  {
    nombre: 'Región de Valparaíso',
    comunas: ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Concón', 'Quillota', 'San Antonio']
  },
  {
    nombre: 'Región del Biobío',
    comunas: ['Concepción', 'Talcahuano', 'San Pedro de la Paz', 'Chiguayante', 'Coronel', 'Los Ángeles']
  },
  {
    nombre: 'Región de Coquimbo',
    comunas: ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel']
  },
  {
    nombre: 'Región de la Araucanía',
    comunas: ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón']
  }
]

export default function CheckoutStoreView() {
  const { items, cargando, subtotal, costoEnvio, total, recargarCarrito } = useCart()
  const { currentUser, openAuthModal } = useAuth()
  const navigate = useNavigate()

  // Formulario de despacho: los mismos campos que valida POST /api/checkout.
  // El RUT y las notas no se piden porque la API no los guarda; el correo es el de la cuenta.
  const [nombre, setNombre] = useState(currentUser?.nombre?.split(' ')[0] || '')
  const [apellido, setApellido] = useState(currentUser?.nombre?.split(' ').slice(1).join(' ') || '')
  const [telefono, setTelefono] = useState('+56 9 8765 4321')
  const [direccion, setDireccion] = useState('Av. Dieciocho 390')
  const [depto, setDepto] = useState('Oficina 402')
  const [region, setRegion] = useState('Región Metropolitana de Santiago')
  const [comuna, setComuna] = useState('Santiago')

  // Pago simulado
  const [isPagoOpen, setIsPagoOpen] = useState(false)
  const [errorCheckout, setErrorCheckout] = useState(null)
  /** Productos sin stock suficiente (409): [{ producto_id, nombre, solicitado, disponible }] */
  const [faltantes, setFaltantes] = useState(null)
  const [procesandoFinal, setProcesandoFinal] = useState(false)

  // Al iniciar sesión desde el checkout se completa el nombre si estaba vacío.
  useEffect(() => {
    if (!currentUser) return
    const [primero, ...resto] = (currentUser.nombre || '').split(' ')
    setNombre((n) => n || primero || '')
    setApellido((a) => a || resto.join(' '))
  }, [currentUser])

  // Obtener comunas de la región seleccionada
  const comunasDisponibles = REGIONES_CHILE.find(r => r.nombre === region)?.comunas || []

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  // Rastrear inicio de checkout en GA4 (una vez, cuando el carrito ya cargó desde la API).
  const checkoutRastreado = useRef(false)
  useEffect(() => {
    if (!checkoutRastreado.current && items.length > 0) {
      checkoutRastreado.current = true
      trackBeginCheckout(items, total)
    }
  }, [items, total])

  // Validación y apertura del pago simulado
  const handleContinuarAlPago = (e) => {
    e.preventDefault()
    setErrorCheckout(null)
    setFaltantes(null)

    if (!currentUser) {
      setErrorCheckout('Inicia sesión para completar la compra. Tu carrito se conservará.')
      openAuthModal('login')
      return
    }
    if (!nombre.trim() || !apellido.trim() || !telefono.trim() || !direccion.trim()) {
      setErrorCheckout('Por favor completa todos los campos obligatorios de despacho.')
      return
    }
    setIsPagoOpen(true)
  }

  // Confirmación del pago simulado: POST /api/checkout con medio_pago "mock".
  const handleConfirmarPago = async () => {
    setProcesandoFinal(true)
    try {
      const orden = await procesarOrdenWeb({
        despacho: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          telefono: telefono.trim(),
          region,
          comuna,
          direccion: direccion.trim(),
          ...(depto.trim() ? { depto: depto.trim() } : {})
        }
      })

      // Evento GA4 de compra exitosa
      trackPurchase(orden)

      setIsPagoOpen(false)
      await recargarCarrito() // la API ya vació el carrito
      navigate(`/orden/${orden.id}`)
    } catch (err) {
      setIsPagoOpen(false)
      setProcesandoFinal(false)
      if (err.status === 409 && Array.isArray(err.detalle?.productos)) {
        setFaltantes(err.detalle.productos)
        setErrorCheckout('Algunos productos ya no tienen stock suficiente. Ajusta tu carrito para continuar.')
        recargarCarrito()
      } else if (err.status === 401) {
        setErrorCheckout('Tu sesión expiró. Inicia sesión de nuevo para completar la compra.')
        openAuthModal('login')
      } else {
        setErrorCheckout(err.message || 'No se pudo completar la compra.')
      }
    }
  }

  if (cargando) {
    return <div className="py-16 text-center text-xs font-semibold text-slate-500">Cargando tu carrito...</div>
  }

  if (items.length === 0 && !procesandoFinal) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-2xl font-black text-slate-800">No hay productos en el checkout</h2>
        <p className="text-xs text-slate-500">Agrega productos al carrito antes de proceder al pago.</p>
        <Link
          to="/catalogo"
          className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
        >
          Volver a la Tienda
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Checkout y Despacho Seguro
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Ingresa tus datos de envío en Chile y confirma la compra con el pago simulado (entorno de pruebas).
        </p>
      </div>

      {errorCheckout && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorCheckout}</span>
        </div>
      )}

      {faltantes && (
        <div role="alert" className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
          <p className="font-bold">Productos sin stock suficiente:</p>
          <ul className="list-disc pl-5 space-y-1">
            {faltantes.map((p) => (
              <li key={p.producto_id}>
                <strong>{p.nombre}</strong>: pediste {p.solicitado}, {p.disponible === 0 ? 'no quedan unidades' : `quedan ${p.disponible}`}.
              </li>
            ))}
          </ul>
          <Link to="/carrito" className="inline-block font-bold text-indigo-700 underline">Ajustar mi carrito</Link>
        </div>
      )}

      <form onSubmit={handleContinuarAlPago} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Formulario de Despacho (2 columnas) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Datos Personales */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-indigo-600" />
              1. Identificación del Cliente (Chile)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Apellidos *</label>
                <input
                  type="text"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Móvil *</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correo de la cuenta</label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  placeholder="Inicia sesión para continuar"
                  readOnly
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Dirección de Despacho */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Truck className="w-4 h-4 text-indigo-600" />
              2. Dirección de Entrega en Chile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Región *</label>
                <select
                  value={region}
                  onChange={(e) => {
                    const r = e.target.value
                    setRegion(r)
                    const primeraComuna = REGIONES_CHILE.find(x => x.nombre === r)?.comunas[0] || ''
                    setComuna(primeraComuna)
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                >
                  {REGIONES_CHILE.map(r => (
                    <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Comuna *</label>
                <select
                  value={comuna}
                  onChange={(e) => setComuna(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                >
                  {comunasDisponibles.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Calle y Número *
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej. Av. Libertador Bernardo O'Higgins 1234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Depto / Block / Casa (Opcional)
                </label>
                <input
                  type="text"
                  value={depto}
                  onChange={(e) => setDepto(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

            </div>
          </div>

          {/* Selección de Medio de Pago */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              3. Medio de Pago
            </h3>

            <div className="flex items-start gap-4 p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40">
              <input type="radio" name="metodoPago" value="mock" checked readOnly className="mt-1 accent-indigo-600" />
              <div className="flex-1">
                <span className="font-extrabold text-xs sm:text-sm text-slate-900">Pago simulado (entorno de pruebas)</span>
                <p className="text-xs text-slate-500 mt-1">
                  No se conecta con ningún banco ni pasarela de pago y no se cobra dinero. La integración con un medio de
                  pago real se agregará más adelante.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Resumen Lateral y Botón de Pago */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 sticky top-24">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Tu Compra ({items.length} artículos)
            </h3>

            {/* Lista resumida de items */}
            <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <img src={item.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate">{item.nombre}</p>
                      <p className="text-slate-400 text-[11px]">{item.cantidad} x {formatCLP(item.precio_venta)}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">
                    {formatCLP(item.precio_venta * item.cantidad)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-200">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">{formatCLP(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Despacho:</span>
                <span className="font-semibold text-slate-900">
                  {costoEnvio === 0 ? <span className="text-emerald-600 font-bold">¡GRATIS!</span> : formatCLP(costoEnvio)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-base font-black text-slate-900">
                <span>Total a Pagar:</span>
                <span className="text-xl text-indigo-600">{formatCLP(total)}</span>
              </div>
            </div>

            {/* Botón Pagar */}
            <button
              type="submit"
              disabled={procesandoFinal}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {procesandoFinal ? (
                <span>Registrando la compra...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Continuar al pago simulado</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-[10px] text-slate-400 space-y-1">
              <p>Entorno de pruebas del proyecto (UTEM): no se realizan cobros reales.</p>
            </div>
          </div>
        </div>

      </form>

      {/* Pago simulado (medio_pago "mock") */}
      <PagoSimuladoModal
        isOpen={isPagoOpen}
        monto={total}
        procesando={procesandoFinal}
        onConfirmar={handleConfirmarPago}
        onRechazar={(msg) => {
          setIsPagoOpen(false)
          setErrorCheckout(msg)
        }}
        onCancel={() => setIsPagoOpen(false)}
      />

    </div>
  )
}
