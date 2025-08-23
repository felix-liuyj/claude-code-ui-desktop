import React, { useRef, useEffect, useState } from 'react';
import './Computer3D.css';

/**
 * 3D电脑键盘交互组件
 * 实现鼠标跟踪的3D键盘效果和按键交互功能
 */
const Computer3D = ({ className = '', onKeyPress }) => {
  const containerRef = useRef(null);
  const keyboardRef = useRef(null);
  const screenRef = useRef(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [screenContent, setScreenContent] = useState('');

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
    
    // 功能键
    13: 39, // Enter
    32: 56, // Space
    8: 27,  // Backspace
    9: 28   // Tab
  };

  // 验证按键是否有效
  const isValidKey = (keyCode) => {
    return (keyCode >= 65 && keyCode <= 90) ||   // A-Z字母键
           (keyCode >= 48 && keyCode <= 57) ||   // 0-9数字键
           keyCode === 32 ||                     // 空格键
           keyCode === 8 ||                      // 退格键
           keyCode === 13 ||                     // 回车键
           keyCode === 190;                      // 句号
  };

  // 鼠标移动事件处理函数
  const handleMouseMove = (event) => {
    if (!keyboardRef.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    
    const rotateX = y * 10 + 60;
    const rotateZ = x * 40 + 35;
    
    keyboardRef.current.style.transform = 
      `perspective(10000px) rotateX(${rotateX}deg) rotateZ(-${rotateZ}deg)`;
  };

  // 添加按键按下的视觉效果
  const addKeyPressEffect = (keyCode) => {
    const keyIndex = KEY_MAP[keyCode];
    if (keyIndex !== undefined && containerRef.current) {
      const keys = containerRef.current.querySelectorAll('.key');
      if (keys[keyIndex]) {
        keys[keyIndex].classList.add('key--down');
      }
    }
  };

  // 移除按键按下的视觉效果
  const removeKeyPressEffect = (keyCode) => {
    const keyIndex = KEY_MAP[keyCode];
    if (keyIndex !== undefined && containerRef.current) {
      const keys = containerRef.current.querySelectorAll('.key');
      if (keys[keyIndex]) {
        keys[keyIndex].classList.remove('key--down');
      }
    }
  };

  // 更新屏幕显示内容
  const updateScreenDisplay = (keyCode) => {
    if (keyCode === 8) { // 退格键：清空屏幕
      setScreenContent('');
      setCharacterCount(0);
      return;
    }
    
    let newContent = screenContent;
    if (keyCode === 32) { // 空格键
      newContent += '\u00A0'; // 非断行空格
    } else if (keyCode === 13) { // 回车键：只触发视觉效果
      return;
    } else if (keyCode === 190) { // 句号
      newContent += '.';
    } else { // 字母和数字键
      newContent += String.fromCharCode(keyCode);
    }
    
    const newCount = characterCount + 1;
    
    // 屏幕字符数量限制：超过15个字符时清空重新开始
    if (newCount > 15) {
      setScreenContent('');
      setCharacterCount(0);
    } else {
      setScreenContent(newContent);
      setCharacterCount(newCount);
    }
  };

  // 按键处理函数
  const handleKeyDown = (event) => {
    const keyCode = event.keyCode;
    
    if (!isValidKey(keyCode)) return;
    
    addKeyPressEffect(keyCode);
    updateScreenDisplay(keyCode);
    
    // 调用外部回调
    if (onKeyPress) {
      onKeyPress(keyCode, String.fromCharCode(keyCode));
    }
  };

  const handleKeyUp = (event) => {
    const keyCode = event.keyCode;
    removeKeyPressEffect(keyCode);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 绑定事件监听器
    container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [screenContent, characterCount]);

  // 创建按键组件
  const createKey = (className = '', colorClass = '') => (
    <div className={`key flex ${className}`}>
      <div className={`key__front face ${colorClass ? `face--key-${colorClass}` : ''}`}></div>
      <div className={`key__back face ${colorClass ? `face--key-${colorClass.replace('3', '1')}` : ''}`}></div>
      <div className={`key__right face ${colorClass ? `face--key-${colorClass.replace('3', '1')}` : ''}`}></div>
      <div className={`key__left face ${colorClass ? `face--key-${colorClass.replace('3', '2')}` : ''}`}></div>
      <div className={`key__top face ${colorClass ? `face--key-${colorClass.replace('3', '1')}` : ''}`}></div>
      <div className={`key__bottom face ${colorClass ? `face--key-${colorClass.replace('3', '2')}` : ''}`}></div>
    </div>
  );

  return (
    <main 
      className={`computer-container flex ${className}`}
      ref={containerRef}
      id="computer-main"
    >
      <div 
        className="keyboard flex" 
        ref={keyboardRef}
        role="application" 
        aria-label="3D虚拟键盘"
      >
        <div 
          className="screen flex" 
          ref={screenRef}
          aria-live="polite" 
          aria-label="屏幕显示区域"
        >
          {screenContent}
        </div>
        
        <div className="keyboard__front face"></div>
        <div className="keyboard__back face"></div>
        <div className="keyboard__right face"></div>
        <div className="keyboard__left face"></div>
        
        <div className="keyboard__top face">
          {/* 数字行 */}
          <div className="keys">
            {createKey('', 'b3')}
            {Array.from({ length: 10 }, (_, i) => createKey())}
            {createKey()}
            {createKey()}
            {createKey('key--w2', 'b3')}
          </div>
          
          {/* 第一排字母行 */}
          <div className="keys">
            {createKey('key--w2', 'b3')}
            {Array.from({ length: 10 }, (_, i) => createKey())}
            {createKey()}
            {createKey()}
            {createKey('key--w2', 'b3')}
          </div>
          
          {/* 第二排字母行 */}
          <div className="keys">
            {createKey('key--w3', 'b3')}
            {Array.from({ length: 9 }, (_, i) => createKey())}
            {createKey()}
            {createKey()}
            {createKey('key--w2', 'o3')}
          </div>
          
          {/* 第三排字母行 */}
          <div className="keys">
            {createKey('key--w2', 'b3')}
            {Array.from({ length: 10 }, (_, i) => createKey())}
            {createKey()}
            {createKey('key--w3', 'b3')}
          </div>
          
          {/* 空格键行 */}
          <div className="keys">
            {createKey('', 'b3')}
            {createKey('', 'o3')}
            {createKey('', 'b3')}
            {createKey('', 'b3')}
            {createKey('key--w6')}
            {createKey('', 'b3')}
            {createKey('', 'b3')}
            {createKey('', 'b3')}
            {createKey('', 'b3')}
            {createKey('', 'b3')}
          </div>
        </div>
        
        <div className="keyboard__bottom face"></div>
      </div>
    </main>
  );
};

export default Computer3D;