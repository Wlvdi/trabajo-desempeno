// src/services/sesion.js
// Datos de sesión guardados en el navegador (localStorage):
// - token JWT de la API propia,
// - usuario { id, email, nombre, rol } para pintar la interfaz al cargar,
// - id del carrito anónimo (cabecera X-Carrito-Id).
// Todo acceso a localStorage va en try/catch: en modo privado o con el
// almacenamiento bloqueado la tienda sigue funcionando (sin recordar nada).

const CLAVE_TOKEN = 'subligol_token'
const CLAVE_USUARIO = 'subligol_auth_user'
const CLAVE_CARRITO = 'subligol_carrito_id'

function leer(clave) {
  try {
    return globalThis.localStorage?.getItem(clave) ?? null
  } catch {
    return null
  }
}

function escribir(clave, valor) {
  try {
    if (valor === null || valor === undefined) globalThis.localStorage?.removeItem(clave)
    else globalThis.localStorage?.setItem(clave, valor)
  } catch {
    // Sin almacenamiento disponible: se ignora.
  }
}

/** @returns {string | null} */
export const obtenerToken = () => leer(CLAVE_TOKEN)

/** @returns {{ id: string, email: string, nombre: string, rol: string } | null} */
export function obtenerUsuario() {
  try {
    const texto = leer(CLAVE_USUARIO)
    return texto ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

/**
 * Guarda la sesión que devuelve la API en login o registro.
 * @param {{ token: string, usuario: object }} sesion
 */
export function guardarSesion({ token, usuario }) {
  escribir(CLAVE_TOKEN, token)
  escribir(CLAVE_USUARIO, JSON.stringify(usuario))
}

/** Actualiza solo los datos del usuario (por ejemplo, tras /api/auth/yo). */
export function guardarUsuario(usuario) {
  escribir(CLAVE_USUARIO, JSON.stringify(usuario))
}

/** @returns {string | null} id del carrito anónimo */
export const obtenerCarritoAnonimo = () => leer(CLAVE_CARRITO)

/** @param {string | null} id */
export const guardarCarritoAnonimo = (id) => escribir(CLAVE_CARRITO, id)

/** @type {Set<() => void>} */
const suscriptores = new Set()

/**
 * Registra una función que se llama cuando la sesión se cierra localmente
 * (por ejemplo, la API respondió 401 a un token vencido).
 * @param {() => void} fn
 * @returns {() => void} función para anular la suscripción
 */
export function alCerrarSesion(fn) {
  suscriptores.add(fn)
  return () => suscriptores.delete(fn)
}

/** Borra token y usuario, y avisa a los suscriptores. */
export function cerrarSesionLocal() {
  escribir(CLAVE_TOKEN, null)
  escribir(CLAVE_USUARIO, null)
  for (const fn of suscriptores) fn()
}
