import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 6003,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5006',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5006',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
