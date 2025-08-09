import React, { useEffect, useState } from 'react';
import {
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileText,
    Languages,
    Maximize2,
    Mic,
    Moon,
    Settings2,
    Sparkles,
    Sun
} from 'lucide-react';
import DarkModeToggle from './DarkModeToggle';
import DevTools from './DevTools';
import { useTheme } from '../contexts/ThemeContext';
import { useElectron } from '../utils/electron';

const QuickSettingsPanel = ({
                                isOpen,
                                onToggle,
                                autoExpandTools,
                                onAutoExpandChange,
                                showRawParameters,
                                onShowRawParametersChange,
                                autoScrollToBottom,
                                onAutoScrollChange,
                                sendByCtrlEnter,
                                onSendByCtrlEnterChange,
                                chatBgEnabled,
                                onChatBgEnabledChange,
                                isMobile
                            }) => {
    const electron = useElectron();
    const [localIsOpen, setLocalIsOpen] = useState(isOpen);
    const [whisperMode, setWhisperMode] = useState(() => {
        return localStorage.getItem('whisperMode') || 'default';
    });
    const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
    const { isDarkMode, themeMode, setTheme } = useTheme();

    useEffect(() => {
        setLocalIsOpen(isOpen);
    }, [isOpen]);

    // ESC key handler for closing quick settings
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onToggle(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onToggle]);

    useEffect(() => {
        // Check development mode
        const checkDevelopmentMode = async () => {
            if (window.electronAPI) {
                try {
                    const result = await window.electronAPI.isDevelopmentMode();
                    if (result.success) {
                        setIsDevelopmentMode(result.isDevelopment);
                    }
                } catch (error) {
                    console.error('Error checking development mode:', error);
                }
            } else {
                // In browser, check for development mode via env or other indicators
                setIsDevelopmentMode(
                    process.env.NODE_ENV === 'development' ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1'
                );
            }
        };

        checkDevelopmentMode();
    }, []);

    const handleToggle = () => {
        const newState = !localIsOpen;
        setLocalIsOpen(newState);
        onToggle(newState);
    };

    // No permission controls here; Quick Settings keeps only light/dark and view toggles.

    return (
        <>
            {/* Pull Tab */ }
            <div
                className={ `fixed ${ isMobile ? 'bottom-44' : 'top-1/2 -translate-y-1/2' } ${
                    localIsOpen ? 'right-64' : 'right-0'
                } z-50 transition-all duration-150 ease-out` }
            >
                <button
                    onClick={ handleToggle }
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-lg"
                    aria-label={ localIsOpen ? 'Close settings panel' : 'Open settings panel' }
                >
                    { localIsOpen ? (
                        <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                    ) : (
                        <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                    ) }
                </button>
            </div>

            {/* Panel */ }
            <div
                className={ `fixed top-0 right-0 h-full w-64 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl transform transition-transform duration-150 ease-out z-40 ${
                    localIsOpen ? 'translate-x-0' : 'translate-x-full'
                } ${ isMobile ? 'h-screen' : '' }` }
            >
                <div className="h-full flex flex-col">
                    {/* Header */ }
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                            快速设置
                        </h3>
                    </div>

                    {/* Settings Content */ }
                    <div
                        className={ `flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 bg-white dark:bg-gray-900 ${ isMobile ? 'pb-20' : '' }` }>
                        {/* Appearance Settings */ }
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">外观设置</h4>

                            <div
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  { isDarkMode ? <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400"/> :
                      <Sun className="h-4 w-4 text-gray-600 dark:text-gray-400"/> }
                    深色模式
                </span>
                                <DarkModeToggle/>
                            </div>

                            {/* 快速区域仅保留二元切换（浅色/深色）；自动模式请前往 外观 设置 */ }
                        </div>

                        {/* 已移除权限模式设置；请在对话区或“工具设置 > 安全项”中更改。 */ }

                        {/* Tool Display Settings */ }
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">工具显示</h4>

                            <label
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Maximize2 className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                  自动展开工具
                </span>
                                <input
                                    type="checkbox"
                                    checked={ autoExpandTools }
                                    onChange={ (e) => onAutoExpandChange(e.target.checked) }
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                />
                            </label>

                            <label
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                  显示原始参数
                </span>
                                <input
                                    type="checkbox"
                                    checked={ showRawParameters }
                                    onChange={ (e) => onShowRawParametersChange(e.target.checked) }
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                />
                            </label>
                        </div>
                        {/* View Options */ }
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">显示选项</h4>

                            <label
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                  自动滚动到底部
                </span>
                                <input
                                    type="checkbox"
                                    checked={ autoScrollToBottom }
                                    onChange={ (e) => onAutoScrollChange(e.target.checked) }
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                />
                            </label>
                            <label
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                                    <svg className="h-4 w-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24"
                                         fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M4 6h16M4 12h16M4 18h7"/>
                                    </svg>
                                    聊天背景装饰
                                </span>
                                <input
                                    type="checkbox"
                                    checked={ !!chatBgEnabled }
                                    onChange={ (e) => onChatBgEnabledChange?.(e.target.checked) }
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                />
                            </label>
                        </div>

                        {/* Input Settings */ }
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">输入设置</h4>

                            <label
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Languages className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                    { electron.getShortcutKey() }+Enter 发送
                </span>
                                <input
                                    type="checkbox"
                                    checked={ sendByCtrlEnter }
                                    onChange={ (e) => onSendByCtrlEnterChange(e.target.checked) }
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                />
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                                启用后，使用 { electron.getShortcutKey() }+Enter 发送消息而不是单独的 Enter
                                键。这对输入法用户有用，可避免意外发送。
                            </p>
                        </div>

                        {/* Whisper Dictation Settings - HIDDEN */ }
                        <div className="space-y-2" style={ { display: 'none' } }>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Whisper
                                Dictation</h4>

                            <div className="space-y-2">
                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="whisperMode"
                                        value="default"
                                        checked={ whisperMode === 'default' }
                                        onChange={ () => {
                                            setWhisperMode('default');
                                            localStorage.setItem('whisperMode', 'default');
                                            window.dispatchEvent(new Event('whisperModeChanged'));
                                        } }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Mic className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                      Default Mode
                    </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Direct transcription of your speech
                                        </p>
                                    </div>
                                </label>

                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="whisperMode"
                                        value="prompt"
                                        checked={ whisperMode === 'prompt' }
                                        onChange={ () => {
                                            setWhisperMode('prompt');
                                            localStorage.setItem('whisperMode', 'prompt');
                                            window.dispatchEvent(new Event('whisperModeChanged'));
                                        } }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Sparkles className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                      Prompt Enhancement
                    </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Transform rough ideas into clear, detailed AI prompts
                                        </p>
                                    </div>
                                </label>

                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="whisperMode"
                                        value="vibe"
                                        checked={ whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect' }
                                        onChange={ () => {
                                            setWhisperMode('vibe');
                                            localStorage.setItem('whisperMode', 'vibe');
                                            window.dispatchEvent(new Event('whisperModeChanged'));
                                        } }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                      Vibe Mode
                    </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Format ideas as clear agent instructions with details
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Developer Tools - Only show in development mode */ }
                        { isDevelopmentMode && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    开发者工具
                                </h4>

                                <div
                                    className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <DevTools/>
                                </div>
                            </div>
                        ) }
                    </div>
                </div>
            </div>

            {/* Backdrop */ }
            { localIsOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 transition-opacity duration-150 ease-out"
                    onClick={ handleToggle }
                />
            ) }
        </>
    );
};

export default QuickSettingsPanel;