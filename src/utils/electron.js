// Electron integration utilities
class ElectronBridge {
    constructor() {
        this.isElectron = typeof window !== 'undefined' && window.electronAPI;
        this.platform = this.isElectron ? window.environment?.platform : null;
    }

    // Check if running in Electron
    isElectronApp() {
        return this.isElectron;
    }

    // Get app version
    async getVersion() {
        if (!this.isElectron) return null;
        return await window.electronAPI.getVersion();
    }

    // File system operations
    async showSaveDialog(options = {}) {
        if (!this.isElectron) return null;
        return await window.electronAPI.showSaveDialog(options);
    }

    async showOpenDialog(options = {}) {
        if (!this.isElectron) return null;
        return await window.electronAPI.showOpenDialog(options);
    }

    async writeFile(filePath, content) {
        if (!this.isElectron) return null;
        return await window.electronAPI.writeFile(filePath, content);
    }

    async readFile(filePath) {
        if (!this.isElectron) return null;
        return await window.electronAPI.readFile(filePath);
    }

    // Menu event handling
    onMenuAction(callback) {
        if (!this.isElectron) return () => {
        };
        return window.electronAPI.onMenuAction(callback);
    }

    // Platform utilities
    isMac() {
        return this.platform === 'darwin';
    }

    isWindows() {
        return this.platform === 'win32';
    }

    isLinux() {
        return this.platform === 'linux';
    }

    // Get platform-specific styling
    getPlatformStyles() {
        if (this.isMac()) {
            return {
                titleBarHeight: '28px',
                windowControls: 'left',
                borderRadius: '10px'
            };
        } else if (this.isWindows()) {
            return {
                titleBarHeight: '32px',
                windowControls: 'right',
                borderRadius: '0px'
            };
        } else {
            return {
                titleBarHeight: '32px',
                windowControls: 'right',
                borderRadius: '6px'
            };
        }
    }

    // Get platform-specific shortcut key modifier
    getShortcutKey() {
        if (this.isMac()) {
            return '⌘';
        } else {
            return 'Ctrl';
        }
    }
}

// Create singleton instance
export const electronBridge = new ElectronBridge();

// Context hook for React components
import { createContext, useContext } from 'react';

export const ElectronContext = createContext(electronBridge);

export function useElectron() {
    return useContext(ElectronContext);
}