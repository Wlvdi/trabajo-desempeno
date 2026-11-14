/**
 * Tests unitarios de las reglas de cobro (no usan base de datos).
 */
import { describe, it, expect } from 'vitest'
import {
  COSTO_ENVIO,
  UMBRAL_ENVIO_GRATIS,
  autorizarPagoMock,
  costoEnvio,
  exigirMedioDisponible
} from '../src/pagos.js'

describe('costoEnvio', () => {
  it('cobra 3990 bajo 30000 y 0 desde 30000 (misma regla que el seed)', () => {
    expect(UMBRAL_ENVIO_GRATIS).toBe(30000)
    expect(COSTO_ENVIO).toBe(3990)
    expect(costoEnvio(29999.99)).toBe(3990)
    expect(costoEnvio(30000)).toBe(0)
    expect(costoEnvio(150000)).toBe(0)
  })
})

describe('autorizarPagoMock', () => {
  it('aprueba y genera un código MOCK-NNNNNN', () => {
    const pago = autorizarPagoMock(10000)
    expect(pago.aprobado).toBe(true)
    expect(pago.codigo_autorizacion).toMatch(/^MOCK-\d{6}$/)
  })
})

describe('exigirMedioDisponible', () => {
  it('acepta mock si está habilitado', () => {
    expect(() => exigirMedioDisponible('mock', { pagoMock: true })).not.toThrow()
  })

  it('rechaza mock deshabilitado con 400', () => {
    expect(() => exigirMedioDisponible('mock', { pagoMock: false })).toThrow(
      expect.objectContaining({ status: 400, message: expect.stringMatching(/deshabilitado/) })
    )
  })

  it('responde 501 para webpay, esté o no habilitado el mock', () => {
    for (const pagoMock of [true, false]) {
      expect(() => exigirMedioDisponible('webpay', { pagoMock })).toThrow(expect.objectContaining({ status: 501 }))
    }
  })
})
