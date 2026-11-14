/**
 * Tests de integración del esquema: migraciones, triggers y restricciones.
 * Usan la base subligol_test creada en tests/setup-bd.js.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, inject } from 'vitest'
import pg from 'pg'
import { aplicarMigraciones } from '../scripts/migrar.js'

let pool

beforeAll(() => {
  pool = new pg.Pool({ connectionString: inject('urlBdPrueba') })
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await pool.query(`
    truncate table carrito_items, carritos, producto_imagenes, detalle_ventas, ventas,
                   detalle_compras, compras, productos, categorias, audit_logs, usuarios
    restart identity cascade`)
})

/** Crea un producto con el stock indicado y devuelve su id. */
async function crearProducto(stock = 10) {
  const { rows } = await pool.query(
    `insert into productos (sku, nombre, precio_venta, costo_unitario, stock_actual)
     values ('TEST-1', 'Producto de prueba', 5000, 2000, $1) returning id`,
    [stock]
  )
  return rows[0].id
}

/** Registra una venta de `cantidad` unidades del producto en una transacción. */
async function vender(productoId, cantidad) {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const { rows } = await cliente.query(`insert into ventas (canal_venta, total) values ('Web', $1) returning id`, [
      cantidad * 5000
    ])
    await cliente.query(
      `insert into detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
       values ($1, $2, $3, 5000, $4)`,
      [rows[0].id, productoId, cantidad, cantidad * 5000]
    )
    await cliente.query('commit')
  } catch (err) {
    await cliente.query('rollback')
    throw err
  } finally {
    cliente.release()
  }
}

const stockDe = async (id) => (await pool.query('select stock_actual from productos where id = $1', [id])).rows[0].stock_actual

describe('Migraciones', () => {
  it('registra las migraciones aplicadas', async () => {
    const { rows } = await pool.query('select nombre from schema_migraciones order by nombre')
    expect(rows.map((r) => r.nombre)).toEqual(['001_esquema_base.sql', '002_tienda.sql', '003_checkout.sql'])
  })

  it('no vuelve a aplicar migraciones ya aplicadas', async () => {
    expect(await aplicarMigraciones(pool)).toEqual([])
  })

  it('habilita pg_stat_statements', async () => {
    const { rowCount } = await pool.query("select 1 from pg_extension where extname = 'pg_stat_statements'")
    expect(rowCount).toBe(1)
  })
})

describe('Triggers de stock y auditoría', () => {
  it('una venta descuenta stock y deja registro de auditoría', async () => {
    const id = await crearProducto(10)
    await vender(id, 3)
    expect(await stockDe(id)).toBe(7)
    const { rows } = await pool.query("select detalle from audit_logs where tipo_evento = 'VENTA_SALIDA'")
    expect(rows).toHaveLength(1)
    expect(rows[0].detalle).toMatchObject({ stock_anterior: 10, stock_nuevo: 7, cantidad_vendida: 3 })
  })

  it('una venta mayor al stock falla y no modifica nada', async () => {
    const id = await crearProducto(2)
    await expect(vender(id, 3)).rejects.toMatchObject({ code: '23514' }) // check_violation
    expect(await stockDe(id)).toBe(2)
    const { rowCount } = await pool.query('select 1 from ventas')
    expect(rowCount).toBe(0)
  })

  it('una compra suma stock', async () => {
    const id = await crearProducto(5)
    const { rows } = await pool.query("insert into compras (proveedor, total) values ('Prov', 20000) returning id")
    await pool.query(
      `insert into detalle_compras (compra_id, producto_id, cantidad, costo_unitario, subtotal)
       values ($1, $2, 10, 2000, 20000)`,
      [rows[0].id, id]
    )
    expect(await stockDe(id)).toBe(15)
  })

  it('crear un producto deja registro de auditoría', async () => {
    await crearProducto()
    const { rowCount } = await pool.query("select 1 from audit_logs where tipo_evento = 'CREACION_PRODUCTO'")
    expect(rowCount).toBe(1)
  })

  it('los registros de auditoría no se pueden modificar ni borrar', async () => {
    await crearProducto()
    await expect(pool.query("update audit_logs set descripcion = 'x'")).rejects.toThrow(/inmutables/)
    await expect(pool.query('delete from audit_logs')).rejects.toThrow(/inmutables/)
  })
})

describe('Restricciones', () => {
  it('el correo de usuario es único sin importar mayúsculas', async () => {
    await pool.query("insert into usuarios (email, nombre, hash_contrasena) values ('Ana@ejemplo.cl', 'Ana', 'h')")
    await expect(
      pool.query("insert into usuarios (email, nombre, hash_contrasena) values ('ana@EJEMPLO.cl', 'Ana', 'h')")
    ).rejects.toMatchObject({ code: '23505' }) // unique_violation
  })

  it('solo acepta los roles cliente y admin', async () => {
    await expect(
      pool.query("insert into usuarios (email, nombre, hash_contrasena, rol) values ('x@ejemplo.cl', 'X', 'h', 'root')")
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('un usuario tiene como máximo un carrito', async () => {
    const { rows } = await pool.query(
      "insert into usuarios (email, nombre, hash_contrasena) values ('c@ejemplo.cl', 'C', 'h') returning id"
    )
    await pool.query('insert into carritos (usuario_id) values ($1)', [rows[0].id])
    await expect(pool.query('insert into carritos (usuario_id) values ($1)', [rows[0].id])).rejects.toMatchObject({
      code: '23505'
    })
  })
})
