import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
    Brain,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Globe,
    FolderOpen,
    Eye,
    EyeOff,
    FileText,
    X
} from 'lucide-react';

const MemoryEditor = ({ 
    type = 'project', // 'project' or 'global'
    projectName = null, 
    isOpen = false, 
    onClose = () => {},
    onSave = () => {},
    initialContent = ''
}) => {
    const [content, setContent] = useState(initialContent);
    const [originalContent, setOriginalContent] = useState(initialContent);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    // Load content when component opens
    useEffect(() => {
        if (isOpen && !initialContent) {
            loadContent();
        }
    }, [isOpen, type, projectName]);

    // Track changes
    useEffect(() => {
        setHasChanges(content !== originalContent);
    }, [content, originalContent]);

    // Auto-hide success message
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    // Handle ESC key to close editor
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, hasChanges]);

    const loadContent = async () => {
        setLoading(true);
        setError(null);
        
        try {
            let response;
            if (type === 'global') {
                response = await api.getGlobalMemory();
            } else {
                response = await api.getProjectMemory(projectName);
            }
            
            const data = await response.json();
            const loadedContent = data.content || '';
            setContent(loadedContent);
            setOriginalContent(loadedContent);
        } catch (err) {
            setError(`Failed to load memory: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const saveContent = async () => {
        setSaving(true);
        setError(null);
        
        try {
            let response;
            if (type === 'global') {
                response = await api.saveGlobalMemory(content);
            } else {
                response = await api.saveProjectMemory(projectName, content);
            }
            
            if (response.ok) {
                setOriginalContent(content);
                setSuccess(true);
                onSave(content);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Save failed');
            }
        } catch (err) {
            setError(`Failed to save memory: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (hasChanges) {
            if (confirm('您有未保存的更改。确定要关闭吗？')) {
                setContent(originalContent);
                onClose();
            }
        } else {
            onClose();
        }
    };

    const resetContent = () => {
        if (confirm('确定要重置为原始内容吗？')) {
            setContent(originalContent);
        }
    };

    if (!isOpen) return null;

    const isGlobal = type === 'global';
    const title = isGlobal ? '全局 Memory (CLAUDE.md)' : `项目 Memory (${projectName})`;
    const description = isGlobal 
        ? '全局 Memory 文件适用于所有项目，包含通用的指令和偏好设置。'
        : '项目 Memory 文件仅适用于当前项目，包含项目特定的上下文和指令。';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        {isGlobal ? (
                            <Globe className="w-5 h-5 text-blue-500" />
                        ) : (
                            <FolderOpen className="w-5 h-5 text-green-500" />
                        )}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {title}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {description}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasChanges && (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                                未保存
                            </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={handleClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewMode(!previewMode)}
                        >
                            {previewMode ? (
                                <>
                                    <EyeOff className="w-4 h-4 mr-2" />
                                    编辑模式
                                </>
                            ) : (
                                <>
                                    <Eye className="w-4 h-4 mr-2" />
                                    预览模式
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadContent}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            刷新
                        </Button>
                        {hasChanges && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetContent}
                            >
                                重置
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="flex items-center gap-2 text-green-600 text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                保存成功
                            </div>
                        )}
                        <Button
                            onClick={saveContent}
                            disabled={!hasChanges || saving}
                            size="sm"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? '保存中...' : '保存'}
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : previewMode ? (
                        <div className="h-full overflow-auto scrollbar-auto-hide p-6">
                            {content ? (
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
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm, remarkBreaks]}
                                        components={{
                                            // 自定义代码块渲染
                                            code: ({ node, inline, className, children, ...props }) => {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return !inline && match ? (
                                                    <pre className="overflow-x-auto scrollbar-thin">
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
                                            // 自定义链接渲染
                                            a: ({ node, ...props }) => (
                                                <a {...props} target="_blank" rel="noopener noreferrer" />
                                            )
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Memory 文件为空</p>
                                    <p className="text-sm">切换到编辑模式开始添加内容</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={`输入 ${isGlobal ? '全局' : '项目'} Memory 内容...

示例内容：
# ${isGlobal ? '全局' : '项目'} Memory

## 偏好设置
- 使用简洁的代码风格
- 优先考虑性能和可读性

## 上下文信息
${isGlobal 
    ? '- 我是一个全栈开发者\n- 偏好使用 TypeScript 和 React' 
    : '- 这是一个 React 应用项目\n- 使用 Vite 作为构建工具'}

## 特殊指令
- 总是包含适当的错误处理
- 代码应该有良好的注释`}
                            className="w-full h-full p-4 border-0 outline-none resize-none font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
                            spellCheck={false}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-4">
                            <span>字符数: {content.length}</span>
                            <span>行数: {content.split('\n').length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            <span>
                                路径: {isGlobal ? '~/.claude/CLAUDE.md' : `${projectName}/CLAUDE.md`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemoryEditor;