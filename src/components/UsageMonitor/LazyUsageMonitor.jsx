import React, { lazy, Suspense } from 'react';
import { RefreshCw } from 'lucide-react';

// 懒加载使用量监控组件
const UsageMonitor = lazy(() => import('./UsageMonitor').then(module => ({ default: module.UsageMonitor })));

/**
 * 懒加载使用量监控包装组件
 */
export function LazyUsageMonitor() {
    return (
        <Suspense 
            fallback={
                <div className="flex items-center justify-center h-64">
                    <div className="flex items-center space-x-2 text-blue-600">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span>正在加载使用量监控...</span>
                    </div>
                </div>
            }
        >
            <UsageMonitor />
        </Suspense>
    );
}