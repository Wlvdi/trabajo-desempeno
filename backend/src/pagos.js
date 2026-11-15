/**
 * Reglas de cobro del checkout: costo de envío y autorización del pago.
 *
 * Dos medios de pago:
 * - "mock": aprobación simulada dentro de la API, sin servicios externos. Lo
 *   usan las pruebas de carga (guía, sección 5.3: bajo carga nunca se debe
 *   llamar al sandbox de un tercero). Se habilita con PAGO_MOCK.
 * - "webpay": Webpay Plus de Transbank en ambiente de INTEGRACIÓN (sandbox
 *   con las credenciales públicas de prueba y tarjetas de prueba). Nunca se
 *   conecta al ambiente de producción ni cobra dinero real.
 */
import { randomInt } from 'node:crypto'
import transbank from 'transbank-sdk'
import { ErrorHttp } from './middlewares/errores.js'

const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = transbank

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

/**
 * @typedef {object} ClienteWebpay
 * @property {(ordenCompra: string, sesion: string, monto: number, urlRetorno: string) =>
 *   Promise<{ token: string, url: string }>} crear inicia la transacción
 * @property {(token: string) => Promise<RespuestaWebpay>} confirmar confirma (commit) al volver el comprador
 */

/**
 * @typedef {object} RespuestaWebpay respuesta del commit de Webpay Plus
 * @property {string} status AUTHORIZED, FAILED, ...
 * @property {number} response_code 0 = aprobada
 * @property {string} [authorization_code]
 * @property {number} amount
 * @property {string} buy_order
 */

/**
 * Cliente de Webpay Plus en ambiente de integración (sandbox). El código de
 * comercio y la llave son los públicos de prueba que trae el SDK oficial.
 * @returns {ClienteWebpay}
 */
export function crearClienteWebpay() {
  const transaccion = new WebpayPlus.Transaction(
    new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
  )
  return {
    crear: (ordenCompra, sesion, monto, urlRetorno) => transaccion.create(ordenCompra, sesion, monto, urlRetorno),
    confirmar: (token) => transaccion.commit(token)
  }
}

/**
 * ¿El commit de Webpay aprobó el pago? (status AUTHORIZED y response_code 0)
 * @param {Partial<RespuestaWebpay> | null | undefined} respuesta
 */
export function pagoWebpayAprobado(respuesta) {
  return respuesta?.status === 'AUTHORIZED' && respuesta?.response_code === 0
}
