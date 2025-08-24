import React, { useCallback, useEffect, useRef, useState } from 'react';
import './Computer3D.css';

/**
 * 3D电脑键盘自动打字动画组件
 * 基于Computer3D组件，实现自动打字效果
 */
const Computer3DTyping = ({
                              className = '',
                              text = 'Loading...',
                              typingSpeed = 500, // 每个字符的间隔时间（毫秒）
                              pauseDuration = 500, // 打字完成后的暂停时间（毫秒）
                              onComplete, // 每轮完成的回调
                              autoStart = true, // 是否自动开始
                              loop = true // 是否循环
                          }) => {
    const containerRef = useRef(null);
    const keyboardRef = useRef(null);
    const screenRef = useRef(null);
    const [screenContent, setScreenContent] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);
    
    // 根据文本长度计算字体大小
    const calculateFontSize = useCallback((textLength) => {
        if (textLength <= 8) return 10; // 短文本
        if (textLength <= 15) return 9; // 中等文本
        if (textLength <= 25) return 8; // 较长文本
        return 7; // 长文本
    }, []);
    
    const fontSize = calculateFontSize(text.length);

    // 键码到键盘按键索引的映射表
    const KEY_MAP = {
        // 字母键
        81: 15, 87: 16, 69: 17, 82: 18, 84: 19, 89: 20, 85: 21, 73: 22, 79: 23, 80: 24,
        65: 29, 83: 30, 68: 31, 70: 32, 71: 33, 72: 34, 74: 35, 75: 36, 76: 37,
        90: 41, 88: 42, 67: 43, 86: 44, 66: 45, 78: 46, 77: 47,

        // 数字键
        49: 1, 50: 2, 51: 3, 52: 4, 53: 5, 54: 6, 55: 7, 56: 8, 57: 9, 48: 10,

        // 符号键
        190: 49, // 句号
        32: 56,  // 空格键
        8: 27,   // 退格键
    };

    // 字符到键码的映射
    const getKeyCodeFromChar = (char) => {
        const upperChar = char.toUpperCase();
        const charCode = upperChar.charCodeAt(0);

        // 字母 A-Z
        if (charCode >= 65 && charCode <= 90) {
            return charCode;
        }

        // 数字 0-9
        if (charCode >= 48 && charCode <= 57) {
            return charCode;
        }

        // 特殊字符
        switch (char) {
            case '.':
                return 190;
            case ' ':
                return 32;
            case '\n':
                return 13;
            default:
                return null;
        }
    };


    // 添加按键按下的视觉效果
    const addKeyPressEffect = (keyCode) => {
        const keyIndex = KEY_MAP[keyCode];
        if (keyIndex !== undefined && containerRef.current) {
            const keys = containerRef.current.querySelectorAll('.key');
            if (keys[keyIndex]) {
                keys[keyIndex].classList.add('key--down');

                // 100ms后移除效果
                setTimeout(() => {
                    if (keys[keyIndex]) {
                        keys[keyIndex].classList.remove('key--down');
                    }
                }, 100);
            }
        }
    };

    // 模拟打字效果
    const typeCharacter = useCallback((char) => {
        const keyCode = getKeyCodeFromChar(char);

        if (keyCode) {
            // 添加视觉效果
            addKeyPressEffect(keyCode);

            // 更新屏幕内容
            if (char === ' ') {
                setScreenContent(prev => prev + '\u00A0'); // 非断行空格
            } else {
                setScreenContent(prev => prev + char);
            }
        }
    }, []);

    // 清空屏幕
    const clearScreen = useCallback(() => {
        // 模拟退格键效果
        addKeyPressEffect(8);
        setScreenContent('');
    }, []);

    // 开始打字动画
    const startTyping = useCallback(() => {
        if (!text || isTyping) return;

        setIsTyping(true);
        setIsPaused(false);
        setScreenContent(''); // 清空屏幕

        let index = 0;
        const typeNextChar = () => {
            if (index < text.length) {
                const char = text[index];
                typeCharacter(char);
                index++;

                intervalRef.current = setTimeout(typeNextChar, typingSpeed);
            } else {
                // 打字完成
                setIsTyping(false);
                setIsPaused(true);

                // 调用完成回调
                if (onComplete) {
                    onComplete();
                }

                // 暂停后清空并重新开始
                timeoutRef.current = setTimeout(() => {
                    clearScreen();

                    if (loop) {
                        // 延迟一点后重新开始
                        setTimeout(() => {
                            setIsPaused(false);
                            startTyping();
                        }, 200);
                    }
                }, pauseDuration);
            }
        };

        typeNextChar();
    }, [text, typingSpeed, pauseDuration, typeCharacter, clearScreen, onComplete, loop, isTyping]);

    // 停止打字动画
    const stopTyping = useCallback(() => {
        if (intervalRef.current) {
            clearTimeout(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsTyping(false);
        setIsPaused(false);
    }, []);


    // 初始化时开始
    useEffect(() => {
        if (autoStart && text) {
            startTyping();
        }

        return () => {
            stopTyping();
        };
    }, []); // 只在组件挂载时执行一次

    // 设置固定角度 - 移除因为CSS已处理

    // 清理定时器
    useEffect(() => {
        return () => {
            stopTyping();
        };
    }, [stopTyping]);

    // 创建按键组件
    const createKey = (className = '', colorClass = '', keyId = '') => (
        <div key={ keyId } className={ `key flex ${ className }` }>
            <div className={ `key__front face ${ colorClass ? `face--key-${ colorClass }` : '' }` }></div>
            <div
                className={ `key__back face ${ colorClass ? `face--key-${ colorClass.replace('3', '1') }` : '' }` }></div>
            <div
                className={ `key__right face ${ colorClass ? `face--key-${ colorClass.replace('3', '1') }` : '' }` }></div>
            <div
                className={ `key__left face ${ colorClass ? `face--key-${ colorClass.replace('3', '2') }` : '' }` }></div>
            <div
                className={ `key__top face ${ colorClass ? `face--key-${ colorClass.replace('3', '1') }` : '' }` }></div>
            <div
                className={ `key__bottom face ${ colorClass ? `face--key-${ colorClass.replace('3', '2') }` : '' }` }></div>
        </div>
    );


    return (
        <main
            className={ `computer-container flex ${ className }` }
            ref={ containerRef }
            id="computer-main"
        >
            <div
                className="keyboard flex"
                ref={ keyboardRef }
                role="application"
                aria-label="3D虚拟键盘 - 自动打字模式"
            >
                <div
                    className="screen flex"
                    ref={ screenRef }
                    aria-live="polite"
                    aria-label="屏幕显示区域"
                    style={{
                        fontSize: `${fontSize}px`,
                        lineHeight: '1.2'
                    }}
                >
                    { screenContent }
                    {/* 添加光标效果 */ }
                    { isTyping && (
                        <span className="typing-cursor" style={ {
                            animation: 'blink 1s infinite',
                            marginLeft: '2px',
                            color: 'rgba(0,0,0,0.7)',
                            fontSize: `${fontSize}px`
                        } }>|</span>
                    ) }
                </div>

                <div className="keyboard__front face"></div>
                <div className="keyboard__back face"></div>
                <div className="keyboard__right face"></div>
                <div className="keyboard__left face"></div>

                <div className="keyboard__top face">
                    {/* 数字行 */ }
                    <div className="keys">
                        { createKey('', 'b3', 'num-esc') }
                        { Array.from({ length: 10 }, (_, i) => createKey('', '', `num-${ i }`)) }
                        { createKey('', '', 'num-minus') }
                        { createKey('', '', 'num-equal') }
                        { createKey('key--w2', 'b3', 'num-backspace') }
                    </div>

                    {/* 第一排字母行 */ }
                    <div className="keys">
                        { createKey('key--w2', 'b3', 'tab') }
                        { Array.from({ length: 10 }, (_, i) => createKey('', '', `letter1-${ i }`)) }
                        { createKey('', '', 'letter1-bracket1') }
                        { createKey('', '', 'letter1-bracket2') }
                        { createKey('key--w2', 'b3', 'letter1-backslash') }
                    </div>

                    {/* 第二排字母行 */ }
                    <div className="keys">
                        { createKey('key--w3', 'b3', 'caps') }
                        { Array.from({ length: 9 }, (_, i) => createKey('', '', `letter2-${ i }`)) }
                        { createKey('', '', 'letter2-semicolon') }
                        { createKey('', '', 'letter2-quote') }
                        { createKey('key--w2', 'o3', 'enter') }
                    </div>

                    {/* 第三排字母行 */ }
                    <div className="keys">
                        { createKey('key--w2', 'b3', 'shift-left') }
                        { Array.from({ length: 10 }, (_, i) => createKey('', '', `letter3-${ i }`)) }
                        { createKey('', '', 'letter3-comma') }
                        { createKey('key--w3', 'b3', 'shift-right') }
                    </div>

                    {/* 空格键行 */ }
                    <div className="keys">
                        { createKey('', 'b3', 'ctrl-left') }
                        { createKey('', 'o3', 'alt-left') }
                        { createKey('', 'b3', 'cmd-left') }
                        { createKey('', 'b3', 'cmd-right') }
                        { createKey('key--w6', '', 'spacebar') }
                        { createKey('', 'b3', 'alt-right') }
                        { createKey('', 'b3', 'fn') }
                        { createKey('', 'b3', 'ctrl-right') }
                        { createKey('', 'b3', 'arrow-left') }
                        { createKey('', 'b3', 'arrow-right') }
                    </div>
                </div>

                <div className="keyboard__bottom face"></div>
            </div>

            {/* 添加光标闪烁动画 */ }
            <style>{ `
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      ` }</style>
        </main>
    );
};

export default Computer3DTyping;