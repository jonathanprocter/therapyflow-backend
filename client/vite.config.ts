import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow Vite to use next available port
    host: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '524d766c-fdfb-44af-bd9b-a42f854908dd-00-owso2knsvid2.janeway.replit.dev'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Handle different server ports
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
        }
      }
    }
  },
  // Prevent re-optimization issues
  optimizeDeps: {
    force: false,
  },
  cacheDir: '.vite',
})
