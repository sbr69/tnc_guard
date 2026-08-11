import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['motion'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/docs': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/redoc': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/openapi.json': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
