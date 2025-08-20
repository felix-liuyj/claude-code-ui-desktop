import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useThrottle } from './usePerformance';

/**
 * 优化的消息管理 Hook
 * 包含虚拟滚动、内存管理和性能优化
 */
export const useMessageManager = (maxMessages = 1000) => {
    const [messages, setMessages] = useState([]);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
    
    // 消息索引缓存
    const messageIndex = useRef(new Map());
    const messageRefs = useRef(new Map());
    
    // 节流的滚动处理
    const throttledScroll = useThrottle((scrollTop, containerHeight, itemHeight) => {
        const start = Math.floor(scrollTop / itemHeight);
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 5; // 多渲染5个作为缓冲
        const end = Math.min(start + visibleCount, messages.length);
        
        setVisibleRange(prev => {
            if (prev.start !== start || prev.end !== end) {
                return { start, end };
            }
            return prev;
        });
    }, 16); // 60fps

    // 优化的消息添加函数
    const addMessage = useCallback((message) => {
        setMessages(prevMessages => {
            // 检查重复消息
            const messageId = message.id || `${message.timestamp}-${message.content?.slice(0, 50)}`;
            if (messageIndex.current.has(messageId)) {
                return prevMessages;
            }

            // 添加到索引
            messageIndex.current.set(messageId, prevMessages.length);

            const newMessages = [...prevMessages, { ...message, id: messageId }];

            // 限制消息数量，移除最旧的消息
            if (newMessages.length > maxMessages) {
                const removed = newMessages.shift();
                messageIndex.current.delete(removed.id);
                
                // 重建索引
                messageIndex.current.clear();
                newMessages.forEach((msg, index) => {
                    messageIndex.current.set(msg.id, index);
                });
            }

            return newMessages;
        });
    }, [maxMessages]);

    // 批量添加消息
    const addMessages = useCallback((newMessages) => {
        if (!Array.isArray(newMessages) || newMessages.length === 0) {
            return;
        }

        setMessages(prevMessages => {
            const uniqueMessages = newMessages.filter(msg => {
                const messageId = msg.id || `${msg.timestamp}-${msg.content?.slice(0, 50)}`;
                return !messageIndex.current.has(messageId);
            });

            if (uniqueMessages.length === 0) {
                return prevMessages;
            }

            // 添加ID并更新索引
            const messagesWithIds = uniqueMessages.map(msg => ({
                ...msg,
                id: msg.id || `${msg.timestamp}-${msg.content?.slice(0, 50)}`
            }));

            messagesWithIds.forEach((msg, index) => {
                messageIndex.current.set(msg.id, prevMessages.length + index);
            });

            const allMessages = [...prevMessages, ...messagesWithIds];

            // 限制总消息数量
            if (allMessages.length > maxMessages) {
                const removeCount = allMessages.length - maxMessages;
                const removedMessages = allMessages.splice(0, removeCount);
                
                // 更新索引
                removedMessages.forEach(msg => {
                    messageIndex.current.delete(msg.id);
                });

                // 重建索引
                messageIndex.current.clear();
                allMessages.forEach((msg, index) => {
                    messageIndex.current.set(msg.id, index);
                });
            }

            return allMessages;
        });
    }, [maxMessages]);

    // 更新特定消息
    const updateMessage = useCallback((messageId, updates) => {
        const index = messageIndex.current.get(messageId);
        if (index === undefined) return;

        setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            newMessages[index] = { ...newMessages[index], ...updates };
            return newMessages;
        });
    }, []);

    // 删除消息
    const removeMessage = useCallback((messageId) => {
        const index = messageIndex.current.get(messageId);
        if (index === undefined) return;

        setMessages(prevMessages => {
            const newMessages = prevMessages.filter((_, i) => i !== index);
            
            // 重建索引
            messageIndex.current.clear();
            newMessages.forEach((msg, i) => {
                messageIndex.current.set(msg.id, i);
            });
            
            return newMessages;
        });
    }, []);

    // 清空消息
    const clearMessages = useCallback(() => {
        setMessages([]);
        messageIndex.current.clear();
        messageRefs.current.clear();
    }, []);

    // 可见消息（用于虚拟滚动）
    const visibleMessages = useMemo(() => {
        return messages.slice(visibleRange.start, visibleRange.end);
    }, [messages, visibleRange]);

    // 消息统计
    const messageStats = useMemo(() => {
        const stats = {
            total: messages.length,
            visible: visibleMessages.length,
            userMessages: 0,
            assistantMessages: 0,
            toolMessages: 0
        };

        messages.forEach(msg => {
            switch (msg.role || msg.type) {
                case 'user':
                    stats.userMessages++;
                    break;
                case 'assistant':
                    stats.assistantMessages++;
                    break;
                case 'tool':
                    stats.toolMessages++;
                    break;
            }
        });

        return stats;
    }, [messages, visibleMessages.length]);

    // 消息搜索
    const searchMessages = useCallback((query, options = {}) => {
        const { 
            caseSensitive = false, 
            exactMatch = false,
            role = null,
            limit = 100 
        } = options;

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        return messages
            .filter(msg => {
                // 角色过滤
                if (role && msg.role !== role) return false;
                
                // 内容搜索
                const content = caseSensitive ? 
                    (msg.content || '') : 
                    (msg.content || '').toLowerCase();
                
                return exactMatch ? 
                    content === searchQuery : 
                    content.includes(searchQuery);
            })
            .slice(0, limit);
    }, [messages]);

    // 获取消息引用
    const getMessageRef = useCallback((messageId) => {
        if (!messageRefs.current.has(messageId)) {
            messageRefs.current.set(messageId, { current: null });
        }
        return messageRefs.current.get(messageId);
    }, []);

    // 清理未使用的引用
    useEffect(() => {
        const currentMessageIds = new Set(messages.map(msg => msg.id));
        const refIds = Array.from(messageRefs.current.keys());
        
        refIds.forEach(id => {
            if (!currentMessageIds.has(id)) {
                messageRefs.current.delete(id);
            }
        });
    }, [messages]);

    return {
        // State
        messages,
        visibleMessages,
        visibleRange,
        messageStats,
        
        // Actions
        addMessage,
        addMessages,
        updateMessage,
        removeMessage,
        clearMessages,
        throttledScroll,
        searchMessages,
        getMessageRef,
        
        // Utils
        messageCount: messages.length,
        hasMessages: messages.length > 0
    };
};