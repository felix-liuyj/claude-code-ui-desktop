/**
 * 轻量级性能优化工具集
 * 避免循环依赖，提供基础性能优化功能
 */

// 防抖函数
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// 节流函数
export const throttle = (func, limit) => {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// 简单的LRU缓存
export class SimpleCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            // 移到末尾（最近使用）
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return null;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // 删除最旧的项
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

// 内存监控
export const getMemoryUsage = () => {
    if (!performance.memory) {
        return null;
    }

    const memory = performance.memory;
    return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
        usageRatio: memory.usedJSHeapSize / memory.jsHeapSizeLimit
    };
};

// 简单的性能计时器
export class PerformanceTimer {
    constructor(name) {
        this.name = name;
        this.startTime = null;
    }

    start() {
        this.startTime = performance.now();
        return this;
    }

    end() {
        if (this.startTime === null) {
            console.warn(`Timer ${this.name} was not started`);
            return 0;
        }
        const duration = performance.now() - this.startTime;
        console.log(`⏱️  ${this.name}: ${duration.toFixed(2)}ms`);
        this.startTime = null;
        return duration;
    }
}

// 批处理工具
export class BatchProcessor {
    constructor(processFn, batchSize = 10, delay = 100) {
        this.processFn = processFn;
        this.batchSize = batchSize;
        this.delay = delay;
        this.queue = [];
        this.timeoutId = null;
    }

    add(item) {
        this.queue.push(item);
        
        if (this.queue.length >= this.batchSize) {
            this.flush();
        } else if (this.timeoutId === null) {
            this.timeoutId = setTimeout(() => this.flush(), this.delay);
        }
    }

    flush() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.queue.length > 0) {
            const batch = this.queue.splice(0);
            this.processFn(batch);
        }
    }
}

// 简单的资源预加载
export const preloadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};

// 检查网络状态
export const getNetworkInfo = () => {
    if (!navigator.connection) {
        return { effectiveType: 'unknown', downlink: 0 };
    }

    const connection = navigator.connection;
    return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
    };
};

// 简单的状态管理（避免不必要的重渲染）
export const createStateManager = (initialState) => {
    let state = { ...initialState };
    const listeners = new Set();

    return {
        getState: () => ({ ...state }),
        
        setState: (updates) => {
            const newState = { ...state, ...updates };
            const hasChanged = Object.keys(updates).some(
                key => newState[key] !== state[key]
            );
            
            if (hasChanged) {
                state = newState;
                listeners.forEach(listener => listener(state));
            }
        },

        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

// 组件性能监控HOC
export const withPerformanceMonitor = (WrappedComponent, componentName) => {
    return React.memo((props) => {
        const renderTimer = React.useRef();
        
        React.useEffect(() => {
            if (renderTimer.current) {
                renderTimer.current.end();
            }
        });

        renderTimer.current = new PerformanceTimer(`${componentName} render`).start();
        
        return React.createElement(WrappedComponent, props);
    });
};

// 工具函数：检查是否应该更新
export const shouldUpdate = (prevProps, nextProps, keys) => {
    if (!keys) {
        return JSON.stringify(prevProps) !== JSON.stringify(nextProps);
    }
    
    return keys.some(key => prevProps[key] !== nextProps[key]);
};

// 简单的虚拟滚动辅助工具
export const calculateVisibleRange = (containerHeight, itemHeight, scrollTop, buffer = 5) => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const endIndex = Math.min(
        Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
    );
    
    return { startIndex, endIndex };
};