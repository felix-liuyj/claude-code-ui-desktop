import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { apiFetch, api } from '../utils/api';
import {
    AlertTriangle,
    Bug,
    Edit3,
    Eye,
    EyeOff,
    FileText,
    GitBranch,
    Globe,
    Languages,
    MessageCircle,
    Monitor,
    Moon,
    Play,
    Plus,
    Save,
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
import { LazyUsageMonitor } from './UsageMonitor/LazyUsageMonitor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

function ToolsSettings({ isOpen, onClose }) {
    const { themeMode, setTheme } = useTheme();
    const [allowedTools, setAllowedTools] = useState([]);
    const [disallowedTools, setDisallowedTools] = useState([]);
    const [newAllowedTool, setNewAllowedTool] = useState('');
    const [newDisallowedTool, setNewDisallowedTool] = useState('');
    const [skipPermissions, setSkipPermissions] = useState(false);
    const [permissionMode, setPermissionMode] = useState('default');
    const [projectSortOrder, setProjectSortOrder] = useState('name');
    const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
    
    // Track changes for individual sections
    const [toolsChanged, setToolsChanged] = useState(false);
    const [mcpChanged, setMcpChanged] = useState(false);

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
    // Appearance: custom chat background image (data URL or relative path)
    const [chatBgImage, setChatBgImage] = useState('');
    // New: user avatar (data URL)
    const [userAvatar, setUserAvatar] = useState('');
    
    // App info state
    const [appInfo, setAppInfo] = useState(null);
    const [appInfoLoading, setAppInfoLoading] = useState(false);
    const [appInfoError, setAppInfoError] = useState(null);

    // Memory state
    const [globalMemoryPreview, setGlobalMemoryPreview] = useState('');
    const [globalMemoryEditMode, setGlobalMemoryEditMode] = useState(false);
    const [globalMemoryContent, setGlobalMemoryContent] = useState('');
    const [globalMemoryOriginal, setGlobalMemoryOriginal] = useState('');
    const [globalMemorySaving, setGlobalMemorySaving] = useState(false);

    // Git configuration state
    const [gitCommitLanguage, setGitCommitLanguage] = useState('chinese');
    const [gitCommitStandard, setGitCommitStandard] = useState('conventional');
    const [gitClaudeIntegration, setGitClaudeIntegration] = useState(true);

    // Function to fetch app information
    const fetchAppInfo = async () => {
        if (appInfoLoading) return;
        
        setAppInfoLoading(true);
        setAppInfoError(null);
        
        try {
            const response = await api.getAppInfo();
            const result = await response.json();
            
            if (result.success) {
                setAppInfo(result.data);
            } else {
                setAppInfoError(result.error || 'Failed to fetch app info');
            }
        } catch (error) {
            console.error('Failed to fetch app info:', error);
            setAppInfoError(error.message);
        } finally {
            setAppInfoLoading(false);
        }
    };

    // Function to load global memory preview
    const loadGlobalMemoryPreview = async () => {
        try {
            const response = await api.getGlobalMemory();
            const data = await response.json();
            const content = data.content || '';
            setGlobalMemoryPreview(content || '全局 Memory 文件为空');
            setGlobalMemoryContent(content);
            setGlobalMemoryOriginal(content);
        } catch (error) {
            console.error('Failed to load global memory preview:', error);
            setGlobalMemoryPreview('Error loading global memory');
        }
    };

    const saveGlobalMemory = async () => {
        setGlobalMemorySaving(true);
        try {
            const response = await api.saveGlobalMemory(globalMemoryContent);
            if (response.ok) {
                setGlobalMemoryOriginal(globalMemoryContent);
                setGlobalMemoryPreview(globalMemoryContent || '全局 Memory 文件为空');
                setGlobalMemoryEditMode(false);
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            console.error('Failed to save global memory:', error);
            alert('保存失败: ' + error.message);
        } finally {
            setGlobalMemorySaving(false);
        }
    };

    const cancelGlobalMemoryEdit = () => {
        setGlobalMemoryContent(globalMemoryOriginal);
        setGlobalMemoryEditMode(false);
    };

    // Update permission mode (but don't persist immediately)
    const updatePermissionMode = (newMode) => {
        setPermissionMode(newMode);
        setToolsChanged(true);
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
            const cliResponse = await apiFetch('/api/mcp/cli/list');

            if (cliResponse.ok) {
                const cliData = await cliResponse.json();
                // Handle both success and failure cases
                if (cliData.servers) {
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
                // If CLI failed but returned valid JSON, log the error but continue
                if (!cliData.success) {
                    console.log('Claude CLI command failed:', cliData.error);
                }
            }

            // Fallback to direct config reading
            const response = await apiFetch('/api/mcp/servers?scope=user');

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
            const response = await apiFetch('/api/mcp/cli/add', {
                method: 'POST',
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
            const response = await apiFetch(`/api/mcp/cli/remove/${ serverId }`, {
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
            const response = await apiFetch(`/api/mcp/servers/${ serverId }/test?scope=${ scope }`, {
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
            const response = await apiFetch('/api/mcp/servers/test', {
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
            const response = await apiFetch(`/api/mcp/servers/${ serverId }/tools?scope=${ scope }`, {
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
            // Load app info when settings dialog opens
            if (!appInfo && !appInfoLoading) {
                fetchAppInfo();
            }
            // Load global memory preview by default
            loadGlobalMemoryPreview();
        }
    }, [isOpen]);

    // ESC key handler for closing settings
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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
                setChatBgImage(settings.chatBgImage || '');
                setUserAvatar(settings.userAvatar || '');
            } else {
                // Set defaults
                setAllowedTools([]);
                setDisallowedTools([]);
                setSkipPermissions(false);
                setPermissionMode('default');
                setProjectSortOrder('name');
                setChatBgImage('');
                setUserAvatar('');
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
            setChatBgImage('');
            setUserAvatar('');
        }
    };


    // Persist partial settings update (helper)
    const persistPartialSettings = (patch) => {
        try {
            const saved = localStorage.getItem('claude-tools-settings');
            const current = saved ? JSON.parse(saved) : {};
            const next = { ...current, ...patch, lastUpdated: new Date().toISOString() };
            localStorage.setItem('claude-tools-settings', JSON.stringify(next));
            window.dispatchEvent(new Event('toolsSettingsChanged'));
        } catch (e) {
            console.error('Failed to persist settings patch:', e);
        }
    };

    // Save tools settings
    const saveToolsSettings = () => {
        const settings = {
            allowedTools,
            disallowedTools,
            skipPermissions,
            permissionMode,
        };
        persistPartialSettings(settings);
        setToolsChanged(false);
    };

    // Save MCP settings (placeholder - MCP has its own save mechanism)
    const saveMcpSettings = () => {
        // MCP servers are saved individually when added/removed
        // This function is for any future MCP-related settings
        setMcpChanged(false);
    };

    const handleChatBgFileChange = (file) => {
        if (!file) return;
        const allowed = ['image/png', 'image/svg+xml', 'image/jpeg'];
        if (!allowed.includes(file.type)) {
            alert('仅支持 PNG、SVG 或 JPG 图片');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result || '';
            setChatBgImage(dataUrl);
            persistPartialSettings({ chatBgImage: dataUrl });
        };
        reader.readAsDataURL(file);
    };

    const handleClearChatBg = () => {
        setChatBgImage('');
        persistPartialSettings({ chatBgImage: '' });
    };

    // New: user avatar handlers
    const handleUserAvatarFileChange = (file) => {
        if (!file) return;
        const allowed = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (!allowed.includes(file.type)) {
            alert('仅支持 PNG、SVG 或 JPG 头像');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result || '';
            setUserAvatar(dataUrl);
            persistPartialSettings({ userAvatar: dataUrl });
        };
        reader.readAsDataURL(file);
    };

    const handleClearUserAvatar = () => {
        setUserAvatar('');
        persistPartialSettings({ userAvatar: '' });
    };

    const addAllowedTool = (tool) => {
        if (tool && !allowedTools.includes(tool)) {
            setAllowedTools([...allowedTools, tool]);
            setNewAllowedTool('');
            setToolsChanged(true);
        }
    };

    const removeAllowedTool = (tool) => {
        setAllowedTools(allowedTools.filter(t => t !== tool));
        setToolsChanged(true);
    };

    const addDisallowedTool = (tool) => {
        if (tool && !disallowedTools.includes(tool)) {
            setDisallowedTools([...disallowedTools, tool]);
            setNewDisallowedTool('');
            setToolsChanged(true);
        }
    };

    const removeDisallowedTool = (tool) => {
        setDisallowedTools(disallowedTools.filter(t => t !== tool));
        setToolsChanged(true);
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
        } catch (error) {
            alert(`Error: ${ error.message }`);
        } finally {
            setMcpLoading(false);
        }
    };

    const handleMcpDelete = async (serverId, scope) => {
        if (confirm('确定要删除这个 MCP 服务器吗？')) {
            try {
                await deleteMcpServer(serverId, scope);
                } catch (error) {
                alert(`Error: ${ error.message }`);
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
                        <Settings className="w-5 h-5 md:w-6 md:h-6 text-primary"/>
                        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                            设置
                        </h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={ onClose }
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'tools'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                工具
                            </button>
                            <button
                                onClick={ () => setActiveTab('appearance') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'appearance'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                外观
                            </button>
                            <button
                                onClick={ () => setActiveTab('git') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'git'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                Git
                            </button>
                            <button
                                onClick={ () => setActiveTab('security') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'security'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                安全项
                            </button>
                            <button
                                onClick={ () => setActiveTab('memory') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'memory'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                记忆
                            </button>
                            <button
                                onClick={ () => setActiveTab('mcp') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'mcp'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                MCP
                            </button>
                            <button
                                onClick={ () => setActiveTab('usage') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'usage'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                使用量
                            </button>
                            {/* Only show developer tab in development mode */ }
                            { isDevelopmentMode && (
                                <button
                                    onClick={ () => setActiveTab('developer') }
                                    className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'developer'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                    }` }
                                >
                                    开发者
                                </button>
                            ) }
                            {/* About tab */ }
                            <button
                                onClick={ () => setActiveTab('about') }
                                className={ `flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'about'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }` }
                            >
                                关于
                            </button>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 space-y-6 md:space-y-8 pb-safe-area-inset-bottom">
                        {/* Memory Tab */}
                        { activeTab === 'memory' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Global Memory */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Globe className="w-5 h-5 text-blue-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            全局 Memory
                                        </h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        全局 Memory 文件适用于所有项目，包含通用的指令和偏好设置。文件位置：~/.claude/CLAUDE.md
                                    </p>
                                    <div className="flex gap-3">
                                        {!globalMemoryEditMode ? (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setGlobalMemoryEditMode(true)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                    编辑全局 Memory
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={loadGlobalMemoryPreview}
                                                    className="flex items-center gap-2"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    刷新
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="default"
                                                    onClick={saveGlobalMemory}
                                                    disabled={globalMemorySaving || globalMemoryContent === globalMemoryOriginal}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    {globalMemorySaving ? '保存中...' : '保存'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={cancelGlobalMemoryEdit}
                                                    disabled={globalMemorySaving}
                                                    className="flex items-center gap-2"
                                                >
                                                    <X className="w-4 h-4" />
                                                    取消
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    {(globalMemoryPreview || globalMemoryPreview === '') && (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-3">
                                            <div className="h-[40vh] overflow-auto">
                                                {globalMemoryEditMode ? (
                                                    <textarea
                                                        value={globalMemoryContent}
                                                        onChange={(e) => setGlobalMemoryContent(e.target.value)}
                                                        placeholder="输入全局 Memory 内容...

示例内容：
# 全局 Memory

## 偏好设置
- 使用简洁的代码风格
- 优先考虑性能和可读性

## 上下文信息
- 我是一个全栈开发者
- 偏好使用 TypeScript 和 React

## 特殊指令
- 总是包含适当的错误处理
- 代码应该有良好的注释"
                                                        className="w-full h-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        spellCheck={false}
                                                    />
                                                ) : (
                                                    <div className="prose prose-sm max-w-none dark:prose-invert
                                                        prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                                                        prose-p:text-gray-700 dark:prose-p:text-gray-300
                                                        prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                                                        prose-code:text-pink-600 dark:prose-code:text-pink-400
                                                        prose-code:bg-gray-100 dark:prose-code:bg-gray-800
                                                        prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                                        prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800
                                                        prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700
                                                        prose-blockquote:border-l-4 prose-blockquote:border-blue-500
                                                        prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20
                                                        prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300
                                                        prose-ul:list-disc prose-ol:list-decimal
                                                        prose-li:text-gray-700 dark:prose-li:text-gray-300
                                                        prose-a:text-blue-600 dark:prose-a:text-blue-400
                                                        prose-a:no-underline hover:prose-a:underline
                                                        prose-hr:border-gray-300 dark:prose-hr:border-gray-700">
                                                        {globalMemoryContent ? (
                                                            <ReactMarkdown 
                                                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                                                components={{
                                                                    code: ({ node, inline, className, children, ...props }) => {
                                                                        const match = /language-(\w+)/.exec(className || '');
                                                                        return !inline && match ? (
                                                                            <pre className="overflow-x-auto">
                                                                                <code className={className} {...props}>
                                                                                    {children}
                                                                                </code>
                                                                            </pre>
                                                                        ) : (
                                                                            <code className={className} {...props}>
                                                                                {children}
                                                                            </code>
                                                                        );
                                                                    },
                                                                    a: ({ node, ...props }) => (
                                                                        <a {...props} target="_blank" rel="noopener noreferrer" />
                                                                    )
                                                                }}
                                                            >
                                                                {globalMemoryContent}
                                                            </ReactMarkdown>
                                                        ) : (
                                                            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                                                                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                                <p>Memory 文件为空</p>
                                                                <p className="text-sm">点击编辑按钮开始添加内容</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Memory Management */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-5 h-5 text-primary"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            Memory 管理
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                                快速访问
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                                在聊天中使用 /memory 命令快速查看和管理 Memory 文件
                                            </p>
                                            <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                                                <div>• /memory - 查看项目 Memory</div>
                                                <div>• /memory show global - 查看全局 Memory</div>
                                                <div>• /memory edit - 编辑项目 Memory</div>
                                                <div>• /memory edit global - 编辑全局 Memory</div>
                                            </div>
                                        </div>
                                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                                Memory 提示
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                                有效使用 Memory 文件的建议
                                            </p>
                                            <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                                                <div>• 使用 Markdown 格式组织内容</div>
                                                <div>• 包含项目背景和偏好设置</div>
                                                <div>• 添加代码风格和约定</div>
                                                <div>• 记录特殊需求和限制</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Git Tab */}
                        { activeTab === 'git' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Git Commit Configuration */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <GitBranch className="w-5 h-5 text-primary"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            Git 提交消息配置
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        {/* Language Selection */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Languages className="w-4 h-4 text-gray-500"/>
                                                <label className="text-sm font-medium text-foreground">
                                                    提交消息语言
                                                </label>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="gitLanguage" 
                                                        value="chinese"
                                                        checked={gitCommitLanguage === 'chinese'}
                                                        onChange={(e) => setGitCommitLanguage(e.target.value)}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
                                                    />
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        中文（推荐）
                                                    </span>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="gitLanguage" 
                                                        value="english"
                                                        checked={gitCommitLanguage === 'english'}
                                                        onChange={(e) => setGitCommitLanguage(e.target.value)}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
                                                    />
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        English
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Commit Standard Selection */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <MessageCircle className="w-4 h-4 text-gray-500"/>
                                                <label className="text-sm font-medium text-foreground">
                                                    提交规范
                                                </label>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="gitStandard" 
                                                        value="conventional"
                                                        checked={gitCommitStandard === 'conventional'}
                                                        onChange={(e) => setGitCommitStandard(e.target.value)}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                            Conventional Commits（推荐）
                                                        </span>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                                                            feat:, fix:, docs:, style:, refactor:, test:, chore:
                                                        </p>
                                                    </div>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="gitStandard" 
                                                        value="angular"
                                                        checked={gitCommitStandard === 'angular'}
                                                        onChange={(e) => setGitCommitStandard(e.target.value)}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                            Angular 规范
                                                        </span>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                                                            类似 Conventional，但更严格的范围要求
                                                        </p>
                                                    </div>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="gitStandard" 
                                                        value="simple"
                                                        checked={gitCommitStandard === 'simple'}
                                                        onChange={(e) => setGitCommitStandard(e.target.value)}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                            简单格式
                                                        </span>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                                                            无固定格式要求，简洁明了
                                                        </p>
                                                    </div>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="gitStandard" 
                                                        value="chinese"
                                                        checked={gitCommitStandard === 'chinese'}
                                                        onChange={(e) => setGitCommitStandard(e.target.value)}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                            中文标准格式
                                                        </span>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                                                            新增:, 修复:, 更新:, 重构:, 测试:, 文档:
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Claude CLI Integration */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Terminal className="w-4 h-4 text-gray-500"/>
                                                <label className="text-sm font-medium text-foreground">
                                                    Claude CLI 集成
                                                </label>
                                            </div>
                                            <label className="flex items-center space-x-3 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={gitClaudeIntegration}
                                                    onChange={(e) => setGitClaudeIntegration(e.target.checked)}
                                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
                                                />
                                                <div>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        启用自动提交消息生成
                                                    </span>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                                                        Claude 在提交代码时自动生成规范的提交消息
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Configuration Priority */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-5 h-5 text-orange-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            配置优先级说明
                                        </h3>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                                        <div className="space-y-3">
                                            <h4 className="font-medium text-orange-800 dark:text-orange-200">
                                                配置生效顺序
                                            </h4>
                                            <div className="space-y-2 text-sm text-orange-700 dark:text-orange-300">
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium">1.</span>
                                                    <span>项目级 CLAUDE.md 文件中的 Git 配置（最高优先级）</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium">2.</span>
                                                    <span>全局 ~/.claude/CLAUDE.md 文件中的配置</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium">3.</span>
                                                    <span>此界面的设置（最低优先级）</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                                                💡 建议在 CLAUDE.md 文件中配置项目特定的 Git 规范，在此处设置全局默认行为
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* CLAUDE.md Configuration Example */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-blue-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            CLAUDE.md 配置示例
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            在项目的 CLAUDE.md 或全局 ~/.claude/CLAUDE.md 文件中添加以下配置：
                                        </p>
                                        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
{`## Git 配置

### 提交消息规范
- **语言**: 中文
- **格式**: Conventional Commits
- **示例**: feat: 添加用户登录功能

### 提交规则
1. 使用规范的提交类型前缀
2. 描述要简洁明了
3. 包含必要的作者信息

### Claude CLI 集成
- 启用自动提交消息生成
- 遵循项目代码规范
- 包含 Co-Authored-By 信息`}
                                            </pre>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                                    常用提交类型
                                                </h4>
                                                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                    <div><code>feat:</code> 新功能</div>
                                                    <div><code>fix:</code> 修复问题</div>
                                                    <div><code>docs:</code> 文档更新</div>
                                                    <div><code>style:</code> 代码格式调整</div>
                                                    <div><code>refactor:</code> 代码重构</div>
                                                    <div><code>test:</code> 测试相关</div>
                                                    <div><code>chore:</code> 构建/工具更新</div>
                                                </div>
                                            </div>
                                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                                    提交消息模板
                                                </h4>
                                                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                    <div>feat: 添加用户认证功能</div>
                                                    <div>fix: 修复登录页面样式问题</div>
                                                    <div>docs: 更新 API 文档</div>
                                                    <div>refactor: 优化数据库查询</div>
                                                    <div>test: 添加单元测试用例</div>
                                                    <div>chore: 升级依赖版本</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Security Tab */ }
                        { activeTab === 'security' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Permission Mode */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-5 h-5 text-primary"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            权限模式
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div
                                            className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <div>
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
                                                               onChange={ (e) => e.target.checked && updatePermissionMode('default') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"/>
                                                        <div className="flex items-center space-x-2">
                                                            <Shield
                                                                className="w-4 h-4 text-primary"/>
                                                            <span
                                                                className="text-sm text-gray-700 dark:text-gray-300">默认模式</span>
                                                        </div>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">每次使用工具时都会提示权限确认</p>
                                                    {/* Accept Edits Mode */ }
                                                    <label className="flex items-center space-x-3 cursor-pointer">
                                                        <input type="radio" name="permissionMode" value="acceptEdits"
                                                               checked={ permissionMode === 'acceptEdits' }
                                                               onChange={ (e) => e.target.checked && updatePermissionMode('acceptEdits') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"/>
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
                                                               onChange={ (e) => e.target.checked && updatePermissionMode('bypassPermissions') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"/>
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
                                                               onChange={ (e) => e.target.checked && updatePermissionMode('plan') }
                                                               disabled={ skipPermissions }
                                                               className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"/>
                                                        <div className="flex items-center space-x-2">
                                                            <FileText className="w-4 h-4 text-primary"/>
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
                                                    setToolsChanged(true);
                                                } }
                                                       className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"/>
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
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
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
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
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
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600"
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
                                                className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-primary focus:border-blue-500 p-2 w-32"
                                            >
                                                <option value="name">按字母顺序</option>
                                                <option value="date">按最近活动</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Background */ }
                                <div className="space-y-4">
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div className="mb-3">
                                            <div className="font-medium text-foreground">聊天背景</div>
                                            <div className="text-sm text-muted-foreground mb-4">
                                                可选：上传自定义 PNG/SVG/JPG 作为聊天背景装饰（以 10% 透明度覆盖）
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-32 h-20 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                                { chatBgImage ? (
                                                    <img src={ chatBgImage } alt="背景预览"
                                                         className="w-full h-full object-cover"/>
                                                ) : (
                                                    <div className="text-xs text-gray-400">无自定义背景</div>
                                                ) }
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label
                                                    className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                    选择图片
                                                    <input type="file" accept="image/png,image/svg+xml,image/jpeg"
                                                           className="hidden"
                                                           onChange={ (e) => handleChatBgFileChange(e.target.files?.[0]) }/>
                                                </label>
                                                <button type="button" onClick={ handleClearChatBg }
                                                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                                        disabled={ !chatBgImage }>清除
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">未设置时使用内置背景图
                                            bg-repeat.svg
                                        </div>
                                    </div>
                                </div>

                                {/* User Avatar */ }
                                <div className="space-y-4">
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div className="mb-3">
                                            <div className="font-medium text-foreground">用户头像</div>
                                            <div
                                                className="text-sm text-muted-foreground">上传自定义头像（PNG/SVG/JPG），将在聊天中用于用户消息气泡旁显示
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-16 h-16 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                                                { userAvatar ? (
                                                    <img src={ userAvatar } alt="头像预览"
                                                         className="w-full h-full object-cover"/>
                                                ) : (
                                                    <div
                                                        className="w-full h-full flex items-center justify-center text-xs text-gray-400">无</div>
                                                ) }
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label
                                                    className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                    选择头像
                                                    <input type="file" accept="image/png,image/svg+xml,image/jpeg"
                                                           className="hidden"
                                                           onChange={ (e) => handleUserAvatarFileChange(e.target.files?.[0]) }/>
                                                </label>
                                                <button type="button" onClick={ handleClearUserAvatar }
                                                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                                        disabled={ !userAvatar }>清除
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">未设置时使用默认头像</div>
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
                                                className="text-xs text-muted-foreground mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
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

                        {/* Usage Tab */ }
                        { activeTab === 'usage' && (
                            <div className="space-y-6 md:space-y-8">
                                <LazyUsageMonitor />
                            </div>
                        ) }
                        {/* About Tab */ }
                        { activeTab === 'about' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Application Information */ }
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Monitor className="w-5 h-5 text-green-500"/>
                                        <h3 className="text-lg font-medium text-foreground">
                                            应用信息
                                        </h3>
                                    </div>
                                    
                                    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        {appInfoLoading && (
                                            <div className="text-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto mb-2"></div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">正在获取应用信息...</p>
                                            </div>
                                        )}
                                        
                                        {appInfoError && !appInfoLoading && (
                                            <div className="text-center py-4">
                                                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2"/>
                                                <p className="text-sm text-red-600 dark:text-red-400 mb-2">获取应用信息失败</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{appInfoError}</p>
                                                <Button
                                                    onClick={fetchAppInfo}
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2"
                                                >
                                                    重试
                                                </Button>
                                            </div>
                                        )}
                                        
                                        {appInfo && !appInfoLoading && (
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">应用名称:</span>
                                                    <span className="font-medium">{appInfo.name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">版本:</span>
                                                    <span className="font-mono text-xs">{appInfo.version}</span>
                                                </div>
                                                {appInfo.description && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">描述:</span>
                                                        <span className="font-medium text-right max-w-xs">{appInfo.description}</span>
                                                    </div>
                                                )}
                                                {appInfo.author && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">作者:</span>
                                                        <span className="font-medium">{appInfo.author}</span>
                                                    </div>
                                                )}
                                                {appInfo.license && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">许可证:</span>
                                                        <span className="font-mono text-xs">{appInfo.license}</span>
                                                    </div>
                                                )}
                                                {appInfo.git?.repository && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">仓库:</span>
                                                        <a 
                                                            href={appInfo.git.repository.replace('git@github.com:', 'https://github.com/').replace('.git', '')}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-xs text-primary hover:text-primary underline"
                                                        >
                                                            GitHub
                                                        </a>
                                                    </div>
                                                )}
                                                {appInfo.git?.commit && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">提交:</span>
                                                        <span className="font-mono text-xs">{appInfo.git.commit}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">运行环境:</span>
                                                    <span className="font-medium">
                                                        {window.electronAPI?.isElectron?.() ? 'Electron Desktop' : 'Web Browser'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">平台:</span>
                                                    <span className="font-medium capitalize">
                                                        {appInfo.build?.platform || window.electronAPI?.platform || navigator.platform}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">架构:</span>
                                                    <span className="font-mono text-xs">{appInfo.build?.arch}</span>
                                                </div>
                                                {window.environment && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600 dark:text-gray-400">Electron版本:</span>
                                                            <span className="font-mono text-xs">
                                                                {window.environment.electronVersion}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600 dark:text-gray-400">Node.js版本:</span>
                                                            <span className="font-mono text-xs">
                                                                {appInfo.build?.nodeVersion || window.environment.nodeVersion}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600 dark:text-gray-400">Chrome版本:</span>
                                                            <span className="font-mono text-xs">
                                                                {window.environment.chromeVersion}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        
                                        {!appInfo && !appInfoLoading && !appInfoError && (
                                            <div className="text-center py-4">
                                                <Monitor className="w-8 h-8 text-gray-400 mx-auto mb-2"/>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">应用信息未加载</p>
                                                <Button
                                                    onClick={fetchAppInfo}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    获取应用信息
                                                </Button>
                                            </div>
                                        )}
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
                                                className="flex-1 h-10"
                                                style={ { fontSize: '16px' } }
                                            />
                                            <Button
                                                onClick={ () => addAllowedTool(newAllowedTool) }
                                                disabled={ !newAllowedTool }
                                                size="sm"
                                                className="h-10 px-4"
                                            >
                                                <Plus className="w-4 h-4 mr-2 sm:mr-0"/>

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
                                                        className="text-xs h-8 truncate"
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
                                                className="flex-1 h-10"
                                                style={ { fontSize: '16px' } }
                                            />
                                            <Button
                                                onClick={ () => addDisallowedTool(newDisallowedTool) }
                                                disabled={ !newDisallowedTool }
                                                size="sm"
                                                className="h-10 px-4"
                                            >
                                                <Plus className="w-4 h-4 mr-2 sm:mr-0"/>

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
                                    className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                    <h4 className="font-medium text-primary-foreground mb-2">
                                        工具模式示例：
                                    </h4>
                                    <ul className="text-sm text-primary space-y-1">
                                        <li><code className="bg-primary/10 px-1 rounded">"Bash(git
                                            log:*)"</code> - 允许所有 git log 命令
                                        </li>
                                        <li><code className="bg-primary/10 px-1 rounded">"Bash(git
                                            diff:*)"</code> - 允许所有 git diff 命令
                                        </li>
                                        <li><code className="bg-primary/10 px-1 rounded">"Write"</code> -
                                            允许所有写入工具使用
                                        </li>
                                        <li><code className="bg-primary/10 px-1 rounded">"Read"</code> -
                                            允许所有读取工具使用
                                        </li>
                                        <li><code
                                            className="bg-primary/10 px-1 rounded">"Bash(rm:*)"</code> -
                                            阻止所有 rm 命令（危险）
                                        </li>
                                    </ul>
                                </div>

                                {/* Save Tools Settings Button */}
                                {toolsChanged && (
                                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-blue-800 dark:text-blue-200">
                                                工具权限设置已修改，需要保存以生效。
                                            </div>
                                            <Button
                                                onClick={saveToolsSettings}
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                                size="sm"
                                            >
                                                保存工具设置
                                            </Button>
                                        </div>
                                    </div>
                                )}

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
                                                                    className="mt-2 p-2 rounded text-xs bg-primary/5 text-primary border border-primary/20">
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
                                                                                            className="text-primary mt-0.5">•</span>
                                                                                        <div>
                                                                                            <code
                                                                                                className="bg-primary/10 px-1 rounded">{ tool.name }</code>
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
                                                                                            className="text-primary mt-0.5">•</span>
                                                                                        <div>
                                                                                            <code
                                                                                                className="bg-primary/10 px-1 rounded">{ resource.name }</code>
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
                                                                                            className="text-primary mt-0.5">•</span>
                                                                                        <div>
                                                                                            <code
                                                                                                className="bg-primary/10 px-1 rounded">{ prompt.name }</code>
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
                                                                className="text-primary hover:text-primary/80"
                                                                title="Test connection">
                                                                { mcpTestResults[server.id]?.loading ? (<div
                                                                    className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent"/>) : (
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
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-primary focus:border-blue-500">
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
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-primary focus:border-blue-500"
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
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-primary focus:border-blue-500"
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
                                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-primary focus:border-blue-500"
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
                                                                className="text-primary border-primary hover:bg-primary/5">
                                                            { mcpConfigTesting ? (<>
                                                                <div
                                                                    className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2"/>
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

                <div className="flex justify-end p-4 md:p-6 border-t border-gray-200 dark:border-gray-700">
                    <Button
                        variant="outline"
                        onClick={ onClose }
                        className="h-10"
                    >
                        关闭
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ToolsSettings;
