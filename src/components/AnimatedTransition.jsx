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
    const [shouldRender, setShouldRender] = useState(show);
    const [animationState, setAnimationState] = useState(show ? 'entered' : 'exited');

    useEffect(() => {
        if (show) {
            setShouldRender(true);
            // 延迟触发进入动画
            const timer = setTimeout(() => {
                setAnimationState('entering');
                onEnter && onEnter();
                setTimeout(() => setAnimationState('entered'), duration);
            }, delay);
            return () => clearTimeout(timer);
        } else {
            setAnimationState('exiting');
            onExit && onExit();
            const timer = setTimeout(() => {
                setAnimationState('exited');
                setShouldRender(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [show, duration, delay, onEnter, onExit]);

    if (!shouldRender) return null;

    const getAnimationClasses = () => {
        const baseClasses = `transition-all duration-${duration} ease-in-out`;
        
        switch (animation) {
            case 'fade':
                return {
                    entering: `${baseClasses} opacity-0`,
                    entered: `${baseClasses} opacity-100`,
                    exiting: `${baseClasses} opacity-100`,
                    exited: `${baseClasses} opacity-0`
                };
            case 'slideUp':
                return {
                    entering: `${baseClasses} opacity-0 transform translate-y-4`,
                    entered: `${baseClasses} opacity-100 transform translate-y-0`,
                    exiting: `${baseClasses} opacity-100 transform translate-y-0`,
                    exited: `${baseClasses} opacity-0 transform translate-y-4`
                };
            case 'slideDown':
                return {
                    entering: `${baseClasses} opacity-0 transform -translate-y-4`,
                    entered: `${baseClasses} opacity-100 transform translate-y-0`,
                    exiting: `${baseClasses} opacity-100 transform translate-y-0`,
                    exited: `${baseClasses} opacity-0 transform -translate-y-4`
                };
            case 'slideLeft':
                return {
                    entering: `${baseClasses} opacity-0 transform translate-x-4`,
                    entered: `${baseClasses} opacity-100 transform translate-x-0`,
                    exiting: `${baseClasses} opacity-100 transform translate-x-0`,
                    exited: `${baseClasses} opacity-0 transform translate-x-4`
                };
            case 'slideRight':
                return {
                    entering: `${baseClasses} opacity-0 transform -translate-x-4`,
                    entered: `${baseClasses} opacity-100 transform translate-x-0`,
                    exiting: `${baseClasses} opacity-100 transform translate-x-0`,
                    exited: `${baseClasses} opacity-0 transform -translate-x-4`
                };
            case 'scale':
                return {
                    entering: `${baseClasses} opacity-0 transform scale-95`,
                    entered: `${baseClasses} opacity-100 transform scale-100`,
                    exiting: `${baseClasses} opacity-100 transform scale-100`,
                    exited: `${baseClasses} opacity-0 transform scale-95`
                };
            case 'bounce':
                return {
                    entering: `${baseClasses} opacity-0 transform scale-50`,
                    entered: `${baseClasses} opacity-100 transform scale-100`,
                    exiting: `${baseClasses} opacity-100 transform scale-100`,
                    exited: `${baseClasses} opacity-0 transform scale-50`
                };
            default:
                return {
                    entering: baseClasses,
                    entered: baseClasses,
                    exiting: baseClasses,
                    exited: baseClasses
                };
        }
    };

    const animationClasses = getAnimationClasses();
    const currentClass = animationClasses[animationState] || '';

    return (
        <div className={`${currentClass} ${className}`}>
            {children}
        </div>
    );
};

/**
 * 列表项动画组件
 * 用于列表项的进入/退出动画
 */
export const AnimatedListItem = ({ children, show, index = 0, className = '' }) => {
    return (
        <AnimatedTransition
            show={show}
            animation="slideUp"
            duration={200}
            delay={index * 50}
            className={className}
        >
            {children}
        </AnimatedTransition>
    );
};

/**
 * 模态框动画组件
 */
export const AnimatedModal = ({ children, show, className = '' }) => {
    return (
        <AnimatedTransition
            show={show}
            animation="scale"
            duration={250}
            className={className}
        >
            {children}
        </AnimatedTransition>
    );
};

/**
 * 消息动画组件
 */
export const AnimatedMessage = ({ children, show, index = 0, className = '' }) => {
    return (
        <AnimatedTransition
            show={show}
            animation="slideUp"
            duration={300}
            delay={index * 100}
            className={className}
        >
            {children}
        </AnimatedTransition>
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
        className: `transform transition-all duration-150 ease-in-out ${
            isPressed 
                ? 'scale-95 shadow-sm' 
                : 'scale-100 hover:scale-105 hover:shadow-md active:scale-95'
        }`
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
        className: `transform transition-all duration-200 ease-in-out ${
            isHovered 
                ? 'scale-105 shadow-lg' 
                : 'scale-100 hover:shadow-md'
        }`
    };

    return { hoverProps, isHovered };
};

export default AnimatedTransition;