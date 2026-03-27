import { defineConfig } from 'vite';

export default defineConfig({
  base: '/phalanx-prototype-v4/',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
  },
});
