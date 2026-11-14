/**
 * POST /api/checkout (requiere sesión): convierte el carrito del usuario en
 * una orden pagada, en UNA sola transacción.
 *
 * IMPORTANTE para la Fase 2: el checkout mantiene una conexión del pool
 * desde el BEGIN hasta el COMMIT, incluidas las esperas por bloqueos de
 * productos. Con PG_POOL_MAX=10 hay como máximo 10 checkouts en curso; el
 * resto espera una conexión libre (PG_TIMEOUT_CONEXION_MS) y luego falla.
 * Por eso las validaciones baratas (cuerpo y medio de pago) se hacen ANTES
 * de pedir la conexión.
 *
 * Flujo dentro de la transacción:
 *  1. set_config('app.usuario_id') para la auditoría.
 *  2. Bloquear el carrito del usuario (FOR UPDATE). Vacío → 400.
 *  3. Bloquear sus productos con FOR UPDATE en orden de id (sin deadlocks).
 *  4. Validar activo y stock. Si alguno no alcanza → 409 con la lista y
 *     ROLLBACK (sin cambios en la base).
 *  5. Calcular neto con precios ACTUALES, envío y total; autorizar el pago.
 *  6. Insertar ventas y detalle_ventas (un INSERT de varias filas; los
 *     triggers descuentan stock y auditan VENTA_SALIDA) y vaciar el carrito.
 */
import { Router } from 'express'
import { autenticar } from '../middlewares/auth.js'
import { ErrorHttp } from '../middlewares/errores.js'
import { enTransaccion } from '../db/transaccion.js'
import { buscarCarritoDeUsuario, vaciarCarrito } from '../consultas/carrito.js'
import { bloquearLineasDelCarrito, insertarDetalle, insertarVenta, leerOrden } from '../consultas/ordenes.js'
import { MEDIOS_PAGO, autorizarPagoMock, costoEnvio, exigirMedioDisponible } from '../pagos.js'
import { ErrorValidacion, campoTexto, cuerpoObjeto } from '../validacion.js'
import { config } from '../config.js'

/** Código de PostgreSQL para violación de CHECK (stock_actual >= 0). */
const VIOLACION_CHECK = '23514'

const REGEX_TELEFONO = /^\+?[0-9 ()-]+$/

/**
 * Valida el cuerpo del checkout. Los campos de despacho coinciden con los
 * de CheckoutStoreView.jsx; rut y email no se guardan (el email ya está en
 * la cuenta y el RUT no es necesario para la orden).
 * @param {unknown} cuerpoCrudo
 */
export function leerCuerpoCheckout(cuerpoCrudo) {
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
  return { medioPago: cuerpo.medio_pago, despacho }
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

/**
 * @param {import('pg').Pool} pool
 * @param {{ pagoMock?: boolean, metricas?: import('../metricas.js').Metricas }} [opciones]
 *   pagoMock: por defecto, config.pagoMock
 *   metricas: cuenta cada intento de compra por resultado (api_compras_total)
 * @returns {import('express').Router}
 */
export function rutasCheckout(pool, { pagoMock = config.pagoMock, metricas } = {}) {
  const router = Router()

  router.post('/', autenticar, async (req, res) => {
    // Validaciones baratas antes de ocupar una conexión del pool.
    const { medioPago, despacho } = leerCuerpoCheckout(req.body)
    exigirMedioDisponible(medioPago, { pagoMock })
    const usuarioId = req.usuario.id

    let orden
    try {
      orden = await enTransaccion(pool, async (db) => {
        await db.query("select set_config('app.usuario_id', $1, true)", [usuarioId])

        const carritoId = await buscarCarritoDeUsuario(db, usuarioId, { bloquear: true })
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

        const pago = autorizarPagoMock(total)

        const ventaId = await insertarVenta(db, {
          usuarioId,
          medioPago,
          codigoAutorizacion: pago.codigo_autorizacion,
          costoEnvio: envio,
          total,
          despacho,
          clienteNombre: `${despacho.nombre} ${despacho.apellido}`
        })
        try {
          await insertarDetalle(db, ventaId, detalle)
        } catch (err) {
          // Segunda barrera: el CHECK de stock no debería saltar porque los
          // productos están bloqueados y validados, pero si salta es un 409.
          if (err.code === VIOLACION_CHECK) throw new ErrorHttp(409, 'Stock insuficiente para completar la compra')
          throw err
        }
        await vaciarCarrito(db, carritoId)

        return leerOrden(db, ventaId, { usuarioId, esAdmin: false })
      })
    } catch (err) {
      metricas?.compras.inc({ resultado: resultadoCompra(err) })
      throw err
    }
    metricas?.compras.inc({ resultado: 'ok' })
    res.status(201).json(orden)
  })

  return router
}
