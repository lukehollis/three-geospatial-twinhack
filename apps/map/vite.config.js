import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js'
  },
  // Explicitly set the root directory to the current directory where index.html is located
  root: __dirname,
  // Define the public directory (for static assets)
  publicDir: 'public',
  // Define the build output directory
  build: {
    outDir: '../../dist/apps/map',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: 'localhost',
    open: true,
    fs: {
      // Allow serving files from the entire project
      allow: ['..', '../..'],
      strict: false
    },
    proxy: {
      // Proxy API requests to the Django backend
      '/api': {
        target: 'http://api.local:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@takram/three-3d-tiles-support': resolve(__dirname, '../../packages/3d-tiles/src'),
      '@takram/three-atmosphere': resolve(__dirname, '../../packages/atmosphere/src'),
      '@takram/three-clouds': resolve(__dirname, '../../packages/clouds/src'),
      '@takram/three-geospatial': resolve(__dirname, '../../packages/core/src'),
      '@takram/three-geospatial-effects': resolve(__dirname, '../../packages/effects/src'),
      '@takram/three-geospatial-worker': resolve(__dirname, '../../packages/worker/src'),
      '@takram/three-terrain-core': resolve(__dirname, '../../packages/terrain-core/src'),
    },
  },
});
