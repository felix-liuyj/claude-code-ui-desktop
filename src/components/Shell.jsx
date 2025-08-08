import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebglAddon } from '@xterm/addon-webgl';
import 'xterm/css/xterm.css';

// CSS to remove xterm focus outline
const xtermStyles = `
  .xterm .xterm-screen {
    outline: none !important;
  }
  .xterm:focus .xterm-screen {
    outline: none !important;
  }
  .xterm-screen:focus {
    outline: none !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = xtermStyles;
    document.head.appendChild(styleSheet);
}

// Global store for shell sessions to persist across tab switches
const shellSessions = new Map();

function Shell({ selectedProject, selectedSession, isActive }) {
    const terminalRef = useRef(null);
    const terminal = useRef(null);
    const fitAddon = useRef(null);
    const ws = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [lastSessionId, setLastSessionId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Connect to shell function
    const connectToShell = () => {
        if (!isInitialized || isConnected || isConnecting) return;

        setIsConnecting(true);

        // Start the WebSocket connection
        connectWebSocket();
    };

    // Disconnect from shell function
    const disconnectFromShell = () => {

        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        // Clear terminal content completely
        if (terminal.current) {
            terminal.current.clear();
            terminal.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
        }

        setIsConnected(false);
        setIsConnecting(false);
    };

    // Restart shell function
    const restartShell = () => {
        setIsRestarting(true);

        // Clear ALL session storage for this project to force fresh start
        const sessionKeys = Array.from(shellSessions.keys()).filter(key =>
            key.includes(selectedProject.name)
        );
        sessionKeys.forEach(key => shellSessions.delete(key));


        // Close existing WebSocket
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        // Clear and dispose existing terminal
        if (terminal.current) {

            // Dispose terminal immediately without writing text
            terminal.current.dispose();
            terminal.current = null;
            fitAddon.current = null;
        }

        // Reset states
        setIsConnected(false);
        setIsInitialized(false);


        // Force re-initialization after cleanup
        setTimeout(() => {
            setIsRestarting(false);
        }, 200);
    };

    // Watch for session changes and restart shell
    useEffect(() => {
        const currentSessionId = selectedSession?.id || null;


        // Disconnect when session changes (user will need to manually reconnect)
        if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {

            // Disconnect from current shell
            disconnectFromShell();

            // Clear stored sessions for this project
            const allKeys = Array.from(shellSessions.keys());
            allKeys.forEach(key => {
                if (key.includes(selectedProject.name)) {
                    shellSessions.delete(key);
                }
            });
        }

        setLastSessionId(currentSessionId);
    }, [selectedSession?.id, isInitialized]);

    // Initialize terminal when component mounts
    useEffect(() => {

        if (!terminalRef.current || !selectedProject || isRestarting) {
            return;
        }

        // Create session key for this project/session combination
        const sessionKey = selectedSession?.id || `project-${ selectedProject.name }`;

        // Check if we have an existing session
        const existingSession = shellSessions.get(sessionKey);
        if (existingSession && !terminal.current) {

            try {
                // Reuse existing terminal
                terminal.current = existingSession.terminal;
                fitAddon.current = existingSession.fitAddon;
                ws.current = existingSession.ws;
                setIsConnected(existingSession.isConnected);

                // Reattach to DOM - dispose existing element first if needed
                if (terminal.current.element && terminal.current.element.parentNode) {
                    terminal.current.element.parentNode.removeChild(terminal.current.element);
                }

                terminal.current.open(terminalRef.current);

                setTimeout(() => {
                    if (fitAddon.current) {
                        fitAddon.current.fit();
                        // Send terminal size to backend after reattaching
                        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                            ws.current.send(JSON.stringify({
                                type: 'resize',
                                cols: terminal.current.cols,
                                rows: terminal.current.rows
                            }));
                        }
                    }
                }, 100);

                setIsInitialized(true);
                return;
            } catch (error) {
                // Clear the broken session and continue to create a new one
                shellSessions.delete(sessionKey);
                terminal.current = null;
                fitAddon.current = null;
                ws.current = null;
            }
        }

        if (terminal.current) {
            return;
        }


        // Initialize new terminal
        terminal.current = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            allowProposedApi: true, // Required for clipboard addon
            allowTransparency: false,
            convertEol: true,
            scrollback: 10000,
            tabStopWidth: 4,
            // Enable full color support
            windowsMode: false,
            macOptionIsMeta: true,
            macOptionClickForcesSelection: false,
            // Enhanced theme with full 16-color ANSI support + true colors
            theme: {
                // Basic colors
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                cursorAccent: '#1e1e1e',
                selection: '#264f78',
                selectionForeground: '#ffffff',

                // Standard ANSI colors (0-7)
                black: '#000000',
                red: '#cd3131',
                green: '#0dbc79',
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',

                // Bright ANSI colors (8-15)
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#ffffff',

                // Extended colors for better Claude output
                extendedAnsi: [
                    // 16-color palette extension for 256-color support
                    '#000000', '#800000', '#008000', '#808000',
                    '#000080', '#800080', '#008080', '#c0c0c0',
                    '#808080', '#ff0000', '#00ff00', '#ffff00',
                    '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
                ]
            }
        });

        fitAddon.current = new FitAddon();
        const clipboardAddon = new ClipboardAddon();
        const webglAddon = new WebglAddon();

        terminal.current.loadAddon(fitAddon.current);
        terminal.current.loadAddon(clipboardAddon);

        try {
            terminal.current.loadAddon(webglAddon);
        } catch (error) {
        }

        terminal.current.open(terminalRef.current);

        // Wait for terminal to be fully rendered, then fit
        setTimeout(() => {
            if (fitAddon.current) {
                fitAddon.current.fit();
            }
        }, 50);

        // Add keyboard shortcuts for copy/paste
        terminal.current.attachCustomKeyEventHandler((event) => {
            // Ctrl+C or Cmd+C for copy (when text is selected)
            if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
                document.execCommand('copy');
                return false;
            }

            // Ctrl+V or Cmd+V for paste
            if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
                navigator.clipboard.readText().then(text => {
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        ws.current.send(JSON.stringify({
                            type: 'input',
                            data: text
                        }));
                    }
                }).catch(err => {
                    // Failed to read clipboard
                });
                return false;
            }

            return true;
        });

        // Ensure terminal takes full space and notify backend of size
        setTimeout(() => {
            if (fitAddon.current) {
                fitAddon.current.fit();
                // Send terminal size to backend after fitting
                if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({
                        type: 'resize',
                        cols: terminal.current.cols,
                        rows: terminal.current.rows
                    }));
                }
            }
        }, 100);

        setIsInitialized(true);

        // Handle terminal input
        terminal.current.onData((data) => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: 'input',
                    data: data
                }));
            }
        });

        // Add resize observer to handle container size changes
        const resizeObserver = new ResizeObserver(() => {
            if (fitAddon.current && terminal.current) {
                setTimeout(() => {
                    fitAddon.current.fit();
                    // Send updated terminal size to backend after resize
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        ws.current.send(JSON.stringify({
                            type: 'resize',
                            cols: terminal.current.cols,
                            rows: terminal.current.rows
                        }));
                    }
                }, 50);
            }
        });

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        return () => {
            resizeObserver.disconnect();

            // Store session for reuse instead of disposing
            if (terminal.current && selectedProject) {
                const sessionKey = selectedSession?.id || `project-${ selectedProject.name }`;

                try {
                    shellSessions.set(sessionKey, {
                        terminal: terminal.current,
                        fitAddon: fitAddon.current,
                        ws: ws.current,
                        isConnected: isConnected
                    });

                } catch (error) {
                }
            }
        };
    }, [terminalRef.current, selectedProject, selectedSession, isRestarting]);

    // Fit terminal when tab becomes active
    useEffect(() => {
        if (!isActive || !isInitialized) return;

        // Fit terminal when tab becomes active and notify backend
        setTimeout(() => {
            if (fitAddon.current) {
                fitAddon.current.fit();
                // Send terminal size to backend after tab activation
                if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({
                        type: 'resize',
                        cols: terminal.current.cols,
                        rows: terminal.current.rows
                    }));
                }
            }
        }, 100);
    }, [isActive, isInitialized]);

    // WebSocket connection function (called manually)
    const connectWebSocket = async () => {
        if (isConnecting || isConnected) return;

        try {
            // 确保使用正确的Electron桌面应用设置
            let wsBaseUrl;
            
            // 优先使用Electron配置
            const port = window.electronAPI?.getConfig?.()?.PORT || '3001';
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsBaseUrl = `${protocol}//localhost:${port}`;
            
            // 可选：尝试从服务器获取配置作为验证
            try {
                const configResponse = await fetch('/api/config');
                const config = await configResponse.json();
                if (config.wsUrl && config.wsUrl.trim() !== '') {
                    wsBaseUrl = config.wsUrl;
                }
            } catch (error) {
                console.warn('Using default WebSocket URL:', wsBaseUrl);
            }

            // WebSocket URL without authentication
            const wsUrl = `${wsBaseUrl}/shell`;
            console.log('Connecting to WebSocket:', wsUrl);
            
            // 验证URL格式
            if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
                throw new Error('Invalid WebSocket URL format');
            }

            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                setIsConnected(true);
                setIsConnecting(false);

                // Wait for terminal to be ready, then fit and send dimensions
                setTimeout(() => {
                    if (fitAddon.current && terminal.current) {
                        // Force a fit to ensure proper dimensions
                        fitAddon.current.fit();

                        // Wait a bit more for fit to complete, then send dimensions
                        setTimeout(() => {
                            const initPayload = {
                                type: 'init',
                                projectPath: selectedProject.fullPath || selectedProject.path,
                                sessionId: selectedSession?.id,
                                hasSession: !!selectedSession,
                                cols: terminal.current.cols,
                                rows: terminal.current.rows
                            };

                            ws.current.send(JSON.stringify(initPayload));

                            // Also send resize message immediately after init
                            setTimeout(() => {
                                if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                                    ws.current.send(JSON.stringify({
                                        type: 'resize',
                                        cols: terminal.current.cols,
                                        rows: terminal.current.rows
                                    }));
                                }
                            }, 100);
                        }, 50);
                    }
                }, 200);
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'output') {
                        // Check for URLs in the output and make them clickable
                        const urlRegex = /(https?:\/\/[^\s\x1b\x07]+)/g;
                        let output = data.data;

                        // Find URLs in the text (excluding ANSI escape sequences)
                        const urls = [];
                        let match;
                        while ((match = urlRegex.exec(output.replace(/\x1b\[[0-9;]*m/g, ''))) !== null) {
                            urls.push(match[1]);
                        }

                        // If URLs found, log them for potential opening

                        terminal.current.write(output);
                    } else if (data.type === 'url_open') {
                        // Handle explicit URL opening requests from server
                        window.open(data.url, '_blank');
                    }
                } catch (error) {
                }
            };

            ws.current.onclose = (event) => {
                setIsConnected(false);
                setIsConnecting(false);

                // Clear terminal content when connection closes
                if (terminal.current) {
                    terminal.current.clear();
                    terminal.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
                }

                // Don't auto-reconnect anymore - user must manually connect
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setIsConnected(false);
                setIsConnecting(false);
                
                // Display error in terminal
                if (terminal.current) {
                    terminal.current.writeln('\x1b[31m✗ 连接终端失败\x1b[0m');
                    terminal.current.writeln('\x1b[33m请检查网络连接或稍后重试\x1b[0m');
                }
            };
        } catch (error) {
            console.error('Failed to connect to terminal:', error);
            setIsConnected(false);
            setIsConnecting(false);
            
            // Display connection error in terminal
            if (terminal.current) {
                terminal.current.writeln('\x1b[31m✗ 连接失败\x1b[0m');
                terminal.current.writeln(`\x1b[33m错误：${error.message || '未知错误'}\x1b[0m`);
                terminal.current.writeln('\x1b[90m请检查服务器状态或稍后重试\x1b[0m');
            }
        }
    };


    if (!selectedProject) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <div
                        className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">选择项目</h3>
                    <p>选择一个项目在该目录中打开交互式终端</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-900 w-full">
            {/* Header */ }
            <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className={ `w-2 h-2 rounded-full ${ isConnected ? 'bg-green-500' : 'bg-red-500' }` }/>
                        { selectedSession && (
                            <span className="text-xs text-blue-300">
                ({ selectedSession.summary.slice(0, 30) }...)
              </span>
                        ) }
                        { !selectedSession && (
                            <span className="text-xs text-gray-400">(新会话)</span>
                        ) }
                        { !isInitialized && (
                            <span className="text-xs text-yellow-400">(正在初始化...)</span>
                        ) }
                        { isRestarting && (
                            <span className="text-xs text-blue-400">(正在重启...)</span>
                        ) }
                    </div>
                    <div className="flex items-center space-x-3">
                        { isConnected && (
                            <button
                                onClick={ disconnectFromShell }
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
                                title="从终端断开连接"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                          d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                                <span>断开连接</span>
                            </button>
                        ) }

                        <button
                            onClick={ restartShell }
                            disabled={ isRestarting || isConnected }
                            className="text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                            title="重启终端（请先断开连接）"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            <span>重启</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Terminal */ }
            <div className="flex-1 p-2 overflow-hidden relative">
                <div ref={ terminalRef } className="h-full w-full focus:outline-none" style={ { outline: 'none' } }/>

                {/* Loading state */ }
                { !isInitialized && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
                        <div className="text-white">加载终端中...</div>
                    </div>
                ) }

                {/* Connect button when not connected */ }
                { isInitialized && !isConnected && !isConnecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
                        <div className="text-center max-w-sm mx-auto">
                            <button
                                onClick={ connectToShell }
                                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center justify-center space-x-2 text-base font-medium"
                                title="连接到终端"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                          d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                                <span>在终端中继续</span>
                            </button>
                            <p className="text-gray-400 text-sm mt-3 px-2">
                                { selectedSession ?
                                    `恢复会话：${ selectedSession.summary.slice(0, 50) }...` :
                                    '开始新的Claude会话'
                                }
                            </p>
                        </div>
                    </div>
                ) }

                {/* Connecting state */ }
                { isConnecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
                        <div className="text-center max-w-sm mx-auto">
                            <div className="flex items-center justify-center space-x-3 text-yellow-400">
                                <div
                                    className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                                <span className="text-base font-medium">连接到终端中...</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-3 px-2">
                                在{ selectedProject.displayName }中启动Claude CLI
                            </p>
                        </div>
                    </div>
                ) }
            </div>
        </div>
    );
}

export default Shell;