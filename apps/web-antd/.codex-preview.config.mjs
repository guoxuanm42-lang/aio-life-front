import { defineConfig } from 'vite';

export default defineConfig({
  preview: {
    host: '0.0.0.0',
    port: 5666,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:45678/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
