import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
    AlertTriangle,
    Bug,
    Edit3,
    FileText,
    Globe,
    Monitor,
    Moon,
    Play,
    Plus,
    Server,
    Settings,
    Shield,
    Sun,
    Terminal,
    Trash2,
    X,
    Zap
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import DevTools from './DevTools';

function ToolsSettings({ isOpen, onClose }) {
    const { themeMode, setTheme } = useTheme();
    const [allowedTools, setAllowedTools] = useState([]);
    const [disallowedTools, setDisallowedTools] = useState([]);
    const [newAllowedTool, setNewAllowedTool] = useState('');
    const [newDisallowedTool, setNewDisallowedTool] = useState('');
    const [skipPermissions, setSkipPermissions] = useState(false);
    const [permissionMode, setPermissionMode] = useState('default');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [projectSortOrder, setProjectSortOrder] = useState('name');
    const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);

    // MCP server management state
    const [mcpServers, setMcpServers] = useState([]);
    const [showMcpForm, setShowMcpForm] = useState(false);
    const [editingMcpServer, setEditingMcpServer] = useState(null);
    const [mcpFormData, setMcpFormData] = useState({
        name: '',
        type: 'stdio',
        scope: 'user', // Always use user scope
        config: {
            command: '',
            args: [],
            env: {},
            url: '',
            headers: {},
            timeout: 30000
        }
    });
    const [mcpLoading, setMcpLoading] = useState(false);
    const [mcpTestResults, setMcpTestResults] = useState({});
    const [mcpConfigTestResult, setMcpConfigTestResult] = useState(null);
    const [mcpConfigTesting, setMcpConfigTesting] = useState(false);
    const [, setMcpConfigTested] = useState(false);
    const [mcpServerTools, setMcpServerTools] = useState({});
    const [mcpToolsLoading, setMcpToolsLoading] = useState({});
    const [activeTab, setActiveTab] = useState('tools');

    // Persist permission mode immediately and notify listeners
    const persistPermissionMode = (newMode) => {
        try {
            setPermissionMode(newMode);
            const saved = localStorage.getItem('claude-tools-settings');
            let settings = saved ? JSON.parse(saved) : {};
            settings.permissionMode = newMode;
            settings.allowedTools = settings.allowedTools || allowedTools;
            settings.disallowedTools = settings.disallowedTools || disallowedTools;
            settings.skipPermissions = typeof settings.skipPermissions === 'boolean' ? settings.skipPermissions : skipPermissions;
            settings.projectSortOrder = settings.projectSortOrder || projectSortOrder;
            settings.lastUpdated = new Date().toISOString();
            localStorage.setItem('claude-tools-settings', JSON.stringify(settings));
            // Broadcast both granular and generic events
            window.dispatchEvent(new CustomEvent('permissionModeChanged', { detail: { mode: newMode } }));
            window.dispatchEvent(new Event('toolsSettingsChanged'));
        } catch (e) {
            console.error('Failed to persist permission mode:', e);
        }
    };

    // Common tool patterns
    const commonTools = [
        'Bash(git log:*)',
        'Bash(git diff:*)',
        'Bash(git status:*)',
        'Write',
        'Read',
        'Edit',
        'Glob',
        'Grep',
        'MultiEdit',
        'Task',
        'TodoWrite',
        'TodoRead',
        'WebFetch',
        'WebSearch'
    ];

    // MCP API functions
    const fetchMcpServers = async () => {
        try {
            // First try to get servers using Claude CLI
            const cliResponse = await fetch('/api/mcp/cli/list', {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (cliResponse.ok) {
                const cliData = await cliResponse.json();
                if (cliData.success && cliData.servers) {
                    // Convert CLI format to our format
                    const servers = cliData.servers.map(server => ({
                        id: server.name,
                        name: server.name,
                        type: server.type,
                        scope: 'user',
                        config: {
                            command: server.command || '',
                            args: server.args || [],
                            env: server.env || {},
                            url: server.url || '',
                            headers: server.headers || {},
                            timeout: 30000
                        },
                        created: new Date().toISOString(),
                        updated: new Date().toISOString()
                    }));
                    setMcpServers(servers);
                    return;
                }
            }

            // Fallback to direct config reading
            const response = await fetch('/api/mcp/servers?scope=user', {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setMcpServers(data.servers || []);
            } else {
                console.error('Failed to fetch MCP servers');
            }
        } catch (error) {
            console.error('Error fetching MCP servers:', error);
        }
    };

    const saveMcpServer = async (serverData) => {
        try {
            if (editingMcpServer) {
                // For editing, remove old server and add new one
                await deleteMcpServer(editingMcpServer.id, 'user');
            }

            // Use Claude CLI to add the server
            const response = await fetch('/api/mcp/cli/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: serverData.name,
                    type: serverData.type,
                    command: serverData.config?.command,
                    args: serverData.config?.args || [],
                    url: serverData.config?.url,
                    headers: serverData.config?.headers || {},
                    env: serverData.config?.env || {}
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    await fetchMcpServers(); // Refresh the list
                    return true;
                } else {
                    throw new Error(result.error || 'Failed to save server via Claude CLI');
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save server');
            }
        } catch (error) {
            console.error('Error saving MCP server:', error);
            throw error;
        }
    };

    const deleteMcpServer = async (serverId, scope = 'user') => {
        try {
            // Use Claude CLI to remove the server
            const response = await fetch(`/api/mcp/cli/remove/${ serverId }`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    await fetchMcpServers(); // Refresh the list
                    return true;
                } else {
                    throw new Error(result.error || 'Failed to delete server via Claude CLI');
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete server');
            }
        } catch (error) {
            console.error('Error deleting MCP server:', error);
            throw error;
        }
    };

    const testMcpServer = async (serverId, scope = 'user') => {
        try {
            const response = await fetch(`/api/mcp/servers/${ serverId }/test?scope=${ scope }`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.testResult;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to test server');
            }
        } catch (error) {
            console.error('Error testing MCP server:', error);
            throw error;
        }
    };

    const testMcpConfiguration = async (formData) => {
        try {
            const response = await fetch('/api/mcp/servers/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const data = await response.json();
                return data.testResult;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to test configuration');
            }
        } catch (error) {
            console.error('Error testing MCP configuration:', error);
            throw error;
        }
    };

    const discoverMcpTools = async (serverId, scope = 'user') => {
        try {
            const response = await fetch(`/api/mcp/servers/${ serverId }/tools?scope=${ scope }`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.toolsResult;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to discover tools');
            }
        } catch (error) {
            console.error('Error discovering MCP tools:', error);
            throw error;
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    // Note: permissionMode and skipPermissions are independent. When skipPermissions is true,
    // UI that selects permissionMode will be disabled and permissionMode is ignored by runtime.

    const loadSettings = async () => {
        try {
            // Check development mode
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

            // Load from localStorage
            const savedSettings = localStorage.getItem('claude-tools-settings');

            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                setAllowedTools(settings.allowedTools || []);
                setDisallowedTools(settings.disallowedTools || []);
                setSkipPermissions(settings.skipPermissions || false);
                // Map legacy modes to new ones
                let mode = settings.permissionMode || 'default';
                if (mode === 'auto-allow') mode = 'acceptEdits';
                if (mode === 'skip-all') mode = 'bypassPermissions';
                setPermissionMode(mode);
                setProjectSortOrder(settings.projectSortOrder || 'name');
            } else {
                // Set defaults
                setAllowedTools([]);
                setDisallowedTools([]);
                setSkipPermissions(false);
                setPermissionMode('default');
                setProjectSortOrder('name');
            }

            // Load MCP servers from API
            await fetchMcpServers();
        } catch (error) {
            console.error('Error loading tool settings:', error);
            // Set defaults on error
            setAllowedTools([]);
            setDisallowedTools([]);
            setSkipPermissions(false);
            setPermissionMode('default');
            setProjectSortOrder('name');
        }
    };

    const saveSettings = () => {
        setIsSaving(true);
        setSaveStatus(null);

        try {
            const settings = {
                allowedTools,
                disallowedTools,
                skipPermissions,
                permissionMode,
                projectSortOrder,
                lastUpdated: new Date().toISOString()
            };


            // Save to localStorage
            localStorage.setItem('claude-tools-settings', JSON.stringify(settings));
            // Notify other components
            window.dispatchEvent(new Event('toolsSettingsChanged'));

            setSaveStatus('success');

            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (error) {
            console.error('Error saving tool settings:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const addAllowedTool = (tool) => {
        if (tool && !allowedTools.includes(tool)) {
            setAllowedTools([...allowedTools, tool]);
            setNewAllowedTool('');
        }
    };

    const removeAllowedTool = (tool) => {
        setAllowedTools(allowedTools.filter(t => t !== tool));
    };

    const addDisallowedTool = (tool) => {
        if (tool && !disallowedTools.includes(tool)) {
            setDisallowedTools([...disallowedTools, tool]);
            setNewDisallowedTool('');
        }
    };

    const removeDisallowedTool = (tool) => {
        setDisallowedTools(disallowedTools.filter(t => t !== tool));
    };

    // MCP form handling functions
    const resetMcpForm = () => {
        setMcpFormData({
            name: '',
            type: 'stdio',
            scope: 'user', // Always use user scope
            config: {
                command: '',
                args: [],
                env: {},
                url: '',
                headers: {},
                timeout: 30000
            }
        });
        setEditingMcpServer(null);
        setShowMcpForm(false);
        setMcpConfigTestResult(null);
        setMcpConfigTested(false);
        setMcpConfigTesting(false);
    };

    const openMcpForm = (server = null) => {
        if (server) {
            setEditingMcpServer(server);
            setMcpFormData({
                name: server.name,
                type: server.type,
                scope: server.scope,
                config: { ...server.config }
            });
        } else {
            resetMcpForm();
        }
        setShowMcpForm(true);
    };

    const handleMcpSubmit = async (e) => {
        e.preventDefault();

        setMcpLoading(true);

        try {
            await saveMcpServer(mcpFormData);
            resetMcpForm();
            setSaveStatus('success');
        } catch (error) {
            alert(`Error: ${ error.message }`);
            setSaveStatus('error');
        } finally {
            setMcpLoading(false);
        }
    };

    const handleMcpDelete = async (serverId, scope) => {
        if (confirm('确定要删除这个 MCP 服务器吗？')) {
            try {
                await deleteMcpServer(serverId, scope);
                setSaveStatus('success');
            } catch (error) {
                alert(`Error: ${ error.message }`);
                setSaveStatus('error');
            }
        }
    };

    const handleMcpTest = async (serverId, scope) => {
        try {
            setMcpTestResults({ ...mcpTestResults, [serverId]: { loading: true } });
            const result = await testMcpServer(serverId, scope);
            setMcpTestResults({ ...mcpTestResults, [serverId]: result });
        } catch (error) {
            setMcpTestResults({
                ...mcpTestResults,
                [serverId]: {
                    success: false,
                    message: error.message,
                    details: []
                }
            });
        }
    };

    const handleMcpToolsDiscovery = async (serverId, scope) => {
        try {
            setMcpToolsLoading({ ...mcpToolsLoading, [serverId]: true });
            const result = await discoverMcpTools(serverId, scope);
            setMcpServerTools({ ...mcpServerTools, [serverId]: result });
        } catch (error) {
            setMcpServerTools({
                ...mcpServerTools,
                [serverId]: {
                    success: false,
                    tools: [],
                    resources: [],
                    prompts: []
                }
            });
        } finally {
            setMcpToolsLoading({ ...mcpToolsLoading, [serverId]: false });
        }
    };

    const updateMcpConfig = (key, value) => {
        setMcpFormData(prev => ({
            ...prev,
            config: {
                ...prev.config,
                [key]: value
            }
        }));
        // Reset test status when configuration changes
        setMcpConfigTestResult(null);
        setMcpConfigTested(false);
    };

    const handleTestConfiguration = async () => {
        setMcpConfigTesting(true);
        try {
            const result = await testMcpConfiguration(mcpFormData);
            setMcpConfigTestResult(result);
            setMcpConfigTested(true);
        } catch (error) {
            setMcpConfigTestResult({
                success: false,
                message: error.message,
                details: []
            });
            setMcpConfigTested(true);
        } finally {
            setMcpConfigTesting(false);
        }
    };

    const getTransportIcon = (type) => {
        switch (type) {
            case 'stdio':
                return <Terminal className="w-4 h-4"/>;
            case 'sse':
                return <Zap className="w-4 h-4"/>;
            case 'http':
                return <Globe className="w-4 h-4"/>;
            default:
                return <Server className="w-4 h-4"/>;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop fixed inset-0 flex items-center justify-center z-[100] md:p-4 bg-black/50">
            <div
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 md:rounded-lg shadow-xl w-full md:max-w-4xl h-full md:h-[90vh] flex flex-col">
                <div
                    className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/>
                        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                            设置
                        </h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={ onClose }
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white touch-manipulation"
                    >
                        <X className="w-5 h-5"/>
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Tab Navigation */ }
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <div className="flex px-4 md:px-6 overflow-x-auto">
                            <button
                                onClick={ () => setActiveTab('tools') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-manipulation ${
                                    activeTab === 'tools'
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                工具
                            </button>
                            <button
                                onClick={ () => setActiveTab('security') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-manipulation ${
                                    activeTab === 'security'
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                安全项
                            </button>
                            <button
                                onClick={ () => setActiveTab('mcp') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-manipulation ${
                                    activeTab === 'mcp'
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                MCP
                            </button>
                            <button
                                onClick={ () => setActiveTab('appearance') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-manipulation ${
                                    activeTab === 'appearance'
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                外观
                            </button>
                            {/* Only show developer tab in development mode */ }
                            { isDevelopmentMode && (
                                <button
                                    onClick={ () => setActiveTab('developer') }
                                    className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors touch-manipulation ${
                                        activeTab === 'developer'
                                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                    }` }
                                >
                                    开发者
                                </button>
                            ) }
                        </div>
                    </div>

                    <div className="p-4 md:p-6 space-y-6 md:space-y-8 pb-safe-area-inset-bottom">
                        {/* Security Tab */ }
                        { activeTab === 'security' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Permission Mode */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-5 h-5 text-blue-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            权限模式
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div
                                            className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <div>
                                                <div className="font-medium text-foreground mb-3">
                                                    权限处理模式
                                                </div>
                                                <div className="text-sm text-muted-foreground mb-4">
                                                    选择工具权限的处理方式（当启用 --dangerously-skip-permissions
                                                    时，此设置将被忽略）
                                                </div>
                                                { skipPermissions && (
                                                    <div
                                                        className="mb-3 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-700">
                                                        已启用 <code
                                                        className="px-1 bg-red-100/70 dark:bg-red-800/40 rounded">--dangerously-skip-permissions</code>，权限模式已被忽略。请在下方关闭以恢复。
                                                    </div>
                                                ) }
                                                <div className="space-y-3">
                                                    {/* Default Mode */ }
                                                    <label className="flex items-center space-x-3 cursor-pointer">
                                                        <input type="radio" name="permissionMode" value="default"
                                                               checked={ permissionMode === 'default' }
                                                               onChange={ (e) => e.target.checked && persistPermissionMode('default') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"/>
                                                        <div className="flex items-center space-x-2">
                                                            <Shield
                                                                className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                                                            <span
                                                                className="text-sm text-gray-700 dark:text-gray-300">默认模式</span>
                                                        </div>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">每次使用工具时都会提示权限确认</p>
                                                    {/* Accept Edits Mode */ }
                                                    <label className="flex items-center space-x-3 cursor-pointer">
                                                        <input type="radio" name="permissionMode" value="acceptEdits"
                                                               checked={ permissionMode === 'acceptEdits' }
                                                               onChange={ (e) => e.target.checked && persistPermissionMode('acceptEdits') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"/>
                                                        <div className="flex items-center space-x-2">
                                                            <Edit3 className="w-4 h-4 text-green-500"/>
                                                            <span
                                                                className="text-sm text-gray-700 dark:text-gray-300">接受编辑</span>
                                                        </div>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">自动允许安全的编辑与读取类操作，对潜在危险操作仍会提示</p>
                                                    {/* Bypass Permissions Mode */ }
                                                    <label className="flex items-center space-x-3 cursor-pointer">
                                                        <input type="radio" name="permissionMode"
                                                               value="bypassPermissions"
                                                               checked={ permissionMode === 'bypassPermissions' }
                                                               onChange={ (e) => e.target.checked && persistPermissionMode('bypassPermissions') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"/>
                                                        <div className="flex items-center space-x-2">
                                                            <AlertTriangle className="w-4 h-4 text-orange-500"/>
                                                            <span
                                                                className="text-sm text-gray-700 dark:text-gray-300">绕过权限</span>
                                                        </div>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">尽量减少权限提示，但与 <code
                                                        className="px-1 bg-gray-100 dark:bg-gray-800 rounded">--dangerously-skip-permissions</code> 不同，仍会对高风险操作进行保护
                                                    </p>
                                                    {/* Plan Mode */ }
                                                    <label className="flex items-center space-x-3 cursor-pointer">
                                                        <input type="radio" name="permissionMode" value="plan"
                                                               checked={ permissionMode === 'plan' }
                                                               onChange={ (e) => e.target.checked && persistPermissionMode('plan') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"/>
                                                        <div className="flex items-center space-x-2">
                                                            <FileText className="w-4 h-4 text-blue-500"/>
                                                            <span
                                                                className="text-sm text-gray-700 dark:text-gray-300">计划模式</span>
                                                        </div>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">仅生成计划，不直接执行潜在有副作用的操作</p>{/* Plan Mode */ }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Dangerous Skip Permissions */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-orange-500"/>
                                        <h3 className="text-lg font-medium text-foreground">危险选项</h3>
                                    </div>
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div className="text-sm text-muted-foreground mb-3">高危设置，请谨慎使用</div>
                                        <div
                                            className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                                            <label className="flex items-center gap-3">
                                                <input type="checkbox" checked={ skipPermissions } onChange={ (e) => {
                                                    const checked = e.target.checked;
                                                    if (checked) {
                                                        const first = confirm('危险操作：即将启用 --dangerously-skip-permissions。启用后将跳过所有权限确认，工具可能在无提示的情况下修改/删除文件、执行命令。确定继续？');
                                                        if (!first) {
                                                            e.preventDefault();
                                                            return;
                                                        }
                                                        const second = confirm('再次确认：您确实要启用完全跳过权限提示吗？此选项极其危险，仅在完全信任的项目与环境中使用。');
                                                        if (!second) {
                                                            e.preventDefault();
                                                            return;
                                                        }
                                                    }
                                                    const newValue = !!checked;
                                                    setSkipPermissions(newValue);
                                                    try {
                                                        const saved = localStorage.getItem('claude-tools-settings');
                                                        let settings = saved ? JSON.parse(saved) : {};
                                                        settings.skipPermissions = newValue;
                                                        settings.permissionMode = settings.permissionMode || permissionMode;
                                                        settings.allowedTools = settings.allowedTools || allowedTools;
                                                        settings.disallowedTools = settings.disallowedTools || disallowedTools;
                                                        settings.projectSortOrder = settings.projectSortOrder || projectSortOrder;
                                                        settings.lastUpdated = new Date().toISOString();
                                                        localStorage.setItem('claude-tools-settings', JSON.stringify(settings));
                                                        window.dispatchEvent(new Event('toolsSettingsChanged'));
                                                    } catch (err) {
                                                        console.error('Failed to persist skipPermissions:', err);
                                                    }
                                                } }
                                                       className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"/>
                                                <div>
                                                    <div
                                                        className="font-medium text-orange-900 dark:text-orange-100">跳过所有权限提示（极度危险）
                                                    </div>
                                                    <div
                                                        className="text-sm text-orange-700 dark:text-orange-300">等同于 <code
                                                        className="px-1 bg-orange-100 dark:bg-orange-800/40 rounded">--dangerously-skip-permissions</code> 标志。启用后，权限模式将被忽略。
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) }
                        {/* Appearance Tab */ }
                        { activeTab === 'appearance' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Theme Settings */ }
                                <div className="space-y-4">
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div>
                                            <div className="font-medium text-foreground mb-3">
                                                主题设置
                                            </div>
                                            <div className="text-sm text-muted-foreground mb-4">
                                                选择应用程序的外观主题
                                            </div>
                                            <div className="space-y-3">
                                                {/* Auto Theme */ }
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="theme"
                                                        value="auto"
                                                        checked={ themeMode === 'auto' }
                                                        onChange={ (e) => e.target.checked && setTheme('auto') }
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div className="flex items-center space-x-2">
                                                        <Monitor className="w-4 h-4 text-gray-600 dark:text-gray-400"/>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                                    自动 (跟随系统)
                                                                </span>
                                                    </div>
                                                </label>

                                                {/* Light Theme */ }
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="theme"
                                                        value="light"
                                                        checked={ themeMode === 'light' }
                                                        onChange={ (e) => e.target.checked && setTheme('light') }
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div className="flex items-center space-x-2">
                                                        <Sun className="w-4 h-4 text-yellow-500"/>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                                    浅色主题
                                                                </span>
                                                    </div>
                                                </label>

                                                {/* Dark Theme */ }
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="theme"
                                                        value="dark"
                                                        checked={ themeMode === 'dark' }
                                                        onChange={ (e) => e.target.checked && setTheme('dark') }
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div className="flex items-center space-x-2">
                                                        <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400"/>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                                    深色主题
                                                                </span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Project Sorting */ }
                                <div className="space-y-4">
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    项目排序
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    侧边栏中项目的排序方式
                                                </div>
                                            </div>
                                            <select
                                                value={ projectSortOrder }
                                                onChange={ (e) => setProjectSortOrder(e.target.value) }
                                                className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 w-32"
                                            >
                                                <option value="name">按字母顺序</option>
                                                <option value="date">按最近活动</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) }

                        {/* Developer Tab - Only visible in development mode */ }
                        { activeTab === 'developer' && isDevelopmentMode && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Developer Tools */ }
                                <div className="space-y-4">
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div>
                                            <div className="font-medium text-foreground mb-3 flex items-center gap-2">
                                                <Bug className="w-4 h-4"/>
                                                开发者工具
                                            </div>
                                            <div className="text-sm text-muted-foreground mb-4">
                                                访问浏览器开发者控制台和调试工具
                                            </div>

                                            <DevTools className="mb-4"/>

                                            <div
                                                className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                                <div className="font-medium mb-2">使用提示：</div>
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li>在 Electron 应用中，您可以使用上方按钮控制开发者工具的显示</li>
                                                    <li>在浏览器中，请使用 F12 键或右键菜单访问开发者工具</li>
                                                    <li>Console 面板可以查看日志输出和执行 JavaScript 代码</li>
                                                    <li>Network 面板可以监控网络请求</li>
                                                    <li>Elements 面板可以检查和修改 DOM 结构</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Debug Information */ }
                                <div className="space-y-4">
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div>
                                            <div className="font-medium text-foreground mb-3 flex items-center gap-2">
                                                <Terminal className="w-4 h-4"/>
                                                环境信息
                                            </div>
                                            <div className="text-sm text-muted-foreground mb-4">
                                                当前应用运行环境的详细信息
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">运行环境:</span>
                                                        <span className="font-mono">
                                                            { window.electronAPI ? 'Electron Desktop' : 'Web Browser' }
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">用户代理:</span>
                                                        <span className="font-mono text-xs truncate max-w-32"
                                                              title={ navigator.userAgent }>
                                                            { navigator.userAgent.split(' ')[0] }
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">窗口尺寸:</span>
                                                        <span className="font-mono">
                                                            { window.innerWidth } × { window.innerHeight }
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">开发模式:</span>
                                                        <span className="font-mono text-green-600">
                                                            { isDevelopmentMode ? '是' : '否' }
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">语言:</span>
                                                        <span className="font-mono">
                                                            { navigator.language }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) }

                        {/* Tools Tab */ }
                        { activeTab === 'tools' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* 允许的工具 */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-5 h-5 text-green-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            允许的工具
                                        </h3>
                                    </div>
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <p className="text-sm text-muted-foreground mb-4">
                                            无需提示权限即可自动允许的工具
                                        </p>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                value={ newAllowedTool }
                                                onChange={ (e) => setNewAllowedTool(e.target.value) }
                                                placeholder='e.g., "Bash(git log:*)" or "Write"'
                                                onKeyPress={ (e) => {
                                                    if (e.key === 'Enter') {
                                                        addAllowedTool(newAllowedTool);
                                                    }
                                                } }
                                                className="flex-1 h-10 touch-manipulation"
                                                style={ { fontSize: '16px' } }
                                            />
                                            <Button
                                                onClick={ () => addAllowedTool(newAllowedTool) }
                                                disabled={ !newAllowedTool }
                                                size="sm"
                                                className="h-10 px-4 touch-manipulation"
                                            >
                                                <Plus className="w-4 h-4 mr-2 sm:mr-0"/>
                                                <span className="sm:hidden">Add Tool</span>
                                            </Button>
                                        </div>

                                        {/* Common tools quick add */ }
                                        <div className="space-y-2 mt-4">
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                快速添加常用工具：
                                            </p>
                                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                                                { commonTools.map(tool => (
                                                    <Button
                                                        key={ tool }
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={ () => addAllowedTool(tool) }
                                                        disabled={ allowedTools.includes(tool) }
                                                        className="text-xs h-8 touch-manipulation truncate"
                                                    >
                                                        { tool }
                                                    </Button>
                                                )) }
                                            </div>
                                        </div>

                                        <div className="space-y-2 mt-4">
                                            { allowedTools.map(tool => (
                                                <div key={ tool }
                                                     className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                                                    <span
                                                        className="font-mono text-sm text-green-800 dark:text-green-200">
                                                      { tool }
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={ () => removeAllowedTool(tool) }
                                                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                                    >
                                                        <X className="w-4 h-4"/>
                                                    </Button>
                                                </div>
                                            )) }
                                            { allowedTools.length === 0 && (
                                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                                    未配置允许的工具
                                                </div>
                                            ) }
                                        </div>
                                    </div>
                                </div>

                                {/* 禁用的工具 */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            禁用的工具
                                        </h3>
                                    </div>
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <p className="text-sm text-muted-foreground mb-4">
                                            无需提示权限即可自动阻止的工具
                                        </p>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                value={ newDisallowedTool }
                                                onChange={ (e) => setNewDisallowedTool(e.target.value) }
                                                placeholder='e.g., "Bash(rm:*)" or "Write"'
                                                onKeyPress={ (e) => {
                                                    if (e.key === 'Enter') {
                                                        addDisallowedTool(newDisallowedTool);
                                                    }
                                                } }
                                                className="flex-1 h-10 touch-manipulation"
                                                style={ { fontSize: '16px' } }
                                            />
                                            <Button
                                                onClick={ () => addDisallowedTool(newDisallowedTool) }
                                                disabled={ !newDisallowedTool }
                                                size="sm"
                                                className="h-10 px-4 touch-manipulation"
                                            >
                                                <Plus className="w-4 h-4 mr-2 sm:mr-0"/>
                                                <span className="sm:hidden">Add Tool</span>
                                            </Button>
                                        </div>

                                        <div className="space-y-2 mt-4">
                                            { disallowedTools.map(tool => (
                                                <div key={ tool }
                                                     className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                                    <span className="font-mono text-sm text-red-800 dark:text-red-200">
                                                      { tool }
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={ () => removeDisallowedTool(tool) }
                                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                    >
                                                        <X className="w-4 h-4"/>
                                                    </Button>
                                                </div>
                                            )) }
                                            { disallowedTools.length === 0 && (
                                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                                    未配置禁用的工具
                                                </div>
                                            ) }
                                        </div>
                                    </div>
                                </div>

                                {/* Help Section */ }
                                <div
                                    className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                                        工具模式示例：
                                    </h4>
                                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(git
                                            log:*)"</code> - 允许所有 git log 命令
                                        </li>
                                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(git
                                            diff:*)"</code> - 允许所有 git diff 命令
                                        </li>
                                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Write"</code> -
                                            允许所有写入工具使用
                                        </li>
                                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Read"</code> -
                                            允许所有读取工具使用
                                        </li>
                                        <li><code
                                            className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(rm:*)"</code> -
                                            阻止所有 rm 命令（危险）
                                        </li>
                                    </ul>
                                </div>

                            </div>
                        ) }

                        {/* MCP Tab */ }
                        { activeTab === 'mcp' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* MCP Server Management */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Server className="w-5 h-5 text-purple-500"/>
                                        <h3 className="text-lg font-medium text-foreground">MCP 服务器</h3>
                                    </div>
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">模型上下文协议服务器为 Claude
                                                提供额外的工具和数据源</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <Button onClick={ () => openMcpForm() }
                                                    className="bg-purple-600 hover:bg-purple-700 text-white" size="sm">
                                                <Plus className="w-4 h-4 mr-2"/>添加 MCP 服务器
                                            </Button>
                                        </div>
                                        {/* MCP Servers List */ }
                                        <div className="space-y-2">
                                            { mcpServers.map(server => (
                                                <div key={ server.id }
                                                     className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                { getTransportIcon(server.type) }
                                                                <span
                                                                    className="font-medium text-foreground">{ server.name }</span>
                                                                <Badge variant="outline"
                                                                       className="text-xs">{ server.type }</Badge>
                                                                <Badge variant="outline"
                                                                       className="text-xs">{ server.scope }</Badge>
                                                            </div>
                                                            <div className="text-sm text-muted-foreground space-y-1">
                                                                { server.type === 'stdio' && server.config.command && (
                                                                    <div>Command: <code
                                                                        className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{ server.config.command }</code>
                                                                    </div>) }
                                                                { (server.type === 'sse' || server.type === 'http') && server.config.url && (
                                                                    <div>URL: <code
                                                                        className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{ server.config.url }</code>
                                                                    </div>) }
                                                                { server.config.args && server.config.args.length > 0 && (
                                                                    <div>Args: <code
                                                                        className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{ server.config.args.join(' ') }</code>
                                                                    </div>) }
                                                            </div>
                                                            {/* Test Results */ }
                                                            { mcpTestResults[server.id] && (
                                                                <div
                                                                    className={ `mt-2 p-2 rounded text-xs ${ mcpTestResults[server.id].success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200' }` }>
                                                                    <div
                                                                        className="font-medium">{ mcpTestResults[server.id].message }</div>
                                                                    { mcpTestResults[server.id].details && mcpTestResults[server.id].details.length > 0 && (
                                                                        <ul className="mt-1 space-y-0.5">
                                                                            { mcpTestResults[server.id].details.map((detail, i) => (
                                                                                <li key={ i }>• { detail }</li>)) }
                                                                        </ul>
                                                                    ) }
                                                                </div>
                                                            ) }
                                                            {/* Tools Discovery Results */ }
                                                            { mcpServerTools[server.id] && (
                                                                <div
                                                                    className="mt-2 p-2 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                                                                    <div className="font-medium mb-2">Available Tools &
                                                                        Resources
                                                                    </div>
                                                                    { mcpServerTools[server.id].tools && mcpServerTools[server.id].tools.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <div
                                                                                className="font-medium text-xs mb-1">Tools
                                                                                ({ mcpServerTools[server.id].tools.length }):
                                                                            </div>
                                                                            <ul className="space-y-0.5">
                                                                                { mcpServerTools[server.id].tools.map((tool, i) => (
                                                                                    <li key={ i }
                                                                                        className="flex items-start gap-1">
                                                                                        <span
                                                                                            className="text-blue-400 mt-0.5">•</span>
                                                                                        <div>
                                                                                            <code
                                                                                                className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{ tool.name }</code>
                                                                                            { tool.description && tool.description !== 'No description provided' && (
                                                                                                <span
                                                                                                    className="ml-1 text-xs opacity-75">- { tool.description }</span>) }
                                                                                        </div>
                                                                                    </li>
                                                                                )) }
                                                                            </ul>
                                                                        </div>
                                                                    ) }
                                                                    { mcpServerTools[server.id].resources && mcpServerTools[server.id].resources.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <div
                                                                                className="font-medium text-xs mb-1">Resources
                                                                                ({ mcpServerTools[server.id].resources.length }):
                                                                            </div>
                                                                            <ul className="space-y-0.5">
                                                                                { mcpServerTools[server.id].resources.map((resource, i) => (
                                                                                    <li key={ i }
                                                                                        className="flex items-start gap-1">
                                                                                        <span
                                                                                            className="text-blue-400 mt-0.5">•</span>
                                                                                        <div>
                                                                                            <code
                                                                                                className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{ resource.name }</code>
                                                                                            { resource.description && resource.description !== 'No description provided' && (
                                                                                                <span
                                                                                                    className="ml-1 text-xs opacity-75">- { resource.description }</span>) }
                                                                                        </div>
                                                                                    </li>
                                                                                )) }
                                                                            </ul>
                                                                        </div>
                                                                    ) }
                                                                    { mcpServerTools[server.id].prompts && mcpServerTools[server.id].prompts.length > 0 && (
                                                                        <div>
                                                                            <div
                                                                                className="font-medium text-xs mb-1">Prompts
                                                                                ({ mcpServerTools[server.id].prompts.length }):
                                                                            </div>
                                                                            <ul className="space-y-0.5">
                                                                                { mcpServerTools[server.id].prompts.map((prompt, i) => (
                                                                                    <li key={ i }
                                                                                        className="flex items-start gap-1">
                                                                                        <span
                                                                                            className="text-blue-400 mt-0.5">•</span>
                                                                                        <div>
                                                                                            <code
                                                                                                className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{ prompt.name }</code>
                                                                                            { prompt.description && prompt.description !== 'No description provided' && (
                                                                                                <span
                                                                                                    className="ml-1 text-xs opacity-75">- { prompt.description }</span>) }
                                                                                        </div>
                                                                                    </li>
                                                                                )) }
                                                                            </ul>
                                                                        </div>
                                                                    ) }
                                                                    { (!mcpServerTools[server.id].tools || mcpServerTools[server.id].tools.length === 0) && (!mcpServerTools[server.id].resources || mcpServerTools[server.id].resources.length === 0) && (!mcpServerTools[server.id].prompts || mcpServerTools[server.id].prompts.length === 0) && (
                                                                        <div className="text-xs opacity-75">No tools,
                                                                            resources, or prompts discovered</div>
                                                                    ) }
                                                                </div>
                                                            ) }
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-4">
                                                            <Button
                                                                onClick={ () => handleMcpTest(server.id, server.scope) }
                                                                variant="ghost" size="sm"
                                                                disabled={ mcpTestResults[server.id]?.loading }
                                                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                                title="Test connection">
                                                                { mcpTestResults[server.id]?.loading ? (<div
                                                                    className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"/>) : (
                                                                    <Play className="w-4 h-4"/>) }
                                                            </Button>
                                                            <Button
                                                                onClick={ () => handleMcpToolsDiscovery(server.id, server.scope) }
                                                                variant="ghost" size="sm"
                                                                disabled={ mcpToolsLoading[server.id] }
                                                                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                                                                title="Discover tools">
                                                                { mcpToolsLoading[server.id] ? (<div
                                                                    className="w-4 h-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent"/>) : (
                                                                    <Settings className="w-4 h-4"/>) }
                                                            </Button>
                                                            <Button onClick={ () => openMcpForm(server) }
                                                                    variant="ghost" size="sm"
                                                                    className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                                                                <Edit3 className="w-4 h-4"/>
                                                            </Button>
                                                            <Button
                                                                onClick={ () => handleMcpDelete(server.id, server.scope) }
                                                                variant="ghost" size="sm"
                                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                                                                <Trash2 className="w-4 h-4"/>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )) }
                                            { mcpServers.length === 0 && (
                                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">未配置
                                                    MCP 服务器</div>) }
                                        </div>
                                    </div>
                                </div>

                                {/* MCP Server Form Modal */ }
                                { showMcpForm && (
                                    <div
                                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
                                        <div
                                            className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <div
                                                className="flex items-center justify-between p-4 border-b border-border">
                                                <h3 className="text-lg font-medium text-foreground">{ editingMcpServer ? '编辑 MCP 服务器' : '添加 MCP 服务器' }</h3>
                                                <Button variant="ghost" size="sm" onClick={ resetMcpForm }>
                                                    <X className="w-4 h-4"/>
                                                </Button>
                                            </div>
                                            <form onSubmit={ handleMcpSubmit } className="p-4 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label
                                                            className="block text-sm font-medium text-foreground mb-2">服务器名称
                                                            *</label>
                                                        <Input value={ mcpFormData.name } onChange={ (e) => {
                                                            setMcpFormData(prev => ({ ...prev, name: e.target.value }));
                                                            setMcpConfigTestResult(null);
                                                            setMcpConfigTested(false);
                                                        } } placeholder="my-server" required/>
                                                    </div>
                                                    <div>
                                                        <label
                                                            className="block text-sm font-medium text-foreground mb-2">传输类型
                                                            *</label>
                                                        <select value={ mcpFormData.type } onChange={ (e) => {
                                                            setMcpFormData(prev => ({ ...prev, type: e.target.value }));
                                                            setMcpConfigTestResult(null);
                                                            setMcpConfigTested(false);
                                                        } }
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                                                            <option value="stdio">stdio</option>
                                                            <option value="sse">SSE</option>
                                                            <option value="http">HTTP</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                { mcpFormData.type === 'stdio' && (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label
                                                                className="block text-sm font-medium text-foreground mb-2">命令
                                                                *</label>
                                                            <Input value={ mcpFormData.config.command }
                                                                   onChange={ (e) => updateMcpConfig('command', e.target.value) }
                                                                   placeholder="/path/to/mcp-server" required/>
                                                        </div>
                                                        <div>
                                                            <label
                                                                className="block text-sm font-medium text-foreground mb-2">参数（每行一个）</label>
                                                            <textarea
                                                                value={ Array.isArray(mcpFormData.config.args) ? mcpFormData.config.args.join('\n') : '' }
                                                                onChange={ (e) => updateMcpConfig('args', e.target.value.split('\n').filter(arg => arg.trim())) }
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                                                rows="3" placeholder="--api-key&#10;abc123"/>
                                                        </div>
                                                    </div>
                                                ) }
                                                { (mcpFormData.type === 'sse' || mcpFormData.type === 'http') && (
                                                    <div>
                                                        <label
                                                            className="block text-sm font-medium text-foreground mb-2">URL
                                                            *</label>
                                                        <Input value={ mcpFormData.config.url }
                                                               onChange={ (e) => updateMcpConfig('url', e.target.value) }
                                                               placeholder="https://api.example.com/mcp" type="url"
                                                               required/>
                                                    </div>
                                                ) }
                                                <div>
                                                    <label
                                                        className="block text-sm font-medium text-foreground mb-2">环境变量（KEY=value，每行一个）</label>
                                                    <textarea
                                                        value={ Object.entries(mcpFormData.config.env || {}).map(([k, v]) => `${ k }=${ v }`).join('\n') }
                                                        onChange={ (e) => {
                                                            const env = {};
                                                            e.target.value.split('\n').forEach(line => {
                                                                const [key, ...valueParts] = line.split('=');
                                                                if (key && key.trim()) {
                                                                    env[key.trim()] = valueParts.join('=').trim();
                                                                }
                                                            });
                                                            updateMcpConfig('env', env);
                                                        } }
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                                        rows="3" placeholder="API_KEY=your-key&#10;DEBUG=true"/>
                                                </div>
                                                { (mcpFormData.type === 'sse' || mcpFormData.type === 'http') && (
                                                    <div>
                                                        <label
                                                            className="block text-sm font-medium text-foreground mb-2">请求头（KEY=value，每行一个）</label>
                                                        <textarea
                                                            value={ Object.entries(mcpFormData.config.headers || {}).map(([k, v]) => `${ k }=${ v }`).join('\n') }
                                                            onChange={ (e) => {
                                                                const headers = {};
                                                                e.target.value.split('\n').forEach(line => {
                                                                    const [key, ...valueParts] = line.split('=');
                                                                    if (key && key.trim()) {
                                                                        headers[key.trim()] = valueParts.join('=').trim();
                                                                    }
                                                                });
                                                                updateMcpConfig('headers', headers);
                                                            } }
                                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                                            rows="3"
                                                            placeholder="Authorization=Bearer token&#10;X-API-Key=your-key"/>
                                                    </div>
                                                ) }
                                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="font-medium text-foreground">配置测试</h4>
                                                        <Button type="button" onClick={ handleTestConfiguration }
                                                                disabled={ mcpConfigTesting || !mcpFormData.name.trim() }
                                                                variant="outline" size="sm"
                                                                className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                                            { mcpConfigTesting ? (<>
                                                                <div
                                                                    className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2"/>
                                                                测试中...</>) : (<><Play
                                                                className="w-4 h-4 mr-2"/>测试配置</>) }
                                                        </Button>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mb-3">您可以测试配置以验证其是否正常工作。</p>
                                                    { mcpConfigTestResult && (
                                                        <div
                                                            className={ `p-3 rounded-lg text-sm ${ mcpConfigTestResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800' }` }>
                                                            <div className="font-medium flex items-center gap-2">
                                                                { mcpConfigTestResult.success ? (
                                                                    <svg className="w-4 h-4" fill="currentColor"
                                                                         viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd"
                                                                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                              clipRule="evenodd"/>
                                                                    </svg>) : (
                                                                    <svg className="w-4 h-4" fill="currentColor"
                                                                         viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd"
                                                                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                                              clipRule="evenodd"/>
                                                                    </svg>) }
                                                                { mcpConfigTestResult.message }
                                                            </div>
                                                            { mcpConfigTestResult.details && mcpConfigTestResult.details.length > 0 && (
                                                                <ul className="mt-2 space-y-1 text-xs">
                                                                    { mcpConfigTestResult.details.map((detail, i) => (
                                                                        <li key={ i }
                                                                            className="flex items-start gap-1"><span
                                                                            className="text-gray-400 mt-0.5">•</span><span>{ detail }</span>
                                                                        </li>)) }
                                                                </ul>
                                                            ) }
                                                        </div>
                                                    ) }
                                                </div>
                                                <div className="flex justify-end gap-2 pt-4">
                                                    <Button type="button" variant="outline"
                                                            onClick={ resetMcpForm }>取消</Button>
                                                    <Button type="submit" disabled={ mcpLoading }
                                                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50">{ mcpLoading ? '保存中...' : (editingMcpServer ? '更新服务器' : '添加服务器') }</Button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                ) }
                            </div>
                        ) }
                    </div>
                </div>

                <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 gap-3 pb-safe-area-inset-bottom">
                    <div className="flex items-center justify-center sm:justify-start gap-2 order-2 sm:order-1">
                        { saveStatus === 'success' && (
                            <div className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"/>
                                </svg>
                                设置保存成功！
                            </div>
                        ) }
                        { saveStatus === 'error' && (
                            <div className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                          clipRule="evenodd"/>
                                </svg>
                                保存设置失败
                            </div>
                        ) }
                    </div>
                    <div className="flex items-center gap-3 order-1 sm:order-2">
                        <Button
                            variant="outline"
                            onClick={ onClose }
                            disabled={ isSaving }
                            className="flex-1 sm:flex-none h-10 touch-manipulation"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={ saveSettings }
                            disabled={ isSaving }
                            className="flex-1 sm:flex-none h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 touch-manipulation"
                        >
                            { isSaving ? (
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                                    保存中...
                                </div>
                            ) : (
                                '保存设置'
                            ) }
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ToolsSettings;
