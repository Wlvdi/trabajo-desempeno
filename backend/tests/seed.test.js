/**
 * Test de integración del seed completo contra la base subligol_test.
 */
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest'
import pg from 'pg'
import argon2 from 'argon2'
import { sembrar } from '../seeds/seed.js'
import { TOTAL_PRODUCTOS, TOTAL_CLIENTES, TOTAL_VENTAS, TOTAL_COMPRAS } from '../seeds/generador.js'

let pool
let resumen

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: inject('urlBdPrueba') })
  resumen = await sembrar(pool, { contrasenaClientes: 'clave-cliente-test', contrasenaAdmin: 'clave-admin-test' })
}, 120_000)

afterAll(async () => {
  await pool.end()
})

describe('seed', () => {
  it('carga las cantidades esperadas', () => {
    expect(resumen).toMatchObject({
      usuarios: TOTAL_CLIENTES + 1,
      categorias: 5,
      productos: TOTAL_PRODUCTOS,
      ventas: TOTAL_VENTAS,
      compras: TOTAL_COMPRAS
    })
  })

  it('no deja stock negativo y deja productos agotados y críticos', async () => {
    const { rows } = await pool.query(`
      select count(*) filter (where stock_actual < 0)::int as negativos,
             count(*) filter (where stock_actual = 0)::int as agotados,
             count(*) filter (where stock_actual <= stock_minimo)::int as bajos
      from productos`)
    expect(rows[0].negativos).toBe(0)
    expect(rows[0].agotados).toBeGreaterThan(0)
    expect(rows[0].bajos).toBeGreaterThan(rows[0].agotados)
  })

  it('las vistas del panel responden con datos', async () => {
    const { rows } = await pool.query('select * from vista_balance_comercial')
    expect(rows[0].cantidad_ventas_realizadas).toBe(String(TOTAL_VENTAS))
    const canales = await pool.query('select canal_venta from vista_ventas_por_canal')
    expect(canales.rows.map((r) => r.canal_venta)).toContain('Web')
  })

  it('guarda contraseñas con hash argon2id verificable', async () => {
    const { rows } = await pool.query("select hash_contrasena from usuarios where email = 'test001@ejemplo.cl'")
    expect(rows[0].hash_contrasena).toMatch(/^\$argon2id\$/)
    expect(await argon2.verify(rows[0].hash_contrasena, 'clave-cliente-test')).toBe(true)
    const admin = await pool.query("select rol from usuarios where email = 'admin@subligol.cl'")
    expect(admin.rows[0].rol).toBe('admin')
  })

  it('es reproducible: volver a sembrar deja los mismos ids y precios', async () => {
    const antes = await pool.query('select id, precio_venta, stock_actual from productos order by id')
    await sembrar(pool, { contrasenaClientes: 'clave-cliente-test', contrasenaAdmin: 'clave-admin-test' })
    const despues = await pool.query('select id, precio_venta, stock_actual from productos order by id')
    expect(despues.rows).toEqual(antes.rows)
  })
})
