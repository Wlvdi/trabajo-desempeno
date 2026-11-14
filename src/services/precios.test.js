import { describe, it, expect } from 'vitest'
import { ivaIncluido, TASA_IVA } from './precios'

describe('ivaIncluido', () => {
  it('calcula la parte de IVA de un precio que ya lo incluye', () => {
    expect(ivaIncluido(11900)).toBe(1900)
    expect(ivaIncluido(1190)).toBe(190)
  })

  it('redondea al peso', () => {
    expect(ivaIncluido(4990)).toBe(797) // 4990 × 0,19 / 1,19 = 796,72
  })

  it('el neto más el IVA reconstruye el monto original', () => {
    for (const monto of [990, 4490, 15370, 30000]) {
      const neto = Math.round(monto / (1 + TASA_IVA))
      expect(Math.abs(neto + ivaIncluido(monto) - monto)).toBeLessThanOrEqual(1)
    }
  })

  it('devuelve 0 para montos vacíos o inválidos', () => {
    expect(ivaIncluido(0)).toBe(0)
    expect(ivaIncluido(undefined)).toBe(0)
    expect(ivaIncluido('abc')).toBe(0)
  })
})
