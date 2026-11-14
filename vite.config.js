import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Destino del proxy /api en desarrollo y en "vite preview" (API en Docker o npm run dev del backend).
const API_DESARROLLO = 'http://localhost:3000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // El frontend llama a /api en el mismo origen; Vite reenvía al backend (sin CORS).
    proxy: { '/api': API_DESARROLLO }
  },
  preview: {
    proxy: { '/api': API_DESARROLLO }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
})
