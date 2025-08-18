## [1.0.0](https://github.com/felix-liuyj/claude-code-ui-desktop/releases/tag/v1.0.0) (2025-01-18)

### ⚠ BREAKING CHANGES

* 移除了独立的 MemoryEditor 弹窗，改为内嵌式编辑

### ✨ 新增功能

* **Usage Monitor 使用量监控模块**
  - 实时监控 5 小时窗口的令牌使用情况
  - 每日统计分析与成本计算
  - 月度趋势分析与长期使用追踪
  - 模型策略配置按钮 (Default/Opus/Sonnet/Opus Plan)
  - 多层缓存系统优化性能

* **优化全局 Memory 编辑体验**
  - 移除多余的弹窗，复用查看内容区域
  - 集成 Markdown 实时预览渲染
  - 默认显示预览内容
  - 统一预览和编辑模式的交互

### 🔧 改进

* **JSONL 解析优化**
  - 修复 50% 解析失败率问题
  - 添加智能错误恢复机制
  - 支持不完整 JSON 行修复
  - 跳过 summary 类型行

* **日志系统优化**
  - 环境变量控制的调试日志 (VITE_DEBUG=true)
  - 统一的 Logger 工具类
  - 减少生产环境日志噪音

### 🐛 修复

* 修复 Model API 404 错误 - 统一前后端参数命名 (strategy -> model)
* 修复 Memory 编辑器高度过低问题 - 调整为 40vh
* 修复预览显示原始 Markdown 代码 - 集成 ReactMarkdown 渲染
* 修复重复的全局 Memory 预览区域

### 📦 依赖更新

* 添加 react-markdown 和 remark 插件支持
* 添加 recharts 图表库
* 添加 multer 文件上传支持
# 更新日志

此项目的所有重要变更都将记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

## [未发布]

### ✨ 新增功能
- 自动更新通知的版本检查功能
- 自动化版本管理的GitHub发布脚本
- 针对Electron环境优化的桌面专用UI

### 🔄 变更
- 改进版本检查API调用的错误处理
- 更新项目结构以优先支持桌面端

### 🐛 修复
- 修复编译后应用读取package.json时的ENOENT错误
- 修复没有releases的仓库的GitHub API 404错误处理

## [1.0.1] - 2025-01-XX

### ✨ 新增功能
- 版本检查功能
- 侧边栏更新通知

### 🐛 修复
- 修复Electron环境下的Package.json路径解析问题

## [1.0.0] - 2025-01-XX

### ✨ 新增功能
- 初始桌面版本发布
- 基于Electron的Claude Code UI
- 项目管理和会话处理
- 与Claude CLI的WebSocket通信
- 文件浏览器和编辑器集成
- 直接访问Claude CLI的终端集成
- MCP (模型上下文协议) 支持
- 图片上传功能
- 主题管理 (亮色/暗色模式)
- 设置管理
- 会话保护系统

### 🎯 主要特性
- **桌面应用**: 纯Electron应用，内嵌Node.js服务器
- **项目发现**: 从 `~/.claude/projects/` 自动检测
- **会话管理**: 创建、重命名、删除和组织对话
- **文件操作**: 完整的CRUD支持，带备份创建功能
- **实时更新**: Chokidar文件监视器与WebSocket通信
- **权限系统**: 多种模式，包括计划模式和绕过权限
- **多语言支持**: 中文界面
- **响应式设计**: 针对桌面使用优化

### 🔧 技术实现
- 使用Electron、React和Express构建
- 使用Vite进行快速开发构建
- 使用Tailwind CSS进行样式设计
- 使用WebSocket进行实时通信
- 通过better-sqlite3集成SQLite
- 支持PTY终端集成