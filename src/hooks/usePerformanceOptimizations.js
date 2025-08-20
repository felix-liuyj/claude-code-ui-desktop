/**
 * React性能优化Hooks
 * 提供常用的性能优化功能，避免循环依赖
 */
import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { debounce, throttle, SimpleCache, getMemoryUsage } from '../utils/performance';

// 防抖Hook
export const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// 节流Hook
export const useThrottle = (value, limit) => {
    const [throttledValue, setThrottledValue] = useState(value);
    const lastRan = useRef(Date.now());

    useEffect(() => {
        const handler = setTimeout(() => {
            if (Date.now() - lastRan.current >= limit) {
                setThrottledValue(value);
                lastRan.current = Date.now();
            }
        }, limit - (Date.now() - lastRan.current));

        return () => {
            clearTimeout(handler);
        };
    }, [value, limit]);

    return throttledValue;
};

// 缓存Hook
export const useCache = (maxSize = 100) => {
    const cache = useRef(new SimpleCache(maxSize));

    const get = useCallback((key) => {
        return cache.current.get(key);
    }, []);

    const set = useCallback((key, value) => {
        cache.current.set(key, value);
    }, []);

    const clear = useCallback(() => {
        cache.current.clear();
    }, []);

    const size = useCallback(() => {
        return cache.current.size();
    }, []);

    return { get, set, clear, size };
};

// 内存监控Hook
export const useMemoryMonitor = (interval = 5000) => {
    const [memoryInfo, setMemoryInfo] = useState(null);

    useEffect(() => {
        const updateMemoryInfo = () => {
            const info = getMemoryUsage();
            if (info) {
                setMemoryInfo(info);
                
                // 内存使用率过高时发出警告
                if (info.usageRatio > 0.8) {
                    console.warn('🧠 High memory usage detected:', info);
                }
            }
        };

        updateMemoryInfo();
        const intervalId = setInterval(updateMemoryInfo, interval);

        return () => clearInterval(intervalId);
    }, [interval]);

    return memoryInfo;
};

// 虚拟列表Hook
export const useVirtualList = (items, itemHeight, containerHeight) => {
    const [scrollTop, setScrollTop] = useState(0);

    const visibleRange = useMemo(() => {
        const buffer = 5;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
        const endIndex = Math.min(
            items.length - 1,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
        );

        return { startIndex, endIndex };
    }, [scrollTop, itemHeight, containerHeight, items.length]);

    const visibleItems = useMemo(() => {
        return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
    }, [items, visibleRange.startIndex, visibleRange.endIndex]);

    const totalHeight = items.length * itemHeight;
    const offsetY = visibleRange.startIndex * itemHeight;

    return {
        visibleItems,
        totalHeight,
        offsetY,
        setScrollTop
    };
};

// 组件更新优化Hook
export const useUpdateOptimizer = (deps) => {
    const prevDeps = useRef(deps);
    const shouldUpdate = useRef(true);

    const hasChanged = useMemo(() => {
        if (!prevDeps.current || prevDeps.current.length !== deps.length) {
            shouldUpdate.current = true;
        } else {
            shouldUpdate.current = deps.some((dep, index) => dep !== prevDeps.current[index]);
        }
        
        prevDeps.current = deps;
        return shouldUpdate.current;
    }, deps);

    return hasChanged;
};

// 异步数据加载Hook
export const useAsyncData = (asyncFunction, dependencies = []) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const cache = useRef(new SimpleCache(50));

    const cacheKey = JSON.stringify(dependencies);

    useEffect(() => {
        // 检查缓存
        const cachedData = cache.current.get(cacheKey);
        if (cachedData) {
            setData(cachedData);
            return;
        }

        setLoading(true);
        setError(null);

        asyncFunction()
            .then(result => {
                setData(result);
                cache.current.set(cacheKey, result);
            })
            .catch(err => {
                setError(err);
                console.error('AsyncData error:', err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, dependencies);

    const refresh = useCallback(() => {
        cache.current.clear();
        setLoading(true);
        setError(null);
        
        asyncFunction()
            .then(result => {
                setData(result);
                cache.current.set(cacheKey, result);
            })
            .catch(err => setError(err))
            .finally(() => setLoading(false));
    }, [asyncFunction, cacheKey]);

    return { data, loading, error, refresh };
};

// 防抖回调Hook
export const useDebouncedCallback = (callback, delay) => {
    const debouncedCallback = useRef(debounce(callback, delay));

    useEffect(() => {
        debouncedCallback.current = debounce(callback, delay);
    }, [callback, delay]);

    return debouncedCallback.current;
};

// 节流回调Hook
export const useThrottledCallback = (callback, limit) => {
    const throttledCallback = useRef(throttle(callback, limit));

    useEffect(() => {
        throttledCallback.current = throttle(callback, limit);
    }, [callback, limit]);

    return throttledCallback.current;
};

// 批处理Hook
export const useBatchProcessor = (processFn, batchSize = 10, delay = 100) => {
    const queue = useRef([]);
    const timeoutId = useRef(null);

    const flush = useCallback(() => {
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
            timeoutId.current = null;
        }

        if (queue.current.length > 0) {
            const batch = queue.current.splice(0);
            processFn(batch);
        }
    }, [processFn]);

    const add = useCallback((item) => {
        queue.current.push(item);
        
        if (queue.current.length >= batchSize) {
            flush();
        } else if (timeoutId.current === null) {
            timeoutId.current = setTimeout(flush, delay);
        }
    }, [batchSize, delay, flush]);

    useEffect(() => {
        return () => {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
            }
        };
    }, []);

    return { add, flush };
};

// 滚动性能优化Hook
export const useScrollOptimization = (threshold = 100) => {
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeout = useRef();

    const handleScroll = useThrottledCallback(() => {
        if (!isScrolling) {
            setIsScrolling(true);
        }

        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            setIsScrolling(false);
        }, threshold);
    }, 16); // 60fps

    useEffect(() => {
        return () => {
            if (scrollTimeout.current) {
                clearTimeout(scrollTimeout.current);
            }
        };
    }, []);

    return { isScrolling, handleScroll };
};