# InteractiveWidgets 交互式组件库

这个目录包含各种交互式小组件，都是从原始HTML文件改造而来的React组件。

## 组件列表

### Computer3D - 3D电脑键盘组件

一个完全交互式的3D键盘组件，支持鼠标跟踪和按键交互。

**功能特性：**
- 3D鼠标跟踪效果
- 真实键盘按键映射
- 屏幕实时显示输入内容
- 支持字母、数字和句号输入
- 响应式设计
- 无障碍支持

**使用方法：**
```jsx
import { Computer3D } from './components/InteractiveWidgets';

function App() {
  const handleKeyPress = (keyCode, character) => {
    console.log('按键:', keyCode, '字符:', character);
  };

  return (
    <Computer3D 
      className="my-keyboard"
      onKeyPress={handleKeyPress}
    />
  );
}
```

**Props:**
- `className` (string): 自定义CSS类名
- `onKeyPress` (function): 按键回调函数，接收 `(keyCode, character)` 参数

### Computer3DTyping - 3D电脑键盘自动打字组件

基于Computer3D的自动打字动画组件，非常适合用作加载动画。

**功能特性：**
- 自动打字动画效果
- 可配置的打字速度
- 循环播放支持
- 打字光标显示
- 完整的3D键盘视觉效果
- 按键按下动画同步

**使用方法：**
```jsx
import { Computer3DTyping } from './components/InteractiveWidgets';

function App() {
  return (
    <Computer3DTyping 
      text="Loading..."
      typingSpeed={500}
      pauseDuration={500}
      loop={true}
      autoStart={true}
      onComplete={() => console.log('一轮打字完成')}
    />
  );
}
```

**Props:**
- `text` (string): 要输入的文本，默认 "Loading..."
- `typingSpeed` (number): 每个字符的输入间隔（毫秒），默认 500
- `pauseDuration` (number): 输入完成后的暂停时间（毫秒），默认 500
- `loop` (boolean): 是否循环播放，默认 true
- `autoStart` (boolean): 是否自动开始，默认 true
- `onComplete` (function): 每轮完成的回调函数
- `className` (string): 自定义CSS类名

**高级控制（通过ref）：**
- `start()`: 开始打字
- `stop()`: 停止打字
- `restart()`: 重新开始
- `clear()`: 清空屏幕

### CoinTipButton - 3D硬币打赏按钮组件

一个具有硬币投掷动画效果的打赏按钮。

**功能特性：**
- 3D硬币投掷动画
- 支持GSAP动画库（可选）
- 提供fallback动画
- 响应式设计
- 无障碍支持

**使用方法：**
```jsx
import { CoinTipButton } from './components/InteractiveWidgets';

function App() {
  const handleTip = () => {
    console.log('用户进行了打赏！');
    // 处理打赏逻辑
  };

  return (
    <CoinTipButton 
      onTip={handleTip}
      buttonText="留下你的小费"
      className="my-tip-button"
      disabled={false}
    />
  );
}
```

**Props:**
- `onTip` (function): 打赏完成回调函数
- `buttonText` (string): 按钮显示文本，默认"留下你的小费"
- `className` (string): 自定义CSS类名
- `disabled` (boolean): 是否禁用按钮

## 依赖说明

### 可选依赖
- **GSAP**: CoinTipButton组件支持GSAP动画库以获得更流畅的动画效果
  ```bash
  npm install gsap
  ```
  如果未安装GSAP，组件会自动使用fallback动画。

## 样式说明

每个组件都有对应的CSS文件：
- `Computer3D.css` - 3D键盘样式
- `CoinTipButton.css` - 硬币按钮样式

样式采用CSS作用域限制，避免全局污染。支持：
- 响应式设计
- 深色主题
- 高对比度模式
- 减少动画偏好
- 无障碍支持

## 文件结构

```
InteractiveWidgets/
├── README.md                 # 说明文档
├── index.js                  # 统一导出文件
├── computer.html            # 原始3D键盘HTML文件（保留）
├── coin-tip-button.html     # 原始硬币按钮HTML文件（保留）
├── Computer3D.jsx           # 3D键盘React组件
├── Computer3D.css           # 3D键盘样式文件
├── Computer3DTyping.jsx     # 3D键盘自动打字组件
├── CoinTipButton.jsx        # 硬币按钮React组件
└── CoinTipButton.css        # 硬币按钮样式文件
```

## 开发说明

1. **保留原始文件**: 原始HTML文件被保留作为参考，方便后续维护和对比
2. **模块化设计**: 每个组件都是独立的，可以单独使用
3. **样式隔离**: 使用CSS类前缀避免样式冲突
4. **性能优化**: 组件使用React Hooks进行状态管理和事件处理
5. **无障碍支持**: 添加了适当的ARIA属性和键盘导航支持

## 扩展指南

要添加新的交互式组件：

1. 在此目录下创建新的JSX和CSS文件
2. 在 `index.js` 中添加导出
3. 更新此README文档
4. 如果有原始HTML版本，也保存在此目录中