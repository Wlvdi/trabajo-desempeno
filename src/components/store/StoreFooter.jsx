// src/components/store/StoreFooter.jsx
import React from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, ShieldCheck, Truck, CreditCard, Heart, ArrowUpRight } from 'lucide-react'

export default function StoreFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner de Confianza y Medios de Pago Chilenos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Despachos a Todo Chile</h4>
              <p className="text-xs text-slate-400 mt-1">
                Alianzas con Starken, Chilexpress y Blue Express. Envío gratis en Santiago y regiones por compras sobre $30.000.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Webpay Plus Transbank</h4>
              <p className="text-xs text-slate-400 mt-1">
                Paga con Débito Redcompra, Tarjetas de Crédito bancarias en cuotas sin interés y Cuenta RUT de Banco Estado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Calidad Grado AAA</h4>
              <p className="text-xs text-slate-400 mt-1">
                Polímeros certificados de alta absorción que garantizan impresiones indelebles y colores intensos.
              </p>
            </div>
          </div>
        </div>

        {/* Columnas Informativas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-12 border-b border-slate-800">
          
          {/* Logo y Misión */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Subligol<span className="text-indigo-400">.cl</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Especialistas en insumos, blancos y productos terminados para sublimación y estampados personalizados en Chile.
            </p>
            <div className="pt-2">
              <span className="inline-block px-3 py-1 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 rounded-full text-[11px] font-semibold">
                Proyecto UTEM • Desempeño de Sistemas
              </span>
            </div>
          </div>

          {/* Enlaces Rápidos */}
          <div>
            <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Navegación
            </h5>
            <ul className="space-y-2.5 text-xs text-slate-400 font-medium">
              <li>
                <Link to="/" className="hover:text-white transition">Inicio / Destacados</Link>
              </li>
              <li>
                <Link to="/catalogo" className="hover:text-white transition">Catálogo Completo</Link>
              </li>
              <li>
                <Link to="/catalogo?temporada=Escolar" className="hover:text-white transition">Campaña Escolar 2026</Link>
              </li>
              <li>
                <Link to="/catalogo?categoriaId=cat-tazas" className="hover:text-white transition">Tazas y Tazones</Link>
              </li>
              <li>
                <Link to="/catalogo?categoriaId=cat-textiles" className="hover:text-white transition">Poleras y Textiles</Link>
              </li>
            </ul>
          </div>

          {/* Medios de Pago y Chile */}
          <div>
            <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Pasarela de Pago
            </h5>
            <p className="text-xs text-slate-400 mb-3">
              Ambiente de pruebas oficial Webpay Plus Transbank habilitado con tarjetas simuladas de débito y crédito.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono">Webpay Plus</span>
              <span className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono">Redcompra</span>
              <span className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono">Cuenta RUT</span>
              <span className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono">Visa / Mastercard</span>
            </div>
          </div>

          {/* Acceso Académico / Bodega */}
          <div>
            <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Gestión Interna
            </h5>
            <p className="text-xs text-slate-400 mb-3">
              Monitorea el inventario, balance financiero y el impacto en tiempo real de cada pedido generado.
            </p>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <span>Acceder al Panel ERP</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
          <p>
            © 2026 Subligol SpA. Desarrollado para evaluación de Desempeño de Sistemas - UTEM.
          </p>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Hecho con</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>en Santiago de Chile</span>
          </div>
        </div>

      </div>
    </footer>
  )
}
