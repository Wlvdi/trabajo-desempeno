/**
 * Tests de integración de /api/auth (registro, login y yo) sobre subligol_test.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import { config } from '../src/config.js'
import { prepararCatalogo } from './ayudantes.js'

const CLAVE_CLIENTES = 'clave-cliente-test'
const CLAVE_ADMIN = 'clave-admin-test'
const CREDENCIALES_INCORRECTAS = 'Correo o contraseña incorrectos'

let pool
let app

beforeAll(async () => {
  ;({ pool, app } = await prepararCatalogo())
}, 120_000)

afterAll(async () => {
  await pool.end()
})

const registrar = (cuerpo) => request(app).post('/api/auth/registro').send(cuerpo)
const login = (email, contrasena) => request(app).post('/api/auth/login').send({ email, contrasena })
const yo = (cabecera) => {
  const req = request(app).get('/api/auth/yo')
  return cabecera === undefined ? req : req.set('Authorization', cabecera)
}

/** Codifica un objeto como segmento base64url de un JWT. */
const segmento = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

describe('POST /api/auth/registro', () => {
  it('crea un cliente y devuelve usuario y token, sin el hash', async () => {
    const res = await registrar({ nombre: '  Ana Pérez ', email: '  Ana.Perez@Ejemplo.CL ', contrasena: 'una clave larga' })
    expect(res.status).toBe(201)
    expect(Object.keys(res.body.usuario).sort()).toEqual(['email', 'id', 'nombre', 'rol'])
    expect(res.body.usuario).toMatchObject({ email: 'ana.perez@ejemplo.cl', nombre: 'Ana Pérez', rol: 'cliente' })
    expect(JSON.stringify(res.body)).not.toMatch(/hash|argon2/)

    const payload = jwt.verify(res.body.token, config.jwt.secreto, { algorithms: ['HS256'] })
    expect(payload).toMatchObject({ sub: res.body.usuario.id, rol: 'cliente' })
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'rol', 'sub'])

    const { rows } = await pool.query('select email, hash_contrasena from usuarios where id = $1', [res.body.usuario.id])
    expect(rows[0].email).toBe('ana.perez@ejemplo.cl')
    expect(rows[0].hash_contrasena).toMatch(/^\$argon2id\$/)
    expect(await argon2.verify(rows[0].hash_contrasena, 'una clave larga')).toBe(true)
  })

  it('ignora el rol enviado en el cuerpo y crea siempre un cliente', async () => {
    const res = await registrar({ nombre: 'Intruso', email: 'intruso@ejemplo.cl', contrasena: '12345678', rol: 'admin' })
    expect(res.status).toBe(201)
    expect(res.body.usuario.rol).toBe('cliente')
    const { rows } = await pool.query('select rol from usuarios where id = $1', [res.body.usuario.id])
    expect(rows[0].rol).toBe('cliente')
  })

  it('responde 409 si el correo ya existe, sin importar mayúsculas', async () => {
    const res = await registrar({ nombre: 'Duplicado', email: 'TEST001@Ejemplo.cl', contrasena: '12345678' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('El correo ya está registrado')
  })

  it('el token del registro sirve para /api/auth/yo y para iniciar sesión', async () => {
    const reg = await registrar({ nombre: 'Luis Soto', email: 'luis.soto@ejemplo.cl', contrasena: 'clave-de-luis' })
    const res = await yo(`Bearer ${reg.body.token}`)
    expect(res.body).toEqual(reg.body.usuario)
    expect((await login('luis.soto@ejemplo.cl', 'clave-de-luis')).status).toBe(200)
  })

  it.each([
    [{ email: 'a@b.cl', contrasena: '12345678' }, /"nombre" es obligatorio/],
    [{ nombre: 'A', email: 'a@b.cl', contrasena: '12345678' }, /"nombre" debe tener entre 2 y 80/],
    [{ nombre: '   ', email: 'a@b.cl', contrasena: '12345678' }, /"nombre" debe tener entre 2 y 80/],
    [{ nombre: 'x'.repeat(81), email: 'a@b.cl', contrasena: '12345678' }, /"nombre"/],
    [{ nombre: 'Ana', contrasena: '12345678' }, /"email" es obligatorio/],
    [{ nombre: 'Ana', email: 'sin-arroba.cl', contrasena: '12345678' }, /formato de correo/],
    [{ nombre: 'Ana', email: 'a b@c.cl', contrasena: '12345678' }, /formato de correo/],
    [{ nombre: 'Ana', email: 'ana@dominio', contrasena: '12345678' }, /formato de correo/],
    [{ nombre: 'Ana', email: `${'a'.repeat(250)}@b.cl`, contrasena: '12345678' }, /máximo 254/],
    [{ nombre: 'Ana', email: 'a@b.cl', contrasena: '1234567' }, /"contrasena" debe tener entre 8 y 128/],
    [{ nombre: 'Ana', email: 'a@b.cl', contrasena: 'x'.repeat(129) }, /"contrasena"/],
    [{ nombre: 'Ana', email: 'a@b.cl', contrasena: 12345678 }, /"contrasena" es obligatorio y debe ser texto/]
  ])('responde 400 con %o', async (cuerpo, mensaje) => {
    const res = await registrar(cuerpo)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })

  it('responde 400 si el cuerpo no es un objeto JSON', async () => {
    const res = await request(app).post('/api/auth/registro').set('Content-Type', 'application/json').send('[1,2]')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('El cuerpo debe ser un objeto JSON')
  })
})

describe('POST /api/auth/login', () => {
  it('inicia sesión con un cliente del seed', async () => {
    const res = await login('test001@ejemplo.cl', CLAVE_CLIENTES)
    expect(res.status).toBe(200)
    expect(res.body.usuario).toMatchObject({ email: 'test001@ejemplo.cl', rol: 'cliente' })
    expect(Object.keys(res.body.usuario).sort()).toEqual(['email', 'id', 'nombre', 'rol'])
    expect(jwt.verify(res.body.token, config.jwt.secreto).rol).toBe('cliente')
  })

  it('inicia sesión con el administrador (rol admin)', async () => {
    const res = await login('admin@subligol.cl', CLAVE_ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.usuario.rol).toBe('admin')
    expect(jwt.verify(res.body.token, config.jwt.secreto).rol).toBe('admin')
  })

  it('acepta el correo con mayúsculas y espacios', async () => {
    const res = await login('  TEST002@Ejemplo.CL ', CLAVE_CLIENTES)
    expect(res.status).toBe(200)
    expect(res.body.usuario.email).toBe('test002@ejemplo.cl')
  })

  it('responde 401 con el mismo mensaje si la contraseña es incorrecta o el correo no existe', async () => {
    const malaClave = await login('test001@ejemplo.cl', 'otra-clave')
    const sinCorreo = await login('nadie@ejemplo.cl', CLAVE_CLIENTES)
    expect(malaClave.status).toBe(401)
    expect(sinCorreo.status).toBe(401)
    expect(malaClave.body).toEqual({ error: CREDENCIALES_INCORRECTAS })
    expect(sinCorreo.body).toEqual(malaClave.body)
  })

  it('verifica contra un hash ficticio si el correo no existe (tiempo comparable)', async () => {
    const medir = async (email) => {
      const inicio = performance.now()
      await login(email, 'clave-equivocada')
      return performance.now() - inicio
    }
    await medir('nadie@ejemplo.cl') // calienta el hash ficticio
    let existe = 0
    let noExiste = 0
    for (let i = 0; i < 3; i++) {
      existe += await medir('test003@ejemplo.cl')
      noExiste += await medir(`nadie${i}@ejemplo.cl`)
    }
    // Sin el hash ficticio, el correo inexistente respondería varias veces más rápido.
    expect(noExiste / existe).toBeGreaterThan(0.5)
  })

  it.each([
    [{ contrasena: 'x' }, /"email"/],
    [{ email: 'test001@ejemplo.cl' }, /"contrasena"/],
    [{ email: 'no-es-correo', contrasena: 'x' }, /formato de correo/]
  ])('responde 400 con %o', async (cuerpo, mensaje) => {
    const res = await request(app).post('/api/auth/login').send(cuerpo)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(mensaje)
  })
})

describe('GET /api/auth/yo', () => {
  let token
  let usuario

  beforeAll(async () => {
    const res = await login('test001@ejemplo.cl', CLAVE_CLIENTES)
    ;({ token, usuario } = res.body)
  })

  it('devuelve el usuario leído desde la base con un token válido', async () => {
    const res = await yo(`Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(usuario)
  })

  it('responde 401 sin token', async () => {
    const res = await yo(undefined)
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Debes iniciar sesión')
  })

  it.each(['Bearer', 'Bearer abc.def', `Token ${'x'.repeat(10)}`, 'Bearer a.b.c'])(
    'responde 401 con la cabecera malformada "%s"',
    async (cabecera) => {
      expect((await yo(cabecera)).status).toBe(401)
    }
  )

  it('responde 401 con un token firmado con otro secreto', async () => {
    const falso = jwt.sign({ rol: 'cliente' }, 'otro-secreto-de-al-menos-32-caracteres-xx', {
      subject: usuario.id,
      algorithm: 'HS256'
    })
    const res = await yo(`Bearer ${falso}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Token inválido o expirado')
  })

  it('responde 401 con un token alterado (rol cambiado sin volver a firmar)', async () => {
    const [cabecera, , firma] = token.split('.')
    const payload = jwt.decode(token)
    const alterado = [cabecera, segmento({ ...payload, rol: 'admin' }), firma].join('.')
    expect((await yo(`Bearer ${alterado}`)).status).toBe(401)
  })

  it('responde 401 con un token expirado', async () => {
    const expirado = jwt.sign({ rol: 'cliente', exp: Math.floor(Date.now() / 1000) - 60 }, config.jwt.secreto, {
      subject: usuario.id,
      algorithm: 'HS256'
    })
    expect((await yo(`Bearer ${expirado}`)).status).toBe(401)
  })

  it('responde 401 con un token de algoritmo "none"', async () => {
    const ahora = Math.floor(Date.now() / 1000)
    const sinFirma = `${segmento({ alg: 'none', typ: 'JWT' })}.${segmento({ sub: usuario.id, rol: 'admin', iat: ahora, exp: ahora + 3600 })}.`
    expect((await yo(`Bearer ${sinFirma}`)).status).toBe(401)
  })

  it('responde 401 con un token firmado con otro algoritmo (HS512)', async () => {
    const hs512 = jwt.sign({ rol: 'cliente' }, config.jwt.secreto, { subject: usuario.id, algorithm: 'HS512' })
    expect((await yo(`Bearer ${hs512}`)).status).toBe(401)
  })

  it('responde 401 si el usuario del token ya no existe', async () => {
    const reg = await registrar({ nombre: 'Efímero', email: 'efimero@ejemplo.cl', contrasena: '12345678' })
    await pool.query('delete from usuarios where id = $1', [reg.body.usuario.id])
    expect((await yo(`Bearer ${reg.body.token}`)).status).toBe(401)
  })
})
