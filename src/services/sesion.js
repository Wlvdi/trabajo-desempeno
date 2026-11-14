// src/services/sesion.js
// Datos de sesión guardados en el navegador (localStorage):
// - token JWT de la API propia,
// - usuario { id, email, nombre, rol } para pintar la interfaz al cargar,
// - id del carrito anónimo (cabecera X-Carrito-Id),
// - tokens de las órdenes compradas como invitado (cabecera X-Orden-Token).
// Todo acceso a localStorage va en try/catch: en modo privado o con el
// almacenamiento bloqueado la tienda sigue funcionando (sin recordar nada).

const CLAVE_TOKEN = 'subligol_token'
const CLAVE_USUARIO = 'subligol_auth_user'
const CLAVE_CARRITO = 'subligol_carrito_id'
const CLAVE_ORDENES_INVITADO = 'subligol_ordenes_invitado'
/** Órdenes de invitado que se recuerdan en este navegador (las más recientes). */
const MAXIMO_ORDENES_INVITADO = 20

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

/** @returns {Record<string, string>} { idOrden: token } */
function leerOrdenesInvitado() {
  try {
    const datos = JSON.parse(leer(CLAVE_ORDENES_INVITADO) || '{}')
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {}
  } catch {
    return {}
  }
}

/**
 * Recuerda el token de una orden comprada como invitado, para poder volver
 * a verla en este navegador (por ejemplo, al recargar la página de la orden).
 * @param {string} idOrden
 * @param {string} token
 */
export function guardarOrdenInvitado(idOrden, token) {
  const ordenes = { ...leerOrdenesInvitado(), [idOrden]: token }
  const recientes = Object.entries(ordenes).slice(-MAXIMO_ORDENES_INVITADO)
  escribir(CLAVE_ORDENES_INVITADO, JSON.stringify(Object.fromEntries(recientes)))
}

/**
 * @param {string} idOrden
 * @returns {string | null} token de consulta de una orden de invitado
 */
export const obtenerTokenOrden = (idOrden) => leerOrdenesInvitado()[idOrden] ?? null

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
