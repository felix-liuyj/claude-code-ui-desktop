import React, { useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Eye,
    FileText,
    Languages,
    Maximize2,
    Mic,
    Moon,
    Settings2,
    Shield,
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
    const [permissionMode, setPermissionMode] = useState(() => {
        const savedSettings = localStorage.getItem('claude-tools-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            let mode = settings.permissionMode || 'default';
            if (mode === 'auto-allow') mode = 'acceptEdits';
            if (mode === 'skip-all') mode = 'bypassPermissions';
            return mode;
        }
        return 'default';
    });
    const [skipPermissions, setSkipPermissions] = useState(() => {
        const savedSettings = localStorage.getItem('claude-tools-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            return !!settings.skipPermissions;
        }
        return false;
    });
    const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
    const { isDarkMode, themeMode, setTheme } = useTheme();

    useEffect(() => {
        setLocalIsOpen(isOpen);
    }, [isOpen]);

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

    const handlePermissionModeChange = (newMode) => {
        setPermissionMode(newMode);

        // Save to localStorage
        const savedSettings = localStorage.getItem('claude-tools-settings');
        let settings = {};
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
        }
        settings.permissionMode = newMode;
        settings.lastUpdated = new Date().toISOString();
        localStorage.setItem('claude-tools-settings', JSON.stringify(settings));

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('permissionModeChanged', { detail: { mode: newMode } }));
    };

    // Listen to global settings changes to keep in sync
    useEffect(() => {
        const onToolsSettingsChanged = () => {
            const savedSettings = localStorage.getItem('claude-tools-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                let mode = settings.permissionMode || 'default';
                if (mode === 'auto-allow') mode = 'acceptEdits';
                if (mode === 'skip-all') mode = 'bypassPermissions';
                setPermissionMode(mode);
                setSkipPermissions(!!settings.skipPermissions);
            }
        };
        window.addEventListener('toolsSettingsChanged', onToolsSettingsChanged);
        const onPermissionModeChanged = (e) => {
            let mode = e?.detail?.mode || 'default';
            if (mode === 'auto-allow') mode = 'acceptEdits';
            if (mode === 'skip-all') mode = 'bypassPermissions';
            setPermissionMode(mode);
        };
        window.addEventListener('permissionModeChanged', onPermissionModeChanged);
        return () => {
            window.removeEventListener('toolsSettingsChanged', onToolsSettingsChanged);
            window.removeEventListener('permissionModeChanged', onPermissionModeChanged);
        };
    }, []);

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

                            {/* Theme tri-state selector to keep follow-system option */}
                            <div className="p-2 pt-0">
                                <div className="inline-flex rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden" role="group" aria-label="Theme selector">
                                    <button
                                        type="button"
                                        onClick={() => setTheme('auto')}
                                        className={`px-3 py-1.5 text-xs font-medium ${themeMode==='auto' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'} border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none`}
                                        aria-pressed={themeMode==='auto'}
                                    >自动</button>
                                    <button
                                        type="button"
                                        onClick={() => setTheme('light')}
                                        className={`px-3 py-1.5 text-xs font-medium ${themeMode==='light' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'} border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none`}
                                        aria-pressed={themeMode==='light'}
                                    >浅色</button>
                                    <button
                                        type="button"
                                        onClick={() => setTheme('dark')}
                                        className={`px-3 py-1.5 text-xs font-medium ${themeMode==='dark' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none`}
                                        aria-pressed={themeMode==='dark'}
                                    >深色</button>
                                </div>
                                { themeMode === 'auto' && (
                                    <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">当前跟随系统</div>
                                ) }
                            </div>
                        </div>

                        {/* Permission Mode Settings */ }
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">权限模式</h4>

                            <div className="space-y-2">
                                { skipPermissions && (
                                    <div
                                        className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-700">
                                        已启用 <code
                                        className="px-1 bg-red-100/70 dark:bg-red-800/40 rounded">--dangerously-skip-permissions</code>，此处的权限模式已被忽略。
                                    </div>
                                ) }
                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="permissionMode"
                                        value="default"
                                        checked={ permissionMode === 'default' }
                                        onChange={ () => handlePermissionModeChange('default') }
                                        disabled={ skipPermissions }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                                        <span
                                            className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400"/>
                                            默认模式
                                        </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            每次使用工具时都会提示权限确认
                                        </p>
                                    </div>
                                </label>

                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="permissionMode"
                                        value="acceptEdits"
                                        checked={ permissionMode === 'acceptEdits' }
                                        onChange={ () => handlePermissionModeChange('acceptEdits') }
                                        disabled={ skipPermissions }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                                        <span
                                            className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                            <Edit3 className="h-4 w-4 text-green-500"/>
                                            接受编辑
                                        </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            自动允许安全的编辑与读取类操作，对潜在危险操作仍会提示
                                        </p>
                                    </div>
                                </label>

                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="permissionMode"
                                        value="bypassPermissions"
                                        checked={ permissionMode === 'bypassPermissions' }
                                        onChange={ () => handlePermissionModeChange('bypassPermissions') }
                                        disabled={ skipPermissions }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                                        <span
                                            className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                            <AlertTriangle className="h-4 w-4 text-orange-500"/>
                                            绕过权限
                                        </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            尽量减少权限提示，但与 --dangerously-skip-permissions 不同，仍会对高风险操作进行保护
                                        </p>
                                    </div>
                                </label>

                                <label
                                    className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <input
                                        type="radio"
                                        name="permissionMode"
                                        value="plan"
                                        checked={ permissionMode === 'plan' }
                                        onChange={ () => handlePermissionModeChange('plan') }
                                        disabled={ skipPermissions }
                                        className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                                    />
                                    <div className="ml-3 flex-1">
                                        <span
                                            className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                            <FileText className="h-4 w-4 text-blue-500"/>
                                            计划模式
                                        </span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            仅生成计划，不直接执行潜在有副作用的操作
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

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