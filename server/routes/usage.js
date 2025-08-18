import express from 'express';
import { DataAggregator } from '../usage-monitor/data-aggregator.js';

const router = express.Router();

// 创建数据聚合器实例
let dataAggregator = null;

// 初始化数据聚合器
function getDataAggregator() {
    if (!dataAggregator) {
        dataAggregator = new DataAggregator();
    }
    return dataAggregator;
}

/**
 * GET /api/usage/realtime
 * 获取实时使用量监控数据
 */
router.get('/realtime', async (req, res) => {
    try {
        const aggregator = getDataAggregator();
        const data = await aggregator.getRealTimeData();
        
        res.json({
            success: true,
            data,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error fetching realtime usage data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'REALTIME_DATA_ERROR'
        });
    }
});

/**
 * GET /api/usage/daily
 * 获取每日使用量统计
 * Query params: days (default: 30)
 */
router.get('/daily', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const aggregator = getDataAggregator();
        const data = await aggregator.getDailyData(days);
        
        res.json({
            success: true,
            data,
            params: { days },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error fetching daily usage data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'DAILY_DATA_ERROR'
        });
    }
});

/**
 * GET /api/usage/monthly
 * 获取月度使用量统计
 * Query params: months (default: 6)
 */
router.get('/monthly', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 6;
        const aggregator = getDataAggregator();
        const data = await aggregator.getMonthlyData(months);
        
        res.json({
            success: true,
            data,
            params: { months },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error fetching monthly usage data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'MONTHLY_DATA_ERROR'
        });
    }
});

/**
 * GET /api/usage/plan-detection
 * 获取订阅计划检测结果
 */
router.get('/plan-detection', async (req, res) => {
    try {
        const aggregator = getDataAggregator();
        const sessionAnalyzer = aggregator.sessionAnalyzer;
        const tokenCalculator = aggregator.tokenCalculator;
        
        const allSessions = sessionAnalyzer.getAllProjectSessions();
        const planDetection = tokenCalculator.detectSubscriptionPlan(allSessions);
        const limits = aggregator.getPlanLimits(planDetection.plan, planDetection.detectedLimit);
        
        res.json({
            success: true,
            data: {
                planDetection,
                limits,
                sessionAnalysis: {
                    totalSessions: allSessions.length,
                    dateRange: allSessions.length > 0 ? {
                        start: allSessions[allSessions.length - 1].timestamp,
                        end: allSessions[0].timestamp
                    } : null
                }
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error detecting subscription plan:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'PLAN_DETECTION_ERROR'
        });
    }
});

/**
 * POST /api/usage/custom-limits
 * 设置自定义使用限制
 */
router.post('/custom-limits', async (req, res) => {
    try {
        const { tokens, cost, messages } = req.body;
        
        // 验证输入
        if (!tokens || tokens <= 0) {
            return res.status(400).json({
                success: false,
                error: '令牌限制必须大于0',
                code: 'INVALID_TOKEN_LIMIT'
            });
        }
        
        if (cost && cost <= 0) {
            return res.status(400).json({
                success: false,
                error: '成本限制必须大于0',
                code: 'INVALID_COST_LIMIT'
            });
        }

        // 这里可以将自定义限制保存到配置文件或数据库
        // 目前直接返回确认信息
        res.json({
            success: true,
            data: {
                customLimits: {
                    tokens: parseInt(tokens),
                    cost: parseFloat(cost) || 50.0,
                    messages: parseInt(messages) || 500
                },
                applied: true
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error setting custom limits:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'CUSTOM_LIMITS_ERROR'
        });
    }
});

/**
 * DELETE /api/usage/cache
 * 清除数据缓存
 */
router.delete('/cache', async (req, res) => {
    try {
        const aggregator = getDataAggregator();
        aggregator.clearCache();
        
        res.json({
            success: true,
            message: '缓存已清除',
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'CACHE_CLEAR_ERROR'
        });
    }
});

/**
 * GET /api/usage/status
 * 获取使用量监控系统状态
 */
router.get('/status', async (req, res) => {
    try {
        const aggregator = getDataAggregator();
        const systemStatus = aggregator.getSystemStatus();
        
        res.json({
            success: true,
            data: {
                system: systemStatus,
                health: 'healthy',
                version: '1.0.0'
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting system status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'STATUS_ERROR'
        });
    }
});

/**
 * GET /api/usage/debug
 * 调试使用量数据读取
 */
router.get('/debug', async (req, res) => {
    try {
        const aggregator = getDataAggregator();
        const sessionAnalyzer = aggregator.sessionAnalyzer;
        
        // 收集调试信息
        const debugInfo = {
            claudeConfigDir: sessionAnalyzer.claudeConfigDir,
            projectsDir: sessionAnalyzer.projectsDir,
            configDirExists: require('fs').existsSync(sessionAnalyzer.claudeConfigDir),
            projectsDirExists: require('fs').existsSync(sessionAnalyzer.projectsDir),
            homeDir: require('os').homedir()
        };
        
        // 尝试扫描项目
        if (debugInfo.projectsDirExists) {
            try {
                const projects = require('fs').readdirSync(sessionAnalyzer.projectsDir);
                debugInfo.projects = projects;
                debugInfo.projectCount = projects.length;
                
                // 检查第一个项目的结构
                if (projects.length > 0) {
                    const firstProject = projects[0];
                    const firstProjectPath = require('path').join(sessionAnalyzer.projectsDir, firstProject);
                    debugInfo.sampleProject = {
                        name: firstProject,
                        path: firstProjectPath,
                        exists: require('fs').existsSync(firstProjectPath)
                    };
                    
                    if (debugInfo.sampleProject.exists) {
                        const projectContents = require('fs').readdirSync(firstProjectPath);
                        debugInfo.sampleProject.contents = projectContents;
                        
                        const sessionsPath = require('path').join(firstProjectPath, 'sessions');
                        debugInfo.sampleProject.sessionsPath = sessionsPath;
                        debugInfo.sampleProject.sessionsExists = require('fs').existsSync(sessionsPath);
                        
                        if (debugInfo.sampleProject.sessionsExists) {
                            const sessionFiles = require('fs').readdirSync(sessionsPath);
                            debugInfo.sampleProject.sessionFiles = sessionFiles;
                        }
                    }
                }
            } catch (error) {
                debugInfo.scanError = error.message;
            }
        }
        
        // 尝试获取实际数据
        const allSessions = sessionAnalyzer.getAllProjectSessions();
        debugInfo.sessionCount = allSessions.length;
        
        if (allSessions.length > 0) {
            debugInfo.sampleSession = {
                timestamp: allSessions[0].timestamp,
                model: allSessions[0].model,
                usage: allSessions[0].usage,
                projectName: allSessions[0].projectName
            };
        }
        
        res.json({
            success: true,
            debug: debugInfo,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            code: 'DEBUG_ERROR'
        });
    }
});

/**
 * GET /api/usage/export
 * 导出使用量数据 (CSV格式)
 */
router.get('/export', async (req, res) => {
    try {
        const { format = 'csv', type = 'daily', period = 30 } = req.query;
        const aggregator = getDataAggregator();
        
        let data;
        if (type === 'daily') {
            const result = await aggregator.getDailyData(parseInt(period));
            data = result.report;
        } else if (type === 'monthly') {
            const result = await aggregator.getMonthlyData(parseInt(period));
            data = result.report;
        } else {
            return res.status(400).json({
                success: false,
                error: '不支持的导出类型',
                code: 'INVALID_EXPORT_TYPE'
            });
        }

        if (format === 'csv') {
            const csv = generateCSV(data, type);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="claude-usage-${type}-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
        } else {
            res.json({
                success: true,
                data,
                format,
                type,
                timestamp: new Date()
            });
        }
    } catch (error) {
        console.error('Error exporting usage data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'EXPORT_ERROR'
        });
    }
});

/**
 * 生成CSV格式数据
 */
function generateCSV(data, type) {
    if (type === 'daily') {
        const headers = ['日期', '总令牌数', '输入令牌', '输出令牌', '缓存令牌', '总成本', '会话数'];
        const rows = data.map(item => [
            item.date,
            item.stats.totalTokens,
            item.stats.totalInputTokens,
            item.stats.totalOutputTokens,
            item.stats.totalCacheTokens,
            item.stats.totalCost.toFixed(4),
            item.sessionCount
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    } else if (type === 'monthly') {
        const headers = ['月份', '总令牌数', '总成本', '会话数', '平均每日令牌', '平均每日成本'];
        const rows = data.map(item => [
            item.month,
            item.stats.totalTokens,
            item.stats.totalCost.toFixed(4),
            item.sessionCount,
            Math.round(item.stats.totalTokens / 30), // 粗略估算
            (item.stats.totalCost / 30).toFixed(4)
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return '';
}

export default router;