import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { MicButton } from './MicButton';
import { useThrottle } from '../hooks/usePerformance';

/**
 * 优化的消息输入组件
 * 包含文件拖拽、自动调整高度等功能
 */
const MessageInput = memo(({
    input,
    setInput,
    isLoading,
    attachedImages,
    setAttachedImages,
    onSubmit,
    sendByCtrlEnter = false,
    placeholder = "输入消息..."
}) => {
    const textareaRef = useRef(null);
    const [isComposing, setIsComposing] = useState(false);

    // 节流的输入处理
    const throttledInputChange = useThrottle((value) => {
        setInput(value);
    }, 16); // 60fps

    // 自动调整文本框高度
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // 重置高度以获取正确的 scrollHeight
        textarea.style.height = 'auto';
        
        // 计算新高度
        const newHeight = Math.min(textarea.scrollHeight, 300); // 最大高度300px
        textarea.style.height = `${newHeight}px`;
    }, []);

    // 优化的输入处理
    const handleInputChange = useCallback((e) => {
        const value = e.target.value;
        throttledInputChange(value);
        adjustTextareaHeight();
    }, [throttledInputChange, adjustTextareaHeight]);

    // 键盘事件处理
    const handleKeyDown = useCallback((e) => {
        // IME组合输入时不处理快捷键
        if (isComposing) return;

        if (e.key === 'Enter') {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                // Ctrl+Enter 或 Cmd+Enter: 发送消息
                e.preventDefault();
                onSubmit(e);
            } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                // 普通 Enter: 根据设置决定是否发送
                if (!sendByCtrlEnter) {
                    e.preventDefault();
                    onSubmit(e);
                }
            }
        }
    }, [isComposing, onSubmit, sendByCtrlEnter]);

    // IME组合事件
    const handleCompositionStart = useCallback(() => {
        setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback(() => {
        setIsComposing(false);
    }, []);

    // 文件拖拽处理
    const {
        getRootProps,
        getInputProps,
        isDragActive,
        open: openFileDialog
    } = useDropzone({
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
        },
        maxSize: 5 * 1024 * 1024, // 5MB
        onDrop: useCallback((acceptedFiles) => {
            const newImages = acceptedFiles.map(file => ({
                file,
                preview: URL.createObjectURL(file),
                id: Math.random().toString(36).substr(2, 9)
            }));
            setAttachedImages(prev => [...prev, ...newImages]);
        }, [setAttachedImages]),
        noClick: true, // 禁用点击上传，只允许拖拽
        noKeyboard: true
    });

    // 移除图片
    const removeImage = useCallback((imageId) => {
        setAttachedImages(prev => {
            const updated = prev.filter(img => img.id !== imageId);
            // 释放对象URL
            const removed = prev.find(img => img.id === imageId);
            if (removed?.preview) {
                URL.revokeObjectURL(removed.preview);
            }
            return updated;
        });
    }, [setAttachedImages]);

    // 组件卸载时清理对象URL
    useEffect(() => {
        return () => {
            attachedImages.forEach(img => {
                if (img.preview) {
                    URL.revokeObjectURL(img.preview);
                }
            });
        };
    }, [attachedImages]);

    // 初始化时调整文本框高度
    useEffect(() => {
        adjustTextareaHeight();
    }, [input, adjustTextareaHeight]);

    return (
        <form onSubmit={onSubmit} className="relative max-w-4xl mx-auto">
            {/* 拖拽遮罩 */}
            {isDragActive && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-black/40 flex items-center justify-center pointer-events-none">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                        </svg>
                        <p className="text-sm font-medium">在此放置图像</p>
                    </div>
                </div>
            )}

            {/* 图片预览 */}
            {attachedImages.length > 0 && (
                <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex flex-wrap gap-2">
                        {attachedImages.map((image) => (
                            <div key={image.id} className="relative group">
                                <img
                                    src={image.preview}
                                    alt={image.file.name}
                                    className="w-16 h-16 object-cover rounded border"
                                    loading="lazy"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(image.id)}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    aria-label="移除图片"
                                >
                                    ×
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                    {image.file.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 输入框容器 */}
            <div 
                {...getRootProps()} 
                className="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all duration-200"
            >
                <input {...getInputProps()} />
                
                {/* 工具栏 */}
                <div className="flex items-center gap-2 px-3 pt-3">
                    {/* 文件上传按钮 */}
                    <button
                        type="button"
                        onClick={openFileDialog}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="上传图片"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                    </button>

                    {/* 麦克风按钮 */}
                    <MicButton className="w-8 h-8 sm:w-8 sm:h-8" />
                </div>

                {/* 文本输入区域 */}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        placeholder={placeholder}
                        disabled={isLoading}
                        rows={1}
                        className="w-full pl-3 pr-16 py-3 bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none min-h-[48px] max-h-[300px] text-sm sm:text-base transition-all duration-200"
                        style={{ height: 'auto' }}
                    />

                    {/* 发送按钮 */}
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-gray-800 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                    >
                        <svg
                            className="w-4 h-4 text-white transform rotate-90"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                        </svg>
                    </button>
                </div>

                {/* 键盘提示 */}
                <div className="px-3 pb-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {sendByCtrlEnter ? 'Ctrl+Enter 发送' : 'Enter 发送，Shift+Enter 换行'}
                    </div>
                </div>
            </div>
        </form>
    );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;