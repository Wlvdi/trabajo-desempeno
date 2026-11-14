// src/views/AdminApp.jsx
import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import ModalProducto from '../components/ModalProducto'
import DashboardView from './DashboardView'
import InventarioView from './InventarioView'
import ComprasView from './ComprasView'
import VentasView from './VentasView'
import AuditoriaView from './AuditoriaView'
import ConfigView from './ConfigView'
import { isSupabaseConfigured } from '../services/supabase'
import { testConnection, fetchCategorias, createProducto, updateProducto } from '../services/api'
import { AlertCircle, ArrowRight } from 'lucide-react'

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isConnected, setIsConnected] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)
  const [categorias, setCategorias] = useState([])
  const [inventarioDefaultEstado, setInventarioDefaultEstado] = useState('todos')

  // Modal Producto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [productoToEdit, setProductoToEdit] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const verifyConnection = async () => {
    setIsCheckingConnection(true)
    if (!isSupabaseConfigured()) {
      setIsConnected(false)
      setIsCheckingConnection(false)
      return
    }

    try {
      await testConnection()
      setIsConnected(true)
      const cats = await fetchCategorias()
      setCategorias(cats)
    } catch (err) {
      console.warn('No se pudo validar conexión a Supabase:', err)
      setIsConnected(false)
    } finally {
      setIsCheckingConnection(false)
    }
  }

  useEffect(() => {
    verifyConnection()
  }, [])

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Barra de Navegación del Panel de Control */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
      />

      {/* Banner de Estado de Supabase si no está conectado */}
      {!isConnected && !isCheckingConnection && activeTab !== 'config' && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-950 flex-shrink-0" />
              <span>
                <strong>Modo Autónomo Local Activo:</strong> Puedes usar Subligol con almacenamiento local o conectar Supabase en la pestaña de Configuración.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('config')}
              className="inline-flex items-center gap-1 bg-slate-950 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-800 transition"
            >
              Configurar Supabase <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Contenido Principal ERP */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            key={`dash-${refreshKey}`}
            onNavigate={handleNavigate}
            onOpenNuevoProducto={handleOpenNuevoProducto}
          />
        )}

        {activeTab === 'inventario' && (
          <InventarioView
            key={`inv-${refreshKey}`}
            defaultEstado={inventarioDefaultEstado}
            onOpenNuevoProducto={handleOpenNuevoProducto}
            onEditProducto={handleEditProducto}
          />
        )}

        {activeTab === 'compras' && (
          <ComprasView
            key={`comp-${refreshKey}`}
            onCompraExitosa={triggerRefresh}
          />
        )}

        {activeTab === 'ventas' && (
          <VentasView
            key={`vent-${refreshKey}`}
            onVentaExitosa={triggerRefresh}
          />
        )}

        {activeTab === 'auditoria' && (
          <AuditoriaView
            key={`aud-${refreshKey}`}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView
            onConfigUpdated={(conectado) => {
              setIsConnected(conectado)
              if (conectado) {
                verifyConnection()
              }
            }}
          />
        )}
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
