/**
 * Tests unitarios del módulo de contraseñas (argon2id) y de los tokens JWT.
 */
import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import { config } from '../src/config.js'
import { hashear, verificar, verificarContraHashFicticio } from '../src/seguridad/contrasenas.js'
import { firmarToken, verificarToken } from '../src/seguridad/tokens.js'

describe('contraseñas', () => {
  it('hashea con argon2id usando los parámetros de config (o los de la librería)', async () => {
    const hash = await hashear('clave segura')
    const { memoryCost = 65536, timeCost = 3, parallelism = 4 } = Object.fromEntries(
      Object.entries(config.argon2).filter(([, v]) => v !== undefined)
    )
    expect(hash).toMatch(new RegExp(`^\\$argon2id\\$v=19\\$m=${memoryCost},t=${timeCost},p=${parallelism}\\$`))
  })

  it('cada hash usa una sal distinta', async () => {
    expect(await hashear('misma')).not.toBe(await hashear('misma'))
  })

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashear('clave segura')
    expect(await verificar(hash, 'clave segura')).toBe(true)
    expect(await verificar(hash, 'Clave segura')).toBe(false)
  })

  it('un hash mal formado cuenta como contraseña incorrecta', async () => {
    expect(await verificar('no-es-un-hash', 'x')).toBe(false)
  })

  it('el hash ficticio siempre devuelve false', async () => {
    expect(await verificarContraHashFicticio('cualquier cosa')).toBe(false)
  })
})

describe('tokens', () => {
  it('firma con HS256 y payload mínimo (sub y rol)', () => {
    const token = firmarToken({ id: 'abc', rol: 'admin' })
    const { header, payload } = jwt.decode(token, { complete: true })
    expect(header.alg).toBe('HS256')
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'rol', 'sub'])
    expect(verificarToken(token)).toEqual({ id: 'abc', rol: 'admin' })
  })

  it('respeta la expiración configurada', () => {
    const token = firmarToken({ id: 'abc', rol: 'cliente' }, { secreto: config.jwt.secreto, expiracion: '30m' })
    const { iat, exp } = jwt.decode(token)
    expect(exp - iat).toBe(30 * 60)
  })

  it('rechaza un token sin sub o sin rol', () => {
    const sinRol = jwt.sign({}, config.jwt.secreto, { subject: 'abc', algorithm: 'HS256' })
    expect(() => verificarToken(sinRol)).toThrow()
  })
})
