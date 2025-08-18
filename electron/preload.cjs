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

    // Configuration operations
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    updateAppConfig: (updates) => ipcRenderer.invoke('update-app-config', updates),
    updateAppConfigKey: (key, value) => ipcRenderer.invoke('update-app-config-key', key, value),

    // Developer Tools operations
    toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
    openDevTools: (options) => ipcRenderer.invoke('open-dev-tools', options),
    closeDevTools: () => ipcRenderer.invoke('close-dev-tools'),
    isDevToolsOpened: () => ipcRenderer.invoke('is-dev-tools-opened'),
    isDevelopmentMode: () => ipcRenderer.invoke('is-development-mode'),

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
            ipcRenderer.on(event, (ipcEvent, ...args) => {
                callback(event, ...args);
            });
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