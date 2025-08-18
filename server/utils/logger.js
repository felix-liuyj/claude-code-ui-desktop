/**
 * 统一日志管理器
 * 提供日志级别控制和格式化输出
 */

// 日志级别定义
const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// 日志级别名称映射
const LogLevelNames = {
    0: 'ERROR',
    1: 'WARN',
    2: 'INFO',
    3: 'DEBUG'
};

// 日志颜色映射（用于控制台输出）
const LogColors = {
    ERROR: '\x1b[31m', // 红色
    WARN: '\x1b[33m',  // 黄色
    INFO: '\x1b[36m',  // 青色
    DEBUG: '\x1b[90m', // 灰色
    RESET: '\x1b[0m'   // 重置
};

class Logger {
    constructor(moduleName = 'General') {
        this.moduleName = moduleName;
        // 从环境变量读取日志级别，默认为 INFO
        this.currentLevel = this.getLogLevelFromEnv();
        this.useColors = process.stdout.isTTY && !process.env.NO_COLOR;
    }

    /**
     * 从环境变量获取日志级别
     */
    getLogLevelFromEnv() {
        const envLevel = process.env.LOG_LEVEL || process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO';
        
        switch (envLevel.toUpperCase()) {
            case 'ERROR': return LogLevel.ERROR;
            case 'WARN': return LogLevel.WARN;
            case 'INFO': return LogLevel.INFO;
            case 'DEBUG': return LogLevel.DEBUG;
            default: return LogLevel.INFO;
        }
    }

    /**
     * 设置日志级别
     */
    setLevel(level) {
        if (typeof level === 'string') {
            level = LogLevel[level.toUpperCase()] || LogLevel.INFO;
        }
        this.currentLevel = level;
    }

    /**
     * 格式化时间戳
     */
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    }

    /**
     * 格式化日志消息
     */
    formatMessage(level, message, ...args) {
        const levelName = LogLevelNames[level];
        const timestamp = this.getTimestamp();
        const prefix = `[${timestamp}] [${levelName}] [${this.moduleName}]`;
        
        if (this.useColors) {
            const color = LogColors[levelName] || LogColors.RESET;
            return `${color}${prefix}${LogColors.RESET} ${message}`;
        }
        
        return `${prefix} ${message}`;
    }

    /**
     * 输出日志
     */
    log(level, message, ...args) {
        if (level > this.currentLevel) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message);
        
        switch (level) {
            case LogLevel.ERROR:
                console.error(formattedMessage, ...args);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage, ...args);
                break;
            default:
                console.log(formattedMessage, ...args);
        }
    }

    // 便捷方法
    error(message, ...args) {
        this.log(LogLevel.ERROR, message, ...args);
    }

    warn(message, ...args) {
        this.log(LogLevel.WARN, message, ...args);
    }

    info(message, ...args) {
        this.log(LogLevel.INFO, message, ...args);
    }

    debug(message, ...args) {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    // 创建子日志器
    child(subModule) {
        return new Logger(`${this.moduleName}:${subModule}`);
    }
}

// 创建默认日志器实例
const defaultLogger = new Logger();

// 导出
export { Logger, LogLevel, defaultLogger };

// 为了兼容性，也提供一个工厂函数
export function createLogger(moduleName) {
    return new Logger(moduleName);
}