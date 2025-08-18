import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Activity, Timer, AlertCircle, CheckCircle, TrendingUp, WifiOff, Wifi, Settings, Save, X, DollarSign, MessageSquare, Clock, Zap, CreditCard, Bot, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { UsageProgressBar } from './UsageProgressBar';
import { ModelConfigButton } from './ModelConfigButton';
import { apiFetch } from '../../utils/api';

/**
 * 实时监控视图组件
 */
export function RealTimeView() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30秒
    const [wsConnected, setWsConnected] = useState(false);
    const [useWebSocket, setUseWebSocket] = useState(true);
    // 从 localStorage读取保存的计划选择
    const [selectedPlan, setSelectedPlan] = useState(() => {
        return localStorage.getItem('selectedUsagePlan') || 'custom';
    });
    const [tempSelectedPlan, setTempSelectedPlan] = useState(selectedPlan);
    const [showPlanConfig, setShowPlanConfig] = useState(false);
    const [customTokenLimit, setCustomTokenLimit] = useState(() => {
        return parseInt(localStorage.getItem('customTokenLimit')) || 50000;
    });
    const wsRef = useRef(null);
    
    // 订阅计划配置
    const planOptions = [
        { id: 'pro', name: 'Claude Pro', tokens: 19000, cost: 18.00, messages: 250 },
        { id: 'max5', name: 'Claude Max5', tokens: 88000, cost: 35.00, messages: 1000 },
        { id: 'max20', name: 'Claude Max20', tokens: 220000, cost: 140.00, messages: 2000 },
        { id: 'custom', name: '自定义', tokens: customTokenLimit, cost: customTokenLimit * 0.001, messages: 500 }
    ];

    // 获取实时数据
    const fetchRealTimeData = async () => {
        try {
            setLoading(true);
            const response = await apiFetch('/api/usage/realtime');
            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                setLastUpdated(new Date());
                setError(null);
            } else {
                setError(result.error || '获取数据失败');
            }
        } catch (err) {
            console.error('Error fetching real-time data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // WebSocket连接管理
    const connectWebSocket = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            // 检查是否在Electron环境中
            const isElectron = window.electronAPI;
            let wsUrl;
            
            if (isElectron) {
                // Electron环境，使用固定的localhost:3001
                const port = window.electronAPI?.getConfig?.()?.PORT || '3001';
                wsUrl = `ws://localhost:${port}/ws`;
            } else {
                // Web环境，使用当前页面的host
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${window.location.host}/ws`;
            }
            
            wsRef.current = new WebSocket(wsUrl);
            
            wsRef.current.onopen = () => {
                console.log('📊 Usage monitoring WebSocket connected');
                setWsConnected(true);
                setError(null);
                
                // 订阅使用量数据
                wsRef.current.send(JSON.stringify({
                    type: 'usage-subscribe'
                }));
            };
            
            wsRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'usage-data' || message.type === 'usage-data-update') {
                        setData(message.data);
                        setLastUpdated(new Date(message.timestamp));
                        setLoading(false);
                        setError(null);
                    } else if (message.type === 'usage-error') {
                        setError(message.error);
                        setLoading(false);
                    }
                } catch (err) {
                    console.error('Error parsing WebSocket message:', err);
                }
            };
            
            wsRef.current.onclose = () => {
                console.log('📊 Usage monitoring WebSocket disconnected');
                setWsConnected(false);
                
                // 自动重连
                if (useWebSocket) {
                    setTimeout(connectWebSocket, 5000);
                }
            };
            
            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setWsConnected(false);
                setError('WebSocket连接错误');
            };
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
            setUseWebSocket(false); // 回退到HTTP轮询
        }
    };

    const disconnectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
                type: 'usage-unsubscribe'
            }));
            wsRef.current.close();
        }
    };

    // 初始加载
    useEffect(() => {
        if (useWebSocket) {
            connectWebSocket();
        } else {
            fetchRealTimeData();
        }

        return () => {
            disconnectWebSocket();
        };
    }, [useWebSocket]);

    // HTTP轮询回退机制
    useEffect(() => {
        if (!useWebSocket && autoRefresh) {
            const interval = setInterval(fetchRealTimeData, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [useWebSocket, autoRefresh, refreshInterval]);

    // 格式化燃烧率
    const formatBurnRate = (rate) => {
        if (rate < 1) return (rate * 60).toFixed(1) + '/小时';
        return rate.toFixed(1) + '/分钟';
    };

    // 格式化时间
    const formatTimeRemaining = (minutes) => {
        if (minutes === Infinity || minutes <= 0) return '无限制';
        if (minutes < 60) return `${Math.round(minutes)} 分钟`;
        if (minutes < 1440) return `${Math.round(minutes / 60)} 小时`;
        return `${Math.round(minutes / 1440)} 天`;
    };
    
    // 计算下一次重置时间 (5小时窗口)
    const getNextResetTime = () => {
        const now = new Date();
        const windowEnd = data?.sessionWindow?.end;
        if (!windowEnd) {
            // 默认为当前时间 + 5小时
            const nextReset = new Date(now.getTime() + 5 * 60 * 60 * 1000);
            return nextReset.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        // 使用窗口结束时间
        return new Date(windowEnd).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };

    // 格式化成本
    const formatCost = (cost) => {
        return `$${cost.toFixed(2)}`;
    };

    // 渲染文本进度条
    const renderTextProgressBar = (percentage, length = 50) => {
        // 确保百分比在有效范围内
        const safePercentage = Math.max(0, Math.min(100, percentage || 0));
        const filled = Math.max(0, Math.round((safePercentage / 100) * length));
        const empty = Math.max(0, length - filled);
        return '█'.repeat(filled) + '░'.repeat(empty);
    };

    // 获取状态颜色和表情
    const getStatusIndicator = (percentage) => {
        const safePercentage = Math.max(0, Math.min(100, percentage || 0));
        if (safePercentage >= 90) return { emoji: '🔴', color: 'text-red-500' };
        if (safePercentage >= 75) return { emoji: '🟡', color: 'text-yellow-500' };
        if (safePercentage >= 50) return { emoji: '🟠', color: 'text-orange-500' };
        return { emoji: '🟢', color: 'text-green-500' };
    };

    // 计算预测时间
    const calculatePredictions = () => {
        const burnRate = data?.burnRate?.tokensPerMinute || 0;
        const currentTokens = data?.currentUsage?.totalTokens || 0;
        const limitTokens = currentPlan.tokens;
        const remainingTokens = limitTokens - currentTokens;
        
        if (burnRate <= 0) return { runOutTime: 'N/A', resetTime: 'N/A' };
        
        const minutesToRunOut = remainingTokens / burnRate;
        const runOutTime = new Date(Date.now() + minutesToRunOut * 60 * 1000);
        
        // 假设限制重置时间是5小时后
        const resetTime = new Date(Date.now() + 5 * 60 * 60 * 1000);
        
        return {
            runOutTime: runOutTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            resetTime: resetTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        };
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>加载实时数据...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold">错误</span>
                </div>
                <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
                <Button 
                    onClick={fetchRealTimeData} 
                    className="mt-3 bg-red-600 hover:bg-red-700"
                    size="sm"
                >
                    重试
                </Button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-8 text-gray-500">
                暂无数据
            </div>
        );
    }

    // 获取当前选中的计划配置
    const currentPlan = planOptions.find(p => p.id === selectedPlan) || planOptions[0];
    const tempPlan = planOptions.find(p => p.id === tempSelectedPlan) || planOptions[0];
    
    // 保存计划配置
    const savePlanConfig = () => {
        setSelectedPlan(tempSelectedPlan);
        localStorage.setItem('selectedUsagePlan', tempSelectedPlan);
        if (tempSelectedPlan === 'custom') {
            localStorage.setItem('customTokenLimit', customTokenLimit.toString());
        }
        setShowPlanConfig(false);
        
        // 通知后端更新配置
        apiFetch('/api/usage/custom-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokens: tempPlan.tokens,
                cost: tempPlan.cost,
                messages: tempPlan.messages
            })
        });
    };
    
    return (
        <div className="space-y-6">
            {/* 计划配置模态框 */}
            {showPlanConfig && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">订阅计划配置</h3>
                            <button
                                onClick={() => setShowPlanConfig(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">选择订阅计划</label>
                                <select
                                    value={tempSelectedPlan}
                                    onChange={(e) => setTempSelectedPlan(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                >
                                    {planOptions.map(plan => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name} ({plan.tokens.toLocaleString()} tokens)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {tempSelectedPlan === 'custom' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">自定义Token限额</label>
                                    <input
                                        type="number"
                                        value={customTokenLimit}
                                        onChange={(e) => setCustomTokenLimit(parseInt(e.target.value) || 0)}
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        min="1000"
                                        step="1000"
                                    />
                                </div>
                            )}
                            
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                <p className="text-sm">
                                    <strong>当前选择：</strong> {tempPlan.name}
                                </p>
                                <p className="text-sm mt-1">
                                    <strong>Token限额：</strong> {tempPlan.tokens.toLocaleString()}
                                </p>
                                <p className="text-sm">
                                    <strong>成本限额：</strong> ${tempPlan.cost.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-2 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setTempSelectedPlan(selectedPlan);
                                    setShowPlanConfig(false);
                                }}
                            >
                                取消
                            </Button>
                            <Button onClick={savePlanConfig}>
                                <Save className="w-4 h-4 mr-2" />
                                保存配置
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 头部状态栏和计划信息 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            <span className="font-semibold">实时监控</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                            {currentPlan.name}
                        </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        <Button
                            onClick={() => setShowPlanConfig(true)}
                            variant="outline"
                            size="sm"
                        >
                            <Settings className="w-4 h-4 mr-1" />
                            配置计划
                        </Button>
                        {useWebSocket && (
                            <Badge variant={wsConnected ? "default" : "secondary"} className="text-xs">
                                {wsConnected ? (
                                    <><Wifi className="w-3 h-3 inline mr-1" />实时</>
                                ) : (
                                    <><WifiOff className="w-3 h-3 inline mr-1" />离线</>
                                )}
                            </Badge>
                        )}
                    </div>
                </div>
                
                
                {/* 使用量进度条 */}
                <div className="space-y-4">
                    {/* Cost Usage */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium flex items-center">
                                <DollarSign className="w-4 h-4 mr-1 text-purple-500" />
                                Cost 使用量
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                ${(data?.currentUsage?.totalCost || 0).toFixed(2)} / ${currentPlan.cost.toFixed(2)}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-300 rounded-full ${
                                    ((data?.currentUsage?.totalCost || 0) / currentPlan.cost * 100) >= 90 ? 'bg-red-500' :
                                    ((data?.currentUsage?.totalCost || 0) / currentPlan.cost * 100) >= 75 ? 'bg-yellow-500' :
                                    ((data?.currentUsage?.totalCost || 0) / currentPlan.cost * 100) >= 50 ? 'bg-orange-500' :
                                    'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, ((data?.currentUsage?.totalCost || 0) / currentPlan.cost * 100))}%` }}
                            />
                        </div>
                    </div>

                    {/* Token Usage */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium flex items-center">
                                <Activity className="w-4 h-4 mr-1 text-blue-500" />
                                Token 使用量
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {(data?.currentUsage?.totalTokens || 0).toLocaleString()} / {currentPlan.tokens.toLocaleString()}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-300 rounded-full ${
                                    ((data?.currentUsage?.totalTokens || 0) / currentPlan.tokens * 100) >= 90 ? 'bg-red-500' :
                                    ((data?.currentUsage?.totalTokens || 0) / currentPlan.tokens * 100) >= 75 ? 'bg-yellow-500' :
                                    ((data?.currentUsage?.totalTokens || 0) / currentPlan.tokens * 100) >= 50 ? 'bg-orange-500' :
                                    'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, ((data?.currentUsage?.totalTokens || 0) / currentPlan.tokens * 100))}%` }}
                            />
                        </div>
                    </div>

                    {/* Messages Usage */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium flex items-center">
                                <MessageSquare className="w-4 h-4 mr-1 text-emerald-500" />
                                Messages 使用量
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {data?.currentUsage?.totalMessages || 0} / {currentPlan.messages.toLocaleString()}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-300 rounded-full ${
                                    ((data?.currentUsage?.totalMessages || 0) / currentPlan.messages * 100) >= 90 ? 'bg-red-500' :
                                    ((data?.currentUsage?.totalMessages || 0) / currentPlan.messages * 100) >= 75 ? 'bg-yellow-500' :
                                    ((data?.currentUsage?.totalMessages || 0) / currentPlan.messages * 100) >= 50 ? 'bg-orange-500' :
                                    'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, ((data?.currentUsage?.totalMessages || 0) / currentPlan.messages * 100))}%` }}
                            />
                        </div>
                    </div>

                    {/* Model Distribution */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium flex items-center">
                                <Bot className="w-4 h-4 mr-1 text-blue-500" />
                                模型分布
                            </span>
                            {/* 颜色图例 - 简化版 */}
                            <div className="flex items-center space-x-2 text-xs">
                                {(() => {
                                    const distribution = data?.modelDistribution || {};
                                    const models = Object.keys(distribution);
                                    if (models.length === 0) return null;
                                    
                                    const sorted = models.sort((a, b) => distribution[b].percentage - distribution[a].percentage);
                                    
                                    return sorted.slice(0, 2).map(model => {
                                        const color = model === 'Sonnet' ? '#3b82f6' : 
                                                     model === 'Opus' ? '#8b5cf6' : 
                                                     model === 'Haiku' ? '#10b981' : '#6b7280';
                                        const percentage = distribution[model].percentage;
                                        
                                        return (
                                            <div key={model} className="flex items-center space-x-1">
                                                <div 
                                                    className="w-2 h-2 rounded-full" 
                                                    style={{ backgroundColor: color }}
                                                ></div>
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {model} {percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        
                        {/* 多色进度条 */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden flex">
                            {(() => {
                                const distribution = data?.modelDistribution || {};
                                const models = Object.keys(distribution);
                                if (models.length === 0) {
                                    return <div className="h-full bg-gray-300 dark:bg-gray-600 flex-1"></div>;
                                }
                                
                                const sorted = models.sort((a, b) => distribution[b].percentage - distribution[a].percentage);
                                
                                return sorted.map((model, index) => {
                                    const percentage = distribution[model].percentage;
                                    const color = model === 'Sonnet' ? '#3b82f6' : 
                                                 model === 'Opus' ? '#8b5cf6' : 
                                                 model === 'Haiku' ? '#10b981' : '#6b7280';
                                    
                                    return (
                                        <div 
                                            key={model}
                                            className="h-full transition-all duration-300"
                                            style={{ 
                                                backgroundColor: color,
                                                width: `${percentage}%`
                                            }}
                                            title={`${model}: ${percentage.toFixed(1)}%`}
                                        />
                                    );
                                });
                            })()}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 flex items-center">
                                <Zap className="w-3 h-3 mr-1" />
                                燃烧率
                            </span>
                            <p className="font-semibold">{(data?.burnRate?.tokensPerMinute || 0).toFixed(1)} /min</p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 flex items-center">
                                <CreditCard className="w-3 h-3 mr-1" />
                                成本率
                            </span>
                            <p className="font-semibold">${(() => {
                                // 基于Sonnet模型的平均成本计算（输入0.003 + 输出0.015 = 平均约0.009每千token）
                                const burnRate = data?.burnRate?.tokensPerMinute || 0;
                                const avgCostPerK = 0.009; // 平均每千token成本
                                return (burnRate * avgCostPerK / 1000).toFixed(4);
                            })()} /min</p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 flex items-center">
                                <Target className="w-3 h-3 mr-1" />
                                预计耗尽
                            </span>
                            <p className="font-semibold">{(() => {
                                const burnRate = data?.burnRate?.tokensPerMinute || 0;
                                const currentTokens = data?.currentUsage?.totalTokens || 0;
                                const limitTokens = currentPlan.tokens;
                                const remainingTokens = limitTokens - currentTokens;
                                
                                if (burnRate <= 0) return 'N/A';
                                
                                const minutesToRunOut = remainingTokens / burnRate;
                                const runOutTime = new Date(Date.now() + minutesToRunOut * 60 * 1000);
                                
                                return runOutTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                            })()}</p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                重置时间
                            </span>
                            <p className="font-semibold">{(() => {
                                // 使用真实的会话窗口结束时间
                                const windowEnd = data?.sessionWindow?.end;
                                if (windowEnd) {
                                    return new Date(windowEnd).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                                }
                                // 回退到默认计算
                                return getNextResetTime();
                            })()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 模型使用详情 */}
            <div className="p-4 rounded-lg border border-gray-200 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <Bot className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">模型使用详情</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <ModelConfigButton />
                    </div>
                </div>
                <div className="space-y-3">
                    {(() => {
                        const distribution = data?.modelDistribution || {};
                        const models = Object.keys(distribution);
                        
                        if (models.length === 0) {
                            return (
                                <div className="text-center text-gray-500 py-4">
                                    暂无模型使用数据
                                </div>
                            );
                        }
                        
                        // 按使用率排序
                        const sortedModels = models.sort((a, b) => distribution[b].percentage - distribution[a].percentage);
                        
                        return sortedModels.map(model => {
                            const stats = distribution[model];
                            const percentage = stats.percentage;
                            
                            return (
                                <div key={model} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium flex items-center">
                                            <span className="w-3 h-3 rounded-full mr-2" style={{
                                                backgroundColor: model === 'Sonnet' ? '#3b82f6' : 
                                                               model === 'Opus' ? '#8b5cf6' : 
                                                               model === 'Haiku' ? '#10b981' : '#6b7280'
                                            }}></span>
                                            {model}
                                        </span>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold">{percentage.toFixed(1)}%</div>
                                            <div className="text-xs text-gray-500">
                                                {stats.tokens.toLocaleString()} tokens
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div 
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{ 
                                                width: `${percentage}%`,
                                                backgroundColor: model === 'Sonnet' ? '#3b82f6' : 
                                                               model === 'Opus' ? '#8b5cf6' : 
                                                               model === 'Haiku' ? '#10b981' : '#6b7280'
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <div>
                                            <span className="block">成本</span>
                                            <span className="font-semibold">${stats.cost.toFixed(4)}</span>
                                        </div>
                                        <div>
                                            <span className="block">消息</span>
                                            <span className="font-semibold">{stats.messages}</span>
                                        </div>
                                        <div>
                                            <span className="block">占比</span>
                                            <span className="font-semibold">{percentage.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* 会话窗口信息 */}
            <div className="p-4 rounded-lg border border-gray-200 bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-2 mb-3">
                    <Timer className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">会话窗口信息</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">窗口开始</span>
                        <span className="font-mono text-sm font-semibold">
                            {new Date(data.sessionWindow.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">窗口结束</span>
                        <span className="font-mono text-sm font-semibold">
                            {new Date(data.sessionWindow.end).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">活动会话</span>
                        <span className="font-mono text-sm font-semibold">
                            {data.activeSessions} 个
                        </span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 block">剩余时长</span>
                        <span className="font-mono text-sm font-semibold">
                            {(() => {
                                const now = new Date();
                                const end = new Date(data.sessionWindow.end);
                                const remainingMs = end - now;
                                if (remainingMs <= 0) return '已结束';
                                const hours = Math.floor(remainingMs / (1000 * 60 * 60));
                                const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                                return `${hours}小时${minutes}分钟`;
                            })()}
                        </span>
                    </div>
                </div>
            </div>

            {/* 警告信息 */}
            {data.warnings && data.warnings.length > 0 && (
                <div className="space-y-2">
                    <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        使用量警告
                    </h3>
                    <div className="space-y-2">
                        {data.warnings.map((warning, index) => (
                            <div 
                                key={index} 
                                className={`p-3 rounded-lg border ${
                                    warning.type === 'danger' 
                                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20' 
                                        : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20'
                                }`}
                            >
                                <div className="flex items-center space-x-2">
                                    <AlertCircle className={`w-4 h-4 ${
                                        warning.type === 'danger' ? 'text-red-500' : 'text-yellow-500'
                                    }`} />
                                    <span className={`text-sm font-medium ${
                                        warning.type === 'danger' 
                                            ? 'text-red-800 dark:text-red-200' 
                                            : 'text-yellow-800 dark:text-yellow-200'
                                    }`}>
                                        {warning.message}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 状态信息 */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                最后更新: {lastUpdated?.toLocaleTimeString()} | 
                连接模式: {useWebSocket ? (wsConnected ? 'WebSocket已连接' : 'WebSocket连接中...') : 'HTTP轮询'} |
                {!useWebSocket && (
                    <>
                        自动刷新: {autoRefresh ? '开启' : '关闭'} | 
                        刷新间隔: {refreshInterval / 1000}秒
                    </>
                )}
                {useWebSocket && wsConnected && '实时数据推送: 开启'}
            </div>
        </div>
    );
}