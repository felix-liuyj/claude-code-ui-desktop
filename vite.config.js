import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      proxy: {
        '/api': `http://localhost:${env.PORT || 3001}`,
        '/ws': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true
        },
        '/shell': {
          target: `ws://localhost:${env.PORT || 3002}`,
          ws: true
        }
      }
    },
    build: {
      outDir: 'dist',
      // Ensure assets are loaded with relative paths in Electron
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    },
    // Set base path for Electron
    base: command === 'build' ? './' : '/',
    // Configure for Electron environment
    define: {
      // Electron app detection
      __ELECTRON__: JSON.stringify(process.env.ELECTRON === 'true')
    }
  }
})