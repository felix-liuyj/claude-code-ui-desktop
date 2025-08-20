/**
 * 优化的WebSocket Hook
 * 提供连接管理、消息缓冲、重连机制等优化功能
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    debounce, 
    throttle, 
    SimpleCache, 
    BatchProcessor 
} from '../utils/performance';

export const useOptimizedWebSocket = (url, options = {}) => {
    const {
        reconnectInterval = 3000,
        maxReconnectAttempts = 5,
        messageBufferSize = 1000,
        heartbeatInterval = 30000,
        messageThrottleMs = 100,
        enableMessageBuffer = true
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected, reconnecting, error
    const [messages, setMessages] = useState([]);
    const [lastError, setLastError] = useState(null);

    const wsRef = useRef(null);
    const messageQueueRef = useRef([]);
    const reconnectAttemptsRef = useRef(0);
    const heartbeatRef = useRef(null);
    const messageCache = useRef(new SimpleCache(100));
    
    // 消息批处理器
    const messageBatchProcessor = useRef(null);

    // 初始化消息批处理器
    useEffect(() => {
        if (enableMessageBuffer) {
            messageBatchProcessor.current = new BatchProcessor(
                (batch) => {
                    setMessages(prev => {
                        const newMessages = [...prev, ...batch];
                        // 限制消息数量，防止内存泄漏
                        return newMessages.length > messageBufferSize 
                            ? newMessages.slice(-messageBufferSize) 
                            : newMessages;
                    });
                },
                10, // 批大小
                messageThrottleMs
            );
        }
        
        return () => {
            messageBatchProcessor.current?.flush();
        };
    }, [enableMessageBuffer, messageBufferSize, messageThrottleMs]);

    // 节流的消息处理器
    const throttledMessageHandler = useCallback(
        throttle((message) => {
            if (enableMessageBuffer && messageBatchProcessor.current) {
                messageBatchProcessor.current.add(message);
            } else {
                setMessages(prev => {
                    const newMessages = [...prev, message];
                    return newMessages.length > messageBufferSize 
                        ? newMessages.slice(-messageBufferSize) 
                        : newMessages;
                });
            }
        }, messageThrottleMs),
        [enableMessageBuffer, messageBufferSize, messageThrottleMs]
    );

    // 防抖的重连函数
    const debouncedReconnect = useCallback(
        debounce(() => {
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                connect();
            } else {
                setConnectionState('error');
                setLastError(new Error('Max reconnection attempts reached'));
            }
        }, reconnectInterval),
        [maxReconnectAttempts, reconnectInterval]
    );

    // 心跳机制
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
        }

        heartbeatRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                try {
                    wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                } catch (error) {
                    console.error('Failed to send heartbeat:', error);
                }
            }
        }, heartbeatInterval);
    }, [heartbeatInterval]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);

    // WebSocket连接函数
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            setConnectionState('connecting');
            setLastError(null);

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('🔗 WebSocket connected');
                setIsConnected(true);
                setConnectionState('connected');
                reconnectAttemptsRef.current = 0;

                // 发送队列中的消息
                while (messageQueueRef.current.length > 0) {
                    const message = messageQueueRef.current.shift();
                    try {
                        ws.send(JSON.stringify(message));
                    } catch (error) {
                        console.error('Failed to send queued message:', error);
                    }
                }

                // 启动心跳
                startHeartbeat();
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    // 处理心跳响应
                    if (message.type === 'pong') {
                        return;
                    }

                    // 检查消息是否已处理过（去重）
                    const messageId = message.id || message.timestamp || Date.now();
                    if (messageCache.current.get(messageId)) {
                        return;
                    }

                    messageCache.current.set(messageId, true);
                    throttledMessageHandler(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onclose = (event) => {
                console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                setIsConnected(false);
                setConnectionState('disconnected');
                stopHeartbeat();

                // 非正常关闭时尝试重连
                if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current++;
                    setConnectionState('reconnecting');
                    console.log(`🔄 Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
                    debouncedReconnect();
                }
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                setLastError(error);
                setConnectionState('error');
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setLastError(error);
            setConnectionState('error');
        }
    }, [url, maxReconnectAttempts, debouncedReconnect, startHeartbeat, stopHeartbeat, throttledMessageHandler]);

    // 发送消息
    const sendMessage = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send message:', error);
                // 连接断开时，将消息加入队列
                messageQueueRef.current.push(message);
            }
        } else {
            // 连接未就绪时，将消息放入队列
            messageQueueRef.current.push(message);
            
            // 限制队列大小
            if (messageQueueRef.current.length > 100) {
                messageQueueRef.current.shift();
            }

            // 尝试连接
            if (!isConnected && connectionState !== 'connecting') {
                connect();
            }
        }
    }, [isConnected, connectionState, connect]);

    // 手动重连
    const reconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        reconnectAttemptsRef.current = 0;
        connect();
    }, [connect]);

    // 断开连接
    const disconnect = useCallback(() => {
        stopHeartbeat();
        if (wsRef.current) {
            wsRef.current.close(1000, 'Manual disconnect');
        }
        setIsConnected(false);
        setConnectionState('disconnected');
    }, [stopHeartbeat]);

    // 清理消息
    const clearMessages = useCallback(() => {
        setMessages([]);
        messageCache.current.clear();
    }, []);

    // 获取连接统计信息
    const getStats = useCallback(() => {
        return {
            isConnected,
            connectionState,
            messagesCount: messages.length,
            queuedMessages: messageQueueRef.current.length,
            reconnectAttempts: reconnectAttemptsRef.current,
            cacheSize: messageCache.current.size(),
            lastError: lastError?.message || null
        };
    }, [isConnected, connectionState, messages.length, lastError]);

    // 初始连接
    useEffect(() => {
        connect();
        
        return () => {
            stopHeartbeat();
            if (wsRef.current) {
                wsRef.current.close();
            }
            messageBatchProcessor.current?.flush();
        };
    }, [connect, stopHeartbeat]);

    // 页面可见性变化处理
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isConnected) {
                console.log('📱 Page became visible, attempting to reconnect...');
                reconnect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isConnected, reconnect]);

    return {
        // 状态
        isConnected,
        connectionState,
        messages,
        lastError,
        
        // 操作
        sendMessage,
        reconnect,
        disconnect,
        clearMessages,
        
        // 统计
        getStats,
        messageCount: messages.length,
        queueSize: messageQueueRef.current.length
    };
};