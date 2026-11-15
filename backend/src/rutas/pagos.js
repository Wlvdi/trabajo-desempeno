/**
 * Retorno desde Webpay Plus (ambiente de integración de Transbank).
 *
 * GET|POST /api/pagos/webpay/retorno: Webpay devuelve aquí al comprador
 * (formulario o parámetros de la URL) con uno de estos casos:
 *  - token_ws: el comprador terminó el pago (aprobado o rechazado). La API
 *    lo confirma (commit) con Transbank: si se aprueba, la venta queda
 *    PAGADO y se vacía el carrito; si no, ANULADO y se devuelve el stock.
 *  - TBK_TOKEN (+ TBK_ORDEN_COMPRA, TBK_ID_SESION): el comprador anuló el
 *    pago en el formulario de Webpay → ANULADO.
 *  - Solo TBK_ORDEN_COMPRA y TBK_ID_SESION: se agotó el tiempo → ANULADO.
 * Siempre termina redirigiendo (303) a la tienda:
 *   URL_PUBLICA/orden/:id?pago=aprobado|rechazado|cancelado
 *   URL_PUBLICA/checkout?pago=error (no se encontró la venta)
 * Es idempotente: si la venta ya se cerró (p. ej. el comprador recarga la
 * página), solo redirige según su estado.
 *
 * La llamada a Transbank (commit) se hace FUERA de la transacción, para no
 * ocupar una conexión del pool mientras se espera la respuesta.
 */
import express, { Router } from 'express'
import { enTransaccion } from '../db/transaccion.js'
import { vaciarCarrito } from '../consultas/carrito.js'
import { buscarVentaWebpay, cerrarVentaPendiente } from '../consultas/ordenes.js'
import { crearClienteWebpay, pagoWebpayAprobado } from '../pagos.js'
import { esUuid } from '../validacion.js'
import { config } from '../config.js'

/** Parámetro de texto razonable (Webpay envía tokens de 64 caracteres). */
const parametro = (valor) => (typeof valor === 'string' && valor.length > 0 && valor.length <= 100 ? valor : null)

/**
 * @param {import('pg').Pool} pool
 * @param {{ webpay?: import('../pagos.js').ClienteWebpay, urlPublica?: string,
 *   metricas?: import('../metricas.js').Metricas }} [opciones]
 * @returns {import('express').Router}
 */
export function rutasPagos(pool, { webpay = crearClienteWebpay(), urlPublica = config.urlPublica, metricas } = {}) {
  const router = Router()
  const aOrden = (ventaId, pago) => `${urlPublica}/orden/${ventaId}?pago=${pago}`
  const segunEstado = (estado) => (estado === 'PAGADO' ? 'aprobado' : 'rechazado')

  async function retorno(req, res) {
    const p = { ...req.query, ...(req.body ?? {}) }
    const tokenWs = parametro(p.token_ws)
    const tbkToken = parametro(p.TBK_TOKEN)
    const ordenCompra = parametro(p.TBK_ORDEN_COMPRA)
    const sesion = parametro(p.TBK_ID_SESION)

    // 1. Pago terminado: confirmar con Transbank.
    if (tokenWs && !tbkToken) {
      const venta = await buscarVentaWebpay(pool, { token: tokenWs })
      if (!venta) return res.redirect(303, `${urlPublica}/checkout?pago=error`)
      if (venta.estado !== 'PENDIENTE') return res.redirect(303, aOrden(venta.id, segunEstado(venta.estado)))

      let respuesta = null
      try {
        respuesta = await webpay.confirmar(tokenWs)
      } catch (err) {
        // Transbank rechazó el commit (token vencido, ya confirmado, etc.).
        console.error('Webpay: no se pudo confirmar la transacción:', err.message)
      }
      const aprobado = pagoWebpayAprobado(respuesta) && Math.round(respuesta.amount) === Math.round(venta.total)

      const resultado = await enTransaccion(pool, async (db) => {
        const actual = await buscarVentaWebpay(db, { token: tokenWs }, { bloquear: true })
        if (actual.estado !== 'PENDIENTE') return { cerrada: false, estado: actual.estado }
        await cerrarVentaPendiente(db, actual.id, {
          aprobado,
          codigoAutorizacion: aprobado ? respuesta.authorization_code : null
        })
        if (aprobado && actual.carrito_id) await vaciarCarrito(db, actual.carrito_id)
        return { cerrada: true, estado: aprobado ? 'PAGADO' : 'ANULADO' }
      })
      if (resultado.cerrada) metricas?.compras.inc({ resultado: aprobado ? 'ok' : 'pago_rechazado' })
      return res.redirect(303, aOrden(venta.id, segunEstado(resultado.estado)))
    }

    // 2. Anulado por el comprador o tiempo agotado.
    const venta = tbkToken
      ? await buscarVentaWebpay(pool, { token: tbkToken })
      : ordenCompra && esUuid(sesion)
        ? await buscarVentaWebpay(pool, { codigo: ordenCompra, id: sesion })
        : null
    if (!venta) return res.redirect(303, `${urlPublica}/checkout?pago=error`)
    if (venta.estado === 'PENDIENTE' && (await cerrarVentaPendiente(pool, venta.id, { aprobado: false }))) {
      metricas?.compras.inc({ resultado: 'pago_rechazado' })
    }
    return res.redirect(303, aOrden(venta.id, venta.estado === 'PAGADO' ? 'aprobado' : 'cancelado'))
  }

  const formulario = express.urlencoded({ extended: false, limit: '10kb' })
  router.get('/webpay/retorno', retorno)
  router.post('/webpay/retorno', formulario, retorno)

  return router
}
