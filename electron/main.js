import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window object
let mainWindow;
let serverProcess;

const isDevelopment = process.env.NODE_ENV === 'development';

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: parseInt(process.env.WINDOW_WIDTH) || 1400,
        height: parseInt(process.env.WINDOW_HEIGHT) || 900,
        minWidth: parseInt(process.env.WINDOW_MIN_WIDTH) || 800,
        minHeight: parseInt(process.env.WINDOW_MIN_HEIGHT) || 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false
        },
        icon: join(__dirname, process.env.DESKTOP_ICON_PATH || '../public/icon.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false // Don't show until ready
    });

    // Load the app - always load from dist in desktop app
    const indexPath = join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);

    // Open DevTools if enabled in configuration
    if (process.env.ENABLE_DEV_TOOLS === 'true') {
        mainWindow.webContents.openDevTools();
    }

    // Disable all browser shortcuts for developer tools to prevent conflicts
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // Disable F12 completely
        if (input.key === 'F12') {
            event.preventDefault();
        }

        // Disable Ctrl+Shift+I / Cmd+Alt+I completely
        if ((input.control && input.shift && input.key === 'I') ||
            (input.meta && input.alt && input.key === 'I')) {
            event.preventDefault();
        }

        // Disable other common dev tools shortcuts completely
        // Ctrl+Shift+C / Cmd+Alt+C (inspect element)
        if ((input.control && input.shift && input.key === 'C') ||
            (input.meta && input.alt && input.key === 'C')) {
            event.preventDefault();
        }

        // Ctrl+Shift+J / Cmd+Alt+J (console)
        if ((input.control && input.shift && input.key === 'J') ||
            (input.meta && input.alt && input.key === 'J')) {
            event.preventDefault();
        }

        // Ctrl+U / Cmd+Alt+U (view source)
        if ((input.control && input.key === 'U') ||
            (input.meta && input.alt && input.key === 'U')) {
            event.preventDefault();
        }
    });

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
            const port = process.env.PORT || '3001';
            const response = await fetch(`http://127.0.0.1:${ port }/api/auth/status`);
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
        process.env.PORT = process.env.PORT || '3001';
        process.env.NODE_ENV = isDevelopment ? 'development' : 'production';
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
        const nvmBaseDir = `${ homeDir }/.nvm/versions/node`;
        try {
            const fsSync = await import('fs');
            if (fsSync.existsSync(nvmBaseDir)) {
                const versions = fsSync.readdirSync(nvmBaseDir);
                // Use the latest version if multiple exist
                if (versions.length > 0) {
                    versions.sort().reverse(); // Sort descending to get latest first
                    const latestVersion = versions[0];
                    const nvmNodePath = `${ nvmBaseDir }/${ latestVersion }/bin`;
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
            `${ homeDir }/.bun/bin`,
            `${ homeDir }/.local/bin`,
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
            process.env.PATH = `${ missingPaths.join(':') }:${ currentPath }`;
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
            label: '文件',
            submenu: [
                {
                    label: '新建会话',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => {
                        mainWindow.webContents.send('menu-new-session');
                    }
                },
                {
                    label: '打开项目',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory'],
                            title: '选择项目目录'
                        });

                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('menu-open-project', result.filePaths[0]);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: '设置',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('menu-settings');
                    }
                },
                { type: 'separator' },
                process.platform === 'darwin' ? 
                    { 
                        label: '退出',
                        accelerator: 'CmdOrCtrl+Q',
                        click: () => {
                            app.quit();
                        }
                    } : 
                    { 
                        label: '关闭',
                        accelerator: 'CmdOrCtrl+W',
                        click: () => {
                            mainWindow.close();
                        }
                    }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于 Claude Code UI',
                    click: () => {
                        mainWindow.webContents.send('menu-about');
                    }
                },
                {
                    label: '了解更多',
                    click: () => {
                        shell.openExternal('https://docs.anthropic.com/en/docs/claude-code');
                    }
                }
            ]
        }
    ];

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

// Developer Tools handlers - only available in development
ipcMain.handle('toggle-dev-tools', () => {
    if (!isDevelopment) {
        return { success: false, error: 'Developer tools are only available in development mode' };
    }
    if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
        return { success: true, isOpen: mainWindow.webContents.isDevToolsOpened() };
    }
    return { success: false, error: 'No main window available' };
});

ipcMain.handle('open-dev-tools', (event, options = {}) => {
    if (!isDevelopment) {
        return { success: false, error: 'Developer tools are only available in development mode' };
    }
    if (mainWindow) {
        const defaultOptions = { mode: 'bottom' };
        const mergedOptions = { ...defaultOptions, ...options };
        mainWindow.webContents.openDevTools(mergedOptions);
        return { success: true };
    }
    return { success: false, error: 'No main window available' };
});

ipcMain.handle('close-dev-tools', () => {
    if (!isDevelopment) {
        return { success: false, error: 'Developer tools are only available in development mode' };
    }
    if (mainWindow) {
        mainWindow.webContents.closeDevTools();
        return { success: true };
    }
    return { success: false, error: 'No main window available' };
});

ipcMain.handle('is-dev-tools-opened', () => {
    if (!isDevelopment) {
        return { success: false, error: 'Developer tools are only available in development mode' };
    }
    if (mainWindow) {
        return { success: true, isOpen: mainWindow.webContents.isDevToolsOpened() };
    }
    return { success: false, error: 'No main window available' };
});

ipcMain.handle('is-development-mode', () => {
    return { success: true, isDevelopment };
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