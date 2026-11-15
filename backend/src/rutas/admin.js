/**
 * /api/admin: endpoints del panel de administración (bodega / ERP).
 *
 * Todo el router exige sesión con rol admin (sin sesión 401, cliente 403).
 *
 * - Productos: GET / POST /productos, PATCH /productos/:id y
 *   PATCH /productos/:id/activo.
 * - Categorías: GET / POST /categorias.
 * - Compras: POST / GET /compras. Los triggers suman stock y auditan
 *   COMPRA_ENTRADA.
 * - Ventas manuales: POST / GET /ventas. Bloquean los productos FOR UPDATE
 *   en orden de id (como el checkout): sin sobreventa y sin deadlocks.
 * - GET /dashboard y GET /auditoria.
 *
 * Toda escritura corre en una transacción que fija app.usuario_id, para que
 * los triggers atribuyan la auditoría al administrador. Los totales se
 * calculan en el servidor (el total que envíe el cliente se ignora).
 *
 * PENDIENTE (migración 005, fuera de este commit): editar o activar un
 * producto no queda auditado porque no hay trigger para ello. Si se agrega,
 * debe ser AFTER UPDATE OF las columnas editables (sku, nombre, descripcion,
 * categoria_id, temporada, costo_unitario, precio_venta, stock_minimo,
 * activo), SIN stock_actual: así no audita cada venta ni afecta las pruebas
 * de carga.
 */
import { Router } from 'express'
import { autenticar, requerirRol } from '../middlewares/auth.js'
import { ErrorHttp } from '../middlewares/errores.js'
import { enTransaccion } from '../db/transaccion.js'
import { insertarDetalle } from '../consultas/ordenes.js'
import {
  FILTROS_ESTADO,
  actualizarProducto,
  datosDashboard,
  historialAuditoria,
  insertarCategoria,
  insertarCompra,
  insertarDetalleCompra,
  insertarProducto,
  insertarVentaManual,
  listarCategorias,
  listarCompras,
  listarProductos,
  listarVentas,
  productoAdmin,
  productosPorIds
} from '../consultas/admin.js'
import {
  ErrorValidacion,
  campoBooleano,
  campoEntero,
  campoLista,
  campoNumero,
  campoTexto,
  campoTextoOpcional,
  campoUuid,
  cuerpoObjeto,
  entero,
  esUuid,
  textoOpcional,
  unoDe
} from '../validacion.js'

/** Máximo de productos por página en el panel (el seed tiene 500). */
export const LIMITE_PRODUCTOS_ADMIN = 1000
/** Máximo de eventos de auditoría por consulta. */
export const LIMITE_AUDITORIA = 500
/** Máximo de compras o ventas en los historiales. */
export const LIMITE_HISTORIAL = 100
/** Máximo de líneas en una compra o venta. */
export const LINEAS_MAXIMAS = 50

/** Canales de venta manual. "Web" queda reservado al checkout de la tienda. */
export const CANALES_MANUALES = Object.freeze(['Instagram', 'WhatsApp', 'Presencial', 'Otro'])

/** Tope de montos: cabe en numeric(12, 2). */
const MONTO_MAXIMO = 99_999_999
const CANTIDAD_MAXIMA_COMPRA = 100_000
const CANTIDAD_MAXIMA_VENTA = 10_000
const STOCK_MAXIMO = 1_000_000

/** Códigos de error de PostgreSQL. */
const VIOLACION_UNICA = '23505'
const VIOLACION_FK = '23503'
const VIOLACION_CHECK = '23514'

/** Monto en pesos a centavos enteros (evita errores de punto flotante). */
const aCentavos = (monto) => Math.round(monto * 100)

// -----------------------------------------------------------------------------
// Validación de cuerpos
// -----------------------------------------------------------------------------

/**
 * Lee los campos de un producto. Al crear, `nombre` es obligatorio y se
 * aplican valores por defecto; al editar (parcial) solo se devuelven los
 * campos presentes.
 * @param {unknown} cuerpoCrudo
 * @param {{ parcial: boolean }} opciones
 * @returns {Record<string, unknown>}
 */
export function leerProducto(cuerpoCrudo, { parcial }) {
  const c = cuerpoObjeto(cuerpoCrudo)
  /** @type {Record<string, unknown>} */
  const campos = {}
  const presente = (nombre) => !parcial || c[nombre] !== undefined

  if (parcial && c.stock_actual !== undefined) {
    throw new ErrorValidacion('El stock no se edita directamente: se modifica con compras y ventas')
  }
  if (presente('sku')) campos.sku = campoTextoOpcional('sku', c.sku, 40)
  if (presente('nombre')) campos.nombre = campoTexto('nombre', c.nombre, { min: 2, max: 120 })
  if (presente('descripcion')) campos.descripcion = campoTextoOpcional('descripcion', c.descripcion, 1000)
  if (presente('categoria_id')) {
    campos.categoria_id = c.categoria_id === null || c.categoria_id === undefined || c.categoria_id === ''
      ? null
      : campoUuid('categoria_id', c.categoria_id)
  }
  if (presente('temporada')) {
    campos.temporada = c.temporada === undefined ? 'General' : campoTexto('temporada', c.temporada, { min: 2, max: 50 })
  }
  if (presente('costo_unitario')) {
    campos.costo_unitario = campoNumero('costo_unitario', c.costo_unitario, { max: MONTO_MAXIMO, porDefecto: 0 })
  }
  if (presente('precio_venta')) {
    campos.precio_venta = campoNumero('precio_venta', c.precio_venta, { max: MONTO_MAXIMO, porDefecto: 0 })
  }
  if (presente('stock_minimo')) {
    campos.stock_minimo = campoEntero('stock_minimo', c.stock_minimo, { min: 0, max: STOCK_MAXIMO, porDefecto: 5 })
  }
  if (presente('activo')) campos.activo = campoBooleano('activo', c.activo, { porDefecto: true })
  if (!parcial) {
    campos.stock_actual = campoEntero('stock_actual', c.stock_actual, { min: 0, max: STOCK_MAXIMO, porDefecto: 0 })
  }
  if (parcial && Object.keys(campos).length === 0) {
    throw new ErrorValidacion('No hay campos para actualizar')
  }
  return campos
}

/**
 * Exige que los items existentes no repitan producto.
 * @param {{ producto_id?: string }[]} items
 */
function exigirSinRepetidos(items) {
  const vistos = new Set()
  for (const it of items) {
    if (!it.producto_id) continue
    if (vistos.has(it.producto_id)) {
      throw new ErrorValidacion(`El producto ${it.producto_id} aparece más de una vez: suma las cantidades en una línea`)
    }
    vistos.add(it.producto_id)
  }
}

/**
 * Cuerpo de POST /compras. Un item con es_nuevo: true crea el producto en la
 * misma transacción (queda inactivo y con precio 0 salvo que llegue precio_venta).
 * @param {unknown} cuerpoCrudo
 */
export function leerCompra(cuerpoCrudo) {
  const c = cuerpoObjeto(cuerpoCrudo)
  const items = campoLista('items', c.items, { min: 1, max: LINEAS_MAXIMAS }).map((crudo, i) => {
    const pre = `items[${i}]`
    const it = cuerpoObjeto(crudo)
    const base = {
      cantidad: campoEntero(`${pre}.cantidad`, it.cantidad, { min: 1, max: CANTIDAD_MAXIMA_COMPRA }),
      costo_unitario: campoNumero(`${pre}.costo_unitario`, it.costo_unitario, { max: MONTO_MAXIMO })
    }
    if (it.es_nuevo === true) {
      const precio = it.precio_venta === undefined || it.precio_venta === null
        ? undefined
        : campoNumero(`${pre}.precio_venta`, it.precio_venta, { max: MONTO_MAXIMO })
      return {
        ...base,
        nuevo: {
          nombre: campoTexto(`${pre}.nombre`, it.nombre, { min: 2, max: 120 }),
          sku: campoTextoOpcional(`${pre}.sku`, it.sku, 40),
          categoria_id: it.categoria_id ? campoUuid(`${pre}.categoria_id`, it.categoria_id) : null,
          temporada: it.temporada ? campoTexto(`${pre}.temporada`, it.temporada, { min: 2, max: 50 }) : 'General',
          stock_minimo: campoEntero(`${pre}.stock_minimo`, it.stock_minimo, { min: 0, max: STOCK_MAXIMO, porDefecto: 5 }),
          precio_venta: precio ?? 0,
          // Sin precio de venta no puede quedar a la venta en la tienda.
          activo: precio !== undefined && precio > 0
        }
      }
    }
    return { ...base, producto_id: campoUuid(`${pre}.producto_id`, it.producto_id) }
  })
  exigirSinRepetidos(items)
  return {
    proveedor: campoTextoOpcional('proveedor', c.proveedor, 120),
    notas: campoTextoOpcional('notas', c.notas, 500),
    items
  }
}

/**
 * Cuerpo de POST /ventas.
 * @param {unknown} cuerpoCrudo
 */
export function leerVenta(cuerpoCrudo) {
  const c = cuerpoObjeto(cuerpoCrudo)
  if (c.canal_venta === 'Web') {
    throw new ErrorValidacion('El canal "Web" está reservado para las compras de la tienda')
  }
  if (typeof c.canal_venta !== 'string' || !CANALES_MANUALES.includes(c.canal_venta)) {
    throw new ErrorValidacion(`El campo "canal_venta" debe ser uno de: ${CANALES_MANUALES.join(', ')}`)
  }
  const items = campoLista('items', c.items, { min: 1, max: LINEAS_MAXIMAS }).map((crudo, i) => {
    const pre = `items[${i}]`
    const it = cuerpoObjeto(crudo)
    return {
      producto_id: campoUuid(`${pre}.producto_id`, it.producto_id),
      cantidad: campoEntero(`${pre}.cantidad`, it.cantidad, { min: 1, max: CANTIDAD_MAXIMA_VENTA }),
      precio_unitario: it.precio_unitario === undefined || it.precio_unitario === null
        ? undefined
        : campoNumero(`${pre}.precio_unitario`, it.precio_unitario, { max: MONTO_MAXIMO })
    }
  })
  exigirSinRepetidos(items)
  return {
    canal: c.canal_venta,
    clienteNombre: campoTextoOpcional('cliente_nombre', c.cliente_nombre, 120),
    notas: campoTextoOpcional('notas', c.notas, 500),
    items
  }
}

/** Valida el :id de la ruta (un id mal formado es 404, como en la tienda). */
function idDeRuta(req, entidad = 'Producto') {
  if (!esUuid(req.params.id)) throw new ErrorHttp(404, `${entidad} no encontrado`)
  return req.params.id.toLowerCase()
}

/**
 * Traduce errores de restricciones de PostgreSQL a respuestas claras.
 * @param {any} err
 * @param {{ sku?: string | null, nombre?: string }} [contexto]
 */
function traducirErrorPg(err, contexto = {}) {
  if (err.code === VIOLACION_UNICA && err.constraint === 'productos_sku_key') {
    return new ErrorHttp(409, `Ya existe un producto con el SKU "${contexto.sku ?? ''}"`)
  }
  if (err.code === VIOLACION_UNICA && err.constraint === 'categorias_nombre_key') {
    return new ErrorHttp(409, `Ya existe la categoría "${contexto.nombre ?? ''}"`)
  }
  if (err.code === VIOLACION_FK && err.constraint === 'productos_categoria_id_fkey') {
    return new ErrorHttp(400, 'La categoría indicada no existe')
  }
  return err
}

/** Fija el usuario de la transacción para la auditoría de los triggers. */
const fijarUsuario = (db, usuarioId) => db.query("select set_config('app.usuario_id', $1, true)", [usuarioId])

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------

/**
 * @param {import('pg').Pool} pool
 * @returns {import('express').Router}
 */
export function rutasAdmin(pool) {
  const router = Router()
  router.use(autenticar, requerirRol('admin'))

  // --- Productos -------------------------------------------------------------
  router.get('/productos', async (req, res) => {
    const q = req.query
    const temporada = textoOpcional('temporada', q.temporada, 50)
    res.json(
      await listarProductos(pool, {
        busqueda: textoOpcional('busqueda', q.busqueda, 100),
        temporada: temporada === 'Todas' ? undefined : temporada,
        estado: unoDe('estado', q.estado, /** @type {any} */ (Object.keys(FILTROS_ESTADO)), 'todos'),
        pagina: entero('pagina', q.pagina, { min: 1, porDefecto: 1 }),
        limite: entero('limite', q.limite, { min: 1, max: LIMITE_PRODUCTOS_ADMIN, porDefecto: 50 })
      })
    )
  })

  router.post('/productos', async (req, res) => {
    const campos = leerProducto(req.body, { parcial: false })
    try {
      const producto = await enTransaccion(pool, async (db) => {
        await fijarUsuario(db, req.usuario.id)
        return productoAdmin(db, await insertarProducto(db, campos))
      })
      res.status(201).json(producto)
    } catch (err) {
      throw traducirErrorPg(err, { sku: /** @type {string} */ (campos.sku) })
    }
  })

  /** Actualiza campos de un producto y responde con su versión nueva. */
  const editar = async (req, res, campos) => {
    const id = idDeRuta(req)
    try {
      const producto = await enTransaccion(pool, async (db) => {
        await fijarUsuario(db, req.usuario.id)
        if (!(await actualizarProducto(db, id, campos))) throw new ErrorHttp(404, 'Producto no encontrado')
        return productoAdmin(db, id)
      })
      res.json(producto)
    } catch (err) {
      throw traducirErrorPg(err, { sku: /** @type {string} */ (campos.sku) })
    }
  }

  router.patch('/productos/:id', (req, res) => editar(req, res, leerProducto(req.body, { parcial: true })))

  router.patch('/productos/:id/activo', (req, res) => {
    const cuerpo = cuerpoObjeto(req.body)
    return editar(req, res, { activo: campoBooleano('activo', cuerpo.activo) })
  })

  // --- Categorías ------------------------------------------------------------
  router.get('/categorias', async (_req, res) => {
    res.json(await listarCategorias(pool))
  })

  router.post('/categorias', async (req, res) => {
    const c = cuerpoObjeto(req.body)
    const nombre = campoTexto('nombre', c.nombre, { min: 2, max: 60 })
    const descripcion = campoTextoOpcional('descripcion', c.descripcion, 300)
    try {
      const id = await insertarCategoria(pool, { nombre, descripcion })
      const [categoria] = await listarCategorias(pool, id)
      res.status(201).json(categoria)
    } catch (err) {
      throw traducirErrorPg(err, { nombre })
    }
  })

  // --- Compras ---------------------------------------------------------------
  router.post('/compras', async (req, res) => {
    const { proveedor, notas, items } = leerCompra(req.body)
    const total = items.reduce((s, it) => s + aCentavos(it.costo_unitario) * it.cantidad, 0) / 100
    if (total > MONTO_MAXIMO) throw new ErrorValidacion(`El total de la compra supera el máximo de ${MONTO_MAXIMO}`)

    let skuActual = null
    try {
      const compra = await enTransaccion(pool, async (db) => {
        await fijarUsuario(db, req.usuario.id)

        const existentes = items.filter((it) => it.producto_id).map((it) => it.producto_id)
        const encontrados = new Set((await productosPorIds(db, existentes)).map((p) => p.id))
        const inexistentes = existentes.filter((id) => !encontrados.has(id))
        if (inexistentes.length > 0) {
          throw new ErrorHttp(400, 'Hay productos que no existen', { productos: inexistentes })
        }

        // Artículos nuevos: se crean con stock 0; el detalle de la compra les suma la cantidad.
        const productosCreados = []
        for (const it of items) {
          if (!it.nuevo) continue
          skuActual = it.nuevo.sku
          it.producto_id = await insertarProducto(db, { ...it.nuevo, costo_unitario: it.costo_unitario, stock_actual: 0 })
          productosCreados.push({
            id: it.producto_id, nombre: it.nuevo.nombre, sku: it.nuevo.sku, activo: it.nuevo.activo,
            precio_venta: it.nuevo.precio_venta
          })
        }

        const compraId = await insertarCompra(db, { proveedor, notas, total, usuarioId: req.usuario.id })
        await insertarDetalleCompra(
          db,
          compraId,
          items.map((it) => ({
            producto_id: /** @type {string} */ (it.producto_id),
            cantidad: it.cantidad,
            costo_unitario: it.costo_unitario,
            subtotal: (aCentavos(it.costo_unitario) * it.cantidad) / 100
          }))
        )
        const [compra] = await listarCompras(db, { id: compraId })
        return { ...compra, productos_creados: productosCreados }
      })
      res.status(201).json(compra)
    } catch (err) {
      throw traducirErrorPg(err, { sku: skuActual })
    }
  })

  router.get('/compras', async (req, res) => {
    const limite = entero('limite', req.query.limite, { min: 1, max: LIMITE_HISTORIAL, porDefecto: 15 })
    res.json(await listarCompras(pool, { limite }))
  })

  // --- Ventas manuales -------------------------------------------------------
  router.post('/ventas', async (req, res) => {
    const { canal, clienteNombre, notas, items } = leerVenta(req.body)

    const venta = await enTransaccion(pool, async (db) => {
      await fijarUsuario(db, req.usuario.id)

      // Bloqueo en orden de id: dos ventas (o un checkout) con los mismos
      // productos no se esperan en ciclo, y cada una ve el stock ya actualizado.
      const bloqueados = new Map(
        (await productosPorIds(db, items.map((it) => it.producto_id), { bloquear: true })).map((p) => [p.id, p])
      )
      const inexistentes = items.filter((it) => !bloqueados.has(it.producto_id)).map((it) => it.producto_id)
      if (inexistentes.length > 0) {
        throw new ErrorHttp(400, 'Hay productos que no existen', { productos: inexistentes })
      }

      const faltantes = items
        .map((it) => ({ it, p: bloqueados.get(it.producto_id) }))
        .filter(({ it, p }) => !p.activo || p.stock_actual < it.cantidad)
        .map(({ it, p }) => ({
          producto_id: p.id,
          nombre: p.nombre,
          solicitado: it.cantidad,
          disponible: p.activo ? p.stock_actual : 0
        }))
      if (faltantes.length > 0) {
        throw new ErrorHttp(409, 'Stock insuficiente para registrar la venta', { productos: faltantes })
      }

      const detalle = items.map((it) => {
        const precio = it.precio_unitario ?? bloqueados.get(it.producto_id).precio_venta
        return {
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          precio_unitario: precio,
          subtotal: (aCentavos(precio) * it.cantidad) / 100
        }
      })
      const total = detalle.reduce((s, l) => s + aCentavos(l.subtotal), 0) / 100
      if (total > MONTO_MAXIMO) throw new ErrorValidacion(`El total de la venta supera el máximo de ${MONTO_MAXIMO}`)

      const ventaId = await insertarVentaManual(db, { canal, clienteNombre, notas, total, usuarioId: req.usuario.id })
      try {
        await insertarDetalle(db, ventaId, detalle)
      } catch (err) {
        // Segunda barrera: el CHECK de stock no debería saltar (productos bloqueados y validados).
        if (err.code === VIOLACION_CHECK) throw new ErrorHttp(409, 'Stock insuficiente para registrar la venta')
        throw err
      }
      const [venta] = await listarVentas(db, { id: ventaId })
      return venta
    })
    res.status(201).json(venta)
  })

  // ?canal=Web muestra solo los pedidos de la tienda (con datos de despacho).
  router.get('/ventas', async (req, res) => {
    const limite = entero('limite', req.query.limite, { min: 1, max: LIMITE_HISTORIAL, porDefecto: 15 })
    const canal = unoDe('canal', req.query.canal, ['Web', ...CANALES_MANUALES], undefined)
    res.json(await listarVentas(pool, { limite, canal }))
  })

  // --- Dashboard y auditoría -------------------------------------------------
  router.get('/dashboard', async (_req, res) => {
    res.json(await datosDashboard(pool))
  })

  router.get('/auditoria', async (req, res) => {
    const limite = entero('limite', req.query.limite, { min: 1, max: LIMITE_AUDITORIA, porDefecto: 100 })
    res.json(await historialAuditoria(pool, limite))
  })

  return router
}
