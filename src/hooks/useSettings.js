import { useState, useEffect, useCallback } from 'react';

// 默认设置值
const DEFAULT_SETTINGS = {
    autoExpandTools: false,
    showRawParameters: false,
    autoScrollToBottom: true,
    sendByCtrlEnter: false,
    chatBgEnabled: false,
};

// 设置键映射
const SETTINGS_KEYS = {
    autoExpandTools: 'autoExpandTools',
    showRawParameters: 'showRawParameters',
    autoScrollToBottom: 'autoScrollToBottom',
    sendByCtrlEnter: 'sendByCtrlEnter',
    chatBgEnabled: 'chatBgEnabled',
};

// 安全的 localStorage 操作，带错误处理
const safeLocalStorage = {
    getItem: (key, defaultValue) => {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Error writing localStorage key "${key}":`, error);
        }
    },
};

/**
 * 集中管理应用设置的Hook
 * 提供缓存机制，减少对localStorage的频繁访问
 */
export function useSettings() {
    // 初始化所有设置，只读取一次localStorage
    const [settings, setSettings] = useState(() => {
        const initialSettings = {};
        Object.entries(DEFAULT_SETTINGS).forEach(([key, defaultValue]) => {
            initialSettings[key] = safeLocalStorage.getItem(SETTINGS_KEYS[key], defaultValue);
        });
        return initialSettings;
    });

    // 更新单个设置的函数，使用useCallback优化
    const updateSetting = useCallback((key, value) => {
        if (!(key in DEFAULT_SETTINGS)) {
            console.warn(`Unknown setting key: ${key}`);
            return;
        }

        setSettings(prev => {
            // 如果值没有变化，不执行更新
            if (prev[key] === value) return prev;
            
            // 更新localStorage
            safeLocalStorage.setItem(SETTINGS_KEYS[key], value);
            
            return { ...prev, [key]: value };
        });
    }, []);

    // 批量更新设置
    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => {
            const updated = { ...prev };
            let hasChanges = false;

            Object.entries(newSettings).forEach(([key, value]) => {
                if (key in DEFAULT_SETTINGS && prev[key] !== value) {
                    updated[key] = value;
                    safeLocalStorage.setItem(SETTINGS_KEYS[key], value);
                    hasChanges = true;
                }
            });

            return hasChanges ? updated : prev;
        });
    }, []);

    // 重置所有设置到默认值
    const resetSettings = useCallback(() => {
        Object.entries(DEFAULT_SETTINGS).forEach(([key, defaultValue]) => {
            safeLocalStorage.setItem(SETTINGS_KEYS[key], defaultValue);
        });
        setSettings(DEFAULT_SETTINGS);
    }, []);

    // 监听其他标签页的localStorage变化
    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key && Object.values(SETTINGS_KEYS).includes(event.key)) {
                const settingKey = Object.keys(SETTINGS_KEYS).find(k => SETTINGS_KEYS[k] === event.key);
                if (settingKey) {
                    try {
                        const newValue = event.newValue !== null ? JSON.parse(event.newValue) : DEFAULT_SETTINGS[settingKey];
                        setSettings(prev => ({ ...prev, [settingKey]: newValue }));
                    } catch (error) {
                        console.warn(`Error parsing storage change for ${settingKey}:`, error);
                    }
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return {
        settings,
        updateSetting,
        updateSettings,
        resetSettings,
        // 为了向后兼容，提供单独的getter
        autoExpandTools: settings.autoExpandTools,
        showRawParameters: settings.showRawParameters,
        autoScrollToBottom: settings.autoScrollToBottom,
        sendByCtrlEnter: settings.sendByCtrlEnter,
        chatBgEnabled: settings.chatBgEnabled,
    };
}