import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:8000',   ws: true },
    },
  },
  build: {
    rollupOptions: {
      // @deck.gl/widgets is an optional peer dep not shipped in this version.
      // Externalizing prevents Rollup from treating the unresolved import as an error.
      external: ['@deck.gl/widgets'],
    },
  },
});
