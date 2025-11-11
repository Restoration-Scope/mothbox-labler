/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { runtimeModule: 'react-compiler-runtime' }]],
      },
    }),
  ],
  resolve: {
    alias: {
      '~': '/src',
      '@': '/src',
    },
  },
  server: {
    allowedHosts: ['vite-96.localcan.dev'],
  },
  // @ts-expect-error - vite and vitest have compatible but differently typed configs
  test: {
    environment: 'jsdom',
    setupFiles: ['/src/test/setup.ts'],
    globals: true,
    css: true,
  },
})
