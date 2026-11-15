/**
 * POST /api/checkout: convierte el carrito en una orden pagada, en UNA sola
 * transacción. Admite dos modos:
 * - Con sesión (Authorization: Bearer): usa el carrito del usuario; el
 *   email de contacto es el de su cuenta.
 * - Como invitado (sin sesión): usa el carrito anónimo (X-Carrito-Id) y
 *   exige despacho.email. La respuesta incluye token_consulta, que permite
 *   ver la orden después (cabecera X-Orden-Token en GET /api/ordenes/:id).
 *
 * IMPORTANTE para la Fase 2: el checkout mantiene una conexión del pool
 * desde el BEGIN hasta el COMMIT, incluidas las esperas por bloqueos de
 * productos. Con PG_POOL_MAX=10 hay como máximo 10 checkouts en curso; el
 * resto espera una conexión libre (PG_TIMEOUT_CONEXION_MS) y luego falla.
 * Por eso las validaciones baratas (cuerpo y medio de pago) se hacen ANTES
 * de pedir la conexión.
 *
 * Flujo dentro de la transacción:
 *  1. set_config('app.usuario_id') para la auditoría (solo con sesión).
 *  2. Bloquear el carrito (del usuario o el anónimo) con FOR UPDATE. Vacío → 400.
 *  3. Bloquear sus productos con FOR UPDATE en orden de id (sin deadlocks).
 *  4. Validar activo y stock. Si alguno no alcanza → 409 con la lista y
 *     ROLLBACK (sin cambios en la base).
 *  5. Calcular neto con precios ACTUALES, envío y total; autorizar el pago.
 *  6. Insertar ventas y detalle_ventas (un INSERT de varias filas; los
 *     triggers descuentan stock y auditan VENTA_SALIDA) y vaciar el carrito.
 *
 * Con medio_pago "webpay" (sandbox de Transbank) cambia:
 *  - Antes del paso 3 se anulan las ventas PENDIENTE que dejó este mismo
 *    carrito (el comprador cerró Webpay sin volver): recuperan su stock.
 *  - La venta queda PENDIENTE (stock reservado) y el carrito NO se vacía.
 *  - DESPUÉS del COMMIT (sin ocupar una conexión del pool mientras se espera
 *    a Transbank) se crea la transacción en Webpay y se responde con
 *    pago: { url, token }; el navegador envía token_ws a esa url.
 *  - El pago se cierra en rutas/pagos.js cuando Webpay devuelve al comprador.
 */
import { Router } from 'express'
import { autenticarOpcional } from '../middlewares/auth.js'
import { ErrorHttp } from '../middlewares/errores.js'
import { enTransaccion } from '../db/transaccion.js'
import { buscarCarritoAnonimo, buscarCarritoDeUsuario, vaciarCarrito } from '../consultas/carrito.js'
import {
  anularPendientesDelCarrito,
  bloquearLineasDelCarrito,
  cerrarVentaPendiente,
  guardarTokenPago,
  insertarDetalle,
  insertarVenta,
  leerOrden
} from '../consultas/ordenes.js'
import { MEDIOS_PAGO, autorizarPagoMock, costoEnvio, crearClienteWebpay, exigirMedioDisponible } from '../pagos.js'
import { ErrorValidacion, campoEmail, campoTexto, cuerpoObjeto, uuidOpcional } from '../validacion.js'
import { config } from '../config.js'

/** Código de PostgreSQL para violación de CHECK (stock_actual >= 0). */
const VIOLACION_CHECK = '23514'

const REGEX_TELEFONO = /^\+?[0-9 ()-]+$/

/**
 * Valida el cuerpo del checkout. Los campos de despacho coinciden con los
 * de CheckoutStoreView.jsx. El email solo se lee en la compra como invitado
 * (con sesión se usa el de la cuenta) y se guarda en ventas.cliente_email,
 * no dentro de despacho.
 * @param {unknown} cuerpoCrudo
 * @param {{ invitado?: boolean }} [opciones]
 * @returns {{ medioPago: string, despacho: Record<string, string>, email: string | null }}
 */
export function leerCuerpoCheckout(cuerpoCrudo, { invitado = false } = {}) {
  const cuerpo = cuerpoObjeto(cuerpoCrudo)

  if (typeof cuerpo.medio_pago !== 'string' || !MEDIOS_PAGO.includes(cuerpo.medio_pago)) {
    throw new ErrorValidacion(`El campo "medio_pago" debe ser uno de: ${MEDIOS_PAGO.join(', ')}`)
  }
  const d = cuerpo.despacho
  if (d === null || typeof d !== 'object' || Array.isArray(d)) {
    throw new ErrorValidacion('El campo "despacho" es obligatorio y debe ser un objeto')
  }
  const campo = (nombre, min, max) => campoTexto(`despacho.${nombre}`, d[nombre], { min, max })

  const despacho = {
    nombre: campo('nombre', 2, 60),
    apellido: campo('apellido', 2, 60),
    telefono: campo('telefono', 8, 20),
    region: campo('region', 2, 80),
    comuna: campo('comuna', 2, 80),
    direccion: campo('direccion', 5, 150)
  }
  if (!REGEX_TELEFONO.test(despacho.telefono)) {
    throw new ErrorValidacion('El campo "despacho.telefono" solo admite dígitos, espacios, +, ( ) y -')
  }
  if (d.depto !== undefined && d.depto !== null && !(typeof d.depto === 'string' && d.depto.trim() === '')) {
    despacho.depto = campoTexto('despacho.depto', d.depto, { min: 1, max: 50 })
  }
  let email = null
  if (invitado) {
    if (typeof d.email !== 'string' || d.email.trim() === '') {
      throw new ErrorValidacion('El campo "despacho.email" es obligatorio para comprar sin cuenta')
    }
    email = campoEmail(d.email)
  }
  return { medioPago: cuerpo.medio_pago, despacho, email }
}

/**
 * Resultado de un checkout fallido para la métrica api_compras_total.
 * @param {{ status?: number }} err
 * @returns {'sin_stock' | 'carrito_vacio' | 'error'}
 */
function resultadoCompra(err) {
  if (err.status === 409) return 'sin_stock'
  if (err.status === 400) return 'carrito_vacio'
  return 'error'
}

/** Monto en pesos a centavos enteros (evita errores de punto flotante). */
const aCentavos = (monto) => Math.round(monto * 100)

/** Ruta (bajo URL_PUBLICA) a la que Webpay devuelve al comprador; ver rutas/pagos.js. */
export const RUTA_RETORNO_WEBPAY = '/api/pagos/webpay/retorno'

/**
 * @param {import('pg').Pool} pool
 * @param {{ pagoMock?: boolean, metricas?: import('../metricas.js').Metricas,
 *   webpay?: import('../pagos.js').ClienteWebpay, urlPublica?: string }} [opciones]
 *   pagoMock: por defecto, config.pagoMock
 *   metricas: cuenta cada intento de compra por resultado (api_compras_total)
 *   webpay: cliente de Webpay (los tests entregan uno falso)
 *   urlPublica: por defecto, config.urlPublica
 * @returns {import('express').Router}
 */
export function rutasCheckout(
  pool,
  { pagoMock = config.pagoMock, metricas, webpay = crearClienteWebpay(), urlPublica = config.urlPublica } = {}
) {
  const router = Router()

  router.post('/', autenticarOpcional, async (req, res) => {
    // Validaciones baratas antes de ocupar una conexión del pool.
    const usuarioId = req.usuario?.id ?? null
    const invitado = usuarioId === null
    const { medioPago, despacho, email } = leerCuerpoCheckout(req.body, { invitado })
    exigirMedioDisponible(medioPago, { pagoMock })
    const idCarritoAnonimo = invitado ? uuidOpcional('X-Carrito-Id', req.get('X-Carrito-Id')) : undefined

    let orden
    try {
      orden = await enTransaccion(pool, async (db) => {
        if (!invitado) await db.query("select set_config('app.usuario_id', $1, true)", [usuarioId])

        let carritoId = null
        if (!invitado) carritoId = await buscarCarritoDeUsuario(db, usuarioId, { bloquear: true })
        else if (idCarritoAnonimo) carritoId = await buscarCarritoAnonimo(db, idCarritoAnonimo, { bloquear: true })
        if (carritoId && medioPago === 'webpay') await anularPendientesDelCarrito(db, carritoId)
        const lineas = carritoId ? await bloquearLineasDelCarrito(db, carritoId) : []
        if (lineas.length === 0) throw new ErrorHttp(400, 'El carrito está vacío')

        const faltantes = lineas
          .filter((l) => !l.activo || l.stock_actual < l.cantidad)
          .map((l) => ({
            producto_id: l.id,
            nombre: l.nombre,
            solicitado: l.cantidad,
            disponible: l.activo ? l.stock_actual : 0
          }))
        if (faltantes.length > 0) {
          throw new ErrorHttp(409, 'Stock insuficiente para completar la compra', { productos: faltantes })
        }

        // Precios actuales del producto (no los del momento en que se agregó al carrito).
        const detalle = lineas.map((l) => ({
          producto_id: l.id,
          cantidad: l.cantidad,
          precio_unitario: l.precio_venta,
          subtotal: (aCentavos(l.precio_venta) * l.cantidad) / 100
        }))
        const neto = detalle.reduce((s, l) => s + aCentavos(l.subtotal), 0) / 100
        const envio = costoEnvio(neto)
        const total = (aCentavos(neto) + aCentavos(envio)) / 100

        // Pago simulado: se aprueba aquí mismo. Webpay: queda PENDIENTE hasta el retorno.
        const conWebpay = medioPago === 'webpay'
        const venta = await insertarVenta(db, {
          usuarioId,
          clienteEmail: email ?? undefined,
          medioPago,
          codigoAutorizacion: conWebpay ? null : autorizarPagoMock(total).codigo_autorizacion,
          costoEnvio: envio,
          total,
          despacho,
          clienteNombre: `${despacho.nombre} ${despacho.apellido}`,
          estado: conWebpay ? 'PENDIENTE' : 'PAGADO',
          carritoId: conWebpay ? carritoId : null
        })
        try {
          await insertarDetalle(db, venta.id, detalle)
        } catch (err) {
          // Segunda barrera: el CHECK de stock no debería saltar porque los
          // productos están bloqueados y validados, pero si salta es un 409.
          if (err.code === VIOLACION_CHECK) throw new ErrorHttp(409, 'Stock insuficiente para completar la compra')
          throw err
        }
        if (!conWebpay) await vaciarCarrito(db, carritoId)

        const orden = await leerOrden(db, venta.id, { usuarioId, token: venta.token_consulta })
        // Solo el invitado recibe el token: con sesión, la orden se ve con el JWT.
        return invitado ? { ...orden, token_consulta: venta.token_consulta } : orden
      })
    } catch (err) {
      metricas?.compras.inc({ resultado: resultadoCompra(err) })
      throw err
    }

    if (medioPago === 'webpay') {
      // La compra se cuenta como "ok" recién cuando Webpay aprueba (rutas/pagos.js).
      let transaccion
      try {
        transaccion = await webpay.crear(orden.codigo, orden.id, Math.round(orden.total), urlPublica + RUTA_RETORNO_WEBPAY)
        await guardarTokenPago(pool, orden.id, transaccion.token)
      } catch (err) {
        console.error('No se pudo iniciar la transacción en Webpay:', err.message)
        await cerrarVentaPendiente(pool, orden.id, { aprobado: false }) // devuelve el stock
        metricas?.compras.inc({ resultado: 'error' })
        throw new ErrorHttp(502, 'No se pudo iniciar el pago con Webpay. Intenta de nuevo en unos minutos.')
      }
      res.status(201).json({ ...orden, pago: { url: transaccion.url, token: transaccion.token } })
      return
    }

    metricas?.compras.inc({ resultado: 'ok' })
    res.status(201).json(orden)
  })

  return router
}
