import React, { useState, useEffect } from 'react';
import { Settings, Check, X, ChevronDown, Bot } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { apiFetch } from '../../utils/api';

/**
 * 模型配置按钮组件
 * 提供 /model 配置功能
 */
export function ModelConfigButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStrategy, setCurrentStrategy] = useState(null);
    const [availableStrategies, setAvailableStrategies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 策略颜色映射
    const getStrategyColor = (strategyId) => {
        switch (strategyId) {
            case 'default': return 'bg-blue-500';
            case 'opus': return 'bg-purple-500';
            case 'sonnet': return 'bg-green-500';
            case 'opus-plan': return 'bg-indigo-500';
            default: return 'bg-gray-500';
        }
    };

    // 获取当前策略
    const fetchCurrentStrategy = async () => {
        try {
            const response = await apiFetch('/api/model');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    setCurrentStrategy(result.data.currentStrategy || 'default');
                }
            }
        } catch (err) {
            console.error('获取当前策略失败:', err);
            setCurrentStrategy('default');
        }
    };

    // 获取可用策略列表
    const fetchAvailableStrategies = async () => {
        try {
            const response = await apiFetch('/api/model/list');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    setAvailableStrategies(result.data);
                } else {
                    throw new Error('无效的API响应');
                }
            }
        } catch (err) {
            console.error('获取策略列表失败:', err);
            // 回退到默认策略列表
            setAvailableStrategies([
                { id: 'default', name: 'Default (recommended)', description: 'Opus 4.1 for up to 20% of usage limits, then use Sonnet 4', recommended: true },
                { id: 'opus', name: 'Opus', description: 'Opus 4.1 for complex tasks · Reaches usage limits faster', recommended: false },
                { id: 'sonnet', name: 'Sonnet', description: 'Sonnet 4 for daily use', recommended: false },
                { id: 'opus-plan', name: 'Opus Plan Mode', description: 'Use Opus 4.1 in plan mode, Sonnet 4 otherwise', recommended: false }
            ]);
        }
    };

    // 设置策略
    const setStrategy = async (strategyId) => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await apiFetch('/api/model', {
                method: 'POST',
                body: JSON.stringify({ model: strategyId })
            });
            
            if (response.ok) {
                setCurrentStrategy(strategyId);
                setIsOpen(false);
            } else {
                const errorData = await response.json();
                setError(errorData.error || '设置策略失败');
            }
        } catch (err) {
            console.error('设置策略失败:', err);
            setError('网络错误');
        } finally {
            setLoading(false);
        }
    };

    // 初始化数据
    useEffect(() => {
        if (isOpen) {
            fetchCurrentStrategy();
            fetchAvailableStrategies();
        }
    }, [isOpen]);

    const currentStrategyInfo = availableStrategies.find(s => s.id === currentStrategy);
    const displayName = currentStrategyInfo ? currentStrategyInfo.name : (currentStrategy || 'Default');

    return (
        <div className="relative">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 h-8 px-3"
            >
                <div className={`w-3 h-3 rounded-full ${getStrategyColor(currentStrategy || 'default')}`}></div>
                <span className="text-xs">{displayName}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[420px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium flex items-center">
                                <Settings className="w-4 h-4 mr-2" />
                                模型策略配置
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                                className="h-6 w-6 p-0"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>


                        {/* 错误提示 */}
                        {error && (
                            <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* 策略列表 */}
                        <div className="space-y-2">
                            {availableStrategies.map(strategy => {
                                const isSelected = strategy.id === currentStrategy;
                                
                                return (
                                    <button
                                        key={strategy.id}
                                        onClick={() => setStrategy(strategy.id)}
                                        disabled={loading || isSelected}
                                        className={`w-full p-3 text-left rounded-md border transition-colors ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-3 h-3 rounded-full ${getStrategyColor(strategy.id)}`}></div>
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`font-medium text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                                                            {strategy.name}
                                                        </div>
                                                        {strategy.recommended && (
                                                            <Badge variant="outline" className="text-xs">推荐</Badge>
                                                        )}
                                                        {isSelected && (
                                                            <Badge variant="default" className="text-xs bg-blue-500 text-white">当前</Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {strategy.description}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-blue-500" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {loading && (
                            <div className="mt-3 text-center text-sm text-gray-500">
                                正在设置策略...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}