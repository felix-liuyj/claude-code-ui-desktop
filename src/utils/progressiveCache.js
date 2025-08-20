/**
 * 渐进式缓存系统
 * 实现多层缓存策略，支持内存、localStorage和IndexedDB
 */
import { SimpleCache } from './performance';

// 缓存优先级
const CACHE_PRIORITY = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
};

// 缓存类型
const CACHE_TYPE = {
    MEMORY: 'memory',
    LOCAL_STORAGE: 'localStorage', 
    INDEXED_DB: 'indexedDB'
};

class ProgressiveCache {
    constructor(options = {}) {
        this.options = {
            memorySize: options.memorySize || 100,
            localStorageSize: options.localStorageSize || 50,
            indexedDBSize: options.indexedDBSize || 1000,
            defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5分钟
            compressionThreshold: options.compressionThreshold || 1024, // 1KB
            ...options
        };

        // 初始化各层缓存
        this.memoryCache = new SimpleCache(this.options.memorySize);
        this.initIndexedDB();
        
        // 缓存统计
        this.stats = {
            hits: { memory: 0, localStorage: 0, indexedDB: 0 },
            misses: 0,
            evictions: 0
        };
    }

    /**
     * 初始化IndexedDB
     */
    async initIndexedDB() {
        if (!window.indexedDB) {
            console.warn('IndexedDB not supported');
            return;
        }

        try {
            this.indexedDB = await this.openDB('ProgressiveCache', 1);
        } catch (error) {
            console.error('Failed to initialize IndexedDB:', error);
        }
    }

    /**
     * 打开IndexedDB数据库
     */
    openDB(name, version) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(name, version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('expiry', 'expiry', { unique: false });
                    store.createIndex('priority', 'priority', { unique: false });
                }
            };
        });
    }

    /**
     * 获取缓存项
     */
    async get(key) {
        // 1. 尝试内存缓存
        const memoryResult = this.memoryCache.get(key);
        if (memoryResult && this.isValid(memoryResult)) {
            this.stats.hits.memory++;
            return memoryResult.data;
        }

        // 2. 尝试localStorage
        try {
            const localStorageResult = this.getFromLocalStorage(key);
            if (localStorageResult && this.isValid(localStorageResult)) {
                this.stats.hits.localStorage++;
                // 提升到内存缓存
                this.memoryCache.set(key, localStorageResult);
                return localStorageResult.data;
            }
        } catch (error) {
            console.warn('LocalStorage get failed:', error);
        }

        // 3. 尝试IndexedDB
        if (this.indexedDB) {
            try {
                const indexedDBResult = await this.getFromIndexedDB(key);
                if (indexedDBResult && this.isValid(indexedDBResult)) {
                    this.stats.hits.indexedDB++;
                    // 提升到更高层缓存
                    this.setInLocalStorage(key, indexedDBResult);
                    this.memoryCache.set(key, indexedDBResult);
                    return indexedDBResult.data;
                }
            } catch (error) {
                console.warn('IndexedDB get failed:', error);
            }
        }

        this.stats.misses++;
        return null;
    }

    /**
     * 设置缓存项
     */
    async set(key, data, options = {}) {
        const {
            ttl = this.options.defaultTTL,
            priority = CACHE_PRIORITY.MEDIUM,
            type = null // 自动选择存储类型
        } = options;

        const cacheItem = {
            key,
            data,
            timestamp: Date.now(),
            expiry: Date.now() + ttl,
            priority,
            size: this.getDataSize(data)
        };

        // 根据数据大小和优先级选择存储策略
        const storageType = type || this.selectStorageType(cacheItem);

        try {
            switch (storageType) {
                case CACHE_TYPE.MEMORY:
                    this.memoryCache.set(key, cacheItem);
                    break;
                    
                case CACHE_TYPE.LOCAL_STORAGE:
                    this.setInLocalStorage(key, cacheItem);
                    this.memoryCache.set(key, cacheItem); // 同时存储在内存中
                    break;
                    
                case CACHE_TYPE.INDEXED_DB:
                    await this.setInIndexedDB(key, cacheItem);
                    this.setInLocalStorage(key, cacheItem);
                    this.memoryCache.set(key, cacheItem);
                    break;
                    
                default:
                    this.memoryCache.set(key, cacheItem);
            }
        } catch (error) {
            console.error('Cache set failed:', error);
            // 降级到内存缓存
            this.memoryCache.set(key, cacheItem);
        }
    }

    /**
     * 选择存储类型
     */
    selectStorageType(cacheItem) {
        // 高优先级数据优先存储在持久化存储中
        if (cacheItem.priority >= CACHE_PRIORITY.HIGH) {
            return CACHE_TYPE.INDEXED_DB;
        }

        // 大数据存储在IndexedDB
        if (cacheItem.size > this.options.compressionThreshold) {
            return CACHE_TYPE.INDEXED_DB;
        }

        // 中等优先级存储在localStorage
        if (cacheItem.priority >= CACHE_PRIORITY.MEDIUM) {
            return CACHE_TYPE.LOCAL_STORAGE;
        }

        // 默认内存存储
        return CACHE_TYPE.MEMORY;
    }

    /**
     * localStorage操作
     */
    getFromLocalStorage(key) {
        try {
            const item = localStorage.getItem(`cache_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            return null;
        }
    }

    setInLocalStorage(key, cacheItem) {
        try {
            const serialized = JSON.stringify(cacheItem);
            // 检查localStorage空间
            if (serialized.length > 1024 * 1024) { // 1MB限制
                console.warn('Cache item too large for localStorage:', key);
                return false;
            }
            
            localStorage.setItem(`cache_${key}`, serialized);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.cleanupLocalStorage();
                // 重试一次
                try {
                    localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
                    return true;
                } catch (retryError) {
                    console.warn('LocalStorage quota exceeded even after cleanup');
                }
            }
            return false;
        }
    }

    /**
     * IndexedDB操作
     */
    async getFromIndexedDB(key) {
        if (!this.indexedDB) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.indexedDB.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async setInIndexedDB(key, cacheItem) {
        if (!this.indexedDB) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put(cacheItem);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 清理过期缓存
     */
    async cleanup() {
        const now = Date.now();
        let cleanedCount = 0;

        // 清理内存缓存
        // Note: SimpleCache doesn't have direct iteration, so we'll recreate it
        const newMemoryCache = new SimpleCache(this.options.memorySize);
        this.memoryCache = newMemoryCache;

        // 清理localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item && item.expiry < now) {
                        keysToRemove.push(key);
                    }
                } catch (error) {
                    keysToRemove.push(key); // 移除损坏的缓存项
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            cleanedCount++;
        });

        // 清理IndexedDB
        if (this.indexedDB) {
            try {
                await this.cleanupIndexedDB(now);
            } catch (error) {
                console.error('IndexedDB cleanup failed:', error);
            }
        }

        console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
        return cleanedCount;
    }

    async cleanupIndexedDB(now) {
        return new Promise((resolve, reject) => {
            const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('expiry');
            const range = IDBKeyRange.upperBound(now);
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 清理localStorage空间
     */
    cleanupLocalStorage() {
        const cacheKeys = [];
        
        // 收集所有缓存键和其时间戳
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item) {
                        cacheKeys.push({ key, timestamp: item.timestamp, priority: item.priority });
                    }
                } catch (error) {
                    // 损坏的缓存项，直接删除
                    localStorage.removeItem(key);
                }
            }
        }

        // 按优先级和时间排序，删除优先级低且较旧的项
        cacheKeys
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // 优先级低的在前
                }
                return a.timestamp - b.timestamp; // 时间早的在前
            })
            .slice(0, Math.floor(cacheKeys.length / 2)) // 删除一半
            .forEach(({ key }) => {
                localStorage.removeItem(key);
                this.stats.evictions++;
            });
    }

    /**
     * 工具方法
     */
    isValid(cacheItem) {
        return cacheItem && cacheItem.expiry > Date.now();
    }

    getDataSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch {
            return 0;
        }
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        const totalHits = this.stats.hits.memory + this.stats.hits.localStorage + this.stats.hits.indexedDB;
        const totalRequests = totalHits + this.stats.misses;
        
        return {
            ...this.stats,
            hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
            memorySize: this.memoryCache.size(),
            totalRequests
        };
    }

    /**
     * 删除缓存项
     */
    async delete(key) {
        // 从所有层级删除
        this.memoryCache.set(key, null); // SimpleCache doesn't have delete, so set to null
        
        try {
            localStorage.removeItem(`cache_${key}`);
        } catch (error) {
            console.warn('Failed to delete from localStorage:', error);
        }

        if (this.indexedDB) {
            try {
                await this.deleteFromIndexedDB(key);
            } catch (error) {
                console.warn('Failed to delete from IndexedDB:', error);
            }
        }
    }

    async deleteFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 清空所有缓存
     */
    async clear() {
        this.memoryCache.clear();
        
        // 清空localStorage中的缓存
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // 清空IndexedDB
        if (this.indexedDB) {
            try {
                const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
                const store = transaction.objectStore('cache');
                store.clear();
            } catch (error) {
                console.error('Failed to clear IndexedDB:', error);
            }
        }

        // 重置统计
        this.stats = {
            hits: { memory: 0, localStorage: 0, indexedDB: 0 },
            misses: 0,
            evictions: 0
        };
    }
}

// 创建全局缓存实例
const globalCache = new ProgressiveCache();

// 定期清理过期缓存
setInterval(() => {
    globalCache.cleanup();
}, 10 * 60 * 1000); // 每10分钟清理一次

export { ProgressiveCache, CACHE_PRIORITY, CACHE_TYPE };
export default globalCache;