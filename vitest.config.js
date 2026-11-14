// Tests del frontend (src/). Los del backend corren con su propia
// configuración en backend/vitest.config.js (npm test ejecuta ambos).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    // Los servicios no usan el DOM: basta con Node (fetch está disponible).
    environment: 'node',
    // localStorage en memoria para los servicios que guardan la sesión.
    setupFiles: ['./src/test/almacenamiento-memoria.js'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true
  }
})
