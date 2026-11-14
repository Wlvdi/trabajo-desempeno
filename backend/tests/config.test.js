/**
 * Tests unitarios de leerConfig (no usan base de datos).
 */
import { describe, it, expect } from 'vitest'
import { leerConfig } from '../src/config.js'

const SECRETO = 'a'.repeat(32)

describe('leerConfig: JWT', () => {
  it('en producción sin JWT_SECRETO lanza error (la API no arranca)', () => {
    expect(() => leerConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRETO es obligatorio/)
  })

  it('en producción rechaza un secreto de menos de 32 caracteres', () => {
    expect(() => leerConfig({ NODE_ENV: 'production', JWT_SECRETO: 'a'.repeat(31) })).toThrow(/32 caracteres/)
  })

  it('en producción acepta un secreto de 32 caracteres', () => {
    const { jwt } = leerConfig({ NODE_ENV: 'production', JWT_SECRETO: SECRETO })
    expect(jwt).toEqual({ secreto: SECRETO, expiracion: '2h', secretoGenerado: false })
  })

  it('en desarrollo sin JWT_SECRETO genera uno aleatorio', () => {
    const a = leerConfig({}).jwt
    const b = leerConfig({}).jwt
    expect(a.secretoGenerado).toBe(true)
    expect(a.secreto).toMatch(/^[0-9a-f]{64}$/)
    expect(a.secreto).not.toBe(b.secreto)
  })

  it('usa JWT_EXPIRACION si viene definida', () => {
    expect(leerConfig({ JWT_SECRETO: SECRETO, JWT_EXPIRACION: '15m' }).jwt.expiracion).toBe('15m')
  })
})

describe('leerConfig: argon2', () => {
  it('sin variables deja los valores por defecto de la librería (undefined)', () => {
    expect(leerConfig({}).argon2).toEqual({ memoryCost: undefined, timeCost: undefined, parallelism: undefined })
  })

  it('lee los parámetros desde el entorno', () => {
    const { argon2 } = leerConfig({ ARGON2_MEMORIA_KIB: '19456', ARGON2_ITERACIONES: '2', ARGON2_PARALELISMO: '1' })
    expect(argon2).toEqual({ memoryCost: 19456, timeCost: 2, parallelism: 1 })
  })

  it('ignora valores vacíos o inválidos', () => {
    const { argon2 } = leerConfig({ ARGON2_MEMORIA_KIB: '', ARGON2_ITERACIONES: 'tres', ARGON2_PARALELISMO: '0' })
    expect(argon2).toEqual({ memoryCost: undefined, timeCost: undefined, parallelism: undefined })
  })
})

describe('leerConfig: PAGO_MOCK', () => {
  const SEC = { JWT_SECRETO: 'a'.repeat(32) }

  it('por defecto está habilitado fuera de producción y deshabilitado en producción', () => {
    expect(leerConfig({}).pagoMock).toBe(true)
    expect(leerConfig({ NODE_ENV: 'test' }).pagoMock).toBe(true)
    expect(leerConfig({ ...SEC, NODE_ENV: 'production' }).pagoMock).toBe(false)
  })

  it('respeta el valor explícito', () => {
    expect(leerConfig({ ...SEC, NODE_ENV: 'production', PAGO_MOCK: 'true' }).pagoMock).toBe(true)
    expect(leerConfig({ PAGO_MOCK: 'FALSE' }).pagoMock).toBe(false)
    expect(leerConfig({ ...SEC, NODE_ENV: 'production', PAGO_MOCK: '' }).pagoMock).toBe(false)
  })

  it('un valor distinto de true/false impide arrancar', () => {
    expect(() => leerConfig({ PAGO_MOCK: 'si' })).toThrow(/PAGO_MOCK debe ser true o false/)
  })
})
