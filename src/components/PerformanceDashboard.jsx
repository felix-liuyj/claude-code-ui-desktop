/**
 * 性能监控面板
 * 显示应用性能指标和优化建议
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMemoryMonitor } from '../hooks/usePerformanceOptimizations';
import globalMemoryOptimizer from '../utils/memoryOptimization';
import globalCache from '../utils/progressiveCache';

const PerformanceDashboard = ({ isVisible = false, onClose }) => {
    const [stats, setStats] = useState({});
    const [memoryStats, setMemoryStats] = useState(null);
    const [cacheStats, setCacheStats] = useState({});
    const [recommendations, setRecommendations] = useState([]);
    
    // 拖拽相关状态
    const [position, setPosition] = useState(() => {
        const saved = localStorage.getItem('performance-dashboard-position');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 400, y: 16 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dashboardRef = useRef(null);

    const memoryInfo = useMemoryMonitor(2000); // 每2秒更新

    // 收集性能统计数据
    const collectStats = useCallback(async () => {
        if (!isVisible) return;

        try {
            // 内存统计
            const memoryOptimizerStats = globalMemoryOptimizer.getStats();
            setMemoryStats(memoryOptimizerStats);

            // 缓存统计
            const cacheStatistics = globalCache.getStats();
            setCacheStats(cacheStatistics);

            // 页面性能统计
            const navigation = performance.getEntriesByType('navigation')[0] || {};
            const pageStats = {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
                pageLoad: navigation.loadEventEnd - navigation.navigationStart,
                firstPaint: 0,
                firstContentfulPaint: 0
            };

            // 获取Paint Timing
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
                if (entry.name === 'first-paint') {
                    pageStats.firstPaint = entry.startTime;
                } else if (entry.name === 'first-contentful-paint') {
                    pageStats.firstContentfulPaint = entry.startTime;
                }
            });

            setStats(prevStats => ({
                ...prevStats,
                memory: memoryInfo,
                cache: cacheStatistics,
                page: pageStats,
                timestamp: Date.now()
            }));

            // 生成建议
            generateRecommendations(memoryInfo, memoryOptimizerStats, cacheStatistics);

        } catch (error) {
            console.error('Failed to collect performance stats:', error);
        }
    }, [isVisible, memoryInfo]);

    // 生成性能建议
    const generateRecommendations = useCallback((memory, memoryOpt, cache) => {
        const recommendations = [];

        // 内存建议
        if (memory && memory.usageRatio > 0.8) {
            recommendations.push({
                type: 'memory',
                level: 'critical',
                message: 'Memory usage is very high. Consider closing unused tabs or clearing cache.',
                action: 'cleanup'
            });
        } else if (memory && memory.usageRatio > 0.6) {
            recommendations.push({
                type: 'memory',
                level: 'warning',
                message: 'Memory usage is elevated. Monitor for potential leaks.',
                action: 'monitor'
            });
        }

        // 缓存建议
        if (cache.hitRate < 0.5) {
            recommendations.push({
                type: 'cache',
                level: 'info',
                message: 'Cache hit rate is low. This may indicate inefficient caching strategy.',
                action: 'optimize'
            });
        }

        // 内存泄漏检测
        if (memoryOpt?.leakDetection?.detected) {
            recommendations.push({
                type: 'leak',
                level: 'critical',
                message: 'Potential memory leak detected. Check for uncleaned resources.',
                action: 'investigate'
            });
        }

        setRecommendations(recommendations);
    }, []);

    // 执行清理操作
    const handleCleanup = useCallback(() => {
        globalMemoryOptimizer.performWarningCleanup();
        setTimeout(collectStats, 1000); // 延迟收集统计以看到效果
    }, [collectStats]);

    // 清空缓存
    const handleClearCache = useCallback(async () => {
        await globalCache.clear();
        setTimeout(collectStats, 500);
    }, [collectStats]);

    // 拖拽事件处理
    const handleMouseDown = useCallback((e) => {
        if (e.target.closest('.drag-handle')) {
            setIsDragging(true);
            const rect = dashboardRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // 限制拖拽范围，确保组件不会被拖出窗口
        const maxX = window.innerWidth - 384; // 384是组件宽度(w-96)
        const maxY = window.innerHeight - 100; // 给底部留一些空间
        
        const boundedX = Math.max(0, Math.min(newX, maxX));
        const boundedY = Math.max(0, Math.min(newY, maxY));
        
        setPosition({ x: boundedX, y: boundedY });
    }, [isDragging, dragOffset]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            // 保存位置到 localStorage
            localStorage.setItem('performance-dashboard-position', JSON.stringify(position));
        }
    }, [isDragging, position]);

    // 关闭处理
    const handleClose = useCallback(() => {
        if (onClose) {
            onClose();
        }
    }, [onClose]);

    // 监听全局鼠标事件
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // 定期更新统计
    useEffect(() => {
        if (!isVisible) return;

        collectStats();
        const interval = setInterval(collectStats, 5000); // 每5秒更新

        return () => clearInterval(interval);
    }, [isVisible, collectStats]);

    if (!isVisible) return null;

    return (
        <div 
            ref={dashboardRef}
            className={`performance-dashboard fixed w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-[90vh] overflow-y-auto scrollbar-thin ${
                isDragging ? 'shadow-2xl' : ''
            }`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transition: isDragging ? 'none' : 'box-shadow 0.2s ease'
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="drag-handle flex items-center justify-between p-4 pb-2 cursor-grab active:cursor-grabbing border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    性能监控
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCleanup}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        title="清理内存"
                    >
                        清理
                    </button>
                    <button
                        onClick={handleClearCache}
                        className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                        title="清空缓存"
                    >
                        清缓存
                    </button>
                    <button
                        onClick={handleClose}
                        className="ml-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="关闭"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Content */}
            <div className="p-4 pt-2">

            {/* 内存信息 */}
            {memoryInfo && (
                <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">内存使用</h4>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                            <div className="text-xs text-gray-600 dark:text-gray-400">已用</div>
                            <div className="font-mono text-sm">{memoryInfo.used}MB</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                            <div className="text-xs text-gray-600 dark:text-gray-400">总计</div>
                            <div className="font-mono text-sm">{memoryInfo.total}MB</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                            <div className="text-xs text-gray-600 dark:text-gray-400">使用率</div>
                            <div className="font-mono text-sm">{(memoryInfo.usageRatio * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                    
                    {/* 内存使用进度条 */}
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                        <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                                memoryInfo.usageRatio > 0.8 ? 'bg-red-500' :
                                memoryInfo.usageRatio > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(memoryInfo.usageRatio * 100, 100)}%` }}
                        />
                    </div>

                    {/* 内存趋势 */}
                    {memoryStats?.trend && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                            趋势: <span className={`font-medium ${
                                memoryStats.trend === 'increasing' ? 'text-red-600' :
                                memoryStats.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600'
                            }`}>
                                {memoryStats.trend === 'increasing' ? '上升' :
                                 memoryStats.trend === 'decreasing' ? '下降' : '稳定'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* 缓存统计 */}
            {cacheStats && Object.keys(cacheStats).length > 0 && (
                <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">缓存统计</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="text-xs text-gray-600 dark:text-gray-400">命中率</div>
                            <div className="font-mono text-sm">
                                {((cacheStats.hitRate || 0) * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="text-xs text-gray-600 dark:text-gray-400">缓存项</div>
                            <div className="font-mono text-sm">{cacheStats.memorySize || 0}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 页面性能 */}
            {stats.page && (
                <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">页面性能</h4>
                    <div className="space-y-1">
                        {stats.page.domContentLoaded && (
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">DOM加载</span>
                                <span className="font-mono">{Math.round(stats.page.domContentLoaded)}ms</span>
                            </div>
                        )}
                        {stats.page.pageLoad && (
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">完全加载</span>
                                <span className="font-mono">{Math.round(stats.page.pageLoad)}ms</span>
                            </div>
                        )}
                        {stats.page.firstContentfulPaint > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">首次绘制</span>
                                <span className="font-mono">{Math.round(stats.page.firstContentfulPaint)}ms</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 性能建议 */}
            {recommendations.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">优化建议</h4>
                    <div className="space-y-2">
                        {recommendations.map((rec, index) => (
                            <div
                                key={index}
                                className={`p-2 rounded text-xs ${
                                    rec.level === 'critical' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200' :
                                    rec.level === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200' :
                                    'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
                                } border`}
                            >
                                <div className="font-medium mb-1 capitalize">{rec.type}</div>
                                <div>{rec.message}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 更新时间 */}
            {stats.timestamp && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
                    上次更新: {new Date(stats.timestamp).toLocaleTimeString()}
                </div>
            )}
            </div>
        </div>
    );
};

export default PerformanceDashboard;