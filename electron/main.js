import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window object
let mainWindow;
let serverProcess;

const isDevelopment = process.env.NODE_ENV === 'development' && !process.env.ELECTRON_APP;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false
        },
        icon: join(__dirname, '../build/icon.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false // Don't show until ready
    });

    // Load the app - always load from dist in desktop app
    const indexPath = join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);

    // Always open DevTools for debugging
    mainWindow.webContents.openDevTools();

    // Add detailed logging for debugging
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('❌ Page failed to load:', {
            errorCode,
            errorDescription,
            validatedURL
        });
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('✅ Page loaded successfully');
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`Console [${ level }]:`, message);
    });

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Focus on macOS
        if (process.platform === 'darwin') {
            mainWindow.focus();
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// Test server connectivity
async function waitForServer() {
    const maxRetries = 30; // 30 seconds
    const retryInterval = 1000; // 1 second

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch('http://127.0.0.1:3001/api/auth/status');
            if (response.ok) {
                console.log('✅ Server is responding to requests');
                return true;
            }
        } catch (error) {
            console.log(`⏳ Waiting for server... attempt ${ i + 1 }/${ maxRetries }`);
        }

        await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    console.error('❌ Server failed to become responsive after 30 seconds');
    return false;
}

// Start the embedded server
async function startServer() {
    try {
        console.log('🚀 Starting embedded server in main process...');

        // Set environment variables
        process.env.PORT = '3001';
        process.env.NODE_ENV = isDevelopment ? 'development' : 'production';
        process.env.ELECTRON_APP = 'true';
        process.env.ELECTRON_USER_DATA = app.getPath('userData');

        // Fix PATH to include common binary locations for Claude CLI and Node.js
        const currentPath = process.env.PATH || '';
        const os = await import('os');
        const homeDir = os.homedir();
        
        // Try to detect Node.js paths from common locations
        const nodeSearchPaths = [];
        
        // Check current process node path
        const currentNodePath = process.execPath;
        if (currentNodePath) {
            const currentNodeDir = dirname(currentNodePath);
            nodeSearchPaths.push(currentNodeDir);
        }
        
        // Check common NVM locations
        const nvmBaseDir = `${homeDir}/.nvm/versions/node`;
        try {
            const fsSync = await import('fs');
            if (fsSync.existsSync(nvmBaseDir)) {
                const versions = fsSync.readdirSync(nvmBaseDir);
                // Use the latest version if multiple exist
                if (versions.length > 0) {
                    versions.sort().reverse(); // Sort descending to get latest first
                    const latestVersion = versions[0];
                    const nvmNodePath = `${nvmBaseDir}/${latestVersion}/bin`;
                    if (fsSync.existsSync(nvmNodePath)) {
                        nodeSearchPaths.push(nvmNodePath);
                    }
                }
            }
        } catch (error) {
            console.log('Could not check NVM directories:', error.message);
        }
        
        const additionalPaths = [
            ...nodeSearchPaths, // Add detected Node.js paths first for priority
            `${homeDir}/.bun/bin`,
            `${homeDir}/.local/bin`,
            '/usr/local/bin',
            '/opt/homebrew/bin',
            '/usr/bin',
            '/bin'
        ];
        
        if (nodeSearchPaths.length > 0) {
            console.log('Detected Node.js paths:', nodeSearchPaths);
        }
        
        // Add paths that aren't already included
        const pathElements = currentPath.split(':');
        const missingPaths = additionalPaths.filter(path => !pathElements.includes(path));
        
        if (missingPaths.length > 0) {
            process.env.PATH = `${missingPaths.join(':')}:${currentPath}`;
            console.log('Enhanced PATH for Claude CLI access:', process.env.PATH);
        }

        console.log('User data path:', app.getPath('userData'));

        // Import and start the server directly in this process
        const serverPath = join(__dirname, '../server/index.js');
        await import(serverPath);

        console.log('✅ Embedded server started successfully');

        // Wait for server to be fully responsive
        console.log('⏳ Waiting for server to be responsive...');
        const serverReady = await waitForServer();

        if (!serverReady) {
            throw new Error('Server failed to become responsive');
        }

        // Create window now that server is confirmed working
        if (!mainWindow) {
            createWindow();
            createMenu();
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to start embedded server:', error);

        // Show error dialog
        dialog.showErrorBox('Server Error',
            `Failed to start backend server: ${ error.message }\n\nThe application cannot continue.`);

        app.quit();
        return false;
    }
}

// Stop the backend server
function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Session',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-new-session');
                    }
                },
                {
                    label: 'Open Project',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory'],
                            title: 'Select Project Directory'
                        });

                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('menu-open-project', result.filePaths[0]);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('menu-settings');
                    }
                },
                { type: 'separator' },
                process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Sidebar',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        mainWindow.webContents.send('menu-toggle-sidebar');
                    }
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Claude Code UI',
                    click: () => {
                        mainWindow.webContents.send('menu-about');
                    }
                },
                {
                    label: 'Learn More',
                    click: () => {
                        shell.openExternal('https://docs.anthropic.com/en/docs/claude-code');
                    }
                }
            ]
        }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });

        // Window menu
        template[4].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(async () => {
    console.log('Electron app ready');

    // Start the embedded server - window will be created when server is ready
    await startServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopServer();
});

// IPC handlers
ipcMain.handle('app-version', () => {
    return app.getVersion();
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Handle protocol for deep linking (optional)
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('claude-code-ui', process.execPath, [
            join(__dirname, '..')
        ]);
    }
} else {
    app.setAsDefaultProtocolClient('claude-code-ui');
}