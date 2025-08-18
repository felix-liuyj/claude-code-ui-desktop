import React from 'react';
import { AlertTriangle, TrendingUp, Clock, DollarSign } from 'lucide-react';

/**
 * 使用量进度条组件 - 显示令牌、成本、消息使用情况
 */
export function UsageProgressBar({ 
    label, 
    current, 
    limit, 
    unit = '', 
    type = 'default',
    showPercentage = true,
    showWarnings = true,
    formatValue = (value) => value?.toLocaleString() || '0'
}) {
    const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
    
    // 根据使用量百分比确定颜色主题
    const getColorClasses = () => {
        if (percentage >= 90) {
            return {
                bg: 'bg-red-500',
                text: 'text-red-600',
                border: 'border-red-200',
                icon: 'text-red-500'
            };
        } else if (percentage >= 75) {
            return {
                bg: 'bg-yellow-500',
                text: 'text-yellow-600',
                border: 'border-yellow-200',
                icon: 'text-yellow-500'
            };
        } else if (percentage >= 50) {
            return {
                bg: 'bg-blue-500',
                text: 'text-blue-600',
                border: 'border-blue-200',
                icon: 'text-blue-500'
            };
        } else {
            return {
                bg: 'bg-green-500',
                text: 'text-green-600',
                border: 'border-green-200',
                icon: 'text-green-500'
            };
        }
    };

    const colors = getColorClasses();
    
    // 获取图标
    const getIcon = () => {
        switch (type) {
            case 'cost':
                return <DollarSign className={`w-4 h-4 ${colors.icon}`} />;
            case 'time':
                return <Clock className={`w-4 h-4 ${colors.icon}`} />;
            case 'burnRate':
                return <TrendingUp className={`w-4 h-4 ${colors.icon}`} />;
            default:
                return null;
        }
    };

    return (
        <div className={`p-4 rounded-lg border ${colors.border} bg-white dark:bg-gray-800`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    {getIcon()}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                        {label}
                    </span>
                    {showWarnings && percentage >= 75 && (
                        <AlertTriangle className={`w-4 h-4 ${colors.icon}`} />
                    )}
                </div>
                {showPercentage && (
                    <span className={`text-sm font-semibold ${colors.text}`}>
                        {percentage.toFixed(1)}%
                    </span>
                )}
            </div>
            
            {/* 进度条 */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                <div 
                    className={`h-2.5 rounded-full transition-all duration-300 ${colors.bg}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
            
            {/* 数值显示 */}
            <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                    {formatValue(current)}{unit} / {formatValue(limit)}{unit}
                </span>
                <span className="text-gray-500 dark:text-gray-500">
                    剩余: {formatValue(Math.max(0, limit - current))}{unit}
                </span>
            </div>
        </div>
    );
}