import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'

export default function ModalProducto({ isOpen, onClose, onSave, productoToEdit, categorias }) {
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    descripcion: '',
    categoria_id: '',
    temporada: 'General',
    costo_unitario: '',
    precio_venta: '',
    stock_actual: '',
    stock_minimo: '5',
    activo: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const temporadasComunes = [
    'General',
    'Escolar',
    'Día de la Madre',
    'Día del Padre',
    'Día del Niño',
    'Fiestas Patrias',
    'Halloween',
    'Navidad',
    'Verano'
  ]

  useEffect(() => {
    if (productoToEdit) {
      setFormData({
        sku: productoToEdit.sku || '',
        nombre: productoToEdit.nombre || '',
        descripcion: productoToEdit.descripcion || '',
        categoria_id: productoToEdit.categoria_id || (categorias[0]?.id || ''),
        temporada: productoToEdit.temporada || 'General',
        costo_unitario: productoToEdit.costo_unitario?.toString() || '0',
        precio_venta: productoToEdit.precio_venta?.toString() || '0',
        stock_actual: productoToEdit.stock_actual?.toString() || '0',
        stock_minimo: productoToEdit.stock_minimo?.toString() || '5',
        activo: productoToEdit.activo ?? true
      })
    } else {
      setFormData({
        sku: '',
        nombre: '',
        descripcion: '',
        categoria_id: categorias[0]?.id || '',
        temporada: 'General',
        costo_unitario: '',
        precio_venta: '',
        stock_actual: '0',
        stock_minimo: '5',
        activo: true
      })
    }
    setError(null)
  }, [productoToEdit, categorias, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!formData.nombre.trim()) {
      setError('El nombre del producto es obligatorio.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        sku: formData.sku.trim() || null,
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        categoria_id: formData.categoria_id || null,
        temporada: formData.temporada,
        costo_unitario: Number(formData.costo_unitario) || 0,
        precio_venta: Number(formData.precio_venta) || 0,
        stock_minimo: Number(formData.stock_minimo) || 5,
        activo: formData.activo
      }

      // Solo si es nuevo incluimos stock_actual inicial (en edición se ajusta por compras/ventas)
      if (!productoToEdit) {
        payload.stock_actual = Number(formData.stock_actual) || 0
      }

      await onSave(payload, productoToEdit?.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar el producto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 my-8">
        
        {/* Cabecera */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {productoToEdit ? 'Editar Producto' : 'Nuevo Producto al Catálogo'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* SKU / Código */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Código / SKU
              </label>
              <input
                type="text"
                placeholder="Ej: TAZA-BLA-11"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
              />
            </div>

            {/* Temporada */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Temporada / Ciclo
              </label>
              <select
                value={formData.temporada}
                onChange={(e) => setFormData({ ...formData, temporada: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                {temporadasComunes.map((temp) => (
                  <option key={temp} value={temp}>{temp}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Nombre del Producto */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nombre del Producto *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Taza Cerámica Blanca 11oz AAA"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Categoría
            </label>
            <select
              value={formData.categoria_id}
              onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="">-- Sin categoría asignada --</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          {/* Precios y Costos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Costo Unitario (CLP)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="Ej: 1200"
                value={formData.costo_unitario}
                onChange={(e) => setFormData({ ...formData, costo_unitario: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Precio de Venta (CLP)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="Ej: 4500"
                value={formData.precio_venta}
                onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Stock y Alerta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {productoToEdit ? 'Stock Actual (Informativo)' : 'Stock Inicial'}
              </label>
              <input
                type="number"
                min="0"
                disabled={Boolean(productoToEdit)}
                value={formData.stock_actual}
                onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-sm ${
                  productoToEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-indigo-500'
                }`}
              />
              {productoToEdit && (
                <p className="text-[11px] text-slate-400 mt-0.5">El stock se actualiza mediante compras o ventas.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Alerta de Stock Crítico (Mínimo)
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock_minimo}
                onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Estado Activo / Archivado */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 block">Producto Activo</span>
              <span className="text-[11px] text-slate-400 block">
                Desactívalo para archivarlo cuando termine su temporada.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Botones */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : (productoToEdit ? 'Guardar Cambios' : 'Crear Producto')}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
