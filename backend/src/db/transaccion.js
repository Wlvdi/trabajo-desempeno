/**
 * Ayudante para ejecutar varias consultas dentro de una transacción.
 */

/**
 * Toma una conexión del pool, abre una transacción, ejecuta `fn` y hace
 * COMMIT; si `fn` lanza un error hace ROLLBACK y lo vuelve a lanzar.
 * @template T
 * @param {import('pg').Pool} pool
 * @param {(cliente: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function enTransaccion(pool, fn) {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const resultado = await fn(cliente)
    await cliente.query('commit')
    return resultado
  } catch (err) {
    await cliente.query('rollback').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}
