import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  server: {
    allowedHosts: ['vite-11.localcan.dev'],
  },
})
