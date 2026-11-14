// src/components/store/StoreNavbar.jsx
import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ShoppingBag,
  ShoppingCart,
  User,
  Search,
  Package,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Layers,
  Sparkles
} from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'

export default function StoreNavbar() {
  const { totalItemsCount, openCart } = useCart()
  const { currentUser, logout, openAuthModal } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      navigate(`/catalogo?q=${encodeURIComponent(searchTerm.trim())}`)
      setSearchTerm('')
      setIsMobileMenuOpen(false)
    }
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all">
      {/* Barra superior de anuncios */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 text-white text-xs font-medium py-1.5 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="hidden sm:flex items-center gap-1.5 mx-auto">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>
              <strong>¡Despachos a todo Chile!</strong> Envío GRATIS en compras sobre <strong>$30.000 CLP</strong> • Pago simulado <strong>(entorno de pruebas)</strong>
            </span>
          </div>
          <div className="sm:hidden mx-auto text-center font-semibold">
            🚀 Envíos a todo Chile • Pago simulado
          </div>
          <Link
            to="/admin"
            className="hidden md:inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2.5 py-0.5 rounded-full text-xs font-semibold transition"
            title="Ir al panel de gestión y control de bodega"
          >
            <Layers className="w-3 h-3" />
            Modo Bodega ERP
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo y Marca */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Subligol<span className="text-indigo-600">.cl</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase -mt-1">
                  Sublimación & Estampados
                </span>
              </div>
            </Link>

            {/* Navegación Desktop */}
            <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
              <Link
                to="/"
                className={`px-3 py-2 rounded-lg transition-colors ${
                  isActive('/')
                    ? 'text-indigo-600 bg-indigo-50/80 font-bold'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70'
                }`}
              >
                Inicio
              </Link>
              <Link
                to="/catalogo"
                className={`px-3 py-2 rounded-lg transition-colors ${
                  isActive('/catalogo')
                    ? 'text-indigo-600 bg-indigo-50/80 font-bold'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70'
                }`}
              >
                Catálogo de Productos
              </Link>
              <Link
                to="/catalogo?temporada=Escolar"
                className="px-3 py-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70 transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Temporada Escolar
              </Link>
            </nav>
          </div>

          {/* Buscador Central */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden lg:flex flex-1 max-w-md relative items-center"
          >
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar tazas, poleras, botellas..."
              className="w-full bg-slate-100/80 text-slate-900 pl-10 pr-4 py-2 text-sm rounded-full border border-transparent focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          </form>

          {/* Acciones del Usuario (Carrito, Perfil, Modo Admin) */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Botón Carrito */}
            <button
              type="button"
              onClick={openCart}
              className="relative p-2.5 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition flex items-center gap-2 group"
              aria-label="Abrir Carrito"
            >
              <ShoppingCart className="w-5 h-5 text-slate-700 group-hover:text-indigo-600 transition" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs animate-scale">
                  {totalItemsCount}
                </span>
              )}
              <span className="hidden xl:inline text-xs font-bold text-slate-700 group-hover:text-indigo-600">
                Carrito
              </span>
            </button>

            {/* Usuario / Autenticación */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 transition"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {currentUser.nombre?.charAt(0) || 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {currentUser.nombre}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100 text-xs">
                      <p className="font-bold text-slate-900">{currentUser.nombre}</p>
                      <p className="text-slate-400 truncate">{currentUser.email}</p>
                    </div>
                    <Link
                      to="/mis-pedidos"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                    >
                      <Package className="w-4 h-4 text-indigo-500" />
                      Mis Pedidos
                    </Link>
                    <Link
                      to="/admin"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                    >
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Panel de Bodega ERP
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout()
                        setIsUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
              >
                <User className="w-4 h-4" />
                <span>Ingresar</span>
              </button>
            )}

            {/* Acceso directo a Panel de Bodega (Admin) */}
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition shadow-2xs"
            >
              <span>Admin ERP</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            {/* Botón Menú Móvil */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 md:hidden text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Abrir Menú"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menú Móvil Desplegable */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-100 space-y-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar tazas, poleras..."
                className="w-full bg-slate-100 text-slate-900 pl-10 pr-4 py-2 text-sm rounded-xl border border-transparent focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            </form>
            <div className="flex flex-col gap-1 text-sm font-semibold">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Inicio
              </Link>
              <Link
                to="/catalogo"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Catálogo de Productos
              </Link>
              <Link
                to="/catalogo?temporada=Escolar"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Temporada Escolar 2026
              </Link>
              <Link
                to="/mis-pedidos"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Mis Pedidos
              </Link>
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 font-bold flex items-center justify-between"
              >
                <span>Panel de Gestión Bodega ERP</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
