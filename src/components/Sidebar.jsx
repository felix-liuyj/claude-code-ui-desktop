import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useElectron } from '../utils/electron';
import { AnimatedTransition, AnimatedListItem, useButtonAnimation, useHoverAnimation } from './AnimatedTransition';

import {
    Brain,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Edit2,
    Edit3,
    Folder,
    FolderOpen,
    FolderPlus,
    MessageSquare,
    Plus,
    RefreshCw,
    Search,
    Settings,
    Star,
    Trash2,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';
import MemoryEditor from './MemoryEditor';

// Move formatTimeAgo outside component to avoid recreation on every render
const formatTimeAgo = (dateString, currentTime) => {
    const date = new Date(dateString);
    const now = currentTime;

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '未知';
    }

    const diffInMs = now - date;
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInSeconds < 60) return '刚刚';
    if (diffInMinutes === 1) return '1分钟前';
    if (diffInMinutes < 60) return `${ diffInMinutes }分钟前`;
    if (diffInHours === 1) return '1小时前';
    if (diffInHours < 24) return `${ diffInHours }小时前`;
    if (diffInDays === 1) return '1天前';
    if (diffInDays < 7) return `${ diffInDays }天前`;
    return date.toLocaleDateString('zh-CN');
};

const Sidebar = memo(function Sidebar({
                     projects,
                     selectedProject,
                     selectedSession,
                     onProjectSelect,
                     onSessionSelect,
                     onNewSession,
                     onSessionDelete,
                     onProjectDelete,
                     isLoading,
                     onRefresh,
                     onShowSettings,
                     updateAvailable,
                     latestVersion,
                     onShowVersionModal
                 }) {
    const electron = useElectron();
    const [expandedProjects, setExpandedProjects] = useState(new Set());
    const [editingProject, setEditingProject] = useState(null);
    const [showNewProject, setShowNewProject] = useState(false);
    const [editingName, setEditingName] = useState('');
    const [newProjectPath, setNewProjectPath] = useState('');
    const [creatingProject, setCreatingProject] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState({});
    const [additionalSessions, setAdditionalSessions] = useState({});
    const [initialSessionsLoaded, setInitialSessionsLoaded] = useState(new Set());
    const [currentTime, setCurrentTime] = useState(new Date());
    const [projectSortOrder, setProjectSortOrder] = useState('name');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [editingSessionName, setEditingSessionName] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    
    // Memory editor state
    const [showMemoryEditor, setShowMemoryEditor] = useState(false);
    const [memoryEditingProject, setMemoryEditingProject] = useState(null);


    // Starred projects state - persisted in localStorage
    const [starredProjects, setStarredProjects] = useState(() => {
        try {
            const saved = localStorage.getItem('starredProjects');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (error) {
            console.error('Error loading starred projects:', error);
            return new Set();
        }
    });

    // Touch handler to prevent double-tap issues on iPad (only for buttons, not scroll areas)
    const handleTouchClick = (callback) => {
        return (e) => {
            // Only prevent default for buttons/clickable elements, not scrollable areas
            if (e.target.closest('.overflow-y-auto') || e.target.closest('[data-scroll-container]')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            callback();
        };
    };

    // Auto-update timestamps every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every 60 seconds

        return () => clearInterval(timer);
    }, []);

    // Clear additional sessions when projects list changes (e.g., after refresh)
    useEffect(() => {
        setAdditionalSessions({});
        setInitialSessionsLoaded(new Set());
    }, [projects]);

    // Auto-expand project folder when a session is selected
    useEffect(() => {
        if (selectedSession && selectedProject) {
            setExpandedProjects(prev => new Set([...prev, selectedProject.name]));
        }
    }, [selectedSession, selectedProject]);

    // Mark sessions as loaded when projects come in
    useEffect(() => {
        if (projects.length > 0 && !isLoading) {
            const newLoaded = new Set();
            projects.forEach(project => {
                if (project.sessions && project.sessions.length >= 0) {
                    newLoaded.add(project.name);
                }
            });
            setInitialSessionsLoaded(newLoaded);
        }
    }, [projects, isLoading]);

    // Load project sort order from settings
    useEffect(() => {
        const loadSortOrder = () => {
            try {
                const savedSettings = localStorage.getItem('claude-tools-settings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    setProjectSortOrder(settings.projectSortOrder || 'name');
                }
            } catch (error) {
                console.error('Error loading sort order:', error);
            }
        };

        // Load initially
        loadSortOrder();

        // Listen for storage changes
        const handleStorageChange = (e) => {
            if (e.key === 'claude-tools-settings') {
                loadSortOrder();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Also check periodically when component is focused (for same-tab changes)
        const checkInterval = setInterval(() => {
            if (document.hasFocus()) {
                loadSortOrder();
            }
        }, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(checkInterval);
        };
    }, []);

    const toggleProject = useCallback((projectName) => {
        setExpandedProjects(prev => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(projectName)) {
                newExpanded.delete(projectName);
            } else {
                newExpanded.add(projectName);
            }
            return newExpanded;
        });
    }, []);

    // Starred projects utility functions
    const toggleStarProject = useCallback((projectName) => {
        setStarredProjects(prev => {
            const newStarred = new Set(prev);
            if (newStarred.has(projectName)) {
                newStarred.delete(projectName);
            } else {
                newStarred.add(projectName);
            }

            // Persist to localStorage
            try {
                localStorage.setItem('starredProjects', JSON.stringify([...newStarred]));
            } catch (error) {
                console.error('Error saving starred projects:', error);
            }

            return newStarred;
        });
    }, []);

    const isProjectStarred = useCallback((projectName) => {
        return starredProjects.has(projectName);
    }, [starredProjects]);

    // Helper function to get all sessions for a project (initial + additional)
    const getAllSessions = (project) => {
        const initialSessions = project.sessions || [];
        const additional = additionalSessions[project.name] || [];
        return [...initialSessions, ...additional];
    };

    // Helper function to get the last activity date for a project
    const getProjectLastActivity = (project) => {
        const allSessions = getAllSessions(project);
        if (allSessions.length === 0) {
            return new Date(0); // Return epoch date for projects with no sessions
        }

        // Find the most recent session activity
        return allSessions.reduce((latest, session) => {
            const sessionDate = new Date(session.lastActivity);
            return sessionDate > latest ? sessionDate : latest;
        }, new Date(0));
    };

    // Combined sorting: starred projects first, then by selected order
    // 使用 useMemo 缓存排序结果，避免不必要的重新计算
    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) => {
            const aStarred = isProjectStarred(a.name);
            const bStarred = isProjectStarred(b.name);

            // First, sort by starred status
            if (aStarred && !bStarred) return -1;
            if (!aStarred && bStarred) return 1;

            // For projects with same starred status, sort by selected order
            if (projectSortOrder === 'date') {
                // Sort by most recent activity (descending)
                return getProjectLastActivity(b) - getProjectLastActivity(a);
            } else {
                // Sort by display name (user-defined) or fallback to name (ascending)
                const nameA = a.displayName || a.name;
                const nameB = b.displayName || b.name;
                return nameA.localeCompare(nameB);
            }
        });
    }, [projects, projectSortOrder, starredProjects]);

    const startEditing = (project) => {
        setEditingProject(project.name);
        setEditingName(project.displayName);
    };

    const cancelEditing = () => {
        setEditingProject(null);
        setEditingName('');
    };

    const saveProjectName = async (projectName) => {
        try {
            const response = await api.renameProject(projectName, editingName);

            if (response.ok) {
                // Refresh projects to get updated data
                if (window.refreshProjects) {
                    window.refreshProjects();
                } else {
                    window.location.reload();
                }
            } else {
                console.error('Failed to rename project');
            }
        } catch (error) {
            console.error('Error renaming project:', error);
        }

        setEditingProject(null);
        setEditingName('');
    };

    const openMemoryEditor = (project) => {
        setMemoryEditingProject(project);
        setShowMemoryEditor(true);
    };

    const deleteSession = async (projectName, sessionId) => {
        if (!confirm('确定要删除这个会话吗？此操作无法撤销。')) {
            return;
        }

        try {
            const response = await api.deleteSession(projectName, sessionId);

            if (response.ok) {
                // Call parent callback if provided
                if (onSessionDelete) {
                    onSessionDelete(sessionId);
                }
            } else {
                console.error('Failed to delete session');
                alert('删除会话失败，请重试。');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('删除会话时发生错误，请重试。');
        }
    };

    const deleteProject = async (projectName) => {
        if (!confirm('确定要删除这个空项目吗？此操作无法撤销。')) {
            return;
        }

        try {
            const response = await api.deleteProject(projectName);

            if (response.ok) {
                // Call parent callback if provided
                if (onProjectDelete) {
                    onProjectDelete(projectName);
                }
            } else {
                const error = await response.json();
                console.error('Failed to delete project');
                alert(error.error || '删除项目失败，请重试。');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('删除项目时发生错误，请重试。');
        }
    };

    const createNewProject = async () => {
        if (!newProjectPath.trim()) {
            alert('请输入项目路径');
            return;
        }

        setCreatingProject(true);

        try {
            const response = await api.createProject(newProjectPath.trim());

            if (response.ok) {
                await response.json();
                setShowNewProject(false);
                setNewProjectPath('');

                // Refresh projects to show the new one
                if (window.refreshProjects) {
                    window.refreshProjects();
                } else {
                    window.location.reload();
                }
            } else {
                const error = await response.json();
                alert(error.error || '创建项目失败，请重试。');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert('创建项目时发生错误，请重试。');
        } finally {
            setCreatingProject(false);
        }
    };

    const cancelNewProject = () => {
        setShowNewProject(false);
        setNewProjectPath('');
    };

    const loadMoreSessions = async (project) => {
        // Check if we can load more sessions
        const canLoadMore = project.sessionMeta?.hasMore !== false;

        if (!canLoadMore || loadingSessions[project.name]) {
            return;
        }

        setLoadingSessions(prev => ({ ...prev, [project.name]: true }));

        try {
            const currentSessionCount = (project.sessions?.length || 0) + (additionalSessions[project.name]?.length || 0);
            const response = await api.sessions(project.name, 5, currentSessionCount);

            if (response.ok) {
                const result = await response.json();

                // Store additional sessions locally
                setAdditionalSessions(prev => ({
                    ...prev, [project.name]: [...(prev[project.name] || []), ...result.sessions]
                }));

                // Update project metadata if needed
                if (result.hasMore === false) {
                    // Mark that there are no more sessions to load
                    project.sessionMeta = { ...project.sessionMeta, hasMore: false };
                }
            }
        } catch (error) {
            console.error('Error loading more sessions:', error);
        } finally {
            setLoadingSessions(prev => ({ ...prev, [project.name]: false }));
        }
    };

    // Filter projects based on search input
    // 使用 useMemo 缓存过滤结果
    const filteredProjects = useMemo(() => {
        if (!searchFilter.trim()) return sortedProjects;

        const searchLower = searchFilter.toLowerCase();
        return sortedProjects.filter(project => {
            const displayName = (project.displayName || project.name).toLowerCase();
            const projectName = project.name.toLowerCase();

            // Search in both display name and actual project name/path
            return displayName.includes(searchLower) || projectName.includes(searchLower);
        });
    }, [sortedProjects, searchFilter]);

    return (<div className="h-full flex flex-col bg-card md:select-none">
        {/* Header */ }
        <div className="md:p-4 md:border-b md:border-border">
            {/* Desktop Header */ }
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shadow-sm">
                        <img src="logo.svg" alt="AI 编程助手" className="w-full h-full object-cover"/>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Claude Code UI</h1>
                        <p className="text-sm text-muted-foreground">AI编程助手</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 px-0 hover:bg-accent transition-colors duration-200 group"
                        onClick={ async () => {
                            setIsRefreshing(true);
                            try {
                                await onRefresh();
                            } finally {
                                setIsRefreshing(false);
                            }
                        } }
                        disabled={ isRefreshing }
                        title={ `刷新项目和会话 (${ electron.getShortcutKey() }+R)` }
                    >
                        <RefreshCw
                            className={ `w-4 h-4 ${ isRefreshing ? 'animate-spin' : '' } group-hover:rotate-180 transition-transform duration-300` }/>
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-9 w-9 px-0 bg-primary hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md"
                        onClick={ () => setShowNewProject(true) }
                        title={ `创建新项目 (${ electron.getShortcutKey() }+N)` }
                    >
                        <FolderPlus className="w-4 h-4"/>
                    </Button>
                </div>
            </div>

            {/* Mobile Header removed */ }
        </div>

        {/* New Project Form */ }
        { showNewProject && (<div className="md:p-3 md:border-b md:border-border md:bg-muted/30">
            {/* Desktop Form */ }
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FolderPlus className="w-4 h-4"/>
                    创建新项目
                </div>
                <Input
                    value={ newProjectPath }
                    onChange={ (e) => setNewProjectPath(e.target.value) }
                    placeholder="/path/to/project 或 relative/path"
                    className="text-sm focus:ring-2 focus:ring-primary/20"
                    autoFocus
                    onKeyDown={ (e) => {
                        if (e.key === 'Enter') createNewProject();
                        if (e.key === 'Escape') cancelNewProject();
                    } }
                />
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={ createNewProject }
                        disabled={ !newProjectPath.trim() || creatingProject }
                        className="flex-1 h-8 text-xs hover:bg-primary/90 transition-colors"
                    >
                        { creatingProject ? '正在创建...' : '创建项目' }
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={ cancelNewProject }
                        disabled={ creatingProject }
                        className="h-8 text-xs hover:bg-accent transition-colors"
                    >
                        取消
                    </Button>
                </div>
            </div>

            {/* Mobile overlay removed for desktop-only */ }
        </div>) }

        {/* Search Filter */ }
        { projects.length > 0 && !isLoading && (<div className="px-3 md:px-4 py-2 border-b border-border">
            <div className="relative">
                <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input
                    type="text"
                    placeholder="搜索项目..."
                    value={ searchFilter }
                    onChange={ (e) => setSearchFilter(e.target.value) }
                    className="pl-9 h-9 text-sm bg-muted/50 border-0 focus:bg-background focus:ring-1 focus:ring-primary/20"
                />
                { searchFilter && (<button
                    onClick={ () => setSearchFilter('') }
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-accent rounded"
                >
                    <X className="w-3 h-3 text-muted-foreground"/>
                </button>) }
            </div>
        </div>) }

        {/* Projects List */ }
        <ScrollArea className="flex-1 md:px-2 md:py-3 overflow-y-auto overscroll-contain">
            <div className="md:space-y-1 pb-safe-area-inset-bottom">
                { isLoading ? (<div className="text-center py-12 md:py-8 px-4">
                    <div
                        className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4 md:mb-3">
                        <div
                            className="w-6 h-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"/>
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-2 md:mb-1">正在加载项目...</h3>
                    <p className="text-sm text-muted-foreground">
                        正在获取您的 Claude 项目和会话
                    </p>
                </div>) : projects.length === 0 ? (<div className="text-center py-12 md:py-8 px-4">
                    <div
                        className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4 md:mb-3">
                        <Folder className="w-6 h-6 text-muted-foreground"/>
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-2 md:mb-1">未找到项目</h3>
                    <p className="text-sm text-muted-foreground">
                        在项目目录中运行 Claude CLI 以开始使用
                    </p>
                </div>) : filteredProjects.length === 0 ? (<div className="text-center py-12 md:py-8 px-4">
                    <div
                        className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4 md:mb-3">
                        <Search className="w-6 h-6 text-muted-foreground"/>
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-2 md:mb-1">没有匹配的项目</h3>
                    <p className="text-sm text-muted-foreground">
                        请尝试调整搜索关键词
                    </p>
                </div>) : (filteredProjects.map((project, index) => {
                    const isExpanded = expandedProjects.has(project.name);
                    const isSelected = selectedProject?.name === project.name;
                    const isStarred = isProjectStarred(project.name);

                    return (
                        <AnimatedListItem 
                            key={project.name} 
                            show={true} 
                            index={index}
                            className="md:space-y-1"
                        >
                        {/* Project Header */ }
                        <div className="group md:group">
                            {/* Mobile Project Item removed for desktop-only */ }

                            {/* Desktop Project Item */ }
                            <Button
                                variant="ghost"
                                className={ cn("flex w-full justify-between p-2 h-auto font-normal transition-all duration-200 hover:bg-accent/30 hover:scale-[1.02] active:scale-[0.98]", isSelected && "bg-accent/50 text-accent-foreground", isStarred && !isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20") }
                                onClick={ () => {
                                    // Desktop behavior: select project and toggle
                                    if (selectedProject?.name !== project.name) {
                                        onProjectSelect(project);
                                    }
                                    toggleProject(project.name);
                                } }
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    { isExpanded ? (
                                        <FolderOpen className="w-4 h-4 text-primary flex-shrink-0"/>) : (
                                        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0"/>) }
                                    <div className="min-w-0 flex-1 text-left">
                                        { editingProject === project.name ? (<div className="space-y-1">
                                            <input
                                                type="text"
                                                value={ editingName }
                                                onChange={ (e) => setEditingName(e.target.value) }
                                                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                                                placeholder="项目名称"
                                                autoFocus
                                                onKeyDown={ (e) => {
                                                    if (e.key === 'Enter') saveProjectName(project.name);
                                                    if (e.key === 'Escape') cancelEditing();
                                                } }
                                            />
                                            <div className="text-xs text-muted-foreground truncate"
                                                 title={ project.fullPath }>
                                                { project.fullPath }
                                            </div>
                                        </div>) : (<div>
                                            <div
                                                className="text-sm font-semibold truncate text-foreground"
                                                title={ project.displayName }>
                                                { project.displayName }
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                { (() => {
                                                    const sessionCount = getAllSessions(project).length;
                                                    const hasMore = project.sessionMeta?.hasMore !== false;
                                                    return hasMore && sessionCount >= 5 ? `${ sessionCount }+` : sessionCount;
                                                })() }
                                                { project.fullPath !== project.displayName && (
                                                    <span className="ml-1 opacity-60"
                                                          title={ project.fullPath }>
                                    • { project.fullPath.length > 25 ? '...' + project.fullPath.slice(-22) : project.fullPath }
                                  </span>) }
                                            </div>
                                        </div>) }
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                    { editingProject === project.name ? (<>
                                        <div
                                            className="w-6 h-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center rounded cursor-pointer transition-colors"
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                saveProjectName(project.name);
                                            } }
                                        >
                                            <Check className="w-3 h-3"/>
                                        </div>
                                        <div
                                            className="w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center rounded cursor-pointer transition-colors"
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                cancelEditing();
                                            } }
                                        >
                                            <X className="w-3 h-3"/>
                                        </div>
                                    </>) : (<>
                                        {/* Star button */ }
                                        <div
                                            className={ cn("w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded cursor-pointer touch:opacity-100", isStarred ? "hover:bg-yellow-50 dark:hover:bg-yellow-900/20 opacity-100" : "hover:bg-accent") }
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                toggleStarProject(project.name);
                                            } }
                                            title={ isStarred ? "从收藏夹中移除" : "添加到收藏夹" }
                                        >
                                            <Star
                                                className={ cn("w-3 h-3 transition-colors", isStarred ? "text-yellow-600 dark:text-yellow-400 fill-current" : "text-muted-foreground") }/>
                                        </div>
                                        <div
                                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-accent flex items-center justify-center rounded cursor-pointer touch:opacity-100"
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                startEditing(project);
                                            } }
                                            title="重命名项目 (F2)"
                                        >
                                            <Edit3 className="w-3 h-3"/>
                                        </div>
                                        <div
                                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center rounded cursor-pointer touch:opacity-100"
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                openMemoryEditor(project);
                                            } }
                                            title="编辑项目 Memory"
                                        >
                                            <Brain className="w-3 h-3 text-blue-600 dark:text-blue-400"/>
                                        </div>
                                        { getAllSessions(project).length === 0 && (<div
                                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center rounded cursor-pointer touch:opacity-100"
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                deleteProject(project.name);
                                            } }
                                            title="删除空项目 (Delete)"
                                        >
                                            <Trash2
                                                className="w-3 h-3 text-red-600 dark:text-red-400"/>
                                        </div>) }
                                        { isExpanded ? (<ChevronDown
                                            className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"/>) : (
                                            <ChevronRight
                                                className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"/>) }
                                    </>) }
                                </div>
                            </Button>
                        </div>

                        {/* Sessions List */ }
                        { isExpanded && (<div className="ml-3 space-y-1 border-l border-border pl-3">
                            { !initialSessionsLoaded.has(project.name) ? (// Loading skeleton for sessions
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={ i } className="p-2 rounded-md">
                                        <div className="flex items-start gap-2">
                                            <div
                                                className="w-3 h-3 bg-muted rounded-full animate-pulse mt-0.5"/>
                                            <div className="flex-1 space-y-1">
                                                <div className="h-3 bg-muted rounded animate-pulse"
                                                     style={ { width: `${ 60 + i * 15 }%` } }/>
                                                <div
                                                    className="h-2 bg-muted rounded animate-pulse w-1/2"/>
                                            </div>
                                        </div>
                                    </div>))) : getAllSessions(project).length === 0 && !loadingSessions[project.name] ? (
                                <div className="py-2 px-3 text-left">
                                    <p className="text-xs text-muted-foreground">暂无会话</p>
                                </div>) : (getAllSessions(project).map((session) => {
                                // Calculate if session is active (within last 10 minutes)
                                const sessionDate = new Date(session.lastActivity);
                                const diffInMinutes = Math.floor((currentTime - sessionDate) / (1000 * 60));
                                const isActive = diffInMinutes < 10;

                                return (<div key={ session.id } className="group relative">
                                    {/* Mobile Session Item removed */ }

                                    {/* Desktop Session Item */ }
                                    <div>
                                        <div className="group/session relative">
                                            <Button
                                                variant="ghost"
                                                className={ cn("w-full justify-start p-2 h-auto font-normal text-left hover:bg-accent/30 transition-colors duration-200 pr-20 relative", selectedSession?.id === session.id && "bg-accent/50 text-accent-foreground") }
                                                onClick={ () => onSessionSelect(session) }
                                            >
                                                {/* Active session indicator dot - positioned between project border and session item for desktop */ }
                                                { isActive && (<div
                                                    className="absolute -left-2.5 top-1/2 transform -translate-y-1/2 z-10">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                                                </div>) }
                                                <div className="flex items-start gap-2 min-w-0 w-full">
                                                    <MessageSquare
                                                        className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0"/>
                                                    <div className="min-w-0 flex-1">
                                                        <div
                                                            className="text-xs font-medium truncate text-foreground mb-1">
                                                            { session.summary || '新会话' }
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1">
                                                                <Clock
                                                                    className="w-2.5 h-2.5 text-muted-foreground"/>
                                                                <span
                                                                    className="text-xs text-muted-foreground">
                                        { formatTimeAgo(session.lastActivity, currentTime) }
                                      </span>
                                                            </div>
                                                            { session.messageCount > 0 && (
                                                                <Badge variant="secondary"
                                                                       className="text-xs px-1 py-0">
                                                                    { session.messageCount }
                                                                </Badge>) }
                                                        </div>
                                                    </div>
                                                </div>
                                            </Button>
                                            {/* Desktop hover buttons */ }
                                            <div
                                                className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/session:opacity-100 transition-all duration-200">
                                                { editingSession === session.id ? (<>
                                                    <input
                                                        type="text"
                                                        value={ editingSessionName }
                                                        onChange={ (e) => setEditingSessionName(e.target.value) }
                                                        onKeyDown={ (e) => {
                                                            e.stopPropagation();
                                                            if (e.key === 'Enter') {
                                                                updateSessionSummary(project.name, session.id, editingSessionName);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingSession(null);
                                                                setEditingSessionName('');
                                                            }
                                                        } }
                                                        onClick={ (e) => e.stopPropagation() }
                                                        className="w-32 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                                        autoFocus
                                                    />
                                                    <button
                                                        className="w-6 h-6 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded flex items-center justify-center"
                                                        onClick={ (e) => {
                                                            e.stopPropagation();
                                                            updateSessionSummary(project.name, session.id, editingSessionName);
                                                        } }
                                                        title="保存"
                                                    >
                                                        <Check
                                                            className="w-3 h-3 text-green-600 dark:text-green-400"/>
                                                    </button>
                                                    <button
                                                        className="w-6 h-6 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 rounded flex items-center justify-center"
                                                        onClick={ (e) => {
                                                            e.stopPropagation();
                                                            setEditingSession(null);
                                                            setEditingSessionName('');
                                                        } }
                                                        title="取消"
                                                    >
                                                        <X className="w-3 h-3 text-gray-600 dark:text-gray-400"/>
                                                    </button>
                                                </>) : (<>
                                                    {/* Generate summary button */ }
                                                    {/* <button
                                      className="w-6 h-6 bg-primary/5 hover:bg-primary/10 rounded flex items-center justify-center"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateSessionSummary(project.name, session.id);
                                      }}
                                      title="Generate AI summary for this session"
                                      disabled={generatingSummary[`${project.name}-${session.id}`]}
                                    >
                                      {generatingSummary[`${project.name}-${session.id}`] ? (
                                        <div className="w-3 h-3 animate-spin rounded-full border border-blue-600 dark:border-blue-400 border-t-transparent" />
                                      ) : (
                                        <Sparkles className="w-3 h-3 text-primary" />
                                      )}
                                    </button> */ }
                                                    {/* Edit button */ }
                                                    <button
                                                        className="w-6 h-6 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 rounded flex items-center justify-center"
                                                        onClick={ (e) => {
                                                            e.stopPropagation();
                                                            setEditingSession(session.id);
                                                            setEditingSessionName(session.summary || '新会话');
                                                        } }
                                                        title="手动编辑会话名称"
                                                    >
                                                        <Edit2
                                                            className="w-3 h-3 text-gray-600 dark:text-gray-400"/>
                                                    </button>
                                                    {/* Delete button */ }
                                                    <button
                                                        className="w-6 h-6 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded flex items-center justify-center"
                                                        onClick={ (e) => {
                                                            e.stopPropagation();
                                                            deleteSession(project.name, session.id);
                                                        } }
                                                        title="永久删除此会话"
                                                    >
                                                        <Trash2
                                                            className="w-3 h-3 text-red-600 dark:text-red-400"/>
                                                    </button>
                                                </>) }
                                            </div>
                                        </div>
                                    </div>
                                </div>);
                            })) }

                            {/* Show More Sessions Button */ }
                            { getAllSessions(project).length > 0 && project.sessionMeta?.hasMore !== false && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-center gap-2 mt-2 text-muted-foreground"
                                    onClick={ () => loadMoreSessions(project) }
                                    disabled={ loadingSessions[project.name] }
                                >
                                    { loadingSessions[project.name] ? (<>
                                        <div
                                            className="w-3 h-3 animate-spin rounded-full border border-muted-foreground border-t-transparent"/>
                                        正在加载...
                                    </>) : (<>
                                        <ChevronDown className="w-3 h-3"/>
                                        显示更多会话
                                    </>) }
                                </Button>) }

                            <Button
                                variant="default"
                                size="sm"
                                className="flex w-full justify-start gap-2 mt-1 h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground smooth-transition interactive-element"
                                onClick={ () => onNewSession(project) }
                            >
                                <Plus className="w-3 h-3"/>
                                新建会话
                            </Button>
                        </div>) }
                        </AnimatedListItem>
                    );
                })) }
            </div>
        </ScrollArea>

        {/* Version Update Notification */ }
        { updateAvailable && (<div className="md:p-2 border-t border-border/50 flex-shrink-0">
            {/* Desktop Version Notification */ }
            <div className="block">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 p-3 h-auto font-normal text-left hover:bg-primary/5 transition-colors duration-200 border border-primary/20 rounded-lg mb-2"
                    onClick={ onShowVersionModal }
                >
                    <div className="relative">
                        <svg className="w-4 h-4 text-primary" fill="none"
                             stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                        </svg>
                        <div
                            className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse"/>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-primary">有可用更新</div>
                        <div
                            className="text-xs text-primary">版本 { latestVersion } 已准备就绪
                        </div>
                    </div>
                </Button>
            </div>

            {/* Mobile Version Notification removed for desktop-only */ }
        </div>) }

        {/* Settings Section */ }
        <div className="md:p-2 md:border-t md:border-border flex-shrink-0">
            {/* Desktop Settings */ }
            <Button
                variant="ghost"
                className="flex w-full justify-start gap-2 p-2 h-auto font-normal text-muted-foreground hover:text-foreground hover:bg-accent smooth-transition interactive-element"
                onClick={ onShowSettings }
            >
                <Settings className="w-3 h-3"/>
                <span className="text-xs">设置</span>
            </Button>
        </div>
        
        {/* Project Memory Editor */}
        <MemoryEditor
            type="project"
            projectName={memoryEditingProject?.name}
            isOpen={showMemoryEditor}
            onClose={() => {
                setShowMemoryEditor(false);
                setMemoryEditingProject(null);
            }}
            onSave={() => {
                // Memory saved successfully
            }}
        />
    </div>);
});

export default Sidebar;