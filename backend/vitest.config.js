import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Crea la base subligol_test y aplica las migraciones antes de los tests.
    globalSetup: ['./tests/setup-bd.js'],
    // Los tests de integración comparten la misma base: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
})
