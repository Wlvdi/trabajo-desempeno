/**
 * Rutas del carrito persistente (/api/carrito).
 *
 * Identificación del carrito:
 * - Con sesión (Authorization: Bearer): el carrito del usuario.
 * - Sin sesión: el carrito anónimo indicado en la cabecera X-Carrito-Id.
 *   La API lo crea al primer "agregar" y devuelve su id en el cuerpo y en
 *   la cabecera X-Carrito-Id de la respuesta.
 *
 * El carrito NO reserva stock: la validación definitiva se hace en el checkout.
 */
import { Router } from 'express'
import { autenticar, autenticarOpcional } from '../middlewares/auth.js'
import { ErrorHttp } from '../middlewares/errores.js'
import { enTransaccion } from '../db/transaccion.js'
import {
  CANTIDAD_MAXIMA,
  LINEAS_MAXIMAS,
  buscarCarritoAnonimo,
  buscarCarritoDeUsuario,
  crearCarritoAnonimo,
  estadoLinea,
  fijarCantidad,
  fusionarCarritos,
  leerCarrito,
  obtenerOCrearCarritoDeUsuario,
  productoParaCarrito,
  quitarProducto,
  sumarUnidades,
  tocarCarrito,
  vaciarCarrito
} from '../consultas/carrito.js'
import { campoEntero, campoUuid, cuerpoObjeto, esUuid, uuidOpcional } from '../validacion.js'

const CABECERA = 'X-Carrito-Id'

/**
 * Lee la cabecera X-Carrito-Id (400 si no es un UUID).
 * @param {import('express').Request} req
 * @returns {string | undefined}
 */
const idAnonimoDe = (req) => uuidOpcional(CABECERA, req.get(CABECERA))

/**
 * Busca (y bloquea) el carrito de la petición; si `crear` es true y no
 * existe, lo crea.
 * @param {import('pg').PoolClient} db
 * @param {import('express').Request} req
 * @param {{ crear: boolean }} opciones
 * @returns {Promise<string | null>}
 */
async function resolverCarrito(db, req, { crear }) {
  if (req.usuario) {
    if (crear) {
      try {
        return await obtenerOCrearCarritoDeUsuario(db, req.usuario.id)
      } catch (err) {
        // El usuario del token ya no existe (clave foránea).
        if (err.code === '23503') throw new ErrorHttp(401, 'Token inválido o expirado')
        throw err
      }
    }
    return buscarCarritoDeUsuario(db, req.usuario.id)
  }
  const idAnonimo = idAnonimoDe(req)
  const existente = idAnonimo ? await buscarCarritoAnonimo(db, idAnonimo) : null
  // Un id anónimo desconocido (vencido o inventado) se reemplaza por uno nuevo.
  if (!existente && crear) return crearCarritoAnonimo(db)
  return existente
}

/**
 * Responde con el carrito; si es anónimo, repite su id en la cabecera.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Awaited<ReturnType<typeof leerCarrito>>} carrito
 */
function responder(req, res, carrito) {
  if (!req.usuario && carrito.id) res.set(CABECERA, carrito.id)
  res.json(carrito)
}

/**
 * Valida el id de producto de la URL; un id que no es UUID no puede estar en el carrito.
 * @param {string} id
 */
function productoDeRuta(id) {
  if (!esUuid(id)) throw new ErrorHttp(404, 'El producto no está en el carrito')
  return id.toLowerCase()
}

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasCarrito(pool) {
  const router = Router()
  router.use(autenticarOpcional)

  // Ver el carrito: lectura simple, sin transacción ni bloqueo, y no crea nada.
  router.get('/', async (req, res) => {
    let carritoId
    if (req.usuario) {
      carritoId = await buscarCarritoDeUsuario(pool, req.usuario.id, { bloquear: false })
    } else {
      const idAnonimo = idAnonimoDe(req)
      carritoId = idAnonimo ? await buscarCarritoAnonimo(pool, idAnonimo, { bloquear: false }) : null
    }
    responder(req, res, await leerCarrito(pool, carritoId))
  })

  // Agregar unidades de un producto.
  router.post('/items', async (req, res) => {
    const cuerpo = cuerpoObjeto(req.body)
    const productoId = campoUuid('producto_id', cuerpo.producto_id)
    const cantidad = campoEntero('cantidad', cuerpo.cantidad, { min: 1, max: CANTIDAD_MAXIMA, porDefecto: 1 })

    const carrito = await enTransaccion(pool, async (db) => {
      const carritoId = await resolverCarrito(db, req, { crear: true })
      const producto = await productoParaCarrito(db, productoId)
      if (!producto || !producto.activo) throw new ErrorHttp(404, 'Producto no encontrado')

      const actual = await estadoLinea(db, carritoId, productoId)
      if (actual.cantidad === 0 && actual.lineas >= LINEAS_MAXIMAS) {
        throw new ErrorHttp(400, `El carrito admite como máximo ${LINEAS_MAXIMAS} productos distintos`)
      }
      const nueva = actual.cantidad + cantidad
      if (nueva > CANTIDAD_MAXIMA) {
        throw new ErrorHttp(400, `Máximo ${CANTIDAD_MAXIMA} unidades por producto`, {
          cantidad_en_carrito: actual.cantidad
        })
      }
      if (nueva > producto.stock_actual) {
        throw new ErrorHttp(409, 'No hay stock suficiente', {
          stock_disponible: producto.stock_actual,
          cantidad_en_carrito: actual.cantidad
        })
      }
      await sumarUnidades(db, carritoId, productoId, cantidad)
      await tocarCarrito(db, carritoId)
      return leerCarrito(db, carritoId)
    })
    responder(req, res, carrito)
  })

  // Fijar la cantidad de un producto que ya está en el carrito.
  router.patch('/items/:productoId', async (req, res) => {
    const productoId = productoDeRuta(req.params.productoId)
    const cuerpo = cuerpoObjeto(req.body)
    const cantidad = campoEntero('cantidad', cuerpo.cantidad, { min: 1, max: CANTIDAD_MAXIMA })

    const carrito = await enTransaccion(pool, async (db) => {
      const carritoId = await resolverCarrito(db, req, { crear: false })
      if (!carritoId) throw new ErrorHttp(404, 'El producto no está en el carrito')
      const producto = await productoParaCarrito(db, productoId)
      if (!producto || !producto.activo) throw new ErrorHttp(404, 'Producto no encontrado')
      if (cantidad > producto.stock_actual) {
        throw new ErrorHttp(409, 'No hay stock suficiente', { stock_disponible: producto.stock_actual })
      }
      if (!(await fijarCantidad(db, carritoId, productoId, cantidad))) {
        throw new ErrorHttp(404, 'El producto no está en el carrito')
      }
      await tocarCarrito(db, carritoId)
      return leerCarrito(db, carritoId)
    })
    responder(req, res, carrito)
  })

  // Quitar un producto (idempotente).
  router.delete('/items/:productoId', async (req, res) => {
    const productoId = productoDeRuta(req.params.productoId)
    const carrito = await enTransaccion(pool, async (db) => {
      const carritoId = await resolverCarrito(db, req, { crear: false })
      if (carritoId) {
        await quitarProducto(db, carritoId, productoId)
        await tocarCarrito(db, carritoId)
      }
      return leerCarrito(db, carritoId)
    })
    responder(req, res, carrito)
  })

  // Vaciar el carrito (idempotente).
  router.delete('/', async (req, res) => {
    const carrito = await enTransaccion(pool, async (db) => {
      const carritoId = await resolverCarrito(db, req, { crear: false })
      if (carritoId) {
        await vaciarCarrito(db, carritoId)
        await tocarCarrito(db, carritoId)
      }
      return leerCarrito(db, carritoId)
    })
    responder(req, res, carrito)
  })

  // Al iniciar sesión: mover el carrito anónimo (X-Carrito-Id) al del usuario.
  router.post('/fusionar', autenticar, async (req, res) => {
    const idAnonimo = idAnonimoDe(req)
    if (!idAnonimo) throw new ErrorHttp(400, `Falta la cabecera ${CABECERA} con el carrito anónimo`)

    const carrito = await enTransaccion(pool, async (db) => {
      const destinoId = await resolverCarrito(db, req, { crear: true })
      const anonimoId = await buscarCarritoAnonimo(db, idAnonimo)
      if (anonimoId) {
        await fusionarCarritos(db, anonimoId, destinoId)
        await tocarCarrito(db, destinoId)
      }
      return leerCarrito(db, destinoId)
    })
    res.json(carrito)
  })

  return router
}
