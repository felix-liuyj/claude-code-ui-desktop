import React, { useState } from 'react';
import { Activity, Calendar, BarChart3, Settings, TrendingUp } from 'lucide-react';
import { RealTimeView } from './RealTimeView';
import { DailyView } from './DailyView';
import { MonthlyView } from './MonthlyView';

/**
 * 使用量监控主组件 - 包含多个视图的标签页界面
 */
export function UsageMonitor() {
    const [activeTab, setActiveTab] = useState('realtime');

    const tabs = [
        {
            id: 'realtime',
            label: '实时监控',
            icon: Activity,
            component: RealTimeView,
            description: '当前5小时窗口的实时使用情况'
        },
        {
            id: 'daily',
            label: '每日统计',
            icon: Calendar,
            component: DailyView,
            description: '按日期统计的使用量和成本'
        },
        {
            id: 'monthly',
            label: '月度分析',
            icon: BarChart3,
            component: MonthlyView,
            description: '月度趋势和长期使用分析'
        }
    ];

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="space-y-6">
            {/* 头部说明 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                    <TrendingUp className="w-6 h-6 text-blue-600 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                            Claude Code 使用量监控
                        </h3>
                        <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                            实时跟踪您的Claude AI令牌使用情况、成本分析和会话统计。
                            基于您的本地Claude配置文件分析，完全离线运行。
                        </p>
                    </div>
                </div>
            </div>

            {/* 标签页导航 */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${isActive 
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* 当前标签页说明 */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
                {tabs.find(tab => tab.id === activeTab)?.description}
            </div>

            {/* 标签页内容 */}
            <div className="min-h-[500px]">
                {ActiveComponent && <ActiveComponent />}
            </div>
        </div>
    );
}