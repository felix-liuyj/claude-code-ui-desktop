/**
 * 内存使用优化工具
 * 提供内存监控、泄漏检测、自动清理等功能
 */
import { getMemoryUsage } from './performance';

// 内存阈值配置
const MEMORY_THRESHOLDS = {
    WARNING: 0.7,   // 70%
    CRITICAL: 0.85, // 85%
    EMERGENCY: 0.95 // 95%
};

class MemoryOptimizer {
    constructor(options = {}) {
        this.options = {
            checkInterval: options.checkInterval || 30000, // 30秒检查一次
            autoCleanup: options.autoCleanup !== false,
            maxListeners: options.maxListeners || 100,
            ...options
        };

        this.listeners = new Set();
        this.cleanupTasks = new Map();
        this.isMonitoring = false;
        this.lastMemoryInfo = null;
        this.memoryHistory = [];
        this.maxHistoryLength = 20; // 保留20个历史记录

        // 自动开始监控
        if (this.options.autoCleanup) {
            this.startMonitoring();
        }
    }

    /**
     * 开始内存监控
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitorInterval = setInterval(() => {
            this.checkMemory();
        }, this.options.checkInterval);

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        console.log('🧠 Memory monitoring started');
    }

    /**
     * 停止内存监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        console.log('🧠 Memory monitoring stopped');
    }

    /**
     * 检查内存使用情况
     */
    checkMemory() {
        const memoryInfo = getMemoryUsage();
        if (!memoryInfo) return;

        // 更新历史记录
        this.memoryHistory.push({
            ...memoryInfo,
            timestamp: Date.now()
        });

        if (this.memoryHistory.length > this.maxHistoryLength) {
            this.memoryHistory.shift();
        }

        this.lastMemoryInfo = memoryInfo;

        // 通知监听器
        this.notifyListeners('memoryUpdate', memoryInfo);

        // 检查是否需要清理
        this.checkThresholds(memoryInfo);

        return memoryInfo;
    }

    /**
     * 检查内存阈值
     */
    checkThresholds(memoryInfo) {
        const { usageRatio } = memoryInfo;

        if (usageRatio >= MEMORY_THRESHOLDS.EMERGENCY) {
            console.error('🚨 EMERGENCY: Memory usage critical!', memoryInfo);
            this.notifyListeners('memoryEmergency', memoryInfo);
            this.performEmergencyCleanup();
        } else if (usageRatio >= MEMORY_THRESHOLDS.CRITICAL) {
            console.warn('⚠️ CRITICAL: High memory usage detected!', memoryInfo);
            this.notifyListeners('memoryCritical', memoryInfo);
            this.performCriticalCleanup();
        } else if (usageRatio >= MEMORY_THRESHOLDS.WARNING) {
            console.warn('⚠️ WARNING: Memory usage approaching limit', memoryInfo);
            this.notifyListeners('memoryWarning', memoryInfo);
            this.performWarningCleanup();
        }
    }

    /**
     * 执行紧急清理
     */
    performEmergencyCleanup() {
        console.log('🧹 Performing emergency memory cleanup...');
        
        // 执行所有注册的清理任务
        this.runCleanupTasks('emergency');
        
        // 强制垃圾回收（如果可用）
        this.forceGarbageCollection();
        
        // 清理大型缓存
        this.clearLargeCaches();
    }

    /**
     * 执行关键清理
     */
    performCriticalCleanup() {
        console.log('🧹 Performing critical memory cleanup...');
        this.runCleanupTasks('critical');
    }

    /**
     * 执行警告清理
     */
    performWarningCleanup() {
        console.log('🧹 Performing warning memory cleanup...');
        this.runCleanupTasks('warning');
    }

    /**
     * 运行清理任务
     */
    runCleanupTasks(level) {
        const tasks = Array.from(this.cleanupTasks.values())
            .filter(task => task.level === level || task.level === 'all')
            .sort((a, b) => b.priority - a.priority);

        let cleanedCount = 0;
        tasks.forEach(task => {
            try {
                const result = task.cleanup();
                if (result) cleanedCount++;
                console.log(`✅ Cleanup task executed: ${task.name}`);
            } catch (error) {
                console.error(`❌ Cleanup task failed: ${task.name}`, error);
            }
        });

        console.log(`🧹 Completed ${cleanedCount} cleanup tasks for level: ${level}`);
    }

    /**
     * 强制垃圾回收
     */
    forceGarbageCollection() {
        if (window.gc && typeof window.gc === 'function') {
            try {
                window.gc();
                console.log('🗑️ Manual garbage collection triggered');
            } catch (error) {
                console.warn('Failed to trigger garbage collection:', error);
            }
        }
    }

    /**
     * 清理大型缓存
     */
    clearLargeCaches() {
        // 清理localStorage中的大项
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    const value = localStorage.getItem(key);
                    // 删除超过10KB的项
                    if (value && value.length > 10 * 1024) {
                        keysToRemove.push(key);
                    }
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`🗑️ Removed large localStorage item: ${key}`);
            });
        } catch (error) {
            console.error('Failed to clear localStorage cache:', error);
        }

        // 清理sessionStorage
        try {
            sessionStorage.clear();
            console.log('🗑️ SessionStorage cleared');
        } catch (error) {
            console.error('Failed to clear sessionStorage:', error);
        }
    }

    /**
     * 注册清理任务
     */
    registerCleanupTask(name, cleanup, options = {}) {
        const {
            priority = 1,
            level = 'warning', // warning, critical, emergency, all
            description = ''
        } = options;

        this.cleanupTasks.set(name, {
            name,
            cleanup,
            priority,
            level,
            description,
            registeredAt: Date.now()
        });

        console.log(`✅ Registered cleanup task: ${name} (${level}, priority: ${priority})`);
    }

    /**
     * 取消注册清理任务
     */
    unregisterCleanupTask(name) {
        if (this.cleanupTasks.delete(name)) {
            console.log(`❌ Unregistered cleanup task: ${name}`);
        }
    }

    /**
     * 添加内存监听器
     */
    addListener(listener) {
        if (this.listeners.size >= this.options.maxListeners) {
            console.warn('Maximum memory listeners reached');
            return false;
        }

        this.listeners.add(listener);
        return true;
    }

    /**
     * 移除内存监听器
     */
    removeListener(listener) {
        return this.listeners.delete(listener);
    }

    /**
     * 通知监听器
     */
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Memory listener error:', error);
            }
        });
    }

    /**
     * 页面可见性变化处理
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            console.log('📱 Page hidden, performing cleanup...');
            this.performWarningCleanup();
        }
    }

    /**
     * 获取内存趋势
     */
    getMemoryTrend() {
        if (this.memoryHistory.length < 2) {
            return 'stable';
        }

        const recent = this.memoryHistory.slice(-5);
        const average = recent.reduce((sum, item) => sum + item.usageRatio, 0) / recent.length;
        const latest = recent[recent.length - 1].usageRatio;

        if (latest > average * 1.1) {
            return 'increasing';
        } else if (latest < average * 0.9) {
            return 'decreasing';
        }
        
        return 'stable';
    }

    /**
     * 检测潜在的内存泄漏
     */
    detectMemoryLeaks() {
        if (this.memoryHistory.length < 10) {
            return null;
        }

        const recent = this.memoryHistory.slice(-10);
        const growthRate = this.calculateGrowthRate(recent);

        // 如果内存持续增长且增长率超过阈值，可能存在内存泄漏
        if (growthRate > 0.05) { // 5% 增长率
            const suspiciousGrowth = recent.every((item, index) => {
                if (index === 0) return true;
                return item.used >= recent[index - 1].used;
            });

            if (suspiciousGrowth) {
                return {
                    detected: true,
                    growthRate,
                    trend: 'continuous-growth',
                    suggestion: 'Check for uncleaned event listeners, closures, or large object references'
                };
            }
        }

        return { detected: false, growthRate };
    }

    /**
     * 计算内存增长率
     */
    calculateGrowthRate(history) {
        if (history.length < 2) return 0;

        const first = history[0].used;
        const last = history[history.length - 1].used;
        
        return (last - first) / first;
    }

    /**
     * 获取内存统计信息
     */
    getStats() {
        const leakDetection = this.detectMemoryLeaks();
        
        return {
            current: this.lastMemoryInfo,
            trend: this.getMemoryTrend(),
            history: this.memoryHistory.slice(),
            cleanupTasks: this.cleanupTasks.size,
            listeners: this.listeners.size,
            isMonitoring: this.isMonitoring,
            leakDetection
        };
    }

    /**
     * 创建内存快照
     */
    createSnapshot(description = '') {
        const memoryInfo = this.checkMemory();
        if (!memoryInfo) return null;

        return {
            timestamp: Date.now(),
            description,
            memory: memoryInfo,
            trend: this.getMemoryTrend(),
            activeTasks: this.cleanupTasks.size,
            listeners: this.listeners.size
        };
    }

    /**
     * 比较两个内存快照
     */
    compareSnapshots(snapshot1, snapshot2) {
        if (!snapshot1 || !snapshot2) return null;

        const memoryDiff = {
            used: snapshot2.memory.used - snapshot1.memory.used,
            total: snapshot2.memory.total - snapshot1.memory.total,
            usageRatio: snapshot2.memory.usageRatio - snapshot1.memory.usageRatio
        };

        const timeDiff = snapshot2.timestamp - snapshot1.timestamp;

        return {
            timeDiff,
            memoryDiff,
            growthRate: memoryDiff.used / (timeDiff / 1000), // MB per second
            analysis: {
                memoryIncreased: memoryDiff.used > 0,
                significantIncrease: memoryDiff.used > 10, // 10MB
                ratioIncreased: memoryDiff.usageRatio > 0.05 // 5%
            }
        };
    }
}

// 全局内存优化器实例
const globalMemoryOptimizer = new MemoryOptimizer();

// 注册默认清理任务
globalMemoryOptimizer.registerCleanupTask('dom-cleanup', () => {
    // 清理分离的DOM节点
    const elementsToClean = document.querySelectorAll('[data-cleanup="true"]');
    elementsToClean.forEach(element => element.remove());
    return elementsToClean.length > 0;
}, { level: 'warning', priority: 5 });

globalMemoryOptimizer.registerCleanupTask('event-listeners', () => {
    // 这里可以添加清理未使用的事件监听器的逻辑
    // 实际实现需要应用级别的监听器管理
    console.log('🧹 Event listeners cleanup placeholder');
    return true;
}, { level: 'critical', priority: 8 });

globalMemoryOptimizer.registerCleanupTask('large-objects', () => {
    // 清理window上的大对象（如果有的话）
    let cleaned = false;
    
    if (window._tempData && typeof window._tempData === 'object') {
        delete window._tempData;
        cleaned = true;
    }
    
    return cleaned;
}, { level: 'emergency', priority: 10 });

// 导出
export { MemoryOptimizer, MEMORY_THRESHOLDS };
export default globalMemoryOptimizer;