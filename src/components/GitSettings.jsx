import React, { useState, useEffect } from 'react';
import { Check, GitBranch, Globe, Sparkles, Settings2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

const GitSettings = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState({
        messageLanguage: 'en',
        useClaudeCLI: true,
        conventionType: 'conventional'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Language options
    const languageOptions = [
        { value: 'en', label: 'English', flag: '🇺🇸' },
        { value: 'zh', label: '简体中文', flag: '🇨🇳' },
        { value: 'zh-CN', label: '中文（中国）', flag: '🇨🇳' }
    ];

    // Convention type options
    const conventionOptions = [
        { 
            value: 'conventional', 
            label: 'Conventional Commits',
            description: 'feat(scope): description',
            example: 'feat(auth): add user login functionality'
        },
        { 
            value: 'angular', 
            label: 'Angular Style',
            description: 'type(component): description',
            example: 'fix(user-service): resolve authentication bug'
        },
        { 
            value: 'simple', 
            label: 'Simple Format',
            description: 'Action description',
            example: 'Add user authentication feature'
        },
        { 
            value: 'chinese', 
            label: '中文格式',
            description: '动作: 描述',
            example: '新增: 用户认证功能'
        }
    ];

    // Load settings on component mount
    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const response = await apiFetch('/api/git/settings');
            const data = await response.json();
            setSettings({
                messageLanguage: data.messageLanguage || 'en',
                useClaudeCLI: data.useClaudeCLI !== false,
                conventionType: data.conventionType || 'conventional'
            });
        } catch (error) {
            console.error('Error loading Git settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            const response = await apiFetch('/api/git/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            const data = await response.json();
            if (data.success) {
                console.log('Git settings saved successfully');
                // Close the modal after successful save
                setTimeout(() => {
                    onClose();
                }, 500);
            } else {
                console.error('Failed to save Git settings:', data.error);
            }
        } catch (error) {
            console.error('Error saving Git settings:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-150 ease-out"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <GitBranch className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Git 设置</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">配置提交消息生成和源代码控制选项</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <>
                            {/* Claude CLI Integration */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">智能生成</h3>
                                </div>
                                
                                <label className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">使用 Claude CLI 生成</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                启用后将使用 Claude CLI 智能分析代码变更并生成更准确的提交消息
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.useClaudeCLI}
                                        onChange={(e) => handleSettingChange('useClaudeCLI', e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                </label>
                            </div>

                            {/* Message Language */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">提交消息语言</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-2">
                                    {languageOptions.map((option) => (
                                        <label key={option.value} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{option.flag}</span>
                                                <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                                            </div>
                                            <input
                                                type="radio"
                                                name="messageLanguage"
                                                value={option.value}
                                                checked={settings.messageLanguage === option.value}
                                                onChange={(e) => handleSettingChange('messageLanguage', e.target.value)}
                                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Convention Type */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Settings2 className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">提交消息规范</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {conventionOptions.map((option) => (
                                        <label key={option.value} className="flex items-start justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                    格式: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-xs">{option.description}</code>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-500">
                                                    示例: <span className="italic">{option.example}</span>
                                                </div>
                                            </div>
                                            <input
                                                type="radio"
                                                name="conventionType"
                                                value={option.value}
                                                checked={settings.conventionType === option.value}
                                                onChange={(e) => handleSettingChange('conventionType', e.target.value)}
                                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary mt-1"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Configuration Information */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">配置优先级</p>
                                        <ul className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
                                            <li>1. 项目 CLAUDE.md 中的 Git 规范（最高优先级）</li>
                                            <li>2. 全局 ~/.claude/CLAUDE.md 中的 Git 规范</li>
                                            <li>3. 此处的应用设置</li>
                                            <li>4. 内置默认规则（最低优先级）</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>保存中...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>保存设置</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GitSettings;