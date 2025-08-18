import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../utils/api';

/**
 * 全局使用量进度条组件 - 显示在应用标题栏
 */
export function GlobalUsageBar() {
    const [usageData, setUsageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(() => {
        return localStorage.getItem('selectedUsagePlan') || 'custom';
    });
    
    console.log('🌐 GlobalUsageBar rendering, plan:', selectedPlan);
    
    // 订阅计划配置
    const planOptions = {
        'pro': { tokens: 19000, name: 'Pro' },
        'max5': { tokens: 88000, name: 'Max5' },
        'max20': { tokens: 220000, name: 'Max20' },
        'custom': { 
            tokens: parseInt(localStorage.getItem('customTokenLimit')) || 50000, 
            name: 'Custom' 
        }
    };
    
    const currentPlan = planOptions[selectedPlan] || planOptions.custom;
    
    // 获取实时使用量数据
    const fetchUsageData = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('🌐 GlobalUsageBar fetching data...');
            const response = await apiFetch('/api/usage/realtime');
            const result = await response.json();
            console.log('🌐 GlobalUsageBar API response:', result);
            if (result.success) {
                setUsageData(result.data);
                console.log('🌐 GlobalUsageBar data set:', result.data);
            } else {
                setError(result.error || 'API返回失败');
            }
        } catch (error) {
            console.error('🌐 GlobalUsageBar fetch error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    // 监听localStorage变化
    useEffect(() => {
        const handleStorageChange = () => {
            setSelectedPlan(localStorage.getItem('selectedUsagePlan') || 'custom');
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // 初始加载和定期刷新
        fetchUsageData();
        const interval = setInterval(fetchUsageData, 30000); // 30秒刷新一次
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);
    
    const usage = usageData?.currentUsage?.totalTokens || 0;
    const percentage = (usage / currentPlan.tokens) * 100;
    
    console.log('🌐 GlobalUsageBar render state:', { usage, percentage, loading, error, usageData: !!usageData });
    
    // 根据使用量确定颜色
    const getProgressColor = () => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 75) return 'bg-yellow-500';
        if (percentage >= 50) return 'bg-orange-500';
        return 'bg-green-500';
    };
    
    // 如果有错误，显示错误状态
    if (error) {
        return (
            <div className="flex items-center space-x-2 px-3 text-red-500">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Usage Error</span>
            </div>
        );
    }
    
    // 如果正在加载，显示加载状态
    if (loading) {
        return (
            <div className="flex items-center space-x-2 px-3">
                <Activity className="w-4 h-4 text-gray-500 animate-pulse" />
                <span className="text-xs text-gray-500">Loading...</span>
            </div>
        );
    }
    
    return (
        <div className="flex items-center space-x-2 px-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-md border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center space-x-1">
                <Activity className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Usage</span>
            </div>
            
            <div className="flex items-center space-x-1 min-w-[120px]">
                <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-300 rounded-full ${getProgressColor()}`}
                            style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                    </div>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {percentage.toFixed(0)}%
                </span>
            </div>
        </div>
    );
}