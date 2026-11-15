/**
 * Carga los datos semilla en PostgreSQL (BORRA los datos existentes).
 *
 * Uso: cd backend && npm run seed
 * Requiere SEED_CONTRASENA_CLIENTES y SEED_CONTRASENA_ADMIN en el .env.
 * Además escribe carga/k6/datos/usuarios.csv (solo correos, sin contraseñas)
 * para que k6 use un usuario distinto por VU.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashear } from '../src/seguridad/contrasenas.js'
import { generarDatos } from './generador.js'

const RUTA_CSV_K6 = fileURLToPath(new URL('../../carga/k6/datos/usuarios.csv', import.meta.url))

/**
 * Inserta filas por lotes con un INSERT multi-fila parametrizado.
 * @param {import('pg').PoolClient} cliente
 * @param {string} tabla
 * @param {string[]} columnas
 * @param {unknown[][]} filas
 * @param {number} [tamanoLote]
 */
async function insertarLotes(cliente, tabla, columnas, filas, tamanoLote = 1000) {
  for (let i = 0; i < filas.length; i += tamanoLote) {
    const lote = filas.slice(i, i + tamanoLote)
    const valores = []
    const marcadores = lote.map((fila) => {
      const m = fila.map((v) => {
        valores.push(v)
        return `$${valores.length}`
      })
      return `(${m.join(', ')})`
    })
    await cliente.query(`insert into ${tabla} (${columnas.join(', ')}) values ${marcadores.join(', ')}`, valores)
  }
}

/**
 * Borra todo y carga los datos generados, en una sola transacción.
 * @param {import('pg').Pool} pool
 * @param {{ contrasenaClientes: string, contrasenaAdmin: string, semilla?: number }} opciones
 * @returns {Promise<Record<string, number>>} cantidad de filas por tabla
 */
export async function sembrar(pool, { contrasenaClientes, contrasenaAdmin, semilla = 2026 }) {
  if (!contrasenaClientes || !contrasenaAdmin) {
    throw new Error('Faltan SEED_CONTRASENA_CLIENTES y/o SEED_CONTRASENA_ADMIN')
  }
  const datos = generarDatos(semilla)

  // Todos los clientes comparten contraseña: se calcula un solo hash.
  // Se usa el mismo módulo que la API, así los parámetros de argon2id son idénticos.
  const [hashClientes, hashAdmin] = await Promise.all([hashear(contrasenaClientes), hashear(contrasenaAdmin)])

  // Stock inicial = unidades vendidas en el historial, para que ninguna venta
  // histórica deje el stock negativo. Al final se fija el stock objetivo.
  const vendido = new Map()
  for (const v of datos.ventas) {
    for (const l of v.detalle) vendido.set(l.producto_id, (vendido.get(l.producto_id) || 0) + l.cantidad)
  }

  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    await cliente.query(`
      truncate table carrito_items, carritos, producto_imagenes, detalle_ventas, ventas,
                     detalle_compras, compras, productos, categorias, audit_logs, usuarios
      restart identity cascade`)
    // Reinicia los códigos de orden web (SUB-AAAA-NNNNNN, migración 003): cada
    // prueba de carga parte desde 500000 y no se agota el máximo (999999).
    await cliente.query('alter sequence seq_codigo_venta restart')
    // Los triggers de auditoría atribuyen los cambios al administrador.
    await cliente.query("select set_config('app.usuario_id', $1, true)", [datos.admin.id])

    await insertarLotes(
      cliente,
      'usuarios',
      ['id', 'email', 'nombre', 'hash_contrasena', 'rol'],
      [
        [datos.admin.id, datos.admin.email, datos.admin.nombre, hashAdmin, 'admin'],
        ...datos.clientes.map((u) => [u.id, u.email, u.nombre, hashClientes, 'cliente'])
      ]
    )

    await insertarLotes(
      cliente,
      'categorias',
      ['id', 'nombre', 'descripcion'],
      datos.categorias.map((c) => [c.id, c.nombre, c.descripcion])
    )

    await insertarLotes(
      cliente,
      'productos',
      ['id', 'sku', 'nombre', 'descripcion', 'descripcion_larga', 'categoria_id', 'temporada', 'costo_unitario',
        'precio_venta', 'stock_actual', 'stock_minimo', 'activo', 'destacado', 'imagen_url', 'especificaciones'],
      datos.productos.map((p) => [
        p.id, p.sku, p.nombre, p.descripcion, p.descripcion_larga, p.categoria_id, p.temporada, p.costo_unitario,
        p.precio_venta, vendido.get(p.id) || 0, p.stock_minimo, p.activo, p.destacado, p.imagen_url,
        JSON.stringify(p.especificaciones)
      ])
    )

    await insertarLotes(
      cliente,
      'producto_imagenes',
      ['producto_id', 'url', 'orden'],
      datos.productos.flatMap((p) => p.imagenes.map((url, i) => [p.id, url, i]))
    )

    await insertarLotes(
      cliente,
      'compras',
      ['id', 'fecha', 'proveedor', 'total', 'usuario_id'],
      datos.compras.map((c) => [c.id, c.fecha, c.proveedor, c.total, c.usuario_id])
    )
    await insertarLotes(
      cliente,
      'detalle_compras',
      ['compra_id', 'producto_id', 'cantidad', 'costo_unitario', 'subtotal'],
      datos.compras.flatMap((c) => c.detalle.map((l) => [c.id, l.producto_id, l.cantidad, l.costo_unitario, l.subtotal]))
    )

    await insertarLotes(
      cliente,
      'ventas',
      ['id', 'fecha', 'canal_venta', 'cliente_nombre', 'total', 'usuario_id', 'codigo', 'estado', 'medio_pago',
        'codigo_autorizacion', 'costo_envio', 'despacho', 'cliente_id'],
      datos.ventas.map((v) => [
        v.id, v.fecha, v.canal_venta, v.cliente_nombre, v.total, v.usuario_id, v.codigo ?? null, v.estado,
        v.medio_pago ?? null, v.codigo_autorizacion ?? null, v.costo_envio,
        v.despacho ? JSON.stringify(v.despacho) : null, v.cliente_id ?? null
      ])
    )
    await insertarLotes(
      cliente,
      'detalle_ventas',
      ['venta_id', 'producto_id', 'cantidad', 'precio_unitario', 'subtotal'],
      datos.ventas.flatMap((v) => v.detalle.map((l) => [v.id, l.producto_id, l.cantidad, l.precio_unitario, l.subtotal]))
    )

    // Stock objetivo (incluye ~3 % agotados y ~5 % en nivel crítico).
    await cliente.query(
      `update productos p set stock_actual = s.stock
       from unnest($1::uuid[], $2::int[]) as s(id, stock)
       where p.id = s.id`,
      [datos.productos.map((p) => p.id), datos.productos.map((p) => p.stock_actual)]
    )

    await cliente.query('commit')
  } catch (err) {
    await cliente.query('rollback')
    throw err
  } finally {
    cliente.release()
  }

  // Estadísticas actualizadas para que el planificador elija bien desde el inicio.
  await pool.query('analyze')

  const { rows } = await pool.query(`
    select 'usuarios' as tabla, count(*)::int as filas from usuarios
    union all select 'categorias', count(*)::int from categorias
    union all select 'productos', count(*)::int from productos
    union all select 'producto_imagenes', count(*)::int from producto_imagenes
    union all select 'compras', count(*)::int from compras
    union all select 'detalle_compras', count(*)::int from detalle_compras
    union all select 'ventas', count(*)::int from ventas
    union all select 'detalle_ventas', count(*)::int from detalle_ventas
    union all select 'audit_logs', count(*)::int from audit_logs`)
  return Object.fromEntries(rows.map((r) => [r.tabla, r.filas]))
}

/**
 * Escribe el CSV de usuarios para k6 (solo correos).
 * @param {string} [ruta]
 */
export async function escribirCsvUsuariosK6(ruta = RUTA_CSV_K6) {
  const { clientes } = generarDatos()
  await mkdir(path.dirname(ruta), { recursive: true })
  await writeFile(ruta, ['email', ...clientes.map((c) => c.email)].join('\n') + '\n', 'utf8')
  return ruta
}

// Ejecución directa por línea de comandos.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { crearPool } = await import('../src/db/pool.js')
  const pool = crearPool()
  try {
    const inicio = Date.now()
    const resumen = await sembrar(pool, {
      contrasenaClientes: process.env.SEED_CONTRASENA_CLIENTES,
      contrasenaAdmin: process.env.SEED_CONTRASENA_ADMIN
    })
    console.table(resumen)
    // El CSV solo hace falta donde se ejecuta k6 (ya está versionado en
    // carga/k6/datos/). Dentro del contenedor no existe esa carpeta: se avisa y sigue.
    let csv = null
    try {
      csv = await escribirCsvUsuariosK6()
    } catch (err) {
      console.warn(`[seed] No se escribió el CSV de usuarios para k6 (${err.code || err.message}); no afecta los datos.`)
    }
    console.log(
      `[seed] Listo en ${((Date.now() - inicio) / 1000).toFixed(1)} s.` +
        (csv ? ` CSV para k6: ${path.relative(process.cwd(), csv)}` : '')
    )
  } catch (err) {
    console.error(`[seed] ${err.message}`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
