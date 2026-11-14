import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Crea la base subligol_test y aplica las migraciones antes de los tests.
    globalSetup: ['./tests/setup-bd.js'],
    // Secreto fijo para los tests de JWT (no es un secreto real).
    env: { JWT_SECRETO: 'secreto-de-prueba-solo-para-tests-0123456789', JWT_EXPIRACION: '2h' },
    // Los tests de integración comparten la misma base: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
})
