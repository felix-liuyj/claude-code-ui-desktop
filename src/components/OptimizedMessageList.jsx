/**
 * 优化的消息列表组件
 * 使用虚拟滚动和性能优化技术
 */
import React, { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useVirtualList, useScrollOptimization } from '../hooks/usePerformanceOptimizations';

// 消息项组件 - 使用memo优化重渲染
const MessageItem = memo(({ message, style, isVisible }) => {
    const messageRef = useRef(null);
    
    // 只有可见时才渲染内容
    if (!isVisible) {
        return (
            <div style={style} className="message-placeholder">
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-16 rounded"></div>
            </div>
        );
    }

    return (
        <div ref={messageRef} style={style} className="message-item">
            <div className={`p-4 ${
                message.sender === 'user' 
                ? 'bg-blue-50 dark:bg-blue-900/20 ml-8' 
                : 'bg-gray-50 dark:bg-gray-800/50 mr-8'
            } rounded-lg mb-2`}>
                <div className="flex items-start gap-3">
                    {/* 头像 */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        message.sender === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-500 text-white'
                    }`}>
                        {message.sender === 'user' ? 'U' : 'C'}
                    </div>
                    
                    {/* 消息内容 */}
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 mb-1">
                            {new Date(message.timestamp || Date.now()).toLocaleTimeString()}
                        </div>
                        
                        {message.type === 'text' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                        ) : message.type === 'tool_use' ? (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-200 dark:border-amber-800">
                                <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                                    Tool: {message.tool_name}
                                </div>
                                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                    {JSON.stringify(message.parameters, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <div className="text-gray-600 dark:text-gray-400">
                                {message.content || '[Unknown message type]'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数，只比较必要的属性
    return (
        prevProps.message.id === nextProps.message.id &&
        prevProps.message.content === nextProps.message.content &&
        prevProps.isVisible === nextProps.isVisible
    );
});

MessageItem.displayName = 'MessageItem';

// 主要的消息列表组件
const OptimizedMessageList = memo(({ 
    messages, 
    isLoading, 
    containerHeight = 400,
    itemHeight = 100,
    autoScroll = true 
}) => {
    const containerRef = useRef(null);
    const [containerHeightState, setContainerHeightState] = useState(containerHeight);
    const { isScrolling, handleScroll } = useScrollOptimization();
    
    // 使用ResizeObserver动态获取容器高度
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setContainerHeightState(entry.contentRect.height);
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // 虚拟列表逻辑
    const {
        visibleItems,
        totalHeight,
        offsetY,
        setScrollTop
    } = useVirtualList(messages, itemHeight, containerHeightState);

    // 滚动处理
    const handleScrollEvent = useCallback((e) => {
        const scrollTop = e.target.scrollTop;
        setScrollTop(scrollTop);
        handleScroll();
    }, [setScrollTop, handleScroll]);

    // 自动滚动到底部
    useEffect(() => {
        if (autoScroll && containerRef.current && !isScrolling) {
            const container = containerRef.current;
            const shouldAutoScroll = 
                container.scrollTop + container.clientHeight >= 
                container.scrollHeight - 100; // 100px tolerance

            if (shouldAutoScroll) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }, [messages.length, autoScroll, isScrolling]);

    // 优化的渲染函数
    const renderedItems = useMemo(() => {
        return visibleItems.map((message, index) => {
            const actualIndex = messages.indexOf(message);
            const itemTop = actualIndex * itemHeight;
            
            return (
                <MessageItem
                    key={message.id || actualIndex}
                    message={message}
                    isVisible={true}
                    style={{
                        position: 'absolute',
                        top: itemTop,
                        left: 0,
                        right: 0,
                        height: itemHeight
                    }}
                />
            );
        });
    }, [visibleItems, messages, itemHeight]);

    return (
        <div 
            ref={containerRef}
            className="message-list-container relative overflow-auto"
            style={{ height: containerHeight }}
            onScroll={handleScrollEvent}
        >
            {/* 虚拟滚动容器 */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {renderedItems}
            </div>

            {/* 加载指示器 */}
            {isLoading && (
                <div className="flex justify-center p-4">
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm">Claude is thinking...</span>
                    </div>
                </div>
            )}

            {/* 滚动性能优化提示 */}
            {isScrolling && (
                <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    Scrolling...
                </div>
            )}
        </div>
    );
});

OptimizedMessageList.displayName = 'OptimizedMessageList';

// 简化版消息列表（为小数据集优化）
const SimpleMessageList = memo(({ messages, isLoading }) => {
    const containerRef = useRef(null);

    // 自动滚动到底部
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages.length]);

    const renderedMessages = useMemo(() => {
        return messages.map((message, index) => (
            <MessageItem
                key={message.id || index}
                message={message}
                isVisible={true}
                style={{}}
            />
        ));
    }, [messages]);

    return (
        <div 
            ref={containerRef}
            className="message-list-simple overflow-auto h-full p-4"
        >
            {renderedMessages}
            
            {isLoading && (
                <div className="flex justify-center p-4">
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm">Claude is thinking...</span>
                    </div>
                </div>
            )}
        </div>
    );
});

SimpleMessageList.displayName = 'SimpleMessageList';

// 自适应消息列表：根据消息数量选择渲染策略
const AdaptiveMessageList = memo(({ messages, isLoading, ...props }) => {
    const VIRTUAL_SCROLL_THRESHOLD = 50; // 超过50条消息时使用虚拟滚动

    if (messages.length > VIRTUAL_SCROLL_THRESHOLD) {
        return (
            <OptimizedMessageList 
                messages={messages} 
                isLoading={isLoading} 
                {...props} 
            />
        );
    }

    return (
        <SimpleMessageList 
            messages={messages} 
            isLoading={isLoading} 
        />
    );
});

AdaptiveMessageList.displayName = 'AdaptiveMessageList';

export { OptimizedMessageList, SimpleMessageList, AdaptiveMessageList };
export default AdaptiveMessageList;