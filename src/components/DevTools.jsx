import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Bug, Code, Terminal, X } from 'lucide-react';

const DevTools = ({ className = '' }) => {
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
    const [isElectron, setIsElectron] = useState(false);
    const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);

    useEffect(() => {
        // Check if running in Electron
        setIsElectron(!!window.electronAPI);

        // Check if in development mode
        if (window.electronAPI) {
            checkDevelopmentMode();
            checkDevToolsState();

            // Set up periodic state checking to handle manual close
            const stateCheckInterval = setInterval(() => {
                checkDevToolsState();
            }, 1000); // Check every second

            return () => clearInterval(stateCheckInterval);
        } else {
            // In browser, check for development mode via env or other indicators
            setIsDevelopmentMode(
                process.env.NODE_ENV === 'development' ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1'
            );
        }
    }, []);

    const checkDevelopmentMode = async () => {
        try {
            const result = await window.electronAPI.isDevelopmentMode();
            if (result.success) {
                setIsDevelopmentMode(result.isDevelopment);
            }
        } catch (error) {
            console.error('Error checking development mode:', error);
        }
    };

    const checkDevToolsState = async () => {
        try {
            const result = await window.electronAPI.isDevToolsOpened();
            if (result.success) {
                setIsDevToolsOpen(result.isOpen);
            }
        } catch (error) {
            console.error('Error checking dev tools state:', error);
        }
    };

    const toggleDevTools = async () => {
        if (!window.electronAPI || !isDevelopmentMode) return;

        try {
            const result = await window.electronAPI.toggleDevTools();
            if (result.success) {
                setIsDevToolsOpen(result.isOpen);
            } else {
                console.warn('Developer tools not available:', result.error);
            }
        } catch (error) {
            console.error('Error toggling dev tools:', error);
        }
    };

    const openDevToolsBottom = async () => {
        if (!window.electronAPI || !isDevelopmentMode) return;

        try {
            const result = await window.electronAPI.openDevTools({ mode: 'bottom' });
            if (result.success) {
                setIsDevToolsOpen(true);
            } else {
                console.warn('Developer tools not available:', result.error);
            }
        } catch (error) {
            console.error('Error opening dev tools:', error);
        }
    };

    const openDevToolsRight = async () => {
        if (!window.electronAPI || !isDevelopmentMode) return;

        try {
            const result = await window.electronAPI.openDevTools({ mode: 'right' });
            if (result.success) {
                setIsDevToolsOpen(true);
            } else {
                console.warn('Developer tools not available:', result.error);
            }
        } catch (error) {
            console.error('Error opening dev tools:', error);
        }
    };

    const openDevToolsDetached = async () => {
        if (!window.electronAPI || !isDevelopmentMode) return;

        try {
            const result = await window.electronAPI.openDevTools({ mode: 'detach' });
            if (result.success) {
                setIsDevToolsOpen(true);
            } else {
                console.warn('Developer tools not available:', result.error);
            }
        } catch (error) {
            console.error('Error opening dev tools:', error);
        }
    };

    const closeDevTools = async () => {
        if (!window.electronAPI || !isDevelopmentMode) return;

        try {
            const result = await window.electronAPI.closeDevTools();
            if (result.success) {
                setIsDevToolsOpen(false);
            } else {
                console.warn('Developer tools not available:', result.error);
            }
        } catch (error) {
            console.error('Error closing dev tools:', error);
        }
    };

    const openBrowserDevTools = () => {
        // Only allow in development mode for browsers too
        if (!isDevelopmentMode) {
            console.log('%c开发者工具仅在开发模式下可用', 'color: #dc2626; font-size: 14px; font-weight: bold;');
            return;
        }

        // For web browsers, try to trigger F12
        if (typeof window !== 'undefined' && window.console) {
            console.log('%c欢迎使用开发者控制台！', 'color: #2563eb; font-size: 16px; font-weight: bold;');
            console.log('%c右键选择"检查元素"或使用菜单打开浏览器开发者工具', 'color: #6b7280; font-size: 14px;');

            // Try to open dev tools (this won't work in most browsers due to security restrictions)
            try {
                // This is a common trick, but modern browsers block it
                window.open('', '_self').console.log('Dev tools should be accessible via right-click menu');
            } catch (e) {
                // Fallback: Just focus console
                console.info('请使用右键菜单或浏览器菜单打开开发者工具');
            }
        }
    };

    // Don't render anything if not in development mode
    if (!isDevelopmentMode) {
        return null;
    }

    if (!isElectron) {
        return (
            <div className={ `p-3 space-y-3 ${ className }` }>
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={ openBrowserDevTools }
                        className="flex items-center gap-2 text-xs flex-1"
                    >
                        <Terminal className="w-3 h-3"/>
                        浏览器控制台
                    </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    按右键选择"检查元素"或使用菜单打开开发者工具
                </p>
            </div>
        );
    }

    return (
        <div className={ `p-3 space-y-3 ${ className }` }>
            <div className="flex items-center justify-between">
                <Button
                    variant={ isDevToolsOpen ? "default" : "outline" }
                    size="sm"
                    onClick={ toggleDevTools }
                    className="flex items-center gap-2 text-xs flex-1"
                >
                    <Terminal className="w-3 h-3"/>
                    { isDevToolsOpen ? '关闭控制台' : '开发者控制台' }
                </Button>
            </div>

            { !isDevToolsOpen && (
                <div className="grid grid-cols-3 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={ openDevToolsBottom }
                        className="flex items-center gap-1 text-xs px-2 justify-center"
                        title="在底部打开"
                    >
                        <Code className="w-3 h-3"/>
                        底部
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={ openDevToolsRight }
                        className="flex items-center gap-1 text-xs px-2 justify-center"
                        title="在右侧打开"
                    >
                        <Bug className="w-3 h-3"/>
                        右侧
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={ openDevToolsDetached }
                        className="flex items-center gap-1 text-xs px-2 justify-center"
                        title="独立窗口打开"
                    >
                        <X className="w-3 h-3"/>
                        独立
                    </Button>
                </div>
            ) }

            { isDevToolsOpen && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={ closeDevTools }
                    className="flex items-center gap-2 text-xs w-full justify-center"
                    title="关闭开发者工具"
                >
                    <X className="w-3 h-3"/>
                    关闭控制台
                </Button>
            ) }

        </div>
    );
};

export default DevTools;
