/**
 * Validación y conversión de parámetros de consulta (query string).
 * Cada función recibe el valor crudo de req.query y devuelve el valor ya
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
