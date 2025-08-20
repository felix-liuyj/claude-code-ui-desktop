import React, { memo, useCallback, useRef, useEffect } from 'react';
import { AnimatedMessage } from './AnimatedTransition';
import MessageComponent from './MessageComponent';
import { usePerformanceMonitor } from '../hooks/usePerformance';

/**
 * 优化的消息列表组件
 * 支持虚拟滚动和性能监控
 */
const MessageList = memo(({
    messages,
    visibleMessageCount = 50,
    isLoading = false,
    onFileOpen,
    onShowSettings,
    autoExpandTools = false,
    showRawParameters = false,
    userAvatarUrl = null,
    scrollContainerRef,
    messagesEndRef
}) => {
    const { startRender, endRender } = usePerformanceMonitor('MessageList');
    const lastMessageCount = useRef(messages.length);

    // 只显示最近的消息以提升性能
    const visibleMessages = React.useMemo(() => {
        if (messages.length <= visibleMessageCount) {
            return messages;
        }
        return messages.slice(-visibleMessageCount);
    }, [messages, visibleMessageCount]);

    // 检测新消息并优化渲染
    useEffect(() => {
        if (messages.length > lastMessageCount.current) {
            startRender();
            // 在下一个事件循环中结束渲染测量
            setTimeout(endRender, 0);
        }
        lastMessageCount.current = messages.length;
    }, [messages.length, startRender, endRender]);

    // 创建差异化函数（记忆化避免重新创建）
    const createDiff = useCallback((oldContent, newContent) => {
        // 简化的diff实现，避免复杂计算
        return {
            added: newContent.filter(line => !oldContent.includes(line)),
            removed: oldContent.filter(line => !newContent.includes(line))
        };
    }, []);

    // 如果没有消息且不在加载，显示空状态
    if (visibleMessages.length === 0 && !isLoading) {
        return (
            <div className="relative z-10 flex items-center justify-center h-full">
                <div className="text-center text-gray-500 dark:text-gray-400 px-6 sm:px-4">
                    <p className="font-bold text-lg sm:text-xl mb-3">与 Claude 开始对话</p>
                    <p className="text-sm sm:text-base leading-relaxed">
                        提问有关您代码的问题，请求更改，或获取开发任务的帮助
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* 消息数量提示 */}
            {messages.length > visibleMessageCount && (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 border-b border-gray-200 dark:border-gray-700">
                    显示最后 {visibleMessageCount} 条消息（共 {messages.length} 条）
                </div>
            )}

            {/* 消息列表 */}
            <div className="relative z-10">
                {visibleMessages.map((message, index) => {
                    const prevMessage = index > 0 ? visibleMessages[index - 1] : null;

                    return (
                        <AnimatedMessage 
                            key={`${message.id || index}`} 
                            show={true} 
                            index={index}
                            className="mb-4"
                        >
                            <MessageComponent
                                message={message}
                                index={index}
                                prevMessage={prevMessage}
                                createDiff={createDiff}
                                onFileOpen={onFileOpen}
                                onShowSettings={onShowSettings}
                                autoExpandTools={autoExpandTools}
                                showRawParameters={showRawParameters}
                                userAvatarUrl={userAvatarUrl}
                            />
                        </AnimatedMessage>
                    );
                })}
            </div>

            {/* 加载指示器 */}
            {isLoading && (
                <div className="chat-message assistant relative z-10">
                    <div className="w-full max-w-none">
                        <div className="flex items-center space-x-3 mb-3">
                            <img
                                src="claude.svg"
                                alt="Claude"
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 animate-pulse"
                                loading="lazy"
                            />
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                Claude
                            </div>
                        </div>
                        <div className="w-full text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-2">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                                <span className="ml-2 animate-pulse">正在思考...</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </>
    );
});

MessageList.displayName = 'MessageList';

export default MessageList;