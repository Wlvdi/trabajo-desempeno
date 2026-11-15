// src/services/compraWebpay.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { marcarCompraWebpayPendiente, tomarCompraWebpayPendiente } from './compraWebpay'

/** sessionStorage mínimo para el entorno Node. */
beforeEach(() => {
  const datos = new Map()
  globalThis.sessionStorage = {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k)
  }
})

describe('compra Webpay pendiente', () => {
  it('se toma una sola vez (recargar la página no repite purchase)', () => {
    marcarCompraWebpayPendiente('o-1', 'invitado')
    expect(tomarCompraWebpayPendiente('o-1')).toBe('invitado')
    expect(tomarCompraWebpayPendiente('o-1')).toBeNull()
  })

  it('una orden no marcada devuelve null', () => {
    expect(tomarCompraWebpayPendiente('o-2')).toBeNull()
  })
})
