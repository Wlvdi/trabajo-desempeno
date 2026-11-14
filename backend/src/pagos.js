/**
 * Reglas de cobro del checkout: costo de envío y autorización del pago.
 *
 * El único medio implementado es "mock" (aprobación simulada, sin llamar a
 * servicios externos). Motivo (guía, sección 5.3): bajo carga nunca se debe
 * llamar al sandbox de un tercero. "webpay" (Transbank) será otro commit.
 */
import { randomInt } from 'node:crypto'
import { ErrorHttp } from './middlewares/errores.js'

/**
 * Neto (en pesos) desde el cual el envío es gratis.
 * Es la misma regla que usa el seed (seeds/generador.js) para las ventas web.
 */
export const UMBRAL_ENVIO_GRATIS = 30000
/** Costo de envío (en pesos) cuando el neto no alcanza el umbral. */
export const COSTO_ENVIO = 3990

/** Medios de pago aceptados en el cuerpo del checkout. */
export const MEDIOS_PAGO = Object.freeze(['mock', 'webpay'])

/**
 * Costo de envío según el neto de la compra.
 * @param {number} neto
 * @returns {number}
 */
export function costoEnvio(neto) {
  return neto >= UMBRAL_ENVIO_GRATIS ? 0 : COSTO_ENVIO
}

/**
 * Verifica que el medio de pago se pueda usar, ANTES de abrir la
 * transacción (no ocupa una conexión del pool si se va a rechazar).
 * @param {string} medio uno de MEDIOS_PAGO (ya validado)
 * @param {{ pagoMock: boolean }} opciones
 */
export function exigirMedioDisponible(medio, { pagoMock }) {
  if (medio === 'webpay') {
    throw new ErrorHttp(501, 'El pago con Webpay no está implementado aún; usa medio_pago "mock"')
  }
  if (medio === 'mock' && !pagoMock) {
    throw new ErrorHttp(400, 'El pago simulado (medio_pago "mock") está deshabilitado en este servidor (PAGO_MOCK=false)')
  }
}

/**
 * Autoriza un pago simulado: aprueba siempre y genera un código MOCK-NNNNNN.
 * @param {number} _total monto a cobrar (no se usa en el mock)
 * @returns {{ aprobado: true, codigo_autorizacion: string }}
 */
export function autorizarPagoMock(_total) {
  return { aprobado: true, codigo_autorizacion: `MOCK-${String(randomInt(0, 1_000_000)).padStart(6, '0')}` }
}
