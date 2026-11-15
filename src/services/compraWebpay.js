// src/services/compraWebpay.js
// Recuerda, entre la ida a Webpay y la vuelta, qué órdenes esperan el evento
// GA4 "purchase". Con Webpay la compra se confirma al volver (la API redirige
// a /orden/:id?pago=aprobado) y recién ahí se envía purchase, con la misma
// función trackPurchase del pago simulado.
// Se usa sessionStorage: sobrevive a la redirección dentro de la misma
// pestaña y se borra al tomarla, así recargar la página no duplica la compra.

/**
 * Nombre visible del medio de pago guardado en la orden.
 * @param {string | null | undefined} medio
 */
export const nombreMedioPago = (medio) =>
  medio === 'mock' ? 'Pago simulado' : medio === 'webpay' ? 'Webpay Plus (ambiente de pruebas)' : medio || 'Sin informar'

const CLAVE = (ordenId) => `subligol_webpay_pendiente_${ordenId}`

/**
 * @param {string} ordenId
 * @param {'invitado' | 'registrado'} tipoCliente
 */
export function marcarCompraWebpayPendiente(ordenId, tipoCliente) {
  try {
    sessionStorage.setItem(CLAVE(ordenId), tipoCliente)
  } catch {
    // Sin sessionStorage (modo privado estricto): no se enviará purchase.
  }
}

/**
 * Devuelve el tipo de cliente si la orden esperaba su purchase, y lo borra
 * (solo la primera llamada devuelve un valor).
 * @param {string} ordenId
 * @returns {'invitado' | 'registrado' | null}
 */
export function tomarCompraWebpayPendiente(ordenId) {
  try {
    const tipo = sessionStorage.getItem(CLAVE(ordenId))
    sessionStorage.removeItem(CLAVE(ordenId))
    return tipo === 'invitado' || tipo === 'registrado' ? tipo : null
  } catch {
    return null
  }
}
