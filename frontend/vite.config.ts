import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Backend reached through the dev server, so the browser never deals with CORS or ports.
// Locally the backend listens on 3101 (see docker-compose.yml); inside Docker it is "backend:3000".
const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:3101'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
