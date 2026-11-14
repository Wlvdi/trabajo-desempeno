/**
 * Tests unitarios del generador de datos semilla (no usan la base de datos).
 */
import { describe, it, expect } from 'vitest'
import {
  generarDatos, crearAzar, FECHA_BASE,
  TOTAL_PRODUCTOS, TOTAL_CLIENTES, TOTAL_VENTAS, TOTAL_COMPRAS, TOTAL_DESTACADOS
} from '../seeds/generador.js'

const datos = generarDatos()

describe('crearAzar', () => {
  it('es determinista para la misma semilla', () => {
    const a = crearAzar(7)
    const b = crearAzar(7)
    expect(Array.from({ length: 5 }, a.siguiente)).toEqual(Array.from({ length: 5 }, b.siguiente))
  })

  it('genera UUID v4 con formato válido', () => {
    const uuid = crearAzar(1).uuid()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('generarDatos', () => {
  it('produce exactamente los mismos datos con la misma semilla', () => {
    expect(JSON.stringify(generarDatos())).toBe(JSON.stringify(datos))
  })

  it('produce datos distintos con otra semilla', () => {
    expect(generarDatos(99).productos[0].id).not.toBe(datos.productos[0].id)
  })

  it('genera las cantidades esperadas', () => {
    expect(datos.categorias).toHaveLength(5)
    expect(datos.productos).toHaveLength(TOTAL_PRODUCTOS)
    expect(datos.clientes).toHaveLength(TOTAL_CLIENTES)
    expect(datos.ventas).toHaveLength(TOTAL_VENTAS)
    expect(datos.compras).toHaveLength(TOTAL_COMPRAS)
    expect(datos.productos.filter((p) => p.destacado)).toHaveLength(TOTAL_DESTACADOS)
  })

  it('usa SKU, nombres, ids y correos únicos', () => {
    const unicos = (lista) => new Set(lista).size === lista.length
    expect(unicos(datos.productos.map((p) => p.sku))).toBe(true)
    expect(unicos(datos.productos.map((p) => p.nombre))).toBe(true)
    expect(unicos([...datos.productos, ...datos.clientes, ...datos.ventas].map((x) => x.id))).toBe(true)
    expect(unicos(datos.clientes.map((c) => c.email))).toBe(true)
  })

  it('reparte los productos entre todas las categorías', () => {
    for (const c of datos.categorias) {
      expect(datos.productos.filter((p) => p.categoria_id === c.id).length).toBe(TOTAL_PRODUCTOS / 5)
    }
  })

  it('tiene precios mayores al costo y entre 1 y 4 imágenes', () => {
    for (const p of datos.productos) {
      expect(p.precio_venta).toBeGreaterThan(p.costo_unitario)
      expect(p.imagenes.length).toBeGreaterThanOrEqual(1)
      expect(p.imagenes.length).toBeLessThanOrEqual(4)
      expect(p.imagen_url).toBe(p.imagenes[0])
    }
  })

  it('deja entre 3 % y 12 % de productos en stock crítico o agotado, sin destacados agotados', () => {
    const bajos = datos.productos.filter((p) => p.stock_actual <= p.stock_minimo).length
    expect(bajos / TOTAL_PRODUCTOS).toBeGreaterThanOrEqual(0.03)
    expect(bajos / TOTAL_PRODUCTOS).toBeLessThanOrEqual(0.12)
    expect(datos.productos.some((p) => p.destacado && p.stock_actual === 0)).toBe(false)
  })

  it('genera ventas consistentes dentro de los últimos 12 meses', () => {
    const ids = new Set(datos.productos.map((p) => p.id))
    const haceUnAno = FECHA_BASE.getTime() - 366 * 24 * 60 * 60 * 1000
    for (const v of datos.ventas) {
      expect(v.fecha.getTime()).toBeLessThanOrEqual(FECHA_BASE.getTime())
      expect(v.fecha.getTime()).toBeGreaterThan(haceUnAno)
      expect(v.detalle.every((l) => ids.has(l.producto_id))).toBe(true)
      const neto = v.detalle.reduce((s, l) => s + l.subtotal, 0)
      expect(v.total).toBe(neto + v.costo_envio)
      if (v.canal_venta === 'Web') {
        expect(v.codigo).toMatch(/^SUB-\d{4}-\d{6}$/)
        expect(v.cliente_id).toBeTruthy()
      }
    }
  })
})
