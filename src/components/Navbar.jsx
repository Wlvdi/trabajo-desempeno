import React, { useState } from 'react'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Settings,
  Menu,
  X,
  Layers
} from 'lucide-react'

export default function Navbar({ activeTab, setActiveTab, isConnected }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'compras', label: 'Compras (+Stock)', icon: ShoppingBag },
    { id: 'ventas', label: 'Ventas (-Stock)', icon: ShoppingCart },
    { id: 'auditoria', label: 'Auditoría Logs', icon: ShieldCheck },
    { id: 'config', label: 'Configuración', icon: Settings }
  ]

  const handleSelectTab = (id) => {
    setActiveTab(id)
    setMobileMenuOpen(false)
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-slate-900">SUBLIGOL</span>
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-indigo-100">
                  Control Operativo
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Gestión de Stock, Compras y Ventas</p>
            </div>
          </div>

          {/* Menú Desktop */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Estado de Conexión, Volver a la Tienda & Botón Móvil */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>🛍️ Tienda Online</span>
            </a>

            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200 cursor-pointer'
            }`}
            onClick={() => !isConnected && setActiveTab('config')}
            title={isConnected ? 'La API propia responde' : 'Haz clic para ver el estado de la API'}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isConnected ? 'API Conectada' : 'API sin respuesta'}
            </div>

            {/* Hamburguesa Móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Menú Desplegable Móvil */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            )
          })}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Estado Base de Datos:</span>
            <span className={`font-semibold ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isConnected ? 'Conectado' : 'Requiere Configuración'}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
