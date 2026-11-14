// src/App.jsx
import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import { initGA, trackPageView } from './services/analytics'

// Componentes de la Tienda
import StoreNavbar from './components/store/StoreNavbar'
import StoreFooter from './components/store/StoreFooter'
import CartDrawer from './components/store/CartDrawer'
import AuthModal from './components/store/AuthModal'
import AvisoTienda from './components/store/AvisoTienda'

// Vistas de la Tienda
import HomeStoreView from './views/store/HomeStoreView'
import CatalogStoreView from './views/store/CatalogStoreView'
import ProductDetailStoreView from './views/store/ProductDetailStoreView'
import CartStoreView from './views/store/CartStoreView'
import CheckoutStoreView from './views/store/CheckoutStoreView'
import OrderSuccessStoreView from './views/store/OrderSuccessStoreView'
import MyOrdersStoreView from './views/store/MyOrdersStoreView'

// Panel Administrativo / Bodega ERP cargado de forma diferida (Code Splitting)
const AdminApp = React.lazy(() => import('./views/AdminApp'))

// Componente para rastrear rutas en Google Analytics 4 (SPA Page Views)
function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    trackPageView(location.pathname + location.search, document.title)
  }, [location])

  return null
}

// Layout para las vistas de la Tienda Online
function StoreLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-500 selection:text-white">
      <StoreNavbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {children}
      </main>
      <StoreFooter />
      <CartDrawer />
      <AuthModal />
      <AvisoTienda />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    // Inicializar Google Analytics 4 y Core Web Vitals
    initGA()
  }, [])

  return (
    <BrowserRouter>
      <AnalyticsTracker />
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Rutas de la Tienda E-commerce */}
            <Route
              path="/"
              element={
                <StoreLayout>
                  <HomeStoreView />
                </StoreLayout>
              }
            />
            <Route
              path="/catalogo"
              element={
                <StoreLayout>
                  <CatalogStoreView />
                </StoreLayout>
              }
            />
            <Route
              path="/producto/:id"
              element={
                <StoreLayout>
                  <ProductDetailStoreView />
                </StoreLayout>
              }
            />
            <Route
              path="/carrito"
              element={
                <StoreLayout>
                  <CartStoreView />
                </StoreLayout>
              }
            />
            <Route
              path="/checkout"
              element={
                <StoreLayout>
                  <CheckoutStoreView />
                </StoreLayout>
              }
            />
            <Route
              path="/orden/:id"
              element={
                <StoreLayout>
                  <OrderSuccessStoreView />
                </StoreLayout>
              }
            />
            <Route
              path="/mis-pedidos"
              element={
                <StoreLayout>
                  <MyOrdersStoreView />
                </StoreLayout>
              }
            />

            {/* Rutas del Panel ERP de Bodega y Gestión Subligol (Lazy Loaded) */}
            <Route
              path="/admin/*"
              element={
                <React.Suspense fallback={<div className="p-8 text-center text-xs font-semibold text-slate-500">Cargando Panel de Bodega ERP...</div>}>
                  <AdminApp />
                </React.Suspense>
              }
            />
            <Route
              path="/admin"
              element={
                <React.Suspense fallback={<div className="p-8 text-center text-xs font-semibold text-slate-500">Cargando Panel de Bodega ERP...</div>}>
                  <AdminApp />
                </React.Suspense>
              }
            />

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
