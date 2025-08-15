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
            target: 'es2015', // 较低的目标以确保兼容性
            rollupOptions: {
                output: {
                    // 为 Electron 启用代码分割
                    manualChunks: {
                        // 将大型依赖分离到独立的 chunk
                        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                        'chart-vendor': ['recharts'],
                        'editor-vendor': ['@uiw/react-codemirror', '@codemirror/lang-css', '@codemirror/lang-html', '@codemirror/lang-javascript', '@codemirror/lang-json', '@codemirror/lang-markdown', '@codemirror/lang-python', '@codemirror/theme-one-dark'],
                        'terminal-vendor': ['xterm', 'xterm-addon-fit', '@xterm/addon-clipboard', '@xterm/addon-webgl'],
                        'markdown-vendor': ['react-markdown'],
                        'ui-vendor': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge']
                    }
                }
            },
            chunkSizeWarningLimit: 3000 // 适当增加警告阈值
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