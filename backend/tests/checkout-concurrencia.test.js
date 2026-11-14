/**
 * Tests de concurrencia del checkout: sin sobreventa y sin deadlocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { firmarToken } from '../src/seguridad/tokens.js'
import { prepararCatalogo } from './ayudantes.js'
import { DESPACHO, llenarCarrito } from './ayudantes-checkout.js'

let pool
let app
let clientes
let productos

beforeAll(async () => {
  let datos
  ;({ pool, app, datos } = await prepararCatalogo())
  clientes = datos.clientes.slice(0, 20)
  const { rows } = await pool.query('select id from productos where activo order by id limit 3')
  productos = rows
}, 120_000)

afterAll(async () => {
  await pool.end()
})

const comprar = (usuarioId) =>
  request(app)
    .post('/api/checkout')
    .set('Authorization', `Bearer ${firmarToken({ id: usuarioId, rol: 'cliente' })}`)
    .send({ medio_pago: 'mock', despacho: DESPACHO })

describe('Checkout concurrente', () => {
  it('20 usuarios compran a la vez un producto con stock 5: exactamente 5 compras', async () => {
    const p = productos[0].id
    await pool.query('update productos set stock_actual = 5 where id = $1', [p])
    const ventasAntes = (await pool.query('select count(*)::int as n from detalle_ventas where producto_id = $1', [p]))
      .rows[0].n
    for (const c of clientes) await llenarCarrito(pool, c.id, [[p, 1]])

    const respuestas = await Promise.all(clientes.map((c) => comprar(c.id)))
    const estados = respuestas.map((r) => r.status)

    expect(estados.filter((s) => s === 201)).toHaveLength(5)
    expect(estados.filter((s) => s === 409)).toHaveLength(15)
    for (const r of respuestas.filter((x) => x.status === 409)) {
      expect(r.body.productos).toEqual([expect.objectContaining({ producto_id: p, solicitado: 1, disponible: 0 })])
    }

    const { rows } = await pool.query(
      `select p.stock_actual,
              (select count(*)::int from detalle_ventas where producto_id = p.id) as lineas
         from productos p where p.id = $1`,
      [p]
    )
    expect(rows[0].stock_actual).toBe(0)
    expect(rows[0].lineas - ventasAntes).toBe(5)
  })

  it('compras simultáneas con los mismos 2 productos en distinto orden terminan sin deadlock', async () => {
    const [, a, b] = productos
    await pool.query('update productos set stock_actual = 1000 where id = any($1::uuid[])', [[a.id, b.id]])
    const [u1, u2, u3, u4] = clientes

    // Varias rondas para que el entrelazado de bloqueos tenga oportunidad de ocurrir.
    for (let ronda = 0; ronda < 10; ronda++) {
      await llenarCarrito(pool, u1.id, [[a.id, 1], [b.id, 1]])
      await llenarCarrito(pool, u2.id, [[b.id, 1], [a.id, 1]])
      await llenarCarrito(pool, u3.id, [[a.id, 2], [b.id, 2]])
      await llenarCarrito(pool, u4.id, [[b.id, 2], [a.id, 2]])
      const respuestas = await Promise.all([u1, u2, u3, u4].map((u) => comprar(u.id)))
      expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201, 201])
    }

    const { rows } = await pool.query('select stock_actual from productos where id = any($1::uuid[])', [[a.id, b.id]])
    // 10 rondas × (1 + 1 + 2 + 2) unidades de cada producto.
    expect(rows.map((r) => r.stock_actual)).toEqual([940, 940])
  })
})
