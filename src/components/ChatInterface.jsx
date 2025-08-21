/*
 * ChatInterface.jsx - Chat Component with Session Protection Integration
 * 
 * SESSION PROTECTION INTEGRATION:
 * ===============================
 * 
 * This component integrates with the Session Protection System to prevent project updates
 * from interrupting active conversations:
 * 
 * Key Integration Points:
 * 1. handleSubmit() - Marks session as active when user sends message (including temp ID for new sessions)
 * 2. session-created handler - Replaces temporary session ID with real WebSocket session ID  
 * 3. claude-complete handler - Marks session as inactive when conversation finishes
 * 4. session-aborted handler - Marks session as inactive when conversation is aborted
 * 
 * This ensures uninterrupted chat experience by coordinating with App.jsx to pause sidebar updates.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDropzone } from 'react-dropzone';
import TodoList from './TodoList';
import { useElectron } from '../utils/electron';
import { AnimatedTransition, AnimatedMessage, useButtonAnimation } from './AnimatedTransition';

import ClaudeStatus from './ClaudeStatus';
import { MicButton } from './MicButton.jsx';
import { api } from '../utils/api';

// Safe localStorage utility to handle quota exceeded errors
const safeLocalStorage = {
    setItem: (key, value) => {
        try {
            // For chat messages, implement compression and size limits
            if (key.startsWith('chat_messages_') && typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    // Limit to last 50 messages to prevent storage bloat
                    if (Array.isArray(parsed) && parsed.length > 50) {
                        console.warn(`Truncating chat history for ${ key } from ${ parsed.length } to 50 messages`);
                        const truncated = parsed.slice(-50);
                        value = JSON.stringify(truncated);
                    }
                } catch (parseError) {
                    console.warn('Could not parse chat messages for truncation:', parseError);
                }
            }

            localStorage.setItem(key, value);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, clearing old data');
                // Clear old chat messages to free up space
                const keys = Object.keys(localStorage);
                const chatKeys = keys.filter(k => k.startsWith('chat_messages_')).sort();

                // Remove oldest chat data first, keeping only the 3 most recent projects
                if (chatKeys.length > 3) {
                    chatKeys.slice(0, chatKeys.length - 3).forEach(k => {
                        localStorage.removeItem(k);
                        console.log(`Removed old chat data: ${ k }`);
                    });
                }

                // If still failing, clear draft inputs too
                const draftKeys = keys.filter(k => k.startsWith('draft_input_'));
                draftKeys.forEach(k => {
                    localStorage.removeItem(k);
                });

                // Try again with reduced data
                try {
                    localStorage.setItem(key, value);
                } catch (retryError) {
                    console.error('Failed to save to localStorage even after cleanup:', retryError);
                    // Last resort: Try to save just the last 10 messages
                    if (key.startsWith('chat_messages_') && typeof value === 'string') {
                        try {
                            const parsed = JSON.parse(value);
                            if (Array.isArray(parsed) && parsed.length > 10) {
                                const minimal = parsed.slice(-10);
                                localStorage.setItem(key, JSON.stringify(minimal));
                                console.warn('Saved only last 10 messages due to quota constraints');
                            }
                        } catch (finalError) {
                            console.error('Final save attempt failed:', finalError);
                        }
                    }
                }
            } else {
                console.error('localStorage error:', error);
            }
        }
    },
    getItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error('localStorage getItem error:', error);
            return null;
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('localStorage removeItem error:', error);
        }
    }
};

// Memoized message component to prevent unnecessary re-renders
const MessageComponent = memo(({
                                   message,
                                   prevMessage,
                                   createDiff,
                                   onFileOpen,
                                   onShowSettings,
                                   autoExpandTools,
                                   showRawParameters,
                                   userAvatarUrl
                               }) => {
    const isGrouped = prevMessage && prevMessage.type === message.type &&
        prevMessage.type === 'assistant' &&
        !prevMessage.isToolUse && !message.isToolUse;
    const messageRef = React.useRef(null);
    const [isExpanded, setIsExpanded] = React.useState(false);
    React.useEffect(() => {
        if (!autoExpandTools || !messageRef.current || !message.isToolUse) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isExpanded) {
                        setIsExpanded(true);
                        // Find all details elements and open them
                        const details = messageRef.current.querySelectorAll('details');
                        details.forEach(detail => {
                            detail.open = true;
                        });
                    }
                });
            },
            { threshold: 0.1 }
        );

        observer.observe(messageRef.current);

        return () => {
            if (messageRef.current) {
                observer.unobserve(messageRef.current);
            }
        };
    }, [autoExpandTools, isExpanded, message.isToolUse]);

    return (
        <div
            ref={ messageRef }
            className={ `chat-message ${ message.type } ${ isGrouped ? 'grouped' : '' } ${ message.type === 'user' ? 'flex justify-end px-4 sm:px-6 py-2' : 'px-4 sm:px-6 py-3' }` }
        >
            { message.type === 'user' ? (
                /* User message bubble on the right */
                <div
                    className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[80%] md:max-w-lg lg:max-w-2xl xl:max-w-3xl">
                    <div
                        className="bg-primary text-white rounded-2xl rounded-br-md px-4 sm:px-5 py-3 shadow-sm flex-1 sm:flex-initial">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            { message.content }
                        </div>
                        { message.images && message.images.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                { message.images.map((img, idx) => (
                                    <img
                                        key={ idx }
                                        src={ img.data }
                                        alt={ img.name }
                                        className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90"
                                        onClick={ () => window.open(img.data, '_blank') }
                                    />
                                )) }
                            </div>
                        ) }
                        <div className="text-xs text-primary-foreground/80 mt-2 text-right opacity-75">
                            { new Date(message.timestamp).toLocaleTimeString() }
                        </div>
                    </div>
                    { !isGrouped && (
                        <img
                            src={ userAvatarUrl || "asker.svg" }
                            alt="User"
                            className="hidden sm:flex w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                    ) }
                </div>
            ) : (
                /* Claude/Error messages on the left */
                <div className="w-full max-w-none">
                    { !isGrouped && (
                        <div className="flex items-center space-x-3 mb-3">
                            { message.type === 'error' ? (
                                <div
                                    className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                                    !
                                </div>
                            ) : (
                                <img
                                    src="claude.svg"
                                    alt="Claude"
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                            ) }
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                { message.type === 'error' ? '错误' : 'Claude' }
                            </div>
                        </div>
                    ) }

                    <div className="w-full">

                        { message.isToolUse && !['Read', 'TodoWrite', 'TodoRead'].includes(message.toolName) ? (
                            <div
                                className="bg-primary/5 border border-primary/20 rounded-lg p-2 sm:p-3 mb-2">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                            </svg>
                                        </div>
                                        <span className="font-medium text-primary-foreground">
                      Using { message.toolName }
                    </span>
                                        <span className="text-xs text-primary font-mono">
                      { message.toolId }
                    </span>
                                    </div>
                                    { onShowSettings && (
                                        <button
                                            onClick={ (e) => {
                                                e.stopPropagation();
                                                onShowSettings();
                                            } }
                                            className="p-1 rounded hover:bg-primary/20"
                                            title="设置"
                                        >
                                            <svg className="w-4 h-4 text-primary" fill="none"
                                                 stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                            </svg>
                                        </button>
                                    ) }
                                </div>
                                { message.toolInput && message.toolName === 'Edit' && (() => {
                                    try {
                                        const input = JSON.parse(message.toolInput);
                                        if (input.file_path && input.old_string && input.new_string) {
                                            return (
                                                <details className="mt-2" open={ autoExpandTools }>
                                                    <summary
                                                        className="text-sm text-primary cursor-pointer hover:text-primary/80 flex items-center gap-2">
                                                        <svg className="w-4 h-4 details-chevron"
                                                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                                  strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                        </svg>
                                                        📝 查看编辑差异为
                                                        <button
                                                            onClick={ (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onFileOpen && onFileOpen(input.file_path, {
                                                                    old_string: input.old_string,
                                                                    new_string: input.new_string
                                                                });
                                                            } }
                                                            className="text-primary hover:text-primary/80 underline font-mono"
                                                        >
                                                            { input.file_path.split('/').pop() }
                                                        </button>
                                                    </summary>
                                                    <div className="mt-3">
                                                        <div
                                                            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                                            <div
                                                                className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                                                <button
                                                                    onClick={ () => onFileOpen && onFileOpen(input.file_path, {
                                                                        old_string: input.old_string,
                                                                        new_string: input.new_string
                                                                    }) }
                                                                    className="text-xs font-mono text-primary hover:text-primary/80 truncate underline cursor-pointer"
                                                                >
                                                                    { input.file_path }
                                                                </button>
                                                                <span
                                                                    className="text-xs text-gray-500 dark:text-gray-400">
                                  差异
                                </span>
                                                            </div>
                                                            <div className="text-xs font-mono">
                                                                { createDiff(input.old_string, input.new_string).map((diffLine, i) => (
                                                                    <div key={ i } className="flex">
                                    <span className={ `w-8 text-center border-r ${
                                        diffLine.type === 'removed'
                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                    }` }>
                                      { diffLine.type === 'removed' ? '-' : '+' }
                                    </span>
                                                                        <span
                                                                            className={ `px-2 py-0.5 flex-1 whitespace-pre-wrap ${
                                                                                diffLine.type === 'removed'
                                                                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                                                                                    : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                                                            }` }>
                                      { diffLine.content }
                                    </span>
                                                                    </div>
                                                                )) }
                                                            </div>
                                                        </div>
                                                        { showRawParameters && (
                                                            <details className="mt-2" open={ autoExpandTools }>
                                                                <summary
                                                                    className="text-xs text-primary cursor-pointer hover:text-primary/80">
                                                                    查看输入参数 (原始)
                                                                </summary>
                                                                <pre
                                                                    className="mt-2 text-xs bg-primary/10 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-primary-foreground">
                                                                    { typeof message.toolInput === 'string' ? message.toolInput : JSON.stringify(message.toolInput, null, 2) }
                                                                </pre>
                                                            </details>
                                                        ) }
                                                    </div>
                                                </details>
                                            );
                                        }
                                    } catch (e) {
                                        return null;
                                    }
                                })() }
                                { message.toolInput && message.toolName !== 'Edit' && (() => {
                                    // Debug log to see what we're dealing with
                                    console.log('Tool display - name:', message.toolName, 'input type:', typeof message.toolInput);

                                    // Special handling for Write tool
                                    if (message.toolName === 'Write') {
                                        console.log('Write tool detected, toolInput:', message.toolInput);
                                        try {
                                            let input;
                                            // Handle both JSON string and already parsed object
                                            if (typeof message.toolInput === 'string') {
                                                input = JSON.parse(message.toolInput);
                                            } else {
                                                input = message.toolInput;
                                            }

                                            console.log('Parsed Write input:', input);

                                            if (input.file_path && input.content !== undefined) {
                                                return (
                                                    <details className="mt-2" open={ autoExpandTools }>
                                                        <summary
                                                            className="text-sm text-primary cursor-pointer hover:text-primary/80 flex items-center gap-2">
                                                            <svg
                                                                className="w-4 h-4 transition-transform details-chevron"
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                      strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                            </svg>
                                                            📄 正在创建新文件:
                                                            <button
                                                                onClick={ (e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    onFileOpen && onFileOpen(input.file_path, {
                                                                        old_string: '',
                                                                        new_string: input.content
                                                                    });
                                                                } }
                                                                className="text-primary hover:text-primary/80 underline font-mono"
                                                            >
                                                                { input.file_path.split('/').pop() }
                                                            </button>
                                                        </summary>
                                                        <div className="mt-3">
                                                            <div
                                                                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                                                <div
                                                                    className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                                                    <button
                                                                        onClick={ () => onFileOpen && onFileOpen(input.file_path, {
                                                                            old_string: '',
                                                                            new_string: input.content
                                                                        }) }
                                                                        className="text-xs font-mono text-primary hover:text-primary/80 truncate underline cursor-pointer"
                                                                    >
                                                                        { input.file_path }
                                                                    </button>
                                                                    <span
                                                                        className="text-xs text-gray-500 dark:text-gray-400">
                                    新文件
                                  </span>
                                                                </div>
                                                                <div className="text-xs font-mono">
                                                                    { createDiff('', input.content).map((diffLine, i) => (
                                                                        <div key={ i } className="flex">
                                      <span className={ `w-8 text-center border-r ${
                                          diffLine.type === 'removed'
                                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                              : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                      }` }>
                                        { diffLine.type === 'removed' ? '-' : '+' }
                                      </span>
                                                                            <span
                                                                                className={ `px-2 py-0.5 flex-1 whitespace-pre-wrap ${
                                                                                    diffLine.type === 'removed'
                                                                                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                                                                                        : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                                                                }` }>
                                        { diffLine.content }
                                      </span>
                                                                        </div>
                                                                    )) }
                                                                </div>
                                                            </div>
                                                            { showRawParameters && (
                                                                <details className="mt-2" open={ autoExpandTools }>
                                                                    <summary
                                                                        className="text-xs text-primary cursor-pointer hover:text-primary/80">
                                                                        View raw parameters
                                                                    </summary>
                                                                    <pre
                                                                        className="mt-2 text-xs bg-primary/10 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-primary-foreground">
                                    { message.toolInput }
                                  </pre>
                                                                </details>
                                                            ) }
                                                        </div>
                                                    </details>
                                                );
                                            }
                                        } catch (e) {
                                            // Fall back to regular display
                                        }
                                    }

                                    // Special handling for TodoWrite tool
                                    if (message.toolName === 'TodoWrite') {
                                        try {
                                            const input = JSON.parse(message.toolInput);
                                            if (input.todos && Array.isArray(input.todos)) {
                                                return (
                                                    <details className="mt-2" open={ autoExpandTools }>
                                                        <summary
                                                            className="text-sm text-primary cursor-pointer hover:text-primary/80 flex items-center gap-2">
                                                            <svg
                                                                className="w-4 h-4 transition-transform details-chevron"
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                      strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                            </svg>
                                                            更新任务列表
                                                        </summary>
                                                        <div className="mt-3">
                                                            <TodoList todos={ input.todos }/>
                                                            { showRawParameters && (
                                                                <details className="mt-3" open={ autoExpandTools }>
                                                                    <summary
                                                                        className="text-xs text-primary cursor-pointer hover:text-primary/80">
                                                                        View raw parameters
                                                                    </summary>
                                                                    <pre
                                                                        className="mt-2 text-xs bg-primary/10 p-2 rounded overflow-x-auto text-primary-foreground">
                                    { message.toolInput }
                                  </pre>
                                                                </details>
                                                            ) }
                                                        </div>
                                                    </details>
                                                );
                                            }
                                        } catch (e) {
                                            // Fall back to regular display
                                        }
                                    }

                                    // Special handling for Bash tool
                                    if (message.toolName === 'Bash') {
                                        try {
                                            const input = JSON.parse(message.toolInput);
                                            return (
                                                <details className="mt-2" open={ autoExpandTools }>
                                                    <summary
                                                        className="text-sm text-primary cursor-pointer hover:text-primary/80 flex items-center gap-2">
                                                        <svg className="w-4 h-4 details-chevron"
                                                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                                  strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                        </svg>
                                                        正在运行命令
                                                    </summary>
                                                    <div className="mt-3 space-y-2">
                                                        <div
                                                            className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-sm">
                                                            <div className="flex items-center gap-2 mb-2 text-gray-400">
                                                                <svg className="w-4 h-4" fill="none"
                                                                     stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round"
                                                                          strokeWidth={ 2 }
                                                                          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                                </svg>
                                                                <span className="text-xs">终端</span>
                                                            </div>
                                                            <div
                                                                className="whitespace-pre-wrap break-all text-green-400">
                                                                $ { input.command }
                                                            </div>
                                                        </div>
                                                        { input.description && (
                                                            <div
                                                                className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                                { input.description }
                                                            </div>
                                                        ) }
                                                        { showRawParameters && (
                                                            <details className="mt-2">
                                                                <summary
                                                                    className="text-xs text-primary cursor-pointer hover:text-primary/80">
                                                                    View raw parameters
                                                                </summary>
                                                                <pre
                                                                    className="mt-2 text-xs bg-primary/10 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-primary-foreground">
                                  { message.toolInput }
                                </pre>
                                                            </details>
                                                        ) }
                                                    </div>
                                                </details>
                                            );
                                        } catch (e) {
                                            // Fall back to regular display
                                        }
                                    }

                                    // Special handling for Read tool
                                    if (message.toolName === 'Read') {
                                        try {
                                            const input = JSON.parse(message.toolInput);
                                            if (input.file_path) {
                                                const filename = input.file_path.split('/').pop();

                                                return (
                                                    <div className="mt-2 text-sm text-primary">
                                                        Read{ ' ' }
                                                        <button
                                                            onClick={ () => onFileOpen && onFileOpen(input.file_path) }
                                                            className="text-primary hover:text-primary/80 underline font-mono"
                                                        >
                                                            { filename }
                                                        </button>
                                                    </div>
                                                );
                                            }
                                        } catch (e) {
                                            // Fall back to regular display
                                        }
                                    }

                                    // Special handling for exit_plan_mode tool
                                    if (message.toolName === 'exit_plan_mode') {
                                        try {
                                            const input = JSON.parse(message.toolInput);
                                            if (input.plan) {
                                                // Replace escaped newlines with actual newlines
                                                const planContent = input.plan.replace(/\\n/g, '\n');
                                                return (
                                                    <details className="mt-2" open={ autoExpandTools }>
                                                        <summary
                                                            className="text-sm text-primary cursor-pointer hover:text-primary/80 flex items-center gap-2">
                                                            <svg
                                                                className="w-4 h-4 transition-transform details-chevron"
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                      strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                            </svg>
                                                            📋 View implementation plan
                                                        </summary>
                                                        <div
                                                            className="mt-3 prose prose-sm max-w-none dark:prose-invert">
                                                            <ReactMarkdown>{ planContent }</ReactMarkdown>
                                                        </div>
                                                    </details>
                                                );
                                            }
                                        } catch (e) {
                                            // Fall back to regular display
                                        }
                                    }

                                    // Regular tool input display for other tools
                                    return (
                                        <details className="mt-2" open={ autoExpandTools }>
                                            <summary
                                                className="text-sm text-primary cursor-pointer hover:text-primary/80 flex items-center gap-2">
                                                <svg className="w-4 h-4 transition-transform details-chevron"
                                                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                          d="M19 9l-7 7-7-7"/>
                                                </svg>
                                                View input parameters
                                            </summary>
                                            <pre
                                                className="mt-2 text-xs bg-primary/10 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-primary-foreground">
                        { message.toolInput }
                      </pre>
                                        </details>
                                    );
                                })() }

                                {/* Tool Result Section */ }
                                { message.toolResult && (
                                    <div className="mt-3 border-t border-blue-200 dark:border-blue-700 pt-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={ `w-4 h-4 rounded flex items-center justify-center ${
                                                message.toolResult.isError
                                                    ? 'bg-red-500'
                                                    : 'bg-green-500'
                                            }` }>
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor"
                                                     viewBox="0 0 24 24">
                                                    { message.toolResult.isError ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              strokeWidth={ 2 } d="M6 18L18 6M6 6l12 12"/>
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              strokeWidth={ 2 }
                                                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                    ) }
                                                </svg>
                                            </div>
                                            <span className={ `text-sm font-medium ${
                                                message.toolResult.isError
                                                    ? 'text-red-700 dark:text-red-300'
                                                    : 'text-green-700 dark:text-green-300'
                                            }` }>
                        { message.toolResult.isError ? '工具错误' : '工具结果' }
                      </span>
                                        </div>

                                        <div className={ `text-sm ${
                                            message.toolResult.isError
                                                ? 'text-red-800 dark:text-red-200'
                                                : 'text-green-800 dark:text-green-200'
                                        }` }>
                                            { (() => {
                                                const content = String(message.toolResult.content || '');

                                                // Special handling for TodoWrite/TodoRead results
                                                if ((message.toolName === 'TodoWrite' || message.toolName === 'TodoRead') &&
                                                    (content.includes('Todos have been modified successfully') ||
                                                        content.includes('Todo list') ||
                                                        (content.startsWith('[') && content.includes('"content"') && content.includes('"status"')))) {
                                                    try {
                                                        // Try to parse if it looks like todo JSON data
                                                        let todos = null;
                                                        if (content.startsWith('[')) {
                                                            todos = JSON.parse(content);
                                                        } else if (content.includes('Todos have been modified successfully')) {
                                                            // For TodoWrite success messages, we don't have the data in the result
                                                            return (
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="font-medium">Todo list has been updated successfully</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        if (todos && Array.isArray(todos)) {
                                                            return (
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <span
                                                                            className="font-medium">Current Todo List</span>
                                                                    </div>
                                                                    <TodoList todos={ todos } isResult={ true }/>
                                                                </div>
                                                            );
                                                        }
                                                    } catch (e) {
                                                        // Fall through to regular handling
                                                    }
                                                }

                                                // Special handling for exit_plan_mode tool results
                                                if (message.toolName === 'exit_plan_mode') {
                                                    try {
                                                        // The content should be JSON with a "plan" field
                                                        const parsed = JSON.parse(content);
                                                        if (parsed.plan) {
                                                            // Replace escaped newlines with actual newlines
                                                            const planContent = parsed.plan.replace(/\\n/g, '\n');
                                                            return (
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <span className="font-medium">Implementation Plan</span>
                                                                    </div>
                                                                    <div
                                                                        className="prose prose-sm max-w-none dark:prose-invert">
                                                                        <ReactMarkdown>{ planContent }</ReactMarkdown>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    } catch (e) {
                                                        // Fall through to regular handling
                                                    }
                                                }

                                                // Special handling for interactive prompts
                                                if (content.includes('Do you want to proceed?') && message.toolName === 'Bash') {
                                                    const lines = content.split('\n');
                                                    const promptIndex = lines.findIndex(line => line.includes('Do you want to proceed?'));
                                                    const beforePrompt = lines.slice(0, promptIndex).join('\n');
                                                    const promptLines = lines.slice(promptIndex);

                                                    // Extract the question and options
                                                    const questionLine = promptLines.find(line => line.includes('Do you want to proceed?')) || '';
                                                    const options = [];

                                                    // Parse numbered options (1. Yes, 2. No, etc.)
                                                    promptLines.forEach(line => {
                                                        const optionMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
                                                        if (optionMatch) {
                                                            options.push({
                                                                number: optionMatch[1],
                                                                text: optionMatch[2].trim()
                                                            });
                                                        }
                                                    });

                                                    // Find which option was selected (usually indicated by "> 1" or similar)
                                                    const selectedMatch = content.match(/>\s*(\d+)/);
                                                    const selectedOption = selectedMatch ? selectedMatch[1] : null;

                                                    return (
                                                        <div className="space-y-3">
                                                            { beforePrompt && (
                                                                <div
                                                                    className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                                                                    <pre
                                                                        className="whitespace-pre-wrap break-words">{ beforePrompt }</pre>
                                                                </div>
                                                            ) }
                                                            <div
                                                                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <div
                                                                        className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                        <svg className="w-5 h-5 text-white" fill="none"
                                                                             stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round"
                                                                                  strokeLinejoin="round"
                                                                                  strokeWidth={ 2 }
                                                                                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                                        </svg>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-base mb-2">
                                                                            Interactive Prompt
                                                                        </h4>
                                                                        <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                                                                            { questionLine }
                                                                        </p>

                                                                        {/* Option buttons */ }
                                                                        <div className="space-y-2 mb-4">
                                                                            { options.map((option) => (
                                                                                <button
                                                                                    key={ option.number }
                                                                                    className={ `w-full text-left px-4 py-3 rounded-lg border-2 ${
                                                                                        selectedOption === option.number
                                                                                            ? 'bg-amber-600 dark:bg-amber-700 text-white border-amber-600 dark:border-amber-700 shadow-md'
                                                                                            : 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm'
                                                                                    } ${
                                                                                        selectedOption ? 'cursor-default' : 'cursor-not-allowed opacity-75'
                                                                                    }` }
                                                                                    disabled
                                                                                >
                                                                                    <div
                                                                                        className="flex items-center gap-3">
                                            <span
                                                className={ `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    selectedOption === option.number
                                                        ? 'bg-white/20'
                                                        : 'bg-amber-100 dark:bg-amber-800/50'
                                                }` }>
                                              { option.number }
                                            </span>
                                                                                        <span
                                                                                            className="text-sm sm:text-base font-medium flex-1">
                                              { option.text }
                                            </span>
                                                                                        { selectedOption === option.number && (
                                                                                            <svg
                                                                                                className="w-5 h-5 flex-shrink-0"
                                                                                                fill="currentColor"
                                                                                                viewBox="0 0 20 20">
                                                                                                <path fillRule="evenodd"
                                                                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                                                      clipRule="evenodd"/>
                                                                                            </svg>
                                                                                        ) }
                                                                                    </div>
                                                                                </button>
                                                                            )) }
                                                                        </div>

                                                                        { selectedOption && (
                                                                            <div
                                                                                className="bg-amber-100 dark:bg-amber-800/30 rounded-lg p-3">
                                                                                <p className="text-amber-900 dark:text-amber-100 text-sm font-medium mb-1">
                                                                                    ✓ Claude 选择了
                                                                                    选项 { selectedOption }
                                                                                </p>
                                                                                <p className="text-amber-800 dark:text-amber-200 text-xs">
                                                                                    In the CLI, you would select this
                                                                                    option interactively using arrow
                                                                                    keys or by typing the number.
                                                                                </p>
                                                                            </div>
                                                                        ) }
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const fileEditMatch = content.match(/The file (.+?) has been updated\./);
                                                if (fileEditMatch) {
                                                    return (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span
                                                                    className="font-medium">File updated successfully</span>
                                                            </div>
                                                            <button
                                                                onClick={ () => onFileOpen && onFileOpen(fileEditMatch[1]) }
                                                                className="text-xs font-mono bg-green-100 dark:bg-green-800/30 px-2 py-1 rounded text-primary hover:text-primary/80 underline cursor-pointer"
                                                            >
                                                                { fileEditMatch[1] }
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                // Handle Write tool output for file creation
                                                const fileCreateMatch = content.match(/(?:The file|File) (.+?) has been (?:created|written)(?: successfully)?\.?/);
                                                if (fileCreateMatch) {
                                                    return (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span
                                                                    className="font-medium">File created successfully</span>
                                                            </div>
                                                            <button
                                                                onClick={ () => onFileOpen && onFileOpen(fileCreateMatch[1]) }
                                                                className="text-xs font-mono bg-green-100 dark:bg-green-800/30 px-2 py-1 rounded text-primary hover:text-primary/80 underline cursor-pointer"
                                                            >
                                                                { fileCreateMatch[1] }
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                // Special handling for Write tool - hide content if it's just the file content
                                                if (message.toolName === 'Write' && !message.toolResult.isError) {
                                                    // For Write tool, the diff is already shown in the tool input section
                                                    // So we just show a success message here
                                                    return (
                                                        <div className="text-green-700 dark:text-green-300">
                                                            <div className="flex items-center gap-2">
                                                                <svg className="w-4 h-4" fill="none"
                                                                     stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round"
                                                                          strokeWidth={ 2 }
                                                                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                                </svg>
                                                                <span
                                                                    className="font-medium">File written successfully</span>
                                                            </div>
                                                            <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                                                                The file content is displayed in the diff view above
                                                            </p>
                                                        </div>
                                                    );
                                                }

                                                if (content.includes('cat -n') && content.includes('→')) {
                                                    return (
                                                        <details open={ autoExpandTools }>
                                                            <summary
                                                                className="text-sm text-green-700 dark:text-green-300 cursor-pointer hover:text-green-800 dark:hover:text-green-200 mb-2 flex items-center gap-2">
                                                                <svg
                                                                    className="w-4 h-4 transition-transform details-chevron"
                                                                    fill="none" stroke="currentColor"
                                                                    viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round"
                                                                          strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                                </svg>
                                                                View file content
                                                            </summary>
                                                            <div
                                                                className="mt-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                                                <div
                                                                    className="text-xs font-mono p-3 whitespace-pre-wrap break-words overflow-hidden">
                                                                    { content }
                                                                </div>
                                                            </div>
                                                        </details>
                                                    );
                                                }

                                                if (content.length > 300) {
                                                    return (
                                                        <details open={ autoExpandTools }>
                                                            <summary
                                                                className="text-sm text-green-700 dark:text-green-300 cursor-pointer hover:text-green-800 dark:hover:text-green-200 mb-2 flex items-center gap-2">
                                                                <svg
                                                                    className="w-4 h-4 transition-transform details-chevron"
                                                                    fill="none" stroke="currentColor"
                                                                    viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round"
                                                                          strokeWidth={ 2 } d="M19 9l-7 7-7-7"/>
                                                                </svg>
                                                                View full output ({ content.length } chars)
                                                            </summary>
                                                            <div
                                                                className="mt-2 prose prose-sm max-w-none prose-green dark:prose-invert">
                                                                <ReactMarkdown>{ content }</ReactMarkdown>
                                                            </div>
                                                        </details>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        className="prose prose-sm max-w-none prose-green dark:prose-invert">
                                                        <ReactMarkdown>{ content }</ReactMarkdown>
                                                    </div>
                                                );
                                            })() }
                                        </div>
                                    </div>
                                ) }
                            </div>
                        ) : message.isInteractivePrompt ? (
                            // Special handling for interactive prompts
                            <div
                                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor"
                                             viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-base mb-3">
                                            Interactive Prompt
                                        </h4>
                                        { (() => {
                                            const lines = message.content.split('\n').filter(line => line.trim());
                                            const questionLine = lines.find(line => line.includes('?')) || lines[0] || '';
                                            const options = [];

                                            // Parse the menu options
                                            lines.forEach(line => {
                                                // Match lines like "❯ 1. Yes" or "  2. No"
                                                const optionMatch = line.match(/[❯\s]*(\d+)\.\s+(.+)/);
                                                if (optionMatch) {
                                                    const isSelected = line.includes('❯');
                                                    options.push({
                                                        number: optionMatch[1],
                                                        text: optionMatch[2].trim(),
                                                        isSelected
                                                    });
                                                }
                                            });

                                            return (
                                                <>
                                                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                                                        { questionLine }
                                                    </p>

                                                    {/* Option buttons */ }
                                                    <div className="space-y-2 mb-4">
                                                        { options.map((option) => (
                                                            <button
                                                                key={ option.number }
                                                                className={ `w-full text-left px-4 py-3 rounded-lg border-2 ${
                                                                    option.isSelected
                                                                        ? 'bg-amber-600 dark:bg-amber-700 text-white border-amber-600 dark:border-amber-700 shadow-md'
                                                                        : 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700'
                                                                } cursor-not-allowed opacity-75` }
                                                                disabled
                                                            >
                                                                <div className="flex items-center gap-3">
                                  <span
                                      className={ `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                          option.isSelected
                                              ? 'bg-white/20'
                                              : 'bg-amber-100 dark:bg-amber-800/50'
                                      }` }>
                                    { option.number }
                                  </span>
                                                                    <span
                                                                        className="text-sm sm:text-base font-medium flex-1">
                                    { option.text }
                                  </span>
                                                                    { option.isSelected && (
                                                                        <span className="text-lg">❯</span>
                                                                    ) }
                                                                </div>
                                                            </button>
                                                        )) }
                                                    </div>

                                                    <div className="bg-amber-100 dark:bg-amber-800/30 rounded-lg p-3">
                                                        <p className="text-amber-900 dark:text-amber-100 text-sm font-medium mb-1">
                                                            ⏳ Waiting for your response in the CLI
                                                        </p>
                                                        <p className="text-amber-800 dark:text-amber-200 text-xs">
                                                            请在您运行 Claude 的终端中选择一个选项。
                                                        </p>
                                                    </div>
                                                </>
                                            );
                                        })() }
                                    </div>
                                </div>
                            </div>
                        ) : message.isToolUse && message.toolName === 'Read' ? (
                            // Simple Read tool indicator
                            (() => {
                                try {
                                    const input = JSON.parse(message.toolInput);
                                    if (input.file_path) {
                                        const filename = input.file_path.split('/').pop();
                                        return (
                                            <div
                                                className="bg-primary/5 border-l-2 border-primary/30 pl-3 py-1 mb-2 text-sm text-primary">
                                                📖 读取{ ' ' }
                                                <button
                                                    onClick={ () => onFileOpen && onFileOpen(input.file_path) }
                                                    className="text-primary hover:text-primary/80 underline font-mono"
                                                >
                                                    { filename }
                                                </button>
                                            </div>
                                        );
                                    }
                                } catch (e) {
                                    return (
                                        <div
                                            className="bg-primary/5 border-l-2 border-primary/30 pl-3 py-1 mb-2 text-sm text-primary">
                                            📖 读取文件
                                        </div>
                                    );
                                }
                            })()
                        ) : message.isToolUse && message.toolName === 'TodoWrite' ? (
                            // Simple TodoWrite tool indicator with tasks
                            (() => {
                                try {
                                    const input = JSON.parse(message.toolInput);
                                    if (input.todos && Array.isArray(input.todos)) {
                                        return (
                                            <div
                                                className="bg-primary/5 border-l-2 border-primary/30 pl-3 py-1 mb-2">
                                                <div className="text-sm text-primary mb-2">
                                                    📝 更新待办事项列表
                                                </div>
                                                <TodoList todos={ input.todos }/>
                                            </div>
                                        );
                                    }
                                } catch (e) {
                                    return (
                                        <div
                                            className="bg-primary/5 border-l-2 border-primary/30 pl-3 py-1 mb-2 text-sm text-primary">
                                            📝 更新待办事项列表
                                        </div>
                                    );
                                }
                            })()
                        ) : message.isToolUse && message.toolName === 'TodoRead' ? (
                            // Simple TodoRead tool indicator
                            <div
                                className="bg-primary/5 border-l-2 border-primary/30 pl-3 py-1 mb-2 text-sm text-primary">
                                📋 读取待办事项列表
                            </div>
                        ) : (
                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                { message.isUserInterrupted && (
                                    <div
                                        className="mb-2 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 rounded-lg p-3 flex items-start gap-2">
                                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0"
                                             viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <div className="text-sm leading-snug">
                                            <div className="font-medium">会话已被用户中断</div>
                                        </div>
                                    </div>
                                ) }
                                {/* Usage limit alert */ }
                                { message.isUsageLimit && (
                                    <div
                                        className="mb-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 flex items-start gap-2">
                                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0"
                                             viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd"
                                                  d="M8.257 3.099a1.5 1.5 0 012.486 0l6.518 11.59A1.5 1.5 0 0115.94 17H4.06a1.5 1.5 0 01-1.322-2.311l6.518-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V7a1 1 0 112 0v4a1 1 0 01-1 1z"
                                                  clipRule="evenodd"/>
                                        </svg>
                                        <div className="text-sm leading-snug">
                                            <div className="font-medium">已达到 Claude 使用限额</div>
                                            <div
                                                className="mt-0.5">将于 { new Date(message.usageLimitReset).toLocaleString() } 重置。
                                            </div>
                                        </div>
                                    </div>
                                ) }
                                { message.type === 'assistant' ? (
                                    <div
                                        className="prose prose-sm max-w-none dark:prose-invert prose-gray [&_code]:!bg-transparent [&_code]:!p-0 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-2 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:mb-1">
                                        <ReactMarkdown
                                            components={ {
                                                code: ({ node, inline, className, children, ...props }) => {
                                                    return inline ? (
                                                        <strong
                                                            className="text-primary font-semibold not-prose bg-primary/5 px-1 py-0.5 rounded" { ...props }>
                                                            { children }
                                                        </strong>
                                                    ) : (
                                                        <div
                                                            className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-hidden my-3 border border-gray-200 dark:border-gray-700">
                                                            <code
                                                                className="text-gray-800 dark:text-gray-200 text-sm font-mono block whitespace-pre-wrap break-words" { ...props }>
                                                                { children }
                                                            </code>
                                                        </div>
                                                    );
                                                },
                                                blockquote: ({ children }) => (
                                                    <blockquote
                                                        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
                                                        { children }
                                                    </blockquote>
                                                ),
                                                a: ({ href, children }) => (
                                                    <a href={ href }
                                                       className="text-primary hover:underline"
                                                       target="_blank" rel="noopener noreferrer">
                                                        { children }
                                                    </a>
                                                ),
                                                p: ({ children }) => (
                                                    <div className="mb-2 last:mb-0">
                                                        { children }
                                                    </div>
                                                )
                                            } }
                                        >
                                            { String(message.content || '') }
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">
                                        { message.content }
                                    </div>
                                ) }
                            </div>
                        ) }

                        <div
                            className={ `text-xs text-gray-500 dark:text-gray-400 mt-1 ${ isGrouped ? 'opacity-0 group-hover:opacity-100' : '' }` }>
                            { new Date(message.timestamp).toLocaleTimeString() }
                        </div>
                    </div>
                </div>
            ) }
        </div>
    );
});

// ImageAttachment component for displaying image previews
const ImageAttachment = ({ file, onRemove, uploadProgress, error }) => {
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div className="relative group">
            <img src={ preview } alt={ file.name } className="w-20 h-20 object-cover rounded"/>
            { uploadProgress !== undefined && uploadProgress < 100 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-xs">{ uploadProgress }%</div>
                </div>
            ) }
            { error && (
                <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </div>
            ) }
            <button
                onClick={ onRemove }
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    );
};

// ChatInterface: Main chat component with Session Protection System integration
//
// Session Protection System prevents automatic project updates from interrupting active conversations:
// - onSessionActive: Called when user sends message to mark session as protected
// - onSessionInactive: Called when conversation completes/aborts to re-enable updates
// - onReplaceTemporarySession: Called to replace temporary session ID with real WebSocket session ID
//
// This ensures uninterrupted chat experience by pausing sidebar refreshes during conversations.
function ChatInterface({
                           selectedProject,
                           selectedSession,
                           sendMessage,
                           messages,
                           onFileOpen,
                           onInputFocusChange,
                           onSessionActive,
                           onSessionInactive,
                           onReplaceTemporarySession,
                           onNavigateToSession,
                           onShowSettings,
                           autoExpandTools,
                           showRawParameters,
                           autoScrollToBottom,
                           sendByCtrlEnter,
                           chatBgEnabled
                       }) {
    const electron = useElectron();
    const [input, setInput] = useState(() => {
        if (typeof window !== 'undefined' && selectedProject) {
            return safeLocalStorage.getItem(`draft_input_${ selectedProject.name }`) || '';
        }
        return '';
    });
    const [chatMessages, setChatMessages] = useState(() => {
        if (typeof window !== 'undefined' && selectedProject) {
            const saved = safeLocalStorage.getItem(`chat_messages_${ selectedProject.name }`);
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(selectedSession?.id || null);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [sessionMessages, setSessionMessages] = useState([]);
    const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);
    const [isSystemSessionChange, setIsSystemSessionChange] = useState(false);
    const [permissionMode, setPermissionMode] = useState('default');
    const [skipPermissions, setSkipPermissions] = useState(false);
    const [attachedImages, setAttachedImages] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(new Map());
    const [imageErrors, setImageErrors] = useState(new Map());
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [, setDebouncedInput] = useState('');
    const [showFileDropdown, setShowFileDropdown] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState(-1);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [atSymbolPosition, setAtSymbolPosition] = useState(-1);
    const [canAbortSession, setCanAbortSession] = useState(false);
    const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
    const scrollPositionRef = useRef({ height: 0, top: 0 });
    const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
    const [visibleMessageCount, setVisibleMessageCount] = useState(100);
    const [claudeStatus, setClaudeStatus] = useState(null);
    const [chatBgImageUrl, setChatBgImageUrl] = useState(null);
    const [userAvatarUrl, setUserAvatarUrl] = useState(null);
    // chatBgEnabled is passed from parent; fallback to localStorage for safety
    const chatBgEnabledResolved = typeof chatBgEnabled === 'boolean'
        ? chatBgEnabled
        : (() => {
            try {
                const saved = localStorage.getItem('chatBgEnabled');
                return saved ? JSON.parse(saved) : false;
            } catch {
                return false;
            }
        })();
    // Sync permissionMode and skipPermissions from saved settings and global events
    useEffect(() => {
        const load = () => {
            try {
                const saved = safeLocalStorage.getItem('claude-tools-settings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    let mode = settings.permissionMode || 'default';
                    if (mode === 'auto-allow') mode = 'acceptEdits';
                    if (mode === 'skip-all') mode = 'bypassPermissions';
                    setPermissionMode(mode);
                    setSkipPermissions(!!settings.skipPermissions);
                    // Update chat background image URL from settings for reactive rendering
                    if (typeof settings.chatBgImage === 'string') {
                        setChatBgImageUrl(settings.chatBgImage || null);
                    }
                    // Update user avatar URL from settings
                    if (typeof settings.userAvatar === 'string') {
                        setUserAvatarUrl(settings.userAvatar || null);
                    }
                }
            } catch (e) {
                // ignore
            }
        };
        load();
        const onPerm = (e) => {
            let mode = e?.detail?.mode || 'default';
            if (mode === 'auto-allow') mode = 'acceptEdits';
            if (mode === 'skip-all') mode = 'bypassPermissions';
            setPermissionMode(mode);
        };
        const onTools = () => load();
        window.addEventListener('permissionModeChanged', onPerm);
        window.addEventListener('toolsSettingsChanged', onTools);
        return () => {
            window.removeEventListener('permissionModeChanged', onPerm);
            window.removeEventListener('toolsSettingsChanged', onTools);
        };
    }, []);


    // Memoized diff calculation to prevent recalculating on every render
    const createDiff = useMemo(() => {
        const cache = new Map();
        return (oldStr, newStr) => {
            const key = `${ oldStr.length }-${ newStr.length }-${ oldStr.slice(0, 50) }`;
            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = calculateDiff(oldStr, newStr);
            cache.set(key, result);
            if (cache.size > 100) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }
            return result;
        };
    }, []);

    // Load session messages from API
    const loadSessionMessages = useCallback(async (projectName, sessionId) => {
        if (!projectName || !sessionId) return [];

        setIsLoadingSessionMessages(true);
        try {
            const response = await api.sessionMessages(projectName, sessionId);
            if (!response.ok) {
                throw new Error('Failed to load session messages');
            }
            const data = await response.json();
            return data.messages || [];
        } catch (error) {
            console.error('Error loading session messages:', error);
            return [];
        } finally {
            setIsLoadingSessionMessages(false);
        }
    }, []);

    // Actual diff calculation function
    const calculateDiff = (oldStr, newStr) => {
        const oldLines = oldStr.split('\n');
        const newLines = newStr.split('\n');

        // Simple diff algorithm - find common lines and differences
        const diffLines = [];
        let oldIndex = 0;
        let newIndex = 0;

        while (oldIndex < oldLines.length || newIndex < newLines.length) {
            const oldLine = oldLines[oldIndex];
            const newLine = newLines[newIndex];

            if (oldIndex >= oldLines.length) {
                // Only new lines remaining
                diffLines.push({ type: 'added', content: newLine, lineNum: newIndex + 1 });
                newIndex++;
            } else if (newIndex >= newLines.length) {
                // Only old lines remaining
                diffLines.push({ type: 'removed', content: oldLine, lineNum: oldIndex + 1 });
                oldIndex++;
            } else if (oldLine === newLine) {
                // Lines are the same - skip in diff view (or show as context)
                oldIndex++;
                newIndex++;
            } else {
                // Lines are different
                diffLines.push({ type: 'removed', content: oldLine, lineNum: oldIndex + 1 });
                diffLines.push({ type: 'added', content: newLine, lineNum: newIndex + 1 });
                oldIndex++;
                newIndex++;
            }
        }

        return diffLines;
    };

    const convertSessionMessages = (rawMessages) => {
        const converted = [];
        const toolResults = new Map(); // Map tool_use_id to tool result

        // Helper to detect usage limit message and extract reset time
        const detectUsageLimit = (text) => {
            if (!text || typeof text !== 'string') return null;
            const marker = 'Claude AI usage limit reached|';
            if (text.includes(marker)) {
                const parts = text.split('|');
                if (parts.length >= 2) {
                    const ts = parseInt(parts[1], 10);
                    if (!Number.isNaN(ts)) {
                        return new Date(ts * 1000);
                    }
                }
            }
            return null;
        };

        // First pass: collect all tool results
        for (const msg of rawMessages) {
            if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
                for (const part of msg.message.content) {
                    if (part.type === 'tool_result') {
                        toolResults.set(part.tool_use_id, {
                            content: part.content,
                            isError: part.is_error,
                            timestamp: new Date(msg.timestamp || Date.now())
                        });
                    }
                }
            }
        }

        // Second pass: process messages and attach tool results to tool uses
        for (const msg of rawMessages) {
            // Handle user messages
            if (msg.message?.role === 'user' && msg.message?.content) {
                let content = '';
                let messageType = 'user';

                if (Array.isArray(msg.message.content)) {
                    // Handle array content, but skip tool results (they're attached to tool uses)
                    const textParts = [];

                    for (const part of msg.message.content) {
                        if (part.type === 'text') {
                            textParts.push(part.text);
                        }
                        // Skip tool_result parts - they're handled in the first pass
                    }

                    content = textParts.join('\n');
                } else if (typeof msg.message.content === 'string') {
                    content = msg.message.content;
                } else {
                    content = String(msg.message.content);
                }

                // Skip command messages and empty content
                if (content && !content.startsWith('<command-name>') && !content.startsWith('[Request interrupted')) {
                    converted.push({
                        type: messageType,
                        content: content,
                        timestamp: msg.timestamp || new Date().toISOString()
                    });
                }
            }

            // Handle assistant messages
            else if (msg.message?.role === 'assistant' && msg.message?.content) {
                if (Array.isArray(msg.message.content)) {
                    // Collect all text parts into a single message
                    const textParts = [];
                    let hasUsageLimit = false;
                    let usageLimitReset = null;
                    
                    for (const part of msg.message.content) {
                        if (part.type === 'text') {
                            const resetAt = detectUsageLimit(part.text);
                            if (resetAt) {
                                hasUsageLimit = true;
                                usageLimitReset = resetAt;
                            } else {
                                textParts.push(part.text);
                            }
                        } else if (part.type === 'tool_use') {
                            // Get the corresponding tool result
                            const toolResult = toolResults.get(part.id);

                            converted.push({
                                type: 'assistant',
                                content: '',
                                timestamp: msg.timestamp || new Date().toISOString(),
                                isToolUse: true,
                                toolName: part.name,
                                toolInput: JSON.stringify(part.input),
                                toolResult: toolResult ? (typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content)) : null,
                                toolError: toolResult?.isError || false,
                                toolResultTimestamp: toolResult?.timestamp || new Date()
                            });
                        }
                    }
                    
                    // Add combined text message if there are any text parts
                    if (textParts.length > 0) {
                        converted.push({
                            type: 'assistant',
                            content: textParts.join(''),
                            timestamp: msg.timestamp || new Date().toISOString()
                        });
                    }
                    
                    // Add usage limit message if detected
                    if (hasUsageLimit) {
                        converted.push({
                            type: 'assistant',
                            content: '',
                            timestamp: msg.timestamp || new Date().toISOString(),
                            isUsageLimit: true,
                            usageLimitReset: usageLimitReset
                        });
                    }
                } else if (typeof msg.message.content === 'string') {
                    const resetAt = detectUsageLimit(msg.message.content);
                    if (resetAt) {
                        converted.push({
                            type: 'assistant',
                            content: '',
                            timestamp: msg.timestamp || new Date().toISOString(),
                            isUsageLimit: true,
                            usageLimitReset: resetAt
                        });
                    } else {
                        converted.push({
                            type: 'assistant',
                            content: msg.message.content,
                            timestamp: msg.timestamp || new Date().toISOString()
                        });
                    }
                }
            }
        }

        return converted;
    };

    // Memoize expensive convertSessionMessages operation
    const convertedMessages = useMemo(() => {
        return convertSessionMessages(sessionMessages);
    }, [sessionMessages]);

    // Define scroll functions early to avoid hoisting issues in useEffect dependencies
    const scrollToBottom = useCallback(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            setIsUserScrolledUp(false);
        }
    }, []);

    // Check if user is near the bottom of the scroll container
    const isNearBottom = useCallback(() => {
        if (!scrollContainerRef.current) return false;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        // Consider "near bottom" if within 50px of the bottom
        return scrollHeight - scrollTop - clientHeight < 50;
    }, []);

    // Handle scroll events to detect when user manually scrolls up
    const handleScroll = useCallback(() => {
        if (scrollContainerRef.current) {
            const nearBottom = isNearBottom();
            setIsUserScrolledUp(!nearBottom);
        }
    }, [isNearBottom]);

    useEffect(() => {
        // Load session messages when session changes
        const loadMessages = async () => {
            if (selectedSession && selectedProject) {
                setCurrentSessionId(selectedSession.id);

                // Only load messages from API if this is a user-initiated session change
                // For system-initiated changes, preserve existing messages and rely on WebSocket
                if (!isSystemSessionChange) {
                    const messages = await loadSessionMessages(selectedProject.name, selectedSession.id);
                    setSessionMessages(messages);
                    // convertedMessages will be automatically updated via useMemo
                    // Scroll to bottom after loading session messages if auto-scroll is enabled
                    if (autoScrollToBottom) {
                        setTimeout(() => scrollToBottom(), 200);
                    }
                } else {
                    // Reset the flag after handling system session change
                    setIsSystemSessionChange(false);
                }
            } else {
                // Don't clear user-typed messages if a new session is being created or we're in-flight
                const hasPending = !!sessionStorage.getItem('pendingSessionId');
                if (!isLoading && !hasPending) {
                    setChatMessages([]);
                }
                setSessionMessages([]);
                setCurrentSessionId(null);
            }
        };

        loadMessages();
    }, [selectedSession, selectedProject, loadSessionMessages, scrollToBottom, isSystemSessionChange]);

    // Update chatMessages when convertedMessages changes, but don't swallow locally added user messages.
    // Strategy: merge by timestamp/id; keep any local messages not present in converted list.
    useEffect(() => {
        if (sessionMessages.length === 0) return;

        setChatMessages(prev => {
            // If prev is empty, just take converted
            if (!prev || prev.length === 0) return convertedMessages;

            // Build a simple hash of converted messages by a stable key
            const keyFor = (m, idx) => {
                // Prefer explicit id if present (we'll add for local user msgs)
                if (m._localId) return `local:${ m._localId }`;
                // Use combo of type+content+approx timestamp bucket to reduce duplicates
                const bucket = m.timestamp ? new Date(m.timestamp).getTime() : idx;
                return `${ m.type }|${ m.isToolUse ? 'tool' : '' }|${ (m.content || '').slice(0, 50) }|${ bucket }`;
            };

            const convertedMap = new Map();
            convertedMessages.forEach((m, i) => convertedMap.set(keyFor(m, i), true));

            // Keep local messages that aren't in converted (e.g., optimistic user message just sent)
            const extras = prev.filter((m, i) => !convertedMap.has(keyFor(m, i)));

            // Merge while preserving order: put converted first (server truth), then extras sorted by timestamp
            const merged = [...convertedMessages, ...extras].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return merged;
        });
    }, [convertedMessages, sessionMessages]);

    // Notify parent when input focus changes
    useEffect(() => {
        if (onInputFocusChange) {
            onInputFocusChange(isInputFocused);
        }
    }, [isInputFocused, onInputFocusChange]);

    // Persist input draft to localStorage
    useEffect(() => {
        if (selectedProject && input !== '') {
            safeLocalStorage.setItem(`draft_input_${ selectedProject.name }`, input);
        } else if (selectedProject && input === '') {
            safeLocalStorage.removeItem(`draft_input_${ selectedProject.name }`);
        }
    }, [input, selectedProject]);

    // Persist chat messages to localStorage
    useEffect(() => {
        if (selectedProject && chatMessages.length > 0) {
            safeLocalStorage.setItem(`chat_messages_${ selectedProject.name }`, JSON.stringify(chatMessages));
        }
    }, [chatMessages, selectedProject]);

    // Load saved state when project changes (but don't interfere with session loading)
    useEffect(() => {
        if (selectedProject) {
            // Always load saved input draft for the project
            const savedInput = safeLocalStorage.getItem(`draft_input_${ selectedProject.name }`) || '';
            if (savedInput !== input) {
                setInput(savedInput);
            }
        }
    }, [selectedProject?.name]);


    useEffect(() => {
        // Handle WebSocket messages
        if (messages.length > 0) {
            const latestMessage = messages[messages.length - 1];

            switch (latestMessage.type) {
                case 'session-created':
                    // New session created by Claude CLI - we receive the real session ID here
                    // Store it temporarily until conversation completes (prevents premature session association)
                    if (latestMessage.sessionId && !currentSessionId) {
                        sessionStorage.setItem('pendingSessionId', latestMessage.sessionId);

                        // Session Protection: Replace temporary "new-session-*" identifier with real session ID
                        // This maintains protection continuity - no gap between temp ID and real ID
                        // The temporary session is removed and real session is marked as active
                        if (onReplaceTemporarySession) {
                            onReplaceTemporarySession(latestMessage.sessionId);
                        }
                    }
                    break;

                case 'claude-response':
                    const messageData = latestMessage.data.message || latestMessage.data;

                    // Handle Claude CLI session duplication bug workaround:
                    // When resuming a session, Claude CLI creates a new session instead of resuming.
                    // We detect this by checking for system/init messages with session_id that differs
                    // from our current session. When found, we need to switch the user to the new session.
                    if (latestMessage.data.type === 'system' &&
                        latestMessage.data.subtype === 'init' &&
                        latestMessage.data.session_id &&
                        currentSessionId &&
                        latestMessage.data.session_id !== currentSessionId) {

                        console.log('🔄 Claude CLI session duplication detected:', {
                            originalSession: currentSessionId,
                            newSession: latestMessage.data.session_id
                        });

                        // Mark this as a system-initiated session change to preserve messages
                        setIsSystemSessionChange(true);

                        // Switch to the new session using React Router navigation
                        // This triggers the session loading logic in App.jsx without a page reload
                        if (onNavigateToSession) {
                            onNavigateToSession(latestMessage.data.session_id);
                        }
                        return; // Don't process the message further, let the navigation handle it
                    }

                    // Handle system/init for new sessions (when currentSessionId is null)
                    if (latestMessage.data.type === 'system' &&
                        latestMessage.data.subtype === 'init' &&
                        latestMessage.data.session_id &&
                        !currentSessionId) {

                        console.log('🔄 New session init detected:', {
                            newSession: latestMessage.data.session_id
                        });

                        // Mark this as a system-initiated session change to preserve messages
                        setIsSystemSessionChange(true);

                        // Switch to the new session
                        if (onNavigateToSession) {
                            onNavigateToSession(latestMessage.data.session_id);
                        }
                        return; // Don't process the message further, let the navigation handle it
                    }

                    // For system/init messages that match current session, just ignore them
                    if (latestMessage.data.type === 'system' &&
                        latestMessage.data.subtype === 'init' &&
                        latestMessage.data.session_id &&
                        currentSessionId &&
                        latestMessage.data.session_id === currentSessionId) {
                        console.log('🔄 System init message for current session, ignoring');
                        return; // Don't process the message further
                    }

                    // Handle different types of content in the response
                    if (Array.isArray(messageData.content)) {
                        // Collect all text parts into a single message
                        const textParts = [];
                        let hasUsageLimit = false;
                        let usageLimitReset = null;
                        let isUserInterrupted = false;
                        
                        for (const part of messageData.content) {
                            if (part.type === 'tool_use') {
                                // Add tool use message
                                const toolInput = part.input ? JSON.stringify(part.input, null, 2) : '';
                                setChatMessages(prev => [...prev, {
                                    type: 'assistant',
                                    content: '',
                                    timestamp: new Date(),
                                    isToolUse: true,
                                    toolName: part.name,
                                    toolInput: toolInput,
                                    toolId: part.id,
                                    toolResult: null // Will be updated when result comes in
                                }]);
                            } else if (part.type === 'text' && part.text?.trim()) {
                                // Detect usage limit and show red triangle alert with parsed time
                                const marker = 'Claude AI usage limit reached|';
                                if (part.text.includes(marker)) {
                                    const pieces = part.text.split('|');
                                    if (pieces.length >= 2) {
                                        const ts = parseInt(pieces[1], 10);
                                        if (!Number.isNaN(ts)) {
                                            hasUsageLimit = true;
                                            usageLimitReset = new Date(ts * 1000);
                                            
                                            // Immediately stop processing when usage limit is reached
                                            setIsLoading(false);
                                            setCanAbortSession(false);
                                            setClaudeStatus(null);
                                            
                                            // Mark session as inactive to re-enable project updates
                                            const activeSessionId = currentSessionId || sessionStorage.getItem('pendingSessionId');
                                            if (activeSessionId && onSessionInactive) {
                                                onSessionInactive(activeSessionId);
                                            }
                                            continue;
                                        }
                                    }
                                }

                                // Detect user-interrupted session message
                                if (part.text.trim() === 'Session interrupted by user.') {
                                    isUserInterrupted = true;
                                    continue;
                                }

                                // Collect text parts
                                textParts.push(part.text);
                            }
                        }
                        
                        // Add combined text message if there are any text parts
                        if (textParts.length > 0) {
                            setChatMessages(prev => [...prev, {
                                type: 'assistant',
                                content: textParts.join(''),
                                timestamp: new Date()
                            }]);
                        }
                        
                        // Add usage limit message if detected
                        if (hasUsageLimit) {
                            setChatMessages(prev => {
                                const hasUsageLimitMessage = prev.some(msg => msg.isUsageLimit);
                                if (hasUsageLimitMessage) {
                                    return prev; // Don't add duplicate usage limit message
                                }
                                return [...prev, {
                                    type: 'assistant',
                                    content: '',
                                    timestamp: new Date(),
                                    isUsageLimit: true,
                                    usageLimitReset: usageLimitReset
                                }];
                            });
                        }
                        
                        // Add user interrupted message if detected
                        if (isUserInterrupted) {
                            setChatMessages(prev => [...prev, {
                                type: 'assistant',
                                content: '',
                                timestamp: new Date(),
                                isUserInterrupted: true
                            }]);
                        }
                    } else if (typeof messageData.content === 'string' && messageData.content.trim()) {
                        // Detect usage limit and show red triangle alert with parsed time
                        const marker = 'Claude AI usage limit reached|';
                        if (messageData.content.includes(marker)) {
                            const pieces = messageData.content.split('|');
                            if (pieces.length >= 2) {
                                const ts = parseInt(pieces[1], 10);
                                if (!Number.isNaN(ts)) {
                                    const resetAt = new Date(ts * 1000);
                                    // Check if we already have a usage limit message to prevent duplicates
                                    setChatMessages(prev => {
                                        const hasUsageLimitMessage = prev.some(msg => msg.isUsageLimit);
                                        if (hasUsageLimitMessage) {
                                            return prev; // Don't add duplicate usage limit message
                                        }
                                        return [...prev, {
                                            type: 'assistant',
                                            content: '',
                                            timestamp: new Date(),
                                            isUsageLimit: true,
                                            usageLimitReset: resetAt
                                        }];
                                    });
                                    
                                    // Immediately stop processing when usage limit is reached
                                    setIsLoading(false);
                                    setCanAbortSession(false);
                                    setClaudeStatus(null);
                                    
                                    // Mark session as inactive to re-enable project updates
                                    const activeSessionId = currentSessionId || sessionStorage.getItem('pendingSessionId');
                                    if (activeSessionId && onSessionInactive) {
                                        onSessionInactive(activeSessionId);
                                    }
                                    break;
                                }
                            }
                        }

                        // Detect user-interrupted session message
                        if (messageData.content.trim() === 'Session interrupted by user.') {
                            setChatMessages(prev => [...prev, {
                                type: 'assistant',
                                content: '',
                                timestamp: new Date(),
                                isUserInterrupted: true
                            }]);
                            break;
                        }

                        // Fallback to regular text message
                        setChatMessages(prev => [...prev, {
                            type: 'assistant',
                            content: messageData.content,
                            timestamp: new Date()
                        }]);
                    }

                    // Handle tool results from user messages (these come separately)
                    if (messageData.role === 'user' && Array.isArray(messageData.content)) {
                        for (const part of messageData.content) {
                            if (part.type === 'tool_result') {
                                // Find the corresponding tool use and update it with the result
                                setChatMessages(prev => prev.map(msg => {
                                    if (msg.isToolUse && msg.toolId === part.tool_use_id) {
                                        return {
                                            ...msg,
                                            toolResult: {
                                                content: part.content,
                                                isError: part.is_error,
                                                timestamp: new Date()
                                            }
                                        };
                                    }
                                    return msg;
                                }));
                            }
                        }
                    }
                    break;

                case 'claude-output':
                    setChatMessages(prev => [...prev, {
                        type: 'assistant',
                        content: latestMessage.data,
                        timestamp: new Date()
                    }]);
                    break;
                case 'claude-interactive-prompt':
                    // Handle interactive prompts from CLI
                    setChatMessages(prev => [...prev, {
                        type: 'assistant',
                        content: latestMessage.data,
                        timestamp: new Date(),
                        isInteractivePrompt: true
                    }]);
                    break;

                case 'claude-error':
                    setChatMessages(prev => [...prev, {
                        type: 'error',
                        content: `Error: ${ latestMessage.error }`,
                        timestamp: new Date()
                    }]);
                    
                    // Stop processing on error
                    setIsLoading(false);
                    setCanAbortSession(false);
                    setClaudeStatus(null);
                    
                    // Mark session as inactive to re-enable project updates
                    const errorActiveSessionId = currentSessionId || sessionStorage.getItem('pendingSessionId');
                    if (errorActiveSessionId && onSessionInactive) {
                        onSessionInactive(errorActiveSessionId);
                    }
                    break;

                case 'claude-complete':
                    setIsLoading(false);
                    setCanAbortSession(false);
                    setClaudeStatus(null);


                    // Session Protection: Mark session as inactive to re-enable automatic project updates
                    // Conversation is complete, safe to allow project updates again
                    // Use real session ID if available, otherwise use pending session ID
                    const activeSessionId = currentSessionId || sessionStorage.getItem('pendingSessionId');
                    if (activeSessionId && onSessionInactive) {
                        onSessionInactive(activeSessionId);
                    }

                    // If we have a pending session ID and the conversation completed successfully, use it
                    const pendingSessionId = sessionStorage.getItem('pendingSessionId');
                    if (pendingSessionId && !currentSessionId && latestMessage.exitCode === 0) {
                        setCurrentSessionId(pendingSessionId);
                        sessionStorage.removeItem('pendingSessionId');
                    }

                    // Clear persisted chat messages after successful completion
                    if (selectedProject && latestMessage.exitCode === 0) {
                        safeLocalStorage.removeItem(`chat_messages_${ selectedProject.name }`);
                    }
                    break;

                case 'session-aborted':
                    setIsLoading(false);
                    setCanAbortSession(false);
                    setClaudeStatus(null);

                    // Session Protection: Mark session as inactive when aborted
                    // User or system aborted the conversation, re-enable project updates
                    if (currentSessionId && onSessionInactive) {
                        onSessionInactive(currentSessionId);
                    }

                    setChatMessages(prev => [...prev, {
                        type: 'assistant',
                        content: '',
                        timestamp: new Date(),
                        isUserInterrupted: true
                    }]);
                    break;

                case 'claude-status':
                    // Handle Claude working status messages
                    console.log('🔔 Received claude-status message:', latestMessage);
                    const statusData = latestMessage.data;
                    if (statusData) {
                        // Parse the status message to extract relevant information
                        let statusInfo = {
                            text: 'Working...',
                            tokens: 0,
                            can_interrupt: true
                        };

                        // Check for different status message formats
                        if (statusData.message) {
                            statusInfo.text = statusData.message;
                        } else if (statusData.status) {
                            statusInfo.text = statusData.status;
                        } else if (typeof statusData === 'string') {
                            statusInfo.text = statusData;
                        }

                        // Extract token count
                        if (statusData.tokens) {
                            statusInfo.tokens = statusData.tokens;
                        } else if (statusData.token_count) {
                            statusInfo.tokens = statusData.token_count;
                        }

                        // Check if can interrupt
                        if (statusData.can_interrupt !== undefined) {
                            statusInfo.can_interrupt = statusData.can_interrupt;
                        }

                        console.log('📊 Setting claude status:', statusInfo);
                        setClaudeStatus(statusInfo);
                        setIsLoading(true);
                        setCanAbortSession(statusInfo.can_interrupt);
                    }
                    break;

            }
        }
    }, [messages]);

    // Load file list when project changes
    useEffect(() => {
        if (selectedProject) {
            fetchProjectFiles();
        }
    }, [selectedProject]);

    const fetchProjectFiles = async () => {
        try {
            const response = await api.getFiles(selectedProject.name);
            if (response.ok) {
                const files = await response.json();
                // Flatten the file tree to get all file paths
                const flatFiles = flattenFileTree(files);
                setFileList(flatFiles);
            }
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    };

    const flattenFileTree = (files, basePath = '') => {
        let result = [];
        for (const file of files) {
            const fullPath = basePath ? `${ basePath }/${ file.name }` : file.name;
            if (file.type === 'directory' && file.children) {
                result = result.concat(flattenFileTree(file.children, fullPath));
            } else if (file.type === 'file') {
                result.push({
                    name: file.name,
                    path: fullPath,
                    relativePath: file.path
                });
            }
        }
        return result;
    };

    // Handle @ symbol detection and file filtering
    useEffect(() => {
        const textBeforeCursor = input.slice(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
            // Check if there's a space after the @ symbol (which would end the file reference)
            if (!textAfterAt.includes(' ')) {
                setAtSymbolPosition(lastAtIndex);
                setShowFileDropdown(true);

                // Filter files based on the text after @
                const filtered = fileList.filter(file =>
                    file.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
                    file.path.toLowerCase().includes(textAfterAt.toLowerCase())
                ).slice(0, 10); // Limit to 10 results

                setFilteredFiles(filtered);
                setSelectedFileIndex(-1);
            } else {
                setShowFileDropdown(false);
                setAtSymbolPosition(-1);
            }
        } else {
            setShowFileDropdown(false);
            setAtSymbolPosition(-1);
        }
    }, [input, cursorPosition, fileList]);

    // Debounced input handling
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedInput(input);
        }, 150); // 150ms debounce

        return () => clearTimeout(timer);
    }, [input]);

    // Show only recent messages for better performance
    const visibleMessages = useMemo(() => {
        if (chatMessages.length <= visibleMessageCount) {
            return chatMessages;
        }
        return chatMessages.slice(-visibleMessageCount);
    }, [chatMessages, visibleMessageCount]);

    // Capture scroll position before render when auto-scroll is disabled
    useEffect(() => {
        if (!autoScrollToBottom && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            scrollPositionRef.current = {
                height: container.scrollHeight,
                top: container.scrollTop
            };
        }
    });

    useEffect(() => {
        // Auto-scroll to bottom when new messages arrive
        if (scrollContainerRef.current && chatMessages.length > 0) {
            if (autoScrollToBottom) {
                // If auto-scroll is enabled, always scroll to bottom unless user has manually scrolled up
                if (!isUserScrolledUp) {
                    setTimeout(() => scrollToBottom(), 50); // Small delay to ensure DOM is updated
                }
            } else {
                // When auto-scroll is disabled, preserve the visual position
                const container = scrollContainerRef.current;
                const prevHeight = scrollPositionRef.current.height;
                const prevTop = scrollPositionRef.current.top;
                const newHeight = container.scrollHeight;
                const heightDiff = newHeight - prevHeight;

                // If content was added above the current view, adjust scroll position
                if (heightDiff > 0 && prevTop > 0) {
                    container.scrollTop = prevTop + heightDiff;
                }
            }
        }
    }, [chatMessages.length, isUserScrolledUp, scrollToBottom, autoScrollToBottom]);

    // Scroll to bottom when component mounts with existing messages or when messages first load
    useEffect(() => {
        if (scrollContainerRef.current && chatMessages.length > 0) {
            // Always scroll to bottom when messages first load (user expects to see latest)
            // Also reset scroll state
            setIsUserScrolledUp(false);
            setTimeout(() => scrollToBottom(), 200); // Longer delay to ensure full rendering
        }
    }, [chatMessages.length > 0, scrollToBottom]); // Trigger when messages first appear

    // Add scroll event listener to detect user scrolling
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
            return () => scrollContainer.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // Initial textarea setup
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';

            // Check if initially expanded
            const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight);
            const isExpanded = textareaRef.current.scrollHeight > lineHeight * 2;
            setIsTextareaExpanded(isExpanded);
        }
    }, []); // Only run once on mount

    // Reset textarea height when input is cleared programmatically
    useEffect(() => {
        if (textareaRef.current && !input.trim()) {
            textareaRef.current.style.height = 'auto';
            setIsTextareaExpanded(false);
        }
    }, [input]);

    // Global ESC key listener for interrupting Claude tasks
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                // Check if we're in a modal or settings view that should be closed first
                // If there are overlays/modals, don't interrupt Claude - let them handle the ESC
                const modals = document.querySelectorAll('[role="dialog"], .modal, .settings-panel, .drawer');
                const visibleModals = Array.from(modals).filter(modal => {
                    const style = window.getComputedStyle(modal);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                });
                
                if (visibleModals.length > 0) {
                    // Let modals handle their own ESC key
                    return;
                }
                
                // If we're in the chat area and Claude is processing, interrupt it
                if (canAbortSession && currentSessionId) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAbortSession();
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, [canAbortSession, currentSessionId]);

    const handleTranscript = useCallback((text) => {
        if (text.trim()) {
            setInput(prevInput => {
                const newInput = prevInput.trim() ? `${ prevInput } ${ text }` : text;

                // Update textarea height after setting new content
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';

                        // Check if expanded after transcript
                        const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight);
                        const isExpanded = textareaRef.current.scrollHeight > lineHeight * 2;
                        setIsTextareaExpanded(isExpanded);
                    }
                }, 0);

                return newInput;
            });
        }
    }, []);

    // Load earlier messages by increasing the visible message count
    const loadEarlierMessages = useCallback(() => {
        setVisibleMessageCount(prevCount => prevCount + 100);
    }, []);

    // Handle image files from drag & drop or file picker
    const handleImageFiles = useCallback((files) => {
        const validFiles = files.filter(file => {
            try {
                // Validate file object and properties
                if (!file || typeof file !== 'object') {
                    console.warn('Invalid file object:', file);
                    return false;
                }

                if (!file.type || !file.type.startsWith('image/')) {
                    return false;
                }

                if (!file.size || file.size > 5 * 1024 * 1024) {
                    // Safely get file name with fallback
                    const fileName = file.name || 'Unknown file';
                    setImageErrors(prev => {
                        const newMap = new Map(prev);
                        newMap.set(fileName, 'File too large (max 5MB)');
                        return newMap;
                    });
                    return false;
                }

                return true;
            } catch (error) {
                console.error('Error validating file:', error, file);
                return false;
            }
        });

        if (validFiles.length > 0) {
            setAttachedImages(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 images
        }
    }, []);

    // Handle clipboard paste for images
    const handlePaste = useCallback(async (e) => {
        const items = Array.from(e.clipboardData.items);

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    handleImageFiles([file]);
                }
            }
        }

        // Fallback for some browsers/platforms
        if (items.length === 0 && e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (imageFiles.length > 0) {
                handleImageFiles(imageFiles);
            }
        }
    }, [handleImageFiles]);

    // Setup dropzone
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
        },
        maxSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        onDrop: handleImageFiles,
        noClick: true, // We'll use our own button
        noKeyboard: true
    });

    const handleMemoryCommand = async (command) => {
        const parts = command.split(' ');
        const subcommand = parts[1];
        
        try {
            if (subcommand === 'show' || subcommand === 'view' || !subcommand) {
                // Show current project memory
                const scope = parts[2];
                if (scope === 'global' || scope === '--global') {
                    const response = await api.getGlobalMemory();
                    const data = await response.json();
                    
                    const memoryMessage = {
                        type: 'system',
                        content: data.content ? `**Global Memory (CLAUDE.md):**\n\n\`\`\`markdown\n${data.content}\n\`\`\`` : '**Global Memory (CLAUDE.md):** Empty',
                        timestamp: new Date(),
                        _localId: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                    };
                    setChatMessages(prev => [...prev, memoryMessage]);
                } else {
                    const response = await api.getProjectMemory(selectedProject.name);
                    const data = await response.json();
                    
                    const memoryMessage = {
                        type: 'system',
                        content: data.content ? `**Project Memory (CLAUDE.md):**\n\n\`\`\`markdown\n${data.content}\n\`\`\`` : '**Project Memory (CLAUDE.md):** Empty',
                        timestamp: new Date(),
                        _localId: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                    };
                    setChatMessages(prev => [...prev, memoryMessage]);
                }
            } else if (subcommand === 'edit') {
                // Open memory editor
                const scope = parts[2];
                const isGlobal = scope === 'global' || scope === '--global';
                
                // Add message showing memory editor is opening
                const editorMessage = {
                    type: 'system',
                    content: `Opening ${isGlobal ? 'global' : 'project'} memory editor...`,
                    timestamp: new Date(),
                    _localId: `mem-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                };
                setChatMessages(prev => [...prev, editorMessage]);
                
                // Here we would open the memory editor modal/interface
                // For now, just show instructions
                setTimeout(() => {
                    const instructionMessage = {
                        type: 'system',
                        content: `**Memory Editor:** Use the project file browser to edit ${isGlobal ? '~/.claude/CLAUDE.md' : 'CLAUDE.md in your project directory'}.`,
                        timestamp: new Date(),
                        _localId: `mem-inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                    };
                    setChatMessages(prev => [...prev, instructionMessage]);
                }, 100);
            } else {
                // Unknown subcommand
                const helpMessage = {
                    type: 'system',
                    content: `**Memory Command Help:**
- \`/memory\` or \`/memory show\` - Show project memory
- \`/memory show global\` - Show global memory  
- \`/memory edit\` - Edit project memory
- \`/memory edit global\` - Edit global memory`,
                    timestamp: new Date(),
                    _localId: `mem-help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                };
                setChatMessages(prev => [...prev, helpMessage]);
            }
        } catch (error) {
            console.error('Memory command error:', error);
            const errorMessage = {
                type: 'error',
                content: `Memory command failed: ${error.message}`,
                timestamp: new Date(),
                _localId: `mem-err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            };
            setChatMessages(prev => [...prev, errorMessage]);
        }
        
        // Clear input after processing memory command
        setInput('');
        setAttachedImages([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !selectedProject) return;

        // Handle memory commands before processing
        const trimmedInput = input.trim();
        if (trimmedInput.startsWith('/memory')) {
            await handleMemoryCommand(trimmedInput);
            return;
        }

        // Upload images first if any
        let uploadedImages = [];
        if (attachedImages.length > 0) {
            const formData = new FormData();
            attachedImages.forEach(file => {
                formData.append('images', file);
            });

            try {
                const response = await api.uploadImages(selectedProject.name, formData);

                if (!response.ok) {
                    let errorMessage = 'Failed to upload images';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        // If JSON parsing fails, use status text
                        errorMessage = response.statusText || errorMessage;
                    }
                    throw new Error(errorMessage);
                }

                const result = await response.json();
                uploadedImages = result.images;
            } catch (error) {
                console.error('Image upload failed:', error);
                setChatMessages(prev => [...prev, {
                    type: 'error',
                    content: `Failed to upload images: ${ error.message }`,
                    timestamp: new Date()
                }]);
                return;
            }
        }

        const userMessage = {
            type: 'user',
            content: input,
            images: uploadedImages,
            timestamp: new Date(),
            _localId: `u-${ Date.now() }-${ Math.random().toString(36).slice(2, 8) }`
        };

        setChatMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setCanAbortSession(true);
        // Set a default status when starting
        setClaudeStatus({
            text: 'Processing',
            tokens: 0,
            can_interrupt: true
        });

        // Always scroll to bottom when user sends a message and reset scroll state
        setIsUserScrolledUp(false); // Reset scroll state so auto-scroll works for Claude's response
        setTimeout(() => scrollToBottom(), 100); // Longer delay to ensure message is rendered

        // Session Protection: Mark session as active to prevent automatic project updates during conversation
        // This is crucial for maintaining chat state integrity. We handle two cases:
        // 1. Existing sessions: Use the real currentSessionId
        // 2. New sessions: Generate temporary identifier "new-session-{timestamp}" since real ID comes via WebSocket later
        // This ensures no gap in protection between message send and session creation
        const sessionToActivate = currentSessionId || `new-session-${ Date.now() }`;
        if (onSessionActive) {
            onSessionActive(sessionToActivate);
        }

        // Get tools settings from localStorage
        const getToolsSettings = () => {
            try {
                const savedSettings = safeLocalStorage.getItem('claude-tools-settings');
                if (savedSettings) {
                    return JSON.parse(savedSettings);
                }
            } catch (error) {
                console.error('Error loading tools settings:', error);
            }
            return {
                allowedTools: [],
                disallowedTools: [],
                skipPermissions: false
            };
        };

        const toolsSettings = getToolsSettings();
        // Keep local skipPermissions state in sync
        setSkipPermissions(!!toolsSettings.skipPermissions);

        // Send command to Claude CLI via WebSocket with images
        sendMessage({
            type: 'claude-command',
            command: input,
            options: {
                projectPath: selectedProject.path,
                cwd: selectedProject.fullPath,
                sessionId: currentSessionId,
                resume: !!currentSessionId,
                toolsSettings: toolsSettings,
                // When --dangerously-skip-permissions is enabled, backend should ignore permissionMode
                permissionMode: permissionMode,
                images: uploadedImages // Pass images to backend
            }
        });

        setInput('');
        setAttachedImages([]);
        setUploadingImages(new Map());
        setImageErrors(new Map());
        setIsTextareaExpanded(false);

        // Reset textarea height


        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Clear the saved draft since message was sent
        if (selectedProject) {
            safeLocalStorage.removeItem(`draft_input_${ selectedProject.name }`);
        }
    };

    const handleKeyDown = (e) => {
        // Handle file dropdown navigation
        if (showFileDropdown && filteredFiles.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedFileIndex(prev =>
                    prev < filteredFiles.length - 1 ? prev + 1 : 0
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedFileIndex(prev =>
                    prev > 0 ? prev - 1 : filteredFiles.length - 1
                );
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (selectedFileIndex >= 0) {
                    selectFile(filteredFiles[selectedFileIndex]);
                } else if (filteredFiles.length > 0) {
                    selectFile(filteredFiles[0]);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowFileDropdown(false);
                return;
            }
        }

        // Handle Tab key for mode switching (only when file dropdown is not showing)
        if (e.key === 'Tab' && !showFileDropdown) {
            e.preventDefault();
            if (skipPermissions) return; // Do not switch when dangerous skip is enabled
            const modes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
            const currentIndex = modes.indexOf(permissionMode);
            const nextIndex = (currentIndex + 1) % modes.length;
            setPermissionMode(modes[nextIndex]);
            return;
        }

        // Handle Enter key: Ctrl+Enter (Cmd+Enter on Mac) sends, Shift+Enter creates new line
        if (e.key === 'Enter') {
            // If we're in composition, don't send message
            if (e.nativeEvent.isComposing) {
                return; // Let IME handle the Enter key
            }

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                // Ctrl+Enter or Cmd+Enter: Send message
                e.preventDefault();
                handleSubmit(e);
            } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                // Plain Enter: Send message only if not in IME composition
                if (!sendByCtrlEnter) {
                    e.preventDefault();
                    handleSubmit(e);
                }
            }
            // Shift+Enter: Allow default behavior (new line)
        }
    };

    const selectFile = (file) => {
        const textBeforeAt = input.slice(0, atSymbolPosition);
        const textAfterAtQuery = input.slice(atSymbolPosition);
        const spaceIndex = textAfterAtQuery.indexOf(' ');
        const textAfterQuery = spaceIndex !== -1 ? textAfterAtQuery.slice(spaceIndex) : '';

        const newInput = textBeforeAt + '@' + file.path + ' ' + textAfterQuery;
        const newCursorPos = textBeforeAt.length + 1 + file.path.length + 1;

        // Immediately ensure focus is maintained
        if (textareaRef.current && !textareaRef.current.matches(':focus')) {
            textareaRef.current.focus();
        }

        // Update input and cursor position
        setInput(newInput);
        setCursorPosition(newCursorPos);

        // Hide dropdown
        setShowFileDropdown(false);
        setAtSymbolPosition(-1);

        // Set cursor position synchronously
        if (textareaRef.current) {
            // Use requestAnimationFrame for smoother updates
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    // Ensure focus is maintained
                    if (!textareaRef.current.matches(':focus')) {
                        textareaRef.current.focus();
                    }
                }
            });
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInput(newValue);
        setCursorPosition(e.target.selectionStart);

        // Handle height reset when input becomes empty
        if (!newValue.trim()) {
            e.target.style.height = 'auto';
            setIsTextareaExpanded(false);
        }
    };

    const handleTextareaClick = (e) => {
        setCursorPosition(e.target.selectionStart);
    };


    const handleNewSession = () => {
        setChatMessages([]);
        setInput('');
        setIsLoading(false);
        setCanAbortSession(false);
    };

    const handleAbortSession = () => {
        if (currentSessionId && canAbortSession) {
            sendMessage({
                type: 'abort-session',
                sessionId: currentSessionId
            });
        }
    };

    const handleModeSwitch = () => {
        const modes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
        const currentIndex = modes.indexOf(permissionMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const nextMode = modes[nextIndex];
        setPermissionMode(nextMode);

        // Persist to localStorage and broadcast so settings panels stay in sync
        try {
            const savedSettings = safeLocalStorage.getItem('claude-tools-settings');
            let settings = savedSettings ? JSON.parse(savedSettings) : {};
            settings.permissionMode = nextMode;
            settings.lastUpdated = new Date().toISOString();
            safeLocalStorage.setItem('claude-tools-settings', JSON.stringify(settings));
        } catch (_) {
            // ignore
        }
        window.dispatchEvent(new CustomEvent('permissionModeChanged', { detail: { mode: nextMode } }));
    };

    // Don't render if no project is selected
    if (!selectedProject) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>选择一个项目开始与 Claude 聊天</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <style>
                { `
          details[open] .details-chevron {
            transform: rotate(180deg);
          }
        ` }
            </style>
            <div className="h-full flex flex-col relative">
                {/* Chat Background - Covers entire chat area including input */ }
                { chatBgEnabledResolved && (
                    <div
                        className="pointer-events-none absolute inset-0 z-0"
                        aria-hidden="true"
                        style={ {
                            backgroundImage: `url('${ chatBgImageUrl || './bg-repeat.svg' }')`,
                            backgroundRepeat: 'repeat',
                            backgroundSize: '72px 72px',
                            backgroundPosition: 'center top',
                            opacity: 0.1,
                        } }
                    />
                ) }
                
                {/* Messages Area - Scrollable Middle Section */ }
                <div
                    ref={ scrollContainerRef }
                    className={`flex-1 overflow-x-hidden px-0 py-3 sm:p-4 space-y-3 sm:space-y-4 relative z-10 ${
                        chatMessages.length > 0 ? 'overflow-y-auto' : 'overflow-y-hidden'
                    }`}
                >
                    { isLoadingSessionMessages && chatMessages.length === 0 ? (
                        <div className="relative z-10 text-center text-gray-500 dark:text-gray-400 mt-8">
                            <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                <p>正在加载会话消息...</p>
                            </div>
                        </div>
                    ) : chatMessages.length === 0 ? (
                        <div className="relative z-10 flex items-center justify-center h-full">
                            <div className="text-center text-gray-500 dark:text-gray-400 px-6 sm:px-4">
                                <p className="font-bold text-lg sm:text-xl mb-3">与 Claude 开始对话</p>
                                <p className="text-sm sm:text-base leading-relaxed">
                                    提问有关您代码的问题，请求更改，或获取开发任务的帮助
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative z-10">
                            { chatMessages.length > visibleMessageCount && (
                                <div
                                    className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 border-b border-gray-200 dark:border-gray-700">
                                    显示最后 { visibleMessageCount } 条消息（共 { chatMessages.length } 条）•
                                    <button
                                        className="ml-1 text-primary hover:text-primary/80 underline"
                                        onClick={ loadEarlierMessages }
                                    >
                                        加载更早的消息
                                    </button>
                                </div>
                            ) }

                            { visibleMessages.map((message, index) => {
                                const prevMessage = index > 0 ? visibleMessages[index - 1] : null;

                                return (
                                    <AnimatedMessage 
                                        key={index} 
                                        show={true} 
                                        index={index}
                                        className="mb-4"
                                    >
                                        <MessageComponent
                                            key={ index }
                                            message={ message }
                                            index={ index }
                                            prevMessage={ prevMessage }
                                            createDiff={ createDiff }
                                            onFileOpen={ onFileOpen }
                                            onShowSettings={ onShowSettings }
                                        autoExpandTools={ autoExpandTools }
                                        showRawParameters={ showRawParameters }
                                        userAvatarUrl={ userAvatarUrl }
                                    />
                                    </AnimatedMessage>
                                );
                            }) }
                        </div>
                    ) }

                    <AnimatedTransition show={isLoading} animation="slideUp" duration={200}>
                        <div className="chat-message assistant relative z-10">
                            <div className="w-full max-w-none">
                                <div className="flex items-center space-x-3 mb-3">
                                    <img
                                        src="claude.svg"
                                        alt="Claude"
                                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 animate-pulse"
                                    />
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Claude
                                    </div>
                                </div>
                                <div className="w-full text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center space-x-2">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        </div>
                                        <span className="ml-2 animate-pulse">正在思考...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AnimatedTransition>

                    <div ref={ messagesEndRef }/>
                </div>


                {/* Input Area - Fixed Bottom */ }
                <div className={ `p-2 sm:p-4 md:p-6 flex-shrink-0 relative z-10 ${
                    isInputFocused ? 'pb-2 sm:pb-4 md:pb-6' : 'pb-16 sm:pb-4 md:pb-6'
                }` }>
                    {/* Claude Working Status - positioned above the input form */ }
                    <ClaudeStatus
                        status={ claudeStatus }
                        isLoading={ isLoading }
                        onAbort={ handleAbortSession }
                    />

                    {/* Permission Mode Selector with scroll to bottom button - Above input, clickable for mobile */ }
                    <div className="max-w-4xl mx-auto mb-3">
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={ handleModeSwitch }
                                className={ `px-3 py-1.5 rounded-lg text-sm font-medium border ${
                                    skipPermissions
                                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border-red-300 dark:border-red-700 cursor-not-allowed'
                                        : permissionMode === 'default'
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            : permissionMode === 'acceptEdits'
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                                                : permissionMode === 'bypassPermissions'
                                                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                                                    : 'bg-primary/5 text-primary border-primary/30 hover:bg-primary/10'
                                }` }
                                title="点击更改权限模式（或在输入框中按 Tab）"
                                disabled={ skipPermissions }
                            >
                                <div className="flex items-center gap-2">
                                    <div className={ `w-2 h-2 rounded-full ${
                                        skipPermissions
                                            ? 'bg-red-600'
                                            : permissionMode === 'default'
                                                ? 'bg-gray-500'
                                                : permissionMode === 'acceptEdits'
                                                    ? 'bg-green-500'
                                                    : permissionMode === 'bypassPermissions'
                                                        ? 'bg-orange-500'
                                                        : 'bg-primary'
                                    }` }/>
                                    <span>
                  { skipPermissions && '危险模式（跳过权限）' }
                                        { !skipPermissions && permissionMode === 'default' && '默认模式' }
                                        { !skipPermissions && permissionMode === 'acceptEdits' && '接受编辑' }
                                        { !skipPermissions && permissionMode === 'bypassPermissions' && '绕过权限' }
                                        { !skipPermissions && permissionMode === 'plan' && '计划模式' }
                </span>
                                </div>
                            </button>

                            {/* Scroll to bottom button - positioned next to mode indicator */ }
                            { isUserScrolledUp && chatMessages.length > 0 && (
                                <button
                                    onClick={ scrollToBottom }
                                    className="w-8 h-8 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-gray-800"
                                    title="滚动到底部"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                              d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                                    </svg>
                                </button>
                            ) }
                        </div>
                    </div>

                    <form onSubmit={ handleSubmit } className="relative max-w-4xl mx-auto">
                        {/* Drag overlay */ }
                        { isDragActive && (
                            <div
                                className="absolute inset-0 z-10 rounded-2xl bg-black/40 flex items-center justify-center pointer-events-none">
                                <div
                                    className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none"
                                         stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                                    </svg>
                                    <p className="text-sm font-medium">在此放置图像</p>
                                </div>
                            </div>
                        ) }

                        {/* Image attachments preview */ }
                        { attachedImages.length > 0 && (
                            <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex flex-wrap gap-2">
                                    { attachedImages.map((file, index) => (
                                        <ImageAttachment
                                            key={ index }
                                            file={ file }
                                            onRemove={ (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setAttachedImages(prev => prev.filter((_, i) => i !== index));
                                            } }
                                            uploadProgress={ uploadingImages.get(file.name) }
                                            error={ imageErrors.get(file.name) }
                                        />
                                    )) }
                                </div>
                            </div>
                        ) }

                        {/* File dropdown - positioned outside dropzone to avoid conflicts */ }
                        { showFileDropdown && filteredFiles.length > 0 && (
                            <div
                                className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 backdrop-blur-sm">
                                { filteredFiles.map((file, index) => (
                                    <div
                                        key={ file.path }
                                        className={ `px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 touch-manipulation ${
                                            index === selectedFileIndex
                                                ? 'bg-primary/5 text-primary'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }` }
                                        onMouseDown={ (e) => {
                                            // Prevent textarea from losing focus on mobile
                                            e.preventDefault();
                                            e.stopPropagation();
                                        } }
                                        onClick={ (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            selectFile(file);
                                        } }
                                    >
                                        <div className="font-medium text-sm">{ file.name }</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                            { file.path }
                                        </div>
                                    </div>
                                )) }
                            </div>
                        ) }

                        <div { ...getRootProps() }
                             className={ `relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-500 focus-within:border-blue-500 ${ isTextareaExpanded ? 'chat-input-expanded' : '' }` }>
                            <input { ...getInputProps() } />
                            <textarea
                                ref={ textareaRef }
                                value={ input }
                                onChange={ handleInputChange }
                                onClick={ handleTextareaClick }
                                onKeyDown={ handleKeyDown }
                                onPaste={ handlePaste }
                                onFocus={ () => setIsInputFocused(true) }
                                onBlur={ () => setIsInputFocused(false) }
                                onInput={ (e) => {
                                    // Immediate resize on input for better UX
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                    setCursorPosition(e.target.selectionStart);

                                    // Check if textarea is expanded (more than 2 lines worth of height)
                                    const lineHeight = parseInt(window.getComputedStyle(e.target).lineHeight);
                                    const isExpanded = e.target.scrollHeight > lineHeight * 2;
                                    setIsTextareaExpanded(isExpanded);
                                } }
                                placeholder="询问 Claude 协助您的代码... (@ 引用文件)"
                                disabled={ isLoading }
                                rows={ 1 }
                                className="chat-input-placeholder w-full pl-12 pr-28 sm:pr-40 py-3 sm:py-4 bg-transparent rounded-2xl focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none min-h-[40px] sm:min-h-[56px] max-h-[40vh] sm:max-h-[300px] overflow-y-auto text-sm sm:text-base"
                                style={ { height: 'auto' } }
                            />
                            {/* Clear button - shown when there's text */ }
                            { input.trim() && (
                                <button
                                    type="button"
                                    onClick={ (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setInput('');
                                        if (textareaRef.current) {
                                            textareaRef.current.style.height = 'auto';
                                            textareaRef.current.focus();
                                        }
                                        setIsTextareaExpanded(false);
                                    } }

                                    className="absolute -left-0.5 -top-3 sm:right-28 sm:left-auto sm:top-1/2 sm:-translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center group z-10 shadow-sm"
                                    title="清空输入"
                                >
                                    <svg
                                        className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={ 2 }
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            ) }
                            {/* Image upload button */ }
                            <button
                                type="button"
                                onClick={ open }
                                className="absolute left-2 bottom-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                title="附加图片"
                            >
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor"
                                     viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 }
                                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                            </button>

                            {/* Mic button - HIDDEN */ }
                            <div className="absolute right-16 sm:right-16 top-1/2 transform -translate-y-1/2"
                                 style={ { display: 'none' } }>
                                <MicButton
                                    onTranscript={ handleTranscript }
                                    className="w-10 h-10 sm:w-10 sm:h-10"
                                />
                            </div>
                            {/* Send button */ }
                            <button
                                type="submit"
                                disabled={ !input.trim() || isLoading }
                                onMouseDown={ (e) => {
                                    e.preventDefault();
                                    handleSubmit(e);
                                } }

                                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-12 h-12 sm:w-12 sm:h-12 bg-primary hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-gray-800"
                            >
                                <svg
                                    className="w-4 h-4 sm:w-5 sm:h-5 text-white transform rotate-90"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={ 2 }
                                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                    />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

export default React.memo(ChatInterface);