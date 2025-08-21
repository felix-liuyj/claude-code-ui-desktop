import React, { useState, useEffect } from 'react';

/**
 * 通用动画过渡组件
 * 支持淡入淡出、滑动、缩放等多种动画效果
 */
export const AnimatedTransition = ({ 
    children, 
    show, 
    animation = 'fade',
    duration = 300,
    delay = 0,
    className = '',
    onEnter,
    onExit
}) => {
    useEffect(() => {
        if (show && onEnter) {
            onEnter();
        } else if (!show && onExit) {
            onExit();
        }
    }, [show, onEnter, onExit]);

    if (!show) return null;

    return (
        <div className={className}>
            {children}
        </div>
    );
};

/**
 * 列表项动画组件
 * 用于列表项的进入/退出动画
 */
export const AnimatedListItem = ({ children, show, index = 0, className = '' }) => {
    if (!show) return null;
    return (
        <div className={className}>
            {children}
        </div>
    );
};

/**
 * 模态框动画组件
 */
export const AnimatedModal = ({ children, show, className = '' }) => {
    if (!show) return null;
    return (
        <div className={className}>
            {children}
        </div>
    );
};

/**
 * 消息动画组件
 */
export const AnimatedMessage = ({ children, show, index = 0, className = '' }) => {
    if (!show) return null;
    return (
        <div className={className}>
            {children}
        </div>
    );
};

/**
 * 按钮动画 Hook
 */
export const useButtonAnimation = () => {
    const [isPressed, setIsPressed] = useState(false);

    const buttonProps = {
        onMouseDown: () => setIsPressed(true),
        onMouseUp: () => setIsPressed(false),
        onMouseLeave: () => setIsPressed(false),
        className: ''
    };

    return { buttonProps, isPressed };
};

/**
 * 悬浮动画 Hook
 */
export const useHoverAnimation = () => {
    const [isHovered, setIsHovered] = useState(false);

    const hoverProps = {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        className: ''
    };

    return { hoverProps, isHovered };
};

export default AnimatedTransition;