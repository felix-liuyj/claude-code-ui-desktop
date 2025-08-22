import { SessionAnalyzer } from './session-analyzer.js';
import { TokenCalculator } from './token-calculator.js';
import { createLogger } from '../utils/logger.js';

/**
 * 数据聚合器 - 整合会话分析和令牌计算功能
 * 提供统一的数据访问接口
 */
export class DataAggregator {
    constructor(claudeConfigDir = null) {
        this.sessionAnalyzer = new SessionAnalyzer(claudeConfigDir);
        this.tokenCalculator = new TokenCalculator();
        this.logger = createLogger('DataAggregator');
        
        // 多层次缓存系统
        this.cache = new Map();
        this.sessionCache = new Map(); // 会话数据缓存
        this.blockCache = new Map();   // 会话块缓存
        this.fileWatchCache = new Map(); // 文件修改时间缓存
        
        // 缓存配置
        this.cacheTimeout = 30000; // 30秒缓存
        this.sessionCacheTimeout = 60000; // 1分钟会话缓存
        this.blockCacheTimeout = 300000; // 5分钟块缓存
        
        // 性能统计
        this.cacheStats = {
            hits: 0,
            misses: 0,
            lastReset: Date.now()
        };
    }

    /**
     * 获取缓存键
     */
    getCacheKey(method, params = {}) {
        return `${method}_${JSON.stringify(params)}`;
    }

    /**
     * 检查缓存是否有效
     */
    isCacheValid(cacheEntry, timeout = this.cacheTimeout) {
        return Date.now() - cacheEntry.timestamp < timeout;
    }

    /**
     * 检查文件系统是否有变化
     */
    hasFileSystemChanged() {
        try {
            const fs = require('fs');
            const projectsDir = this.sessionAnalyzer.projectsDir;
            
            if (!fs.existsSync(projectsDir)) {
                return false;
            }
            
            const currentMtime = fs.statSync(projectsDir).mtime.getTime();
            const cachedMtime = this.fileWatchCache.get('projectsDir');
            
            if (!cachedMtime || currentMtime > cachedMtime) {
                this.fileWatchCache.set('projectsDir', currentMtime);
                return true;
            }
            
            return false;
        } catch (error) {
            this.logger.warn('检查文件系统变化时出错:', error);
            return true; // 出错时假定有变化
        }
    }

    /**
     * 智能缓存 - 根据数据类型使用不同的缓存策略
     */
    async getSmartCached(cacheKey, executeMethod, cacheType = 'default') {
        let cache, timeout;
        
        switch (cacheType) {
            case 'session':
                cache = this.sessionCache;
                timeout = this.sessionCacheTimeout;
                break;
            case 'block':
                cache = this.blockCache;
                timeout = this.blockCacheTimeout;
                break;
            default:
                cache = this.cache;
                timeout = this.cacheTimeout;
        }
        
        const cached = cache.get(cacheKey);
        
        // 检查缓存有效性
        if (cached && this.isCacheValid(cached, timeout)) {
            // 对于会话数据，额外检查文件系统变化
            if (cacheType === 'session' && this.hasFileSystemChanged()) {
                this.logger.debug('文件系统有变化，清除会话缓存');
                this.sessionCache.clear();
                this.blockCache.clear();
                this.cacheStats.misses++;
            } else {
                this.cacheStats.hits++;
                this.logger.debug(`缓存命中: ${cacheKey} (${cacheType})`);
                return cached.data;
            }
        }
        
        // 缓存未命中，执行方法
        this.cacheStats.misses++;
        this.logger.debug(`缓存未命中: ${cacheKey} (${cacheType})`);
        
        const startTime = Date.now();
        const data = await executeMethod();
        const duration = Date.now() - startTime;
        
        this.logger.debug(`数据生成耗时: ${duration}ms for ${cacheKey}`);
        
        cache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            duration
        });

        return data;
    }

    /**
     * 获取缓存数据或执行方法（兼容旧版本）
     */
    async getCachedOrExecute(cacheKey, executeMethod) {
        return this.getSmartCached(cacheKey, executeMethod, 'default');
    }

    /**
     * 获取实时监控数据
     */
    async getRealTimeData() {
        const cacheKey = this.getCacheKey('realtime');
        
        return this.getSmartCached(cacheKey, () => {
            try {
                const allSessions = this.sessionAnalyzer.getAllProjectSessions();
                this.logger.info(`加载了 ${allSessions.length} 个会话记录`);
                
                if (allSessions.length === 0) {
                    return this.getEmptyStateData();
                }
                
                // 获取当前活跃块（按原框架逻辑）
                const activeBlock = this.sessionAnalyzer.getActiveSessionBlock(allSessions);
                this.logger.debug(`当前活跃块:`, activeBlock ? `${activeBlock.sessions.length} 会话` : '无');
                
                // 计算当前活跃块的使用量
                let currentUsage;
                if (activeBlock) {
                    currentUsage = {
                        totalTokens: activeBlock.totalTokens,
                        totalInputTokens: activeBlock.totalInputTokens,
                        totalOutputTokens: activeBlock.totalOutputTokens,
                        totalCacheTokens: activeBlock.totalCacheTokens,
                        totalCost: activeBlock.totalCost,
                        totalMessages: activeBlock.totalMessages
                    };
                } else {
                    // 没有活跃块，返回空使用量
                    currentUsage = {
                        totalTokens: 0,
                        totalInputTokens: 0,
                        totalOutputTokens: 0,
                        totalCacheTokens: 0,
                        totalCost: 0,
                        totalMessages: 0
                    };
                }
                
                // 检测订阅计划
                const planDetection = this.tokenCalculator.detectSubscriptionPlan(allSessions);
                
                // 计算模型使用分布（基于活跃块）
                let modelDistribution = {};
                if (activeBlock && activeBlock.modelUsage) {
                    modelDistribution = this.calculateModelDistributionFromBlock(activeBlock.modelUsage);
                }
                
                // 计算燃烧率
                const burnRate = this.tokenCalculator.calculateBurnRate(allSessions, 60);
                
                // 预设限制值
                const limits = this.getPlanLimits(planDetection.plan, planDetection.detectedLimit);
                
                // 预测剩余时间
                const timeRemaining = this.tokenCalculator.predictSessionTimeRemaining(
                    currentUsage.totalTokens,
                    limits.tokens,
                    burnRate
                );
                
                // 生成警告
                const warnings = this.tokenCalculator.generateUsageWarnings(
                    currentUsage,
                    limits,
                    burnRate,
                    timeRemaining
                );
                
                // 计算重置窗口（基于活跃块）
                let windowStart, windowEnd, timeToReset;
                
                if (activeBlock) {
                    // 使用活跃块的时间窗口
                    windowStart = activeBlock.startTime;
                    windowEnd = activeBlock.endTime;
                    timeToReset = windowEnd.getTime() - Date.now();
                } else {
                    // 没有活跃块，使用当前时间的窗口
                    const now = new Date();
                    const currentHour = now.getHours();
                    const windowStartHour = Math.floor(currentHour / 5) * 5;
                    
                    windowStart = new Date(now);
                    windowStart.setHours(windowStartHour, 0, 0, 0);
                    
                    windowEnd = new Date(windowStart);
                    windowEnd.setHours(windowStartHour + 5, 0, 0, 0);
                    
                    timeToReset = windowEnd.getTime() - Date.now();
                }

                return {
                    currentUsage,
                    limits,
                    planDetection,
                    modelDistribution, // 添加模型分布数据
                    burnRate: {
                        tokensPerMinute: burnRate,
                        tokensPerHour: burnRate * 60,
                        estimatedTimeRemaining: timeRemaining
                    },
                    warnings,
                    activeSessions: activeBlock ? activeBlock.sessions.length : 0,
                    lastUpdated: new Date(),
                    sessionWindow: {
                        start: windowStart,
                        end: windowEnd,
                        timeToReset: timeToReset,
                        resetTime: new Date(Date.now() + timeToReset)
                    },
                    debug: {
                        totalSessionsFound: allSessions.length,
                        activeSessionsInWindow: activeBlock ? activeBlock.sessions.length : 0,
                        oldestSession: allSessions.length > 0 ? allSessions[allSessions.length - 1].timestamp : null,
                        newestSession: allSessions.length > 0 ? allSessions[0].timestamp : null,
                        activeBlockInfo: activeBlock ? {
                            id: activeBlock.id,
                            startTime: activeBlock.startTime,
                            endTime: activeBlock.endTime,
                            totalTokens: activeBlock.totalTokens
                        } : null
                    }
                };
            } catch (error) {
                this.logger.error('获取实时数据时出错:', error);
                return this.getEmptyStateData(error.message);
            }
        }, 'default');
    }

    /**
     * 获取每日使用量数据
     */
    async getDailyData(days = 30) {
        const cacheKey = this.getCacheKey('daily', { days });
        
        return this.getCachedOrExecute(cacheKey, () => {
            const allSessions = this.sessionAnalyzer.getAllProjectSessions();
            
            // 过滤最近N天的数据
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const recentSessions = this.sessionAnalyzer.filterSessionsByTimeRange(
                allSessions, 
                cutoffDate, 
                new Date()
            );
            
            const sessionsByDate = this.sessionAnalyzer.groupSessionsByDate(recentSessions);
            const dailyReport = this.tokenCalculator.generateDailyReport(sessionsByDate);
            
            return {
                report: dailyReport,
                totalDays: dailyReport.length,
                dateRange: {
                    start: cutoffDate,
                    end: new Date()
                },
                summary: this.generateDailySummary(dailyReport)
            };
        });
    }

    /**
     * 获取月度使用量数据
     */
    async getMonthlyData(months = 6) {
        const cacheKey = this.getCacheKey('monthly', { months });
        
        return this.getCachedOrExecute(cacheKey, () => {
            const allSessions = this.sessionAnalyzer.getAllProjectSessions();
            
            // 过滤最近N个月的数据
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - months);
            const recentSessions = this.sessionAnalyzer.filterSessionsByTimeRange(
                allSessions,
                cutoffDate,
                new Date()
            );
            
            const sessionsByMonth = this.sessionAnalyzer.groupSessionsByMonth(recentSessions);
            const monthlyReport = this.tokenCalculator.generateMonthlyReport(sessionsByMonth);
            
            return {
                report: monthlyReport,
                totalMonths: monthlyReport.length,
                dateRange: {
                    start: cutoffDate,
                    end: new Date()
                },
                summary: this.generateMonthlySummary(monthlyReport)
            };
        });
    }

    /**
     * 获取计划限制配置
     */
    getPlanLimits(planType, detectedLimit = null) {
        const planConfigs = {
            'pro': {
                tokens: 19000,
                cost: 18.00,
                messages: 250,
                description: 'Claude Pro 订阅'
            },
            'max5': {
                tokens: 88000,
                cost: 35.00,
                messages: 1000,
                description: 'Claude Max5 订阅'
            },
            'max20': {
                tokens: 220000,
                cost: 140.00,
                messages: 2000,
                description: 'Claude Max20 订阅'
            },
            'custom': {
                tokens: detectedLimit || 88000,
                cost: 35.00,
                messages: 1000,
                description: '自定义计划 (基于P90分析)'
            },
            'unknown': {
                tokens: 88000,
                cost: 35.00,
                messages: 1000,
                description: '未知计划 (默认Max5限制)'
            }
        };

        return planConfigs[planType] || planConfigs['unknown'];
    }

    /**
     * 生成每日摘要统计
     */
    generateDailySummary(dailyReport) {
        if (dailyReport.length === 0) {
            return {
                averageTokensPerDay: 0,
                averageCostPerDay: 0,
                totalTokens: 0,
                totalCost: 0,
                peakDay: null,
                trends: {
                    tokensChange: 0,
                    costChange: 0
                }
            };
        }

        const totalTokens = dailyReport.reduce((sum, day) => sum + day.stats.totalTokens, 0);
        const totalCost = dailyReport.reduce((sum, day) => sum + day.stats.totalCost, 0);
        const averageTokensPerDay = totalTokens / dailyReport.length;
        const averageCostPerDay = totalCost / dailyReport.length;
        
        // 找出使用量最高的一天
        const peakDay = dailyReport.reduce((peak, day) => 
            day.stats.totalTokens > (peak?.stats.totalTokens || 0) ? day : peak, null);

        // 计算趋势（最近7天 vs 之前7天）
        const recent7Days = dailyReport.slice(0, 7);
        const previous7Days = dailyReport.slice(7, 14);
        
        const recentAvg = recent7Days.reduce((sum, day) => sum + day.stats.totalTokens, 0) / recent7Days.length;
        const previousAvg = previous7Days.length > 0 
            ? previous7Days.reduce((sum, day) => sum + day.stats.totalTokens, 0) / previous7Days.length 
            : recentAvg;
        
        const tokensChange = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

        return {
            averageTokensPerDay,
            averageCostPerDay,
            totalTokens,
            totalCost,
            peakDay,
            trends: {
                tokensChange,
                costChange: tokensChange // 成本趋势与令牌趋势相似
            }
        };
    }

    /**
     * 生成月度摘要统计
     */
    generateMonthlySummary(monthlyReport) {
        if (monthlyReport.length === 0) {
            return {
                averageTokensPerMonth: 0,
                averageCostPerMonth: 0,
                totalTokens: 0,
                totalCost: 0,
                peakMonth: null,
                growth: {
                    tokensGrowth: 0,
                    costGrowth: 0
                }
            };
        }

        const totalTokens = monthlyReport.reduce((sum, month) => sum + month.stats.totalTokens, 0);
        const totalCost = monthlyReport.reduce((sum, month) => sum + month.stats.totalCost, 0);
        
        const peakMonth = monthlyReport.reduce((peak, month) => 
            month.stats.totalTokens > (peak?.stats.totalTokens || 0) ? month : peak, null);

        // 计算月度增长率
        let growth = { tokensGrowth: 0, costGrowth: 0 };
        if (monthlyReport.length >= 2) {
            const currentMonth = monthlyReport[0];
            const previousMonth = monthlyReport[1];
            
            if (previousMonth.stats.totalTokens > 0) {
                growth.tokensGrowth = ((currentMonth.stats.totalTokens - previousMonth.stats.totalTokens) 
                    / previousMonth.stats.totalTokens) * 100;
            }
            
            if (previousMonth.stats.totalCost > 0) {
                growth.costGrowth = ((currentMonth.stats.totalCost - previousMonth.stats.totalCost) 
                    / previousMonth.stats.totalCost) * 100;
            }
        }

        return {
            averageTokensPerMonth: totalTokens / monthlyReport.length,
            averageCostPerMonth: totalCost / monthlyReport.length,
            totalTokens,
            totalCost,
            peakMonth,
            growth
        };
    }

    /**
     * 获取空状态数据
     */
    getEmptyStateData(errorMessage = null) {
        return {
            currentUsage: {
                totalTokens: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalCacheTokens: 0,
                totalCost: 0,
                totalMessages: 0
            },
            limits: this.getPlanLimits('unknown'),
            planDetection: {
                plan: 'unknown',
                confidence: 0,
                detectedLimit: null
            },
            burnRate: {
                tokensPerMinute: 0,
                tokensPerHour: 0,
                estimatedTimeRemaining: Infinity
            },
            warnings: errorMessage ? [{
                type: 'warning',
                message: `数据加载失败: ${errorMessage}`
            }] : [],
            activeSessions: 0,
            lastUpdated: new Date(),
            sessionWindow: {
                start: new Date(Date.now() - (5 * 60 * 60 * 1000)),
                end: new Date()
            },
            debug: {
                totalSessionsFound: 0,
                activeSessionsInWindow: 0,
                oldestSession: null,
                newestSession: null,
                isEmpty: true
            }
        };
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
        this.sessionCache.clear();
        this.blockCache.clear();
        this.fileWatchCache.clear();
        this.logger.info('所有缓存已清除');
    }

    /**
     * 清除特定类型的缓存
     */
    clearCacheType(type) {
        switch (type) {
            case 'session':
                this.sessionCache.clear();
                this.logger.info('会话缓存已清除');
                break;
            case 'block':
                this.blockCache.clear();
                this.logger.info('会话块缓存已清除');
                break;
            case 'file':
                this.fileWatchCache.clear();
                this.logger.info('文件监控缓存已清除');
                break;
            default:
                this.cache.clear();
                this.logger.info('默认缓存已清除');
        }
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        const uptime = Date.now() - this.cacheStats.lastReset;
        const total = this.cacheStats.hits + this.cacheStats.misses;
        const hitRate = total > 0 ? Math.round((this.cacheStats.hits / total) * 100) : 0;
        
        return {
            hitRate: `${hitRate}%`,
            totalRequests: total,
            hits: this.cacheStats.hits,
            misses: this.cacheStats.misses,
            uptime: Math.round(uptime / 1000), // 秒
            cacheSize: {
                default: this.cache.size,
                session: this.sessionCache.size,
                block: this.blockCache.size,
                fileWatch: this.fileWatchCache.size
            }
        };
    }

    /**
     * 从块的模型使用数据计算分布百分比
     */
    calculateModelDistributionFromBlock(modelUsage) {
        const distribution = {};
        let totalTokens = 0;
        
        // 计算总token数
        Object.values(modelUsage).forEach(usage => {
            totalTokens += usage.tokens;
        });
        
        if (totalTokens === 0) {
            return {};
        }
        
        // 计算每个模型的百分比
        Object.entries(modelUsage).forEach(([model, usage]) => {
            const percentage = (usage.tokens / totalTokens) * 100;
            distribution[model] = {
                tokens: usage.tokens,
                cost: usage.cost,
                messages: usage.messages,
                percentage: Math.round(percentage * 10) / 10 // 保留1位小数
            };
        });
        
        return distribution;
    }

    /**
     * 获取系统状态信息
     */
    getSystemStatus() {
        const cacheStats = this.getCacheStats();
        
        return {
            cacheSize: this.cache.size,
            cacheTimeout: this.cacheTimeout,
            claudeConfigDir: this.sessionAnalyzer.claudeConfigDir,
            lastCacheUpdate: this.cache.size > 0 
                ? Math.max(...Array.from(this.cache.values()).map(entry => entry.timestamp))
                : null,
            cacheStats,
            performance: {
                sessionCacheTimeout: this.sessionCacheTimeout,
                blockCacheTimeout: this.blockCacheTimeout,
                fileWatchEnabled: true
            }
        };
    }
}