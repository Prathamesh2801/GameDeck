import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/games/zip-to-victory/',
  resolve: {
    alias: { '@brand': fileURLToPath(new URL('../../packages/brand', import.meta.url)) },
  },
  // Shared brand assets live outside this app's root.
  server: { fs: { allow: ['../..'] } },
})
