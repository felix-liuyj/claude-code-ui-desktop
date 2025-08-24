/**
 * 代码分割和懒加载工具
 * 提供组件、资源的按需加载功能
 */
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import globalCache, { CACHE_PRIORITY } from './progressiveCache';

// 创建懒加载组件的工具函数
export const createLazyComponent = (importFn, fallback = null) => {
    const LazyComponent = lazy(importFn);

    return (props) => (
        <Suspense fallback={ fallback || <DefaultLoadingFallback/> }>
            <LazyComponent { ...props } />
        </Suspense>
    );
};

// 默认加载回退组件
const DefaultLoadingFallback = () => (
    <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading component...</span>
    </div>
);

// 预加载组件
export const preloadComponent = (importFn, priority = 'low') => {
    if (priority === 'high') {
        // 立即预加载
        importFn().catch(console.error);
    } else {
        // 空闲时预加载
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                importFn().catch(console.error);
            });
        } else {
            setTimeout(() => {
                importFn().catch(console.error);
            }, 100);
        }
    }
};

// 路由级别的代码分割
export const createRouteComponent = (importFn, preload = false) => {
    if (preload) {
        preloadComponent(importFn, 'high');
    }

    return createLazyComponent(
        importFn,
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading page...</p>
            </div>
        </div>
    );
};

// 图片懒加载Hook
export const useLazyImage = () => {
    const loadImage = async (src, priority = CACHE_PRIORITY.LOW) => {
        // 检查缓存
        const cached = await globalCache.get(`img_${ src }`);
        if (cached) {
            return cached;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = async () => {
                const imageData = {
                    src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    loaded: true
                };

                // 缓存图片信息
                await globalCache.set(`img_${ src }`, imageData, {
                    priority,
                    ttl: 30 * 60 * 1000 // 30分钟
                });

                resolve(imageData);
            };

            img.onerror = () => {
                reject(new Error(`Failed to load image: ${ src }`));
            };

            img.src = src;
        });
    };

    const preloadImages = (srcs, priority = CACHE_PRIORITY.LOW) => {
        srcs.forEach(src => {
            loadImage(src, priority).catch(console.error);
        });
    };

    return { loadImage, preloadImages };
};

// 懒加载图片组件
export const LazyImage = ({
                              src,
                              alt,
                              className = '',
                              style = {},
                              placeholder = null,
                              onLoad = () => {
                              },
                              onError = () => {
                              }
                          }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef(null);
    const { loadImage } = useLazyImage();

    // Intersection Observer for viewport detection
    useEffect(() => {
        if (!imgRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                rootMargin: '50px 0px', // 提前50px开始加载
                threshold: 0.1
            }
        );

        observer.observe(imgRef.current);

        return () => observer.disconnect();
    }, []);

    // 当图片进入视口时开始加载
    useEffect(() => {
        if (!isInView) return;

        loadImage(src, CACHE_PRIORITY.MEDIUM)
            .then(() => {
                setIsLoaded(true);
                onLoad();
            })
            .catch((err) => {
                setError(true);
                onError(err);
            });
    }, [isInView, src, loadImage, onLoad, onError]);

    return (
        <div ref={ imgRef } className={ `lazy-image-container ${ className }` } style={ style }>
            { !isInView ? (
                placeholder || (
                    <div
                        className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded w-full h-full min-h-[100px]"></div>
                )
            ) : error ? (
                <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded min-h-[100px]">
                    <span className="text-gray-500 text-sm">Failed to load image</span>
                </div>
            ) : !isLoaded ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded w-full h-full min-h-[100px]"></div>
            ) : (
                <img
                    src={ src }
                    alt={ alt }
                    className="w-full h-full object-cover rounded"
                    loading="lazy"
                />
            ) }
        </div>
    );
};

// 脚本懒加载
export const loadScript = async (src, options = {}) => {
    const { async = true, defer = false, attributes = {} } = options;

    // 检查是否已加载
    if (document.querySelector(`script[src="${ src }"]`)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = async;
        script.defer = defer;

        Object.entries(attributes).forEach(([key, value]) => {
            script.setAttribute(key, value);
        });

        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${ src }`));

        document.head.appendChild(script);
    });
};

// 样式表懒加载
export const loadStylesheet = async (href, media = 'all') => {
    // 检查是否已加载
    if (document.querySelector(`link[href="${ href }"]`)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.media = media;

        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load stylesheet: ${ href }`));

        document.head.appendChild(link);
    });
};

// 模块懒加载管理器
class LazyModuleManager {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
    }

    // 加载模块
    async loadModule(importFn, moduleId) {
        if (this.loadedModules.has(moduleId)) {
            // 从缓存获取
            const cached = await globalCache.get(`module_${ moduleId }`);
            if (cached) return cached;
        }

        if (this.loadingPromises.has(moduleId)) {
            return this.loadingPromises.get(moduleId);
        }

        const loadPromise = importFn()
            .then(module => {
                this.loadedModules.add(moduleId);
                // 缓存模块引用信息
                globalCache.set(`module_${ moduleId }`, { loaded: true, timestamp: Date.now() }, {
                    priority: CACHE_PRIORITY.HIGH,
                    ttl: 60 * 60 * 1000 // 1小时
                });
                return module;
            })
            .finally(() => {
                this.loadingPromises.delete(moduleId);
            });

        this.loadingPromises.set(moduleId, loadPromise);
        return loadPromise;
    }

    // 预加载模块
    preloadModule(importFn, moduleId, priority = 'low') {
        if (this.loadedModules.has(moduleId)) return;

        const loadFn = () => this.loadModule(importFn, moduleId).catch(console.error);

        if (priority === 'high') {
            loadFn();
        } else if (window.requestIdleCallback) {
            window.requestIdleCallback(loadFn);
        } else {
            setTimeout(loadFn, 100);
        }
    }

    // 获取加载状态
    getLoadingStatus() {
        return {
            loadedModules: this.loadedModules.size,
            loadingModules: this.loadingPromises.size
        };
    }
}

// 全局模块管理器实例
export const moduleManager = new LazyModuleManager();

// 基于网络状态的智能加载策略
export const getLoadingStrategy = () => {
    const connection = navigator.connection;

    if (!connection) {
        return { preload: true, priority: 'medium' };
    }

    const { effectiveType, saveData } = connection;

    // 数据节省模式
    if (saveData) {
        return { preload: false, priority: 'low' };
    }

    // 根据网络速度调整策略
    switch (effectiveType) {
        case '4g':
            return { preload: true, priority: 'high' };
        case '3g':
            return { preload: true, priority: 'medium' };
        case '2g':
        case 'slow-2g':
            return { preload: false, priority: 'low' };
        default:
            return { preload: true, priority: 'medium' };
    }
};

// 智能预加载
export const smartPreload = (resources) => {
    const strategy = getLoadingStrategy();

    if (!strategy.preload) {
        console.log('🐌 Slow network detected, skipping preload');
        return;
    }

    resources.forEach(resource => {
        const { type, src, importFn, id } = resource;

        switch (type) {
            case 'component':
                if (importFn && id) {
                    moduleManager.preloadModule(importFn, id, strategy.priority);
                }
                break;
            case 'script':
                loadScript(src).catch(console.error);
                break;
            case 'stylesheet':
                loadStylesheet(src).catch(console.error);
                break;
            case 'image':
                const { preloadImages } = useLazyImage();
                preloadImages([src], CACHE_PRIORITY.LOW);
                break;
        }
    });
};

// React组件的代码分割HOC
export const withCodeSplitting = (importFn, options = {}) => {
    const {
        fallback = <DefaultLoadingFallback/>,
        preload = false,
        moduleId = null
    } = options;

    if (preload && importFn && moduleId) {
        moduleManager.preloadModule(importFn, moduleId);
    }

    const LazyComponent = lazy(() => {
        if (moduleId) {
            return moduleManager.loadModule(importFn, moduleId);
        }
        return importFn();
    });

    return (props) => (
        <Suspense fallback={ fallback }>
            <LazyComponent { ...props } />
        </Suspense>
    );
};

export default {
    createLazyComponent,
    createRouteComponent,
    LazyImage,
    loadScript,
    loadStylesheet,
    moduleManager,
    smartPreload,
    withCodeSplitting
};