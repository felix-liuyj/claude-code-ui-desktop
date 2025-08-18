import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from '../utils/logger.js';

/**
 * Claude会话分析器 - 移植自Python版本的核心功能
 * 分析Claude Code的JSONL会话文件，提取使用量数据
 */
export class SessionAnalyzer {
    constructor(claudeConfigDir = null) {
        this.claudeConfigDir = claudeConfigDir || path.join(os.homedir(), '.claude');
        this.projectsDir = path.join(this.claudeConfigDir, 'projects');
        this.logger = createLogger('SessionAnalyzer');
    }

    /**
     * 解析JSONL文件中的会话数据 - 增强版本，支持更好的错误恢复
     */
    parseJsonlFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            const sessions = [];
            let parseErrors = 0;
            let incompleteLines = 0;
            let summaryLines = 0;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                
                try {
                    // 尝试修复常见的JSON格式问题
                    line = this.tryFixJsonLine(line);
                    
                    const data = JSON.parse(line);
                    
                    // 跳过摘要类型的行
                    if (data.type === 'summary') {
                        summaryLines++;
                        continue;
                    }
                    
                    if (this.isValidSessionData(data)) {
                        sessions.push(this.normalizeSessionData(data));
                    } else if (this.isIncompleteSessionData(data)) {
                        // 处理不完整的数据（可能是截断的）
                        incompleteLines++;
                        if (incompleteLines <= 1) {
                            console.debug(`⚠️ 第${i+1}行数据不完整，尝试部分解析`);
                        }
                    }
                } catch (error) {
                    parseErrors++;
                    // 尝试更激进的修复
                    if (this.tryRecoverPartialData(line)) {
                        // 如果能够恢复部分数据，记录但不处理
                        if (parseErrors <= 3) {
                            console.debug(`🔧 第${i+1}行部分数据已识别但无法完全恢复`);
                        }
                    }
                }
            }
            
            // 优化日志输出
            const validRate = lines.length > 0 ? Math.round(sessions.length / lines.length * 100) : 0;
            if (validRate < 50) {
                this.logger.info(`📖 文件 ${path.basename(filePath)} 解析完成: ${sessions.length}/${lines.length} 行有效 (${validRate}%，${summaryLines} 摘要行，${incompleteLines} 不完整行)`);
            } else {
                this.logger.info(`✅ 文件 ${path.basename(filePath)} 解析成功: ${sessions.length} 个有效会话`);
            }

            return sessions;
        } catch (error) {
            this.logger.error(`❌ 读取JSONL文件失败 ${filePath}:`, error);
            return [];
        }
    }

    /**
     * 验证会话数据的有效性
     */
    isValidSessionData(data) {
        // Claude CLI 格式: 检查是否为助手响应且包含使用量信息
        return data && 
               data.type === 'assistant' && 
               data.message && 
               data.message.usage && 
               typeof data.message.usage.input_tokens === 'number';
    }

    /**
     * 检查是否为不完整的会话数据
     */
    isIncompleteSessionData(data) {
        // 检查数据是否包含部分必要字段但不完整
        return data && (
            (data.type === 'user' && data.message) ||
            (data.type === 'assistant' && !data.message?.usage) ||
            (data.parentUuid && data.sessionId && !data.message)
        );
    }

    /**
     * 尝试修复常见的JSON格式问题
     */
    tryFixJsonLine(line) {
        // 移除行尾的逗号
        if (line.endsWith(',')) {
            line = line.slice(0, -1);
        }
        
        // 检查是否为截断的JSON（包含未闭合的字符串）
        const openQuotes = (line.match(/"/g) || []).length;
        if (openQuotes % 2 !== 0) {
            // 尝试闭合字符串
            line = line + '"}';
        }
        
        return line;
    }

    /**
     * 尝试从部分数据中恢复信息
     */
    tryRecoverPartialData(line) {
        try {
            // 检查是否包含关键字段
            if (line.includes('sessionId') && 
                (line.includes('usage') || line.includes('message'))) {
                return true;
            }
        } catch (e) {
            // 忽略错误
        }
        return false;
    }

    /**
     * 标准化会话数据格式
     */
    normalizeSessionData(data) {
        // Claude CLI 格式: 使用时间戳或生成时间
        const timestamp = new Date(data.timestamp || Date.now());
        
        // 从 Claude CLI 的 assistant 响应中提取使用量数据
        const usage = data.message.usage;
        const model = data.message.model || 'claude-3-sonnet-20240229';
        
        const normalizedUsage = {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cacheTokens: usage.cache_creation_input_tokens || usage.cache_tokens || 0,
            totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        };
        
        return {
            timestamp,
            sessionId: data.sessionId || `session_${timestamp.getTime()}`,
            model,
            modelFamily: this.getModelFamily(model), // 添加模型系列
            usage: normalizedUsage,
            cost: this.calculateCost(usage, model),
            messageCount: 1, // 每个助手响应算作1条消息
            projectName: data.projectName || 'unknown',
            uuid: data.uuid,
            parentUuid: data.parentUuid,
            raw: data // 保留原始数据用于调试
        };
    }

    /**
     * 获取模型系列（Sonnet, Opus, Haiku）
     */
    getModelFamily(model) {
        if (model.includes('sonnet')) return 'Sonnet';
        if (model.includes('opus')) return 'Opus';
        if (model.includes('haiku')) return 'Haiku';
        return 'Unknown';
    }

    /**
     * 计算使用成本 - 基于模型的定价
     */
    calculateCost(usage, model = 'claude-3-sonnet-20240229') {
        const pricing = this.getModelPricing(model);
        
        // 定价是每千个token的价格，所以需要除以1000
        const inputCost = (usage.input_tokens || 0) / 1000 * pricing.input;
        const outputCost = (usage.output_tokens || 0) / 1000 * pricing.output;
        const cacheCost = (usage.cache_tokens || usage.cache_creation_input_tokens || 0) / 1000 * pricing.cache;
        
        return inputCost + outputCost + cacheCost;
    }

    /**
     * 获取模型定价信息 (每千个token的价格，单位：美元)
     */
    getModelPricing(model) {
        const pricingMap = {
            'claude-3-sonnet-20240229': {
                input: 0.003,
                output: 0.015,
                cache: 0.00075
            },
            'claude-3-5-sonnet-20241022': {
                input: 0.003,
                output: 0.015,
                cache: 0.00075
            },
            'claude-3-haiku-20240307': {
                input: 0.00025,
                output: 0.00125,
                cache: 0.00003125
            },
            'claude-3-opus-20240229': {
                input: 0.015,
                output: 0.075,
                cache: 0.00375
            }
        };

        return pricingMap[model] || pricingMap['claude-3-sonnet-20240229'];
    }

    /**
     * 获取所有项目的会话数据
     */
    getAllProjectSessions() {
        const allSessions = [];
        
        try {
            this.logger.info(`🔍 正在扫描Claude配置目录: ${this.claudeConfigDir}`);
            
            if (!fs.existsSync(this.claudeConfigDir)) {
                this.logger.warn(`⚠️ Claude配置目录不存在: ${this.claudeConfigDir}`);
                return allSessions;
            }
            
            this.logger.info(`📁 正在扫描项目目录: ${this.projectsDir}`);
            
            if (!fs.existsSync(this.projectsDir)) {
                this.logger.warn(`⚠️ 项目目录不存在: ${this.projectsDir}`);
                // 尝试扫描其他可能的位置
                return this.scanAlternativeLocations();
            }

            const projects = fs.readdirSync(this.projectsDir);
            this.logger.info(`📂 发现 ${projects.length} 个项目目录:`, projects);
            
            for (const project of projects) {
                const projectPath = path.join(this.projectsDir, project);
                
                try {
                    const stat = fs.statSync(projectPath);
                    if (!stat.isDirectory()) {
                        this.logger.info(`⏭️ 跳过非目录文件: ${project}`);
                        continue;
                    }
                    
                    this.logger.info(`🔍 扫描项目: ${project}`);
                    const projectSessions = this.scanProjectSessions(projectPath, project);
                    allSessions.push(...projectSessions);
                    
                } catch (error) {
                    this.logger.error(`❌ 无法访问项目目录 ${project}:`, error.message);
                }
            }
        } catch (error) {
            this.logger.error('❌ 扫描项目会话时出错:', error);
        }

        this.logger.info(`📊 总共加载了 ${allSessions.length} 个会话记录`);
        
        // 按时间降序排列（最新的在前）
        return allSessions.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 过滤指定时间范围内的会话
     */
    filterSessionsByTimeRange(sessions, startTime, endTime) {
        return sessions.filter(session => 
            session.timestamp >= startTime && session.timestamp <= endTime
        );
    }

    /**
     * 根据原框架逻辑创建会话块并找到当前活跃块
     * 返回当前活跃块的数据，而不是所有会话
     */
    getActiveSessionBlock(sessions, windowHours = 5) {
        const now = new Date();
        
        if (sessions.length === 0) {
            this.logger.info('📊 没有找到任何会话');
            return null;
        }
        
        // 按时间升序排列，构建会话块
        const sortedSessions = sessions.sort((a, b) => a.timestamp - b.timestamp);
        const blocks = this.createSessionBlocks(sortedSessions, windowHours);
        
        // 找到当前活跃的块（end_time > current_time）
        let activeBlock = null;
        this.logger.info(`📊 搜索活跃块，当前时间: ${now.toISOString()}，总块数: ${blocks.length}`);
        
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            this.logger.info(`📊 检查块 ${i}: ${block.startTime.toISOString()} - ${block.endTime.toISOString()}, isGap: ${block.isGap}, tokens: ${block.totalTokens}`);
            
            if (block.endTime > now && !block.isGap) {
                activeBlock = block;
                this.logger.info(`📊 ✅ 找到活跃块 ${i}: ${block.startTime.toISOString()} - ${block.endTime.toISOString()}`);
                this.logger.info(`📊 活跃块会话数量: ${block.sessions.length}`);
                this.logger.info(`📊 活跃块总tokens: ${block.totalTokens}`);
                break;
            } else if (block.endTime <= now) {
                this.logger.info(`📊 ❌ 块 ${i} 已过期: ${block.endTime.toISOString()} <= ${now.toISOString()}`);
            } else if (block.isGap) {
                this.logger.info(`📊 ❌ 块 ${i} 是空隙块`);
            }
        }
        
        if (!activeBlock) {
            this.logger.info('📊 ⚠️ 没有找到任何活跃的会话块');
            // 显示最近的块信息
            if (blocks.length > 0) {
                const latestBlock = blocks[blocks.length - 1];
                this.logger.info(`📊 最近的块: ${latestBlock.startTime.toISOString()} - ${latestBlock.endTime.toISOString()}, tokens: ${latestBlock.totalTokens}`);
            }
        }
        
        return activeBlock;
    }

    /**
     * 创建会话块（按照原框架的逻辑）
     */
    createSessionBlocks(sessions, windowHours = 5) {
        const blocks = [];
        let currentBlock = null;
        
        for (const session of sessions) {
            // 转换为UTC时间以确保一致性
            const utcTimestamp = new Date(session.timestamp.getTime());
            
            // 计算这个会话应该属于哪个块（基于UTC整点小时）
            const sessionHour = utcTimestamp.getUTCHours();
            const blockStartHour = Math.floor(sessionHour / windowHours) * windowHours;
            
            const blockStart = new Date(utcTimestamp);
            blockStart.setUTCHours(blockStartHour, 0, 0, 0);
            
            const blockEnd = new Date(blockStart);
            blockEnd.setUTCHours(blockStartHour + windowHours, 0, 0, 0);
            
            // 检查是否需要创建新块
            if (!currentBlock || 
                currentBlock.startTime.getTime() !== blockStart.getTime()) {
                
                // 完成上一个块
                if (currentBlock) {
                    this.finalizeBlock(currentBlock);
                    blocks.push(currentBlock);
                }
                
                // 创建新块
                currentBlock = {
                    id: blockStart.toISOString(),
                    startTime: blockStart,
                    endTime: blockEnd,
                    sessions: [],
                    totalTokens: 0,
                    totalInputTokens: 0,
                    totalOutputTokens: 0,
                    totalCacheTokens: 0,
                    totalCost: 0,
                    totalMessages: 0,
                    modelUsage: {},
                    isGap: false,
                    isActive: false
                };
            }
            
            // 添加会话到当前块
            this.addSessionToBlock(currentBlock, session);
        }
        
        // 完成最后一个块
        if (currentBlock) {
            this.finalizeBlock(currentBlock);
            blocks.push(currentBlock);
        }
        
        // 标记活跃块
        this.markActiveBlocks(blocks);
        
        return blocks;
    }

    /**
     * 添加会话到块中
     */
    addSessionToBlock(block, session) {
        block.sessions.push(session);
        block.totalTokens += session.usage.totalTokens;
        block.totalInputTokens += session.usage.inputTokens;
        block.totalOutputTokens += session.usage.outputTokens;
        block.totalCacheTokens += session.usage.cacheTokens;
        block.totalCost += session.cost;
        block.totalMessages += session.messageCount;
        
        // 按模型统计
        const modelFamily = session.modelFamily || 'Unknown';
        if (!block.modelUsage[modelFamily]) {
            block.modelUsage[modelFamily] = {
                tokens: 0,
                cost: 0,
                messages: 0
            };
        }
        block.modelUsage[modelFamily].tokens += session.usage.totalTokens;
        block.modelUsage[modelFamily].cost += session.cost;
        block.modelUsage[modelFamily].messages += session.messageCount;
    }

    /**
     * 完成块的构建
     */
    finalizeBlock(block) {
        if (block.sessions.length > 0) {
            block.actualEndTime = block.sessions[block.sessions.length - 1].timestamp;
        }
    }

    /**
     * 标记活跃块（使用UTC时间）
     */
    markActiveBlocks(blocks) {
        const nowUtc = new Date(); // 使用UTC当前时间
        for (const block of blocks) {
            if (!block.isGap && block.endTime > nowUtc) {
                block.isActive = true;
                this.logger.info(`📊 标记活跃块: ${block.startTime.toISOString()} - ${block.endTime.toISOString()}, 现在: ${nowUtc.toISOString()}`);
            }
        }
    }

    /**
     * 获取到下一次重置的剩余时间（毫秒）
     */
    getTimeToNextReset(windowHours = 5) {
        const now = new Date();
        const currentHour = now.getHours();
        const nextResetHour = (Math.floor(currentHour / windowHours) + 1) * windowHours;
        
        const nextReset = new Date(now);
        if (nextResetHour >= 24) {
            // 跨日处理
            nextReset.setDate(nextReset.getDate() + 1);
            nextReset.setHours(nextResetHour - 24, 0, 0, 0);
        } else {
            nextReset.setHours(nextResetHour, 0, 0, 0);
        }
        
        return nextReset.getTime() - now.getTime();
    }

    /**
     * 按日期分组会话数据
     */
    groupSessionsByDate(sessions) {
        const grouped = new Map();
        
        for (const session of sessions) {
            const dateKey = session.timestamp.toDateString();
            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, []);
            }
            grouped.get(dateKey).push(session);
        }
        
        return grouped;
    }

    /**
     * 按月份分组会话数据
     */
    groupSessionsByMonth(sessions) {
        const grouped = new Map();
        
        for (const session of sessions) {
            const monthKey = `${session.timestamp.getFullYear()}-${session.timestamp.getMonth() + 1}`;
            if (!grouped.has(monthKey)) {
                grouped.set(monthKey, []);
            }
            grouped.get(monthKey).push(session);
        }
        
        return grouped;
    }
    
    /**
     * 扫描单个项目的会话数据
     */
    scanProjectSessions(projectPath, projectName) {
        const sessions = [];
        
        // 方法1: 扫描 sessions 子目录
        const sessionsPath = path.join(projectPath, 'sessions');
        if (fs.existsSync(sessionsPath)) {
            this.logger.info(`📁 发现sessions目录: ${sessionsPath}`);
            const sessionFiles = fs.readdirSync(sessionsPath)
                .filter(file => file.endsWith('.jsonl'))
                .map(file => path.join(sessionsPath, file));
            
            this.logger.info(`📄 发现 ${sessionFiles.length} 个JSONL文件`);
            
            for (const sessionFile of sessionFiles) {
                try {
                    this.logger.info(`📖 解析文件: ${sessionFile}`);
                    const fileSessions = this.parseJsonlFile(sessionFile);
                    this.logger.info(`✅ 从 ${sessionFile} 加载了 ${fileSessions.length} 个会话`);
                    
                    sessions.push(...fileSessions.map(session => ({
                        ...session,
                        projectName,
                        sessionFile
                    })));
                } catch (error) {
                    this.logger.error(`❌ 处理会话文件失败 ${sessionFile}:`, error);
                }
            }
        }
        
        // 方法2: 直接扫描项目目录中的.jsonl文件
        try {
            const directFiles = fs.readdirSync(projectPath)
                .filter(file => file.endsWith('.jsonl'))
                .map(file => path.join(projectPath, file));
            
            if (directFiles.length > 0) {
                this.logger.info(`📄 项目根目录发现 ${directFiles.length} 个JSONL文件`);
                
                for (const sessionFile of directFiles) {
                    try {
                        const fileSessions = this.parseJsonlFile(sessionFile);
                        this.logger.info(`✅ 从 ${sessionFile} 加载了 ${fileSessions.length} 个会话`);
                        
                        sessions.push(...fileSessions.map(session => ({
                            ...session,
                            projectName,
                            sessionFile
                        })));
                    } catch (error) {
                        this.logger.error(`❌ 处理会话文件失败 ${sessionFile}:`, error);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`❌ 扫描项目根目录失败 ${projectPath}:`, error);
        }
        
        return sessions;
    }
    
    /**
     * 扫描备选位置的Claude数据
     */
    scanAlternativeLocations() {
        const alternativePaths = [
            path.join(os.homedir(), '.config', 'claude'),
            path.join(os.homedir(), 'Library', 'Application Support', 'Claude'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'Claude'),
            path.join(os.homedir(), '.anthropic'),
            path.join(os.homedir(), '.claude-cli')
        ];
        
        this.logger.info('🔍 尝试备选Claude配置位置...');
        
        for (const altPath of alternativePaths) {
            this.logger.info(`🔍 检查: ${altPath}`);
            if (fs.existsSync(altPath)) {
                this.logger.info(`✅ 找到备选路径: ${altPath}`);
                
                // 更新配置目录路径
                this.claudeConfigDir = altPath;
                this.projectsDir = path.join(altPath, 'projects');
                
                if (fs.existsSync(this.projectsDir)) {
                    this.logger.info(`✅ 找到项目目录: ${this.projectsDir}`);
                    return this.getAllProjectSessions(); // 递归调用
                }
            }
        }
        
        this.logger.warn('⚠️ 未找到任何Claude配置目录');
        return [];
    }
}