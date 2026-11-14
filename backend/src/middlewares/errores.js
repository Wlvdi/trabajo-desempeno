/**
 * Manejadores finales de la cadena de Express: ruta no encontrada y errores.
 */

/**
 * Error con código HTTP y datos adicionales opcionales para el cliente
 * (por ejemplo, { stock_disponible: 3 } en un 409).
 */
export class ErrorHttp extends Error {
  /**
   * @param {number} status
   * @param {string} mensaje
   * @param {Record<string, unknown>} [detalle]
   */
  constructor(status, mensaje, detalle) {
    super(mensaje)
    this.name = 'ErrorHttp'
    this.status = status
    this.detalle = detalle
  }
}

/** Responde 404 en JSON para cualquier ruta no definida. */
export function rutaNoEncontrada(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada', ruta: req.originalUrl })
}

/**
 * Convierte cualquier error en una respuesta JSON.
 * Si el error trae `status` (por ejemplo, JSON mal formado) se respeta;
 * en otro caso se responde 500 sin exponer detalles internos.
 * Los errores 4xx pueden agregar campos con `detalle`.
 */
// Express identifica el manejador de errores por sus 4 parámetros.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, _req, res, _next) {
  const status = Number.isInteger(err.status) && err.status >= 400 ? err.status : 500
  if (status >= 500) {
    console.error('[api] Error no controlado:', err)
    res.status(status).json({ error: 'Error interno del servidor' })
    return
  }
  const detalle = err.detalle && typeof err.detalle === 'object' ? err.detalle : {}
  res.status(status).json({ ...detalle, error: err.message })
}
