import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
    return {
        plugins: [react()],
        // Enable JSON imports
        json: {
            namedExports: true,
            stringify: false
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
            __ELECTRON__: JSON.stringify(true)
        }
    }
})