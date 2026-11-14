/**
 * Aplica las migraciones SQL de backend/migraciones en orden alfabético.
 * Cada archivo se aplica una sola vez, dentro de una transacción, y queda
 * registrado en la tabla schema_migraciones.
 *
 * Uso: cd backend && npm run migrate
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR_MIGRACIONES = fileURLToPath(new URL('../migraciones/', import.meta.url))

// Número arbitrario para el bloqueo consultivo: evita que dos procesos
// apliquen migraciones al mismo tiempo.
const ID_BLOQUEO = 80910001

/**
 * @param {import('pg').Pool} pool
 * @param {string} [directorio]
 * @returns {Promise<string[]>} nombres de las migraciones aplicadas en esta ejecución
 */
export async function aplicarMigraciones(pool, directorio = DIR_MIGRACIONES) {
  const cliente = await pool.connect()
  const aplicadas = []
  try {
    await cliente.query('select pg_advisory_lock($1)', [ID_BLOQUEO])
    await cliente.query(`
      create table if not exists schema_migraciones (
        nombre text primary key,
        aplicada_en timestamptz not null default now()
      )`)

    const { rows } = await cliente.query('select nombre from schema_migraciones')
    const yaAplicadas = new Set(rows.map((r) => r.nombre))

    const archivos = (await readdir(directorio)).filter((f) => f.endsWith('.sql')).sort()

    for (const archivo of archivos) {
      if (yaAplicadas.has(archivo)) continue
      const sql = await readFile(path.join(directorio, archivo), 'utf8')
      try {
        await cliente.query('begin')
        await cliente.query(sql)
        await cliente.query('insert into schema_migraciones (nombre) values ($1)', [archivo])
        await cliente.query('commit')
        aplicadas.push(archivo)
      } catch (err) {
        await cliente.query('rollback')
        throw new Error(`Falló la migración ${archivo}: ${err.message}`, { cause: err })
      }
    }
    return aplicadas
  } finally {
    await cliente.query('select pg_advisory_unlock($1)', [ID_BLOQUEO]).catch(() => {})
    cliente.release()
  }
}

// Ejecución directa por línea de comandos.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { crearPool } = await import('../src/db/pool.js')
  const pool = crearPool()
  try {
    const aplicadas = await aplicarMigraciones(pool)
    console.log(
      aplicadas.length
        ? `[migrar] Aplicadas: ${aplicadas.join(', ')}`
        : '[migrar] La base de datos ya está al día.'
    )
  } catch (err) {
    console.error(`[migrar] ${err.message}`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
