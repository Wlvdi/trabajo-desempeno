// src/views/AdminApp.jsx
// Panel de administración (bodega / ERP).
//
// Acceso: solo usuarios con sesión y rol "admin" (antes se revisaba si
// Supabase estaba configurado). La API valida el rol de nuevo en cada
// endpoint de administración; esta verificación solo evita mostrar el panel.
//
// Estado: los endpoints de administración llegan en el commit 9. Mientras
// tanto, con PANEL_API_DISPONIBLE = false las pestañas de gestión muestran el
// aviso "Panel en migración" (las funciones de admin de api.js lanzan un
// ErrorApi 501). La pestaña de configuración muestra el estado de la API.
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ModalProducto from '../components/ModalProducto'
import AuthModal from '../components/store/AuthModal'
import DashboardView from './DashboardView'
import InventarioView from './InventarioView'
import ComprasView from './ComprasView'
import VentasView from './VentasView'
import AuditoriaView from './AuditoriaView'
import ConfigView from './ConfigView'
import { useAuth } from '../context/AuthContext'
import { testConnection, fetchCategorias, createProducto, updateProducto } from '../services/api'
import { AlertCircle, ArrowLeft, Construction, Lock } from 'lucide-react'

/** Cambiar a true cuando existan los endpoints de administración (commit 9). */
const PANEL_API_DISPONIBLE = false

/** Pantalla centrada para los casos sin acceso o en migración. */
function Aviso({ icono, titulo, children }) {
  return (
    <div className="max-w-xl mx-auto my-16 bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-4 shadow-xs">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">{icono}</div>
      <h2 className="text-xl font-black text-slate-900">{titulo}</h2>
      <div className="text-xs text-slate-500 space-y-3">{children}</div>
    </div>
  )
}

export default function AdminApp() {
  const { currentUser, isAdmin, loading, openAuthModal } = useAuth()
  const [activeTab, setActiveTab] = useState(PANEL_API_DISPONIBLE ? 'dashboard' : 'config')
  const [isConnected, setIsConnected] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [inventarioDefaultEstado, setInventarioDefaultEstado] = useState('todos')

  // Modal Producto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [productoToEdit, setProductoToEdit] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  /** Verifica que la API responda (GET /api/salud) y carga las categorías. */
  const verifyConnection = async () => {
    try {
      setIsConnected(await testConnection())
      setCategorias(await fetchCategorias())
    } catch (err) {
      console.warn('No se pudo validar la conexión con la API:', err.message)
      setIsConnected(false)
    }
  }

  useEffect(() => {
    if (isAdmin) verifyConnection()
  }, [isAdmin])

  const handleNavigate = (tab, params = {}) => {
    if (params.estado) {
      setInventarioDefaultEstado(params.estado)
    } else {
      setInventarioDefaultEstado('todos')
    }
    setActiveTab(tab)
  }

  const handleOpenNuevoProducto = () => {
    setProductoToEdit(null)
    setIsModalOpen(true)
  }

  const handleEditProducto = (prod) => {
    setProductoToEdit(prod)
    setIsModalOpen(true)
  }

  const handleSaveProducto = async (payload, id) => {
    if (id) {
      await updateProducto(id, payload)
    } else {
      await createProducto(payload)
    }
    setRefreshKey(prev => prev + 1)
  }

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  // --- Control de acceso -----------------------------------------------------
  if (loading) {
    return <div className="p-8 text-center text-xs font-semibold text-slate-500">Validando sesión...</div>
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans px-4">
        <Aviso icono={<Lock className="w-7 h-7" />} titulo={currentUser ? 'No tienes permisos' : 'Acceso restringido'}>
          <p>
            {currentUser
              ? `La cuenta ${currentUser.email} no tiene rol de administrador.`
              : 'El panel de administración requiere iniciar sesión con una cuenta de administrador.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {!currentUser && (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
              >
                Iniciar sesión
              </button>
            )}
            <Link to="/" className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold">
              Volver a la tienda
            </Link>
          </div>
        </Aviso>
        <AuthModal />
      </div>
    )
  }

  // --- Panel -----------------------------------------------------------------
  const avisoMigracion = (
    <Aviso icono={<Construction className="w-7 h-7" />} titulo="Panel en migración">
      <p>
        El panel de administración se está migrando de Supabase a la API propia de Subligol. Inventario, compras,
        ventas, auditoría y el dashboard estarán disponibles cuando se publiquen sus endpoints.
      </p>
      <p>Mientras tanto, la tienda funciona completa y la pestaña de configuración muestra el estado de la API.</p>
      <Link to="/" className="inline-flex items-center gap-1 px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold">
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a la tienda
      </Link>
    </Aviso>
  )
  const mostrarGestion = (tab) => PANEL_API_DISPONIBLE && activeTab === tab

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-500 selection:text-white">

      {/* Barra de Navegación del Panel de Control */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
      />

      {!isConnected && activeTab !== 'config' && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-slate-950 flex-shrink-0" />
            <span>
              <strong>La API no responde.</strong> Revisa que el backend esté en ejecución (docker compose up -d).
            </span>
          </div>
        </div>
      )}

      {/* Contenido Principal ERP */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {!PANEL_API_DISPONIBLE && activeTab !== 'config' && avisoMigracion}

        {mostrarGestion('dashboard') && (
          <DashboardView
            key={`dash-${refreshKey}`}
            onNavigate={handleNavigate}
            onOpenNuevoProducto={handleOpenNuevoProducto}
          />
        )}

        {mostrarGestion('inventario') && (
          <InventarioView
            key={`inv-${refreshKey}`}
            defaultEstado={inventarioDefaultEstado}
            onOpenNuevoProducto={handleOpenNuevoProducto}
            onEditProducto={handleEditProducto}
          />
        )}

        {mostrarGestion('compras') && (
          <ComprasView
            key={`comp-${refreshKey}`}
            onCompraExitosa={triggerRefresh}
          />
        )}

        {mostrarGestion('ventas') && (
          <VentasView
            key={`vent-${refreshKey}`}
            onVentaExitosa={triggerRefresh}
          />
        )}

        {mostrarGestion('auditoria') && (
          <AuditoriaView
            key={`aud-${refreshKey}`}
          />
        )}

        {activeTab === 'config' && <ConfigView onConfigUpdated={setIsConnected} />}
      </main>

      {/* Modal para Crear / Editar Producto */}
      <ModalProducto
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProducto}
        productoToEdit={productoToEdit}
        categorias={categorias}
      />

      {/* Pie de Página */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Subligol © 2026 • Panel ERP de Gestión y Bodega</span>
          <span>Desarrollado para Leonardo Solis • UTEM</span>
        </div>
      </footer>

    </div>
  )
}
