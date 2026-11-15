/**
 * Tests unitarios de la validación de parámetros (no usan base de datos).
 */
import { describe, it, expect } from 'vitest'
import {
  ErrorValidacion,
  booleano,
  campoBooleano,
  campoLista,
  campoNumero,
  campoTextoOpcional,
  entero,
  esUuid,
  numeroNoNegativo,
  paginacion,
  textoObligatorio,
  textoOpcional,
  unoDe,
  uuidOpcional
} from '../src/validacion.js'
import { escaparLike } from '../src/consultas/productos.js'

const UUID = '3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b'

describe('paginacion', () => {
  it('usa pagina 1 y limite 12 por defecto', () => {
    expect(paginacion({})).toEqual({ pagina: 1, limite: 12 })
  })

  it('acepta el límite máximo 48', () => {
    expect(paginacion({ pagina: '3', limite: '48' })).toEqual({ pagina: 3, limite: 48 })
  })

  it.each([
    [{ limite: '49' }, /limite.*entre 1 y 48/],
    [{ limite: '0' }, /limite/],
    [{ pagina: '0' }, /pagina.*mayor o igual a 1/],
    [{ pagina: '-1' }, /pagina/],
    [{ pagina: '1.5' }, /pagina/],
    [{ pagina: 'abc' }, /pagina/],
    [{ pagina: ['1', '2'] }, /una sola vez/]
  ])('rechaza %o', (query, mensaje) => {
    expect(() => paginacion(query)).toThrow(ErrorValidacion)
    expect(() => paginacion(query)).toThrow(mensaje)
  })
})

describe('validadores', () => {
  it('ErrorValidacion lleva status 400', () => {
    expect(new ErrorValidacion('x').status).toBe(400)
  })

  it('entero devuelve el valor por defecto si viene vacío', () => {
    expect(entero('n', '', { min: 1, porDefecto: 7 })).toBe(7)
  })

  it('numeroNoNegativo acepta enteros y decimales, rechaza negativos y texto', () => {
    expect(numeroNoNegativo('p', '1500')).toBe(1500)
    expect(numeroNoNegativo('p', '99.5')).toBe(99.5)
    expect(numeroNoNegativo('p', undefined)).toBeUndefined()
    expect(() => numeroNoNegativo('p', '-1')).toThrow(/mayor o igual a 0/)
    expect(() => numeroNoNegativo('p', 'mil')).toThrow(ErrorValidacion)
  })

  it('booleano solo acepta true y false', () => {
    expect(booleano('b', 'true')).toBe(true)
    expect(booleano('b', 'false')).toBe(false)
    expect(booleano('b', undefined)).toBeUndefined()
    expect(() => booleano('b', '1')).toThrow(/true o false/)
  })

  it('esUuid y uuidOpcional', () => {
    expect(esUuid(UUID)).toBe(true)
    expect(esUuid('abc')).toBe(false)
    expect(uuidOpcional('c', UUID.toUpperCase())).toBe(UUID)
    expect(() => uuidOpcional('c', '123')).toThrow(/UUID/)
  })

  it('textoOpcional recorta y limita el largo', () => {
    expect(textoOpcional('t', '  Navidad ', 50)).toBe('Navidad')
    expect(textoOpcional('t', '   ', 50)).toBeUndefined()
    expect(() => textoOpcional('t', 'x'.repeat(51), 50)).toThrow(/50 caracteres/)
  })

  it('textoObligatorio exige el largo indicado', () => {
    expect(textoObligatorio('q', ' taza ', { min: 2, max: 100 })).toBe('taza')
    expect(() => textoObligatorio('q', undefined, { min: 2, max: 100 })).toThrow(/obligatorio/)
    expect(() => textoObligatorio('q', ' a ', { min: 2, max: 100 })).toThrow(/entre 2 y 100/)
  })

  it('unoDe aplica la lista blanca', () => {
    expect(unoDe('orden', undefined, ['a', 'b'], 'a')).toBe('a')
    expect(unoDe('orden', 'b', ['a', 'b'], 'a')).toBe('b')
    expect(() => unoDe('orden', 'c; drop table productos', ['a', 'b'], 'a')).toThrow(/uno de: a, b/)
  })
})

describe('escaparLike', () => {
  it('escapa %, _ y \\ para buscarlos de forma literal', () => {
    expect(escaparLike('50%_a\\b')).toBe('50\\%\\_a\\\\b')
  })
})

describe('validadores del cuerpo (panel de administración)', () => {
  it('campoTextoOpcional: vacío o ausente es null; recorta y respeta el largo', () => {
    expect(campoTextoOpcional('notas', undefined, 10)).toBeNull()
    expect(campoTextoOpcional('notas', null, 10)).toBeNull()
    expect(campoTextoOpcional('notas', '   ', 10)).toBeNull()
    expect(campoTextoOpcional('notas', ' hola ', 10)).toBe('hola')
    expect(() => campoTextoOpcional('notas', 'x'.repeat(11), 10)).toThrow(/máximo 10/)
    expect(() => campoTextoOpcional('notas', 5, 10)).toThrow(ErrorValidacion)
  })

  it('campoNumero: número JSON entre 0 y max con a lo más 2 decimales', () => {
    expect(campoNumero('precio', 1990, { max: 1e6 })).toBe(1990)
    expect(campoNumero('precio', 10.5, { max: 1e6 })).toBe(10.5)
    expect(campoNumero('precio', 0.29, { max: 1e6 })).toBe(0.29)
    expect(campoNumero('precio', undefined, { max: 1e6, porDefecto: 0 })).toBe(0)
    expect(() => campoNumero('precio', '1990', { max: 1e6 })).toThrow(/número entre 0/)
    expect(() => campoNumero('precio', -1, { max: 1e6 })).toThrow(ErrorValidacion)
    expect(() => campoNumero('precio', 2e6, { max: 1e6 })).toThrow(ErrorValidacion)
    expect(() => campoNumero('precio', Number.NaN, { max: 1e6 })).toThrow(ErrorValidacion)
    expect(() => campoNumero('precio', 1.234, { max: 1e6 })).toThrow(/2 decimales/)
  })

  it('campoBooleano: solo true o false', () => {
    expect(campoBooleano('activo', false)).toBe(false)
    expect(campoBooleano('activo', undefined, { porDefecto: true })).toBe(true)
    expect(() => campoBooleano('activo', 'true')).toThrow(/true o false/)
  })

  it('campoLista: arreglo dentro del largo permitido', () => {
    expect(campoLista('items', [1], { min: 1, max: 2 })).toEqual([1])
    expect(() => campoLista('items', [], { min: 1, max: 2 })).toThrow(/entre 1 y 2/)
    expect(() => campoLista('items', [1, 2, 3], { min: 1, max: 2 })).toThrow(ErrorValidacion)
    expect(() => campoLista('items', 'x', { min: 1, max: 2 })).toThrow(ErrorValidacion)
  })
})
