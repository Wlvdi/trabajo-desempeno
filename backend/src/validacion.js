/**
 * Validación y conversión de parámetros de consulta (query string) y de
 * campos del cuerpo JSON.
 * Cada función recibe el valor crudo (req.query o req.body) y devuelve el valor ya
 * convertido, o lanza un ErrorValidacion (status 400) con un mensaje claro.
 */

/** Error de validación: el manejador de errores lo responde como 400. */
export class ErrorValidacion extends Error {
  /** @param {string} mensaje */
  constructor(mensaje) {
    super(mensaje)
    this.name = 'ErrorValidacion'
    this.status = 400
  }
}

export const LIMITE_POR_DEFECTO = 12
export const LIMITE_MAXIMO = 48

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Indica si un texto es un UUID válido.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esUuid(valor) {
  return typeof valor === 'string' && REGEX_UUID.test(valor)
}

/**
 * Rechaza parámetros repetidos (?a=1&a=2 llega como arreglo).
 * @param {string} nombre
 * @param {unknown} valor
 * @returns {string | undefined}
 */
function textoUnico(nombre, valor) {
  if (valor === undefined) return undefined
  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`El parámetro "${nombre}" debe indicarse una sola vez`)
  }
  return valor
}

/**
 * Entero dentro de un rango; si no viene, devuelve el valor por defecto.
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ min: number, max?: number, porDefecto: number }} opciones
 * @returns {number}
 */
export function entero(nombre, valor, { min, max = Number.MAX_SAFE_INTEGER, porDefecto }) {
  const texto = textoUnico(nombre, valor)
  if (texto === undefined || texto === '') return porDefecto
  const n = /^-?\d+$/.test(texto) ? Number(texto) : Number.NaN
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    const rango = max === Number.MAX_SAFE_INTEGER ? `mayor o igual a ${min}` : `entre ${min} y ${max}`
    throw new ErrorValidacion(`El parámetro "${nombre}" debe ser un entero ${rango}`)
  }
  return n
}

/**
 * Número decimal mayor o igual a cero (opcional).
 * @param {string} nombre
 * @param {unknown} valor
 * @returns {number | undefined}
 */
export function numeroNoNegativo(nombre, valor) {
  const texto = textoUnico(nombre, valor)
  if (texto === undefined || texto === '') return undefined
  const n = /^\d+(\.\d+)?$/.test(texto) ? Number(texto) : Number.NaN
  if (!Number.isFinite(n)) {
    throw new ErrorValidacion(`El parámetro "${nombre}" debe ser un número mayor o igual a 0`)
  }
  return n
}

/**
 * Booleano escrito como "true" o "false" (opcional).
 * @param {string} nombre
 * @param {unknown} valor
 * @returns {boolean | undefined}
 */
export function booleano(nombre, valor) {
  const texto = textoUnico(nombre, valor)
  if (texto === undefined || texto === '') return undefined
  if (texto === 'true') return true
  if (texto === 'false') return false
  throw new ErrorValidacion(`El parámetro "${nombre}" debe ser true o false`)
}

/**
 * UUID opcional.
 * @param {string} nombre
 * @param {unknown} valor
 * @returns {string | undefined}
 */
export function uuidOpcional(nombre, valor) {
  const texto = textoUnico(nombre, valor)
  if (texto === undefined || texto === '') return undefined
  if (!esUuid(texto)) throw new ErrorValidacion(`El parámetro "${nombre}" debe ser un id (UUID) válido`)
  return texto.toLowerCase()
}

/**
 * Texto opcional con largo máximo (se recortan espacios).
 * @param {string} nombre
 * @param {unknown} valor
 * @param {number} largoMaximo
 * @returns {string | undefined}
 */
export function textoOpcional(nombre, valor, largoMaximo) {
  const texto = textoUnico(nombre, valor)?.trim()
  if (texto === undefined || texto === '') return undefined
  if (texto.length > largoMaximo) {
    throw new ErrorValidacion(`El parámetro "${nombre}" admite como máximo ${largoMaximo} caracteres`)
  }
  return texto
}

/**
 * Texto obligatorio con largo mínimo y máximo (se recortan espacios).
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ min: number, max: number }} largo
 * @returns {string}
 */
export function textoObligatorio(nombre, valor, { min, max }) {
  const texto = textoUnico(nombre, valor)?.trim() ?? ''
  if (texto.length < min || texto.length > max) {
    throw new ErrorValidacion(`El parámetro "${nombre}" es obligatorio y debe tener entre ${min} y ${max} caracteres`)
  }
  return texto
}

/**
 * Valor que debe pertenecer a una lista blanca (opcional).
 * @template {string} T
 * @param {string} nombre
 * @param {unknown} valor
 * @param {readonly T[]} permitidos
 * @param {T} porDefecto
 * @returns {T}
 */
export function unoDe(nombre, valor, permitidos, porDefecto) {
  const texto = textoUnico(nombre, valor)
  if (texto === undefined || texto === '') return porDefecto
  if (!permitidos.includes(/** @type {T} */ (texto))) {
    throw new ErrorValidacion(`El parámetro "${nombre}" debe ser uno de: ${permitidos.join(', ')}`)
  }
  return /** @type {T} */ (texto)
}

/**
 * Lee pagina y limite con sus valores por defecto.
 * @param {Record<string, unknown>} query
 * @returns {{ pagina: number, limite: number }}
 */
export function paginacion(query) {
  return {
    pagina: entero('pagina', query.pagina, { min: 1, porDefecto: 1 }),
    limite: entero('limite', query.limite, { min: 1, max: LIMITE_MAXIMO, porDefecto: LIMITE_POR_DEFECTO })
  }
}

// -----------------------------------------------------------------------------
// Cuerpo de la petición (JSON)
// -----------------------------------------------------------------------------

/** Largo máximo de un correo según RFC 5321. */
export const LARGO_MAXIMO_EMAIL = 254

// Validación pragmática: algo@algo.dominio, sin espacios.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Exige que el cuerpo sea un objeto JSON.
 * @param {unknown} cuerpo
 * @returns {Record<string, unknown>}
 */
export function cuerpoObjeto(cuerpo) {
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new ErrorValidacion('El cuerpo debe ser un objeto JSON')
  }
  return /** @type {Record<string, unknown>} */ (cuerpo)
}

/**
 * Campo de texto obligatorio del cuerpo, con largo mínimo y máximo.
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ min: number, max: number, recortar?: boolean }} opciones
 *   recortar: quita espacios al inicio y al final (no se usa en contraseñas)
 * @returns {string}
 */
export function campoTexto(nombre, valor, { min, max, recortar = true }) {
  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`El campo "${nombre}" es obligatorio y debe ser texto`)
  }
  const texto = recortar ? valor.trim() : valor
  if (texto.length < min || texto.length > max) {
    throw new ErrorValidacion(`El campo "${nombre}" debe tener entre ${min} y ${max} caracteres`)
  }
  return texto
}

/**
 * Correo obligatorio: se recorta, se pasa a minúsculas y se valida el formato.
 * @param {unknown} valor
 * @returns {string}
 */
export function campoEmail(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorValidacion('El campo "email" es obligatorio y debe ser texto')
  }
  const email = valor.trim().toLowerCase()
  if (email.length > LARGO_MAXIMO_EMAIL) {
    throw new ErrorValidacion(`El campo "email" admite como máximo ${LARGO_MAXIMO_EMAIL} caracteres`)
  }
  if (!REGEX_EMAIL.test(email)) {
    throw new ErrorValidacion('El campo "email" no tiene un formato de correo válido')
  }
  return email
}

/**
 * Campo UUID obligatorio del cuerpo.
 * @param {string} nombre
 * @param {unknown} valor
 * @returns {string}
 */
export function campoUuid(nombre, valor) {
  if (!esUuid(valor)) {
    throw new ErrorValidacion(`El campo "${nombre}" es obligatorio y debe ser un id (UUID) válido`)
  }
  return /** @type {string} */ (valor).toLowerCase()
}

/**
 * Campo entero del cuerpo (debe venir como número JSON, no como texto).
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ min: number, max: number, porDefecto?: number }} opciones
 *   porDefecto: si se indica, el campo es opcional
 * @returns {number}
 */
export function campoEntero(nombre, valor, { min, max, porDefecto }) {
  if (valor === undefined && porDefecto !== undefined) return porDefecto
  if (!Number.isInteger(valor) || /** @type {number} */ (valor) < min || /** @type {number} */ (valor) > max) {
    throw new ErrorValidacion(`El campo "${nombre}" debe ser un número entero entre ${min} y ${max}`)
  }
  return /** @type {number} */ (valor)
}

/**
 * Campo de texto opcional del cuerpo: undefined, null o "" (tras recortar)
 * devuelven null; si viene, debe ser texto con el largo máximo indicado.
 * @param {string} nombre
 * @param {unknown} valor
 * @param {number} largoMaximo
 * @returns {string | null}
 */
export function campoTextoOpcional(nombre, valor, largoMaximo) {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string') throw new ErrorValidacion(`El campo "${nombre}" debe ser texto`)
  const texto = valor.trim()
  if (texto === '') return null
  if (texto.length > largoMaximo) {
    throw new ErrorValidacion(`El campo "${nombre}" admite como máximo ${largoMaximo} caracteres`)
  }
  return texto
}

/**
 * Campo numérico del cuerpo (número JSON) entre 0 y `max`, con a lo más 2
 * decimales (columnas numeric(12, 2)).
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ max: number, porDefecto?: number }} opciones
 *   porDefecto: si se indica, el campo es opcional
 * @returns {number}
 */
export function campoNumero(nombre, valor, { max, porDefecto }) {
  if (valor === undefined && porDefecto !== undefined) return porDefecto
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > max) {
    throw new ErrorValidacion(`El campo "${nombre}" debe ser un número entre 0 y ${max}`)
  }
  if (Math.abs(Math.round(valor * 100) - valor * 100) > 1e-6) {
    throw new ErrorValidacion(`El campo "${nombre}" admite como máximo 2 decimales`)
  }
  return valor
}

/**
 * Campo booleano del cuerpo (true o false JSON).
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ porDefecto?: boolean }} [opciones] porDefecto: si se indica, el campo es opcional
 * @returns {boolean}
 */
export function campoBooleano(nombre, valor, { porDefecto } = {}) {
  if (valor === undefined && porDefecto !== undefined) return porDefecto
  if (typeof valor !== 'boolean') throw new ErrorValidacion(`El campo "${nombre}" debe ser true o false`)
  return valor
}

/**
 * Campo lista del cuerpo con largo entre `min` y `max`.
 * @param {string} nombre
 * @param {unknown} valor
 * @param {{ min: number, max: number }} largo
 * @returns {unknown[]}
 */
export function campoLista(nombre, valor, { min, max }) {
  if (!Array.isArray(valor) || valor.length < min || valor.length > max) {
    throw new ErrorValidacion(`El campo "${nombre}" debe ser una lista de entre ${min} y ${max} elementos`)
  }
  return valor
}
