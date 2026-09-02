import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    react()
  ],
  base: '/',
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const p = id.replace(/\\/g, '/');
          // React 运行时：首屏必需，单独成块利于长期缓存
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) {
            return 'react-vendor';
          }
          // KaTeX 体积最大，单独成块
          if (/node_modules\/katex\//.test(p)) return 'katex';
          return;
        },
      },
    },
  }
})
