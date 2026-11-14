// src/views/store/CheckoutStoreView.jsx
import React, { useState } from 'react'
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
import WebpaySandboxModal from '../../components/store/WebpaySandboxModal'

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
  const { items, subtotal, costoEnvio, total, clearCart } = useCart()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  // Formulario Despacho
  const [nombre, setNombre] = useState(currentUser?.nombre?.split(' ')[0] || '')
  const [apellido, setApellido] = useState(currentUser?.nombre?.split(' ')[1] || 'Solis')
  const [rut, setRut] = useState('19.876.543-2')
  const [email, setEmail] = useState(currentUser?.email || 'cliente.prueba@subligol.cl')
  const [telefono, setTelefono] = useState('+56 9 8765 4321')
  const [direccion, setDireccion] = useState('Av. Dieciocho 390')
  const [depto, setDepto] = useState('Oficina 402')
  const [region, setRegion] = useState('Región Metropolitana de Santiago')
  const [comuna, setComuna] = useState('Santiago')
  const [notas, setNotas] = useState('Timbre en recepción')

  // Pasarela
  const [metodoPago, setMetodoPago] = useState('webpay') // 'webpay' | 'transferencia'
  const [isSandboxOpen, setIsSandboxOpen] = useState(false)
  const [errorCheckout, setErrorCheckout] = useState(null)
  const [procesandoFinal, setProcesandoFinal] = useState(false)

  // Obtener comunas de la región seleccionada
  const comunasDisponibles = REGIONES_CHILE.find(r => r.nombre === region)?.comunas || []

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(val) || 0)
  }

  // Rastrear inicio de checkout en GA4
  React.useEffect(() => {
    if (items.length > 0) {
      trackBeginCheckout(items, total)
    }
  }, [])

  // Validación y apertura de Sandbox
  const handleContinuarAlPago = (e) => {
    e.preventDefault()
    setErrorCheckout(null)

    if (!nombre.trim() || !apellido.trim() || !rut.trim() || !email.trim() || !direccion.trim()) {
      setErrorCheckout('Por favor completa todos los campos obligatorios de despacho.')
      return
    }

    if (metodoPago === 'webpay') {
      setIsSandboxOpen(true)
    } else {
      // Transferencia directa
      handleFinalizarCompra({
        codigoAutorizacion: 'TRANSF-MANUAL',
        metodoPagoNombre: 'Transferencia Bancaria (Cuenta RUT / Banco Estado)'
      })
    }
  }

  // Confirmación exitosa desde el Sandbox Webpay
  const handleFinalizarCompra = async (pagoInfo) => {
    setIsSandboxOpen(false)
    setProcesandoFinal(true)

    try {
      const clienteData = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rut: rut.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        depto: depto.trim(),
        region,
        comuna
      }

      const ordenCreada = await procesarOrdenWeb({
        cliente: clienteData,
        items,
        metodoPago: pagoInfo.tipoTarjeta || 'Webpay Plus Transbank',
        codigoAutorizacion: pagoInfo.codigoAutorizacion || 'TBK-000000',
        total,
        costoEnvio,
        notas
      })

      // Evento GA4 de compra exitosa
      trackPurchase(ordenCreada)

      clearCart()
      navigate(`/orden/${ordenCreada.id}`)
    } catch (err) {
      console.error(err)
      setErrorCheckout('Error al guardar la orden: ' + err.message)
      setProcesandoFinal(false)
    }
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
          Ingresa tus datos de envío en Chile y realiza tu pago mediante el Sandbox de Webpay Plus.
        </p>
      </div>

      {errorCheckout && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorCheckout}</span>
        </div>
      )}

      <form onSubmit={handleContinuarAlPago} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Formulario de Despacho (2 columnas) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Datos Personales y RUT */}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  RUT Chileno * (Ej. 12.345.678-9)
                </label>
                <input
                  type="text"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
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

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico para Factura / Boleta *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                  required
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instrucciones de Entrega
                </label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej. Dejar con conserje"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Selección de Medio de Pago */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              3. Medio de Pago Disponible en Chile
            </h3>

            <div className="space-y-3">
              {/* Webpay Plus (Destacado) */}
              <label
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition ${
                  metodoPago === 'webpay'
                    ? 'border-red-600 bg-red-50/40 ring-2 ring-red-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="metodoPago"
                  value="webpay"
                  checked={metodoPago === 'webpay'}
                  onChange={() => setMetodoPago('webpay')}
                  className="mt-1 text-red-600 focus:ring-red-500 accent-red-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                      <span className="text-red-600 font-black">Webpay Plus</span>
                      <span>(Transbank Sandbox)</span>
                    </span>
                    <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Débito (Redcompra), Tarjetas de Crédito en cuotas sin interés y Cuenta RUT de Banco Estado.
                  </p>
                </div>
              </label>

              {/* Transferencia Bancaria Manual */}
              <label
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition ${
                  metodoPago === 'transferencia'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="metodoPago"
                  value="transferencia"
                  checked={metodoPago === 'transferencia'}
                  onChange={() => setMetodoPago('transferencia')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      Transferencia Electrónica Manual (Cuenta RUT)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Simulación de pago manual enviando comprobante a pagos@subligol.cl.
                  </p>
                </div>
              </label>
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
              className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-red-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {procesandoFinal ? (
                <span>Guardando y descontando stock...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pagar con Webpay Plus Sandbox</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-[10px] text-slate-400 space-y-1">
              <p>🔒 Transacción cifrada con protocolo TLS 1.3</p>
              <p>Ambiente seguro de integración Transbank para la UTEM.</p>
            </div>
          </div>
        </div>

      </form>

      {/* Modal Sandbox Webpay Plus Oficial */}
      <WebpaySandboxModal
        isOpen={isSandboxOpen}
        monto={total}
        ordenCompra={`OC-${Date.now().toString().slice(-6)}`}
        cliente={{ nombre, apellido, rut, email }}
        onSuccess={handleFinalizarCompra}
        onFailure={(msg) => setErrorCheckout(msg)}
        onCancel={() => setIsSandboxOpen(false)}
      />

    </div>
  )
}
