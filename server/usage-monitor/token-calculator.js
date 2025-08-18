/**
 * 令牌计算器 - 提供高级统计分析功能
 * 移植自Python版本的P90分析和燃烧率计算
 */
export class TokenCalculator {
    constructor() {
        this.sessionWindow = 5 * 60 * 60 * 1000; // 5小时毫秒
    }

    /**
     * 计算P90百分位数 - 用于智能限制检测
     */
    calculateP90(values) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * 0.9) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * 计算P95百分位数 - 用于更严格的限制检测
     */
    calculateP95(values) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * 0.95) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * 计算会话总使用量统计
     */
    calculateSessionStats(sessions) {
        if (sessions.length === 0) {
            return {
                totalTokens: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalCacheTokens: 0,
                totalCost: 0,
                totalMessages: 0,
                sessionCount: 0,
                averageTokensPerSession: 0,
                averageCostPerSession: 0,
                modelUsage: {}
            };
        }

        const stats = sessions.reduce((acc, session) => {
            acc.totalTokens += session.usage.totalTokens;
            acc.totalInputTokens += session.usage.inputTokens;
            acc.totalOutputTokens += session.usage.outputTokens;
            acc.totalCacheTokens += session.usage.cacheTokens;
            acc.totalCost += session.cost;
            acc.totalMessages += session.messageCount;
            
            // 统计模型使用情况
            const modelFamily = session.modelFamily || 'Unknown';
            if (!acc.modelUsage[modelFamily]) {
                acc.modelUsage[modelFamily] = {
                    tokens: 0,
                    cost: 0,
                    messages: 0
                };
            }
            acc.modelUsage[modelFamily].tokens += session.usage.totalTokens;
            acc.modelUsage[modelFamily].cost += session.cost;
            acc.modelUsage[modelFamily].messages += session.messageCount;
            
            return acc;
        }, {
            totalTokens: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheTokens: 0,
            totalCost: 0,
            totalMessages: 0,
            modelUsage: {}
        });

        stats.sessionCount = sessions.length;
        stats.averageTokensPerSession = stats.totalTokens / stats.sessionCount;
        stats.averageCostPerSession = stats.totalCost / stats.sessionCount;

        return stats;
    }

    /**
     * 计算模型使用占比
     */
    calculateModelDistribution(sessions) {
        if (sessions.length === 0) {
            return {};
        }

        const modelStats = {};
        let totalTokens = 0;

        // 统计每个模型的使用量
        sessions.forEach(session => {
            const modelFamily = session.modelFamily || 'Unknown';
            const tokens = session.usage.totalTokens;
            
            totalTokens += tokens;
            
            if (!modelStats[modelFamily]) {
                modelStats[modelFamily] = {
                    tokens: 0,
                    cost: 0,
                    messages: 0
                };
            }
            
            modelStats[modelFamily].tokens += tokens;
            modelStats[modelFamily].cost += session.cost;
            modelStats[modelFamily].messages += session.messageCount;
        });

        // 计算百分比
        const distribution = {};
        Object.keys(modelStats).forEach(model => {
            const stats = modelStats[model];
            distribution[model] = {
                percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
                tokens: stats.tokens,
                cost: stats.cost,
                messages: stats.messages
            };
        });

        return distribution;
    }

    /**
     * 计算燃烧率 - 每分钟令牌消耗速度
     */
    calculateBurnRate(sessions, windowMinutes = 60) {
        if (sessions.length < 2) return 0;

        const now = new Date();
        const windowStart = new Date(now.getTime() - (windowMinutes * 60 * 1000));
        
        const recentSessions = sessions.filter(s => s.timestamp >= windowStart);
        if (recentSessions.length === 0) return 0;

        const totalTokens = recentSessions.reduce((sum, s) => sum + s.usage.totalTokens, 0);
        return totalTokens / windowMinutes;
    }

    /**
     * 预测会话剩余时间 - 基于当前燃烧率
     */
    predictSessionTimeRemaining(currentTokens, tokenLimit, burnRatePerMinute) {
        if (burnRatePerMinute <= 0) return Infinity;
        
        const remainingTokens = Math.max(0, tokenLimit - currentTokens);
        const remainingMinutes = remainingTokens / burnRatePerMinute;
        
        return Math.max(0, remainingMinutes);
    }

    /**
     * 检测用户的订阅计划类型
     */
    detectSubscriptionPlan(sessions) {
        if (sessions.length === 0) {
            return { plan: 'unknown', confidence: 0, detectedLimit: 0 };
        }

        // 收集所有5小时窗口内的最大使用量
        const windowUsages = this.getMaxUsagePerWindow(sessions);
        
        if (windowUsages.length === 0) {
            return { plan: 'unknown', confidence: 0, detectedLimit: 0 };
        }

        const maxUsage = Math.max(...windowUsages);
        const p90Usage = this.calculateP90(windowUsages);
        
        // 基于使用量模式检测计划类型
        if (maxUsage <= 20000) {
            return { plan: 'pro', confidence: 0.8, detectedLimit: 19000 };
        } else if (maxUsage <= 90000) {
            return { plan: 'max5', confidence: 0.85, detectedLimit: 88000 };
        } else if (maxUsage <= 225000) {
            return { plan: 'max20', confidence: 0.9, detectedLimit: 220000 };
        } else {
            return { 
                plan: 'custom', 
                confidence: 0.95, 
                detectedLimit: Math.ceil(p90Usage * 1.1) // P90 + 10% 缓冲
            };
        }
    }

    /**
     * 获取每个5小时窗口的最大使用量
     */
    getMaxUsagePerWindow(sessions) {
        const windows = new Map();
        const windowDuration = this.sessionWindow;

        for (const session of sessions) {
            const windowStart = Math.floor(session.timestamp.getTime() / windowDuration) * windowDuration;
            const windowKey = windowStart.toString();
            
            if (!windows.has(windowKey)) {
                windows.set(windowKey, 0);
            }
            
            windows.set(windowKey, windows.get(windowKey) + session.usage.totalTokens);
        }

        return Array.from(windows.values());
    }

    /**
     * 生成使用量预警信息
     */
    generateUsageWarnings(currentUsage, limits, burnRate, timeRemaining) {
        const warnings = [];
        const usagePercent = (currentUsage.totalTokens / limits.tokens) * 100;
        const costPercent = (currentUsage.totalCost / limits.cost) * 100;

        // 令牌使用量警告
        if (usagePercent >= 90) {
            warnings.push({
                type: 'danger',
                category: 'tokens',
                message: `令牌使用量已达 ${usagePercent.toFixed(1)}%`,
                severity: 'high'
            });
        } else if (usagePercent >= 75) {
            warnings.push({
                type: 'warning',
                category: 'tokens',
                message: `令牌使用量已达 ${usagePercent.toFixed(1)}%`,
                severity: 'medium'
            });
        }

        // 成本警告
        if (costPercent >= 90) {
            warnings.push({
                type: 'danger',
                category: 'cost',
                message: `成本已达 ${costPercent.toFixed(1)}%`,
                severity: 'high'
            });
        } else if (costPercent >= 75) {
            warnings.push({
                type: 'warning',
                category: 'cost',
                message: `成本已达 ${costPercent.toFixed(1)}%`,
                severity: 'medium'
            });
        }

        // 燃烧率警告
        if (burnRate > 0 && timeRemaining < 30) {
            warnings.push({
                type: 'danger',
                category: 'burnRate',
                message: `按当前速度，约 ${Math.round(timeRemaining)} 分钟后达到限制`,
                severity: 'high'
            });
        } else if (burnRate > 0 && timeRemaining < 60) {
            warnings.push({
                type: 'warning',
                category: 'burnRate',
                message: `按当前速度，约 ${Math.round(timeRemaining)} 分钟后达到限制`,
                severity: 'medium'
            });
        }

        return warnings;
    }

    /**
     * 生成每日使用量报告
     */
    generateDailyReport(sessionsByDate) {
        const report = [];
        
        for (const [date, sessions] of sessionsByDate) {
            const stats = this.calculateSessionStats(sessions);
            const modelUsage = this.getModelUsageBreakdown(sessions);
            
            report.push({
                date,
                stats,
                modelUsage,
                sessionCount: sessions.length
            });
        }
        
        return report.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * 生成月度使用量报告
     */
    generateMonthlyReport(sessionsByMonth) {
        const report = [];
        
        for (const [month, sessions] of sessionsByMonth) {
            const stats = this.calculateSessionStats(sessions);
            const dailyBreakdown = this.getDailyBreakdownForMonth(sessions);
            
            report.push({
                month,
                stats,
                dailyBreakdown,
                sessionCount: sessions.length
            });
        }
        
        return report.sort((a, b) => b.month.localeCompare(a.month));
    }

    /**
     * 获取模型使用量分解
     */
    getModelUsageBreakdown(sessions) {
        const modelStats = new Map();
        
        for (const session of sessions) {
            const model = session.model;
            if (!modelStats.has(model)) {
                modelStats.set(model, {
                    sessions: 0,
                    totalTokens: 0,
                    totalCost: 0
                });
            }
            
            const stats = modelStats.get(model);
            stats.sessions++;
            stats.totalTokens += session.usage.totalTokens;
            stats.totalCost += session.cost;
        }
        
        return Object.fromEntries(modelStats);
    }

    /**
     * 获取月份内的每日分解数据
     */
    getDailyBreakdownForMonth(sessions) {
        const dailyMap = new Map();
        
        for (const session of sessions) {
            const dayKey = session.timestamp.getDate();
            if (!dailyMap.has(dayKey)) {
                dailyMap.set(dayKey, {
                    day: dayKey,
                    tokens: 0,
                    cost: 0,
                    sessions: 0
                });
            }
            
            const dayStats = dailyMap.get(dayKey);
            dayStats.tokens += session.usage.totalTokens;
            dayStats.cost += session.cost;
            dayStats.sessions++;
        }
        
        return Array.from(dailyMap.values()).sort((a, b) => a.day - b.day);
    }
}