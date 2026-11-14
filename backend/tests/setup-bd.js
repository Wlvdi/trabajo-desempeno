/**
 * Configuración global de Vitest: recrea la base de datos de prueba
 * (subligol_test) en el PostgreSQL de Docker y le aplica las migraciones.
 *
 * Requiere el contenedor de base de datos: docker compose up -d db
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { aplicarMigraciones } from '../scripts/migrar.js'

const NOMBRE_BD_PRUEBA = 'subligol_test'

/** Carga ../.env (raíz del repo) si existe, sin pisar variables ya definidas. */
function cargarEnv() {
  const ruta = fileURLToPath(new URL('../../.env', import.meta.url))
  if (existsSync(ruta)) process.loadEnvFile(ruta)
}

/**
 * @param {{ provide: (clave: string, valor: unknown) => void }} contexto
 */
export default async function ({ provide }) {
  cargarEnv()
  const base = new URL(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://subligol:subligol@localhost:5432/subligol'
  )

  const urlAdmin = new URL(base)
  urlAdmin.pathname = '/postgres'
  const urlPrueba = new URL(base)
  urlPrueba.pathname = `/${NOMBRE_BD_PRUEBA}`

  const admin = new pg.Client({ connectionString: urlAdmin.toString(), connectionTimeoutMillis: 3000 })
  try {
    await admin.connect()
  } catch (err) {
    throw new Error(
      `No se pudo conectar a PostgreSQL en ${base.host} (${err.message}).\n` +
        'Levanta la base de datos con: docker compose up -d db (y revisa DATABASE_URL en .env)'
    )
  }
  try {
    await admin.query(`drop database if exists ${NOMBRE_BD_PRUEBA} with (force)`)
    await admin.query(`create database ${NOMBRE_BD_PRUEBA}`)
  } finally {
    await admin.end()
  }

  const pool = new pg.Pool({ connectionString: urlPrueba.toString() })
  try {
    await aplicarMigraciones(pool)
  } finally {
    await pool.end()
  }

  provide('urlBdPrueba', urlPrueba.toString())
}
