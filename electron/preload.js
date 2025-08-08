const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getVersion: () => ipcRenderer.invoke('app-version'),

    // File system operations
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

    // Menu events
    onMenuAction: (callback) => {
        const events = [
            'menu-new-session',
            'menu-open-project',
            'menu-settings',
            'menu-toggle-sidebar',
            'menu-about'
        ];

        events.forEach(event => {
            ipcRenderer.on(event, callback);
        });

        // Return cleanup function
        return () => {
            events.forEach(event => {
                ipcRenderer.removeAllListeners(event);
            });
        };
    },

    // Configuration access
    getConfig: () => ({
        PORT: process.env.PORT,
        WS_RECONNECT_DELAY: parseInt(process.env.WS_RECONNECT_DELAY) || 3000,
        WINDOW_WIDTH: parseInt(process.env.WINDOW_WIDTH) || 1400,
        WINDOW_HEIGHT: parseInt(process.env.WINDOW_HEIGHT) || 900
    }),

    // Utility
    isElectron: () => true,
    platform: process.platform
});

// Expose environment info
contextBridge.exposeInMainWorld('environment', {
    isElectron: true,
    platform: process.platform,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron
});