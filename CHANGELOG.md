## [1.1.1](https://github.com/felix-liuyj/claude-code-ui-desktop/compare/v1.1.0...v1.1.1) (2025-08-22)

### Features

* **ui:** 优化设置界面布局和修复多项功能问题 ([788ccba](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/788ccba07e669bd5078b73ccc1a1af7c71381b4e))

### Bug Fixes

* **components:** README, routes and 2 more components ([bd72885](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/bd7288525155d9f4361246c6a347b33722e1a1d7))
* include utils directory in electron-builder files configuration ([9cfa6c3](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/9cfa6c389758f09b9b009e692c023a1546665133))
## [1.1.1](https://github.com/felix-liuyj/claude-code-ui-desktop/compare/v1.1.0...v1.1.1) (2025-08-22)

### ✨ 新增功能

#### 界面优化
* **设置标签页重排**: 按使用频率和逻辑分组重新排列设置标签页顺序：工具 > 安全项 > 记忆 > Git > MCP > 外观 > 使用量 > 开发者 > 关于
* **Git 设置分组**: 将 Git 设置拆分为三个独立卡片 - 提交消息语言、提交规范、Claude CLI 集成，提升配置体验
* **紧凑界面设计**: 全面压缩选项卡片尺寸，减少内边距和间距，提升界面紧凑度和信息密度

### 问题修复

#### 消息系统优化
* **重复消息问题**: 修复 WebSocket 消息重复显示问题，改进消息 ID 生成算法使用内容哈希确保唯一性
* **消息渲染错误**: 修复聊天界面中 HTML 实体和 JSON 转义字符显示为原始文本的问题

#### Git 集成修复
* **错误日志清理**: 优化 Git 状态检查逻辑，对非 Git 仓库项目不再输出错误信息到控制台
* **多语言支持**: 改进 Git 仓库验证以支持中英文错误消息处理

#### 缓存与存储优化  
* **IndexedDB 降级**: 修复 IndexedDB 初始化失败问题，添加访问测试和 localStorage 降级策略
* **使用量监控修正**: 更正 max5 计划的限制配置（Token: 88,000, Cost: $35.00, Messages: 1,000）

### 技术改进

* **WebSocket 消息去重**: 使用稳定的哈希算法优化消息去重机制，提升实时通信可靠性
* **渐进式缓存增强**: 改进多层缓存系统的错误处理和降级策略，提升数据访问稳定性
* **响应式设计优化**: 改进界面响应式布局，确保各种屏幕尺寸下的良好体验

---

## [1.1.0](https://github.com/felix-liuyj/claude-code-ui-desktop/compare/v1.0.0...v1.1.0) (2025-08-20)

### ✨ 新增功能

#### Git 集成增强
* **智能提交消息生成**: 集成 Claude Code CLI 自动分析代码变更并生成规范的提交消息 ([4757df6](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/4757df6bab238ca3c13eaa9569c9ada9cb9a3e4d))
* **CLAUDE.md 配置支持**: 支持从全局和项目级 CLAUDE.md 文件读取 Git 消息规范和提交规则
* **多语言支持**: 提交消息支持中文和英文两种语言生成
* **配置优先级系统**: 项目 CLAUDE.md > 全局 CLAUDE.md > 应用设置 > 默认值的四级配置体系
* **Git 设置界面**: 在工具设置中新增 Git 标签，提供语言、规范和 CLI 集成的配置选项

#### 性能优化与监控
* **性能仪表板**: 新增可拖拽的性能监控面板，实时显示内存使用、缓存状态和性能指标 ([bc202a7](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/bc202a798b0c587adb420d988b2d0600802cf6c5))
* **内存优化系统**: 实现多层级内存清理策略，包含 DOM 清理、事件监听器清理和大对象清理
* **渐进式缓存**: Memory → localStorage → IndexedDB 的三级缓存体系，优化数据访问性能
* **组件优化**: 使用 React.memo、useMemo、useCallback 优化组件渲染性能
* **代码分割**: 实现懒加载和动态导入，减少初始加载时间

#### 使用量监控增强
* **实时数据广播**: 30秒间隔的 WebSocket 推送，实时更新使用量数据 ([d33cd13](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/d33cd1326515887890f3090d182154a913eff4a5))
* **日用量分析**: 详细的每日令牌使用统计和成本计算
* **月度趋势**: 长期使用模式分析和预测
* **模型策略快切**: 支持快速切换 Default/Opus/Sonnet/Opus Plan 等不同策略

### 🔧 技术改进

* **消息管理优化**: 改进会话保护系统，防止 WebSocket 更新中断活跃对话 ([268b268](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/268b268566d2ea56c638ba3dead2e4b3f7706ec1))
* **虚拟滚动**: 为长列表实现虚拟滚动，提升大数据量渲染性能
* **防抖优化**: 文件系统监听器使用300ms防抖，减少频繁触发
* **API 性能**: 优化项目发现和会话加载的 API 响应时间

### 🐛 问题修复

* **路径解析**: 统一开发和生产环境下 package.json 路径解析逻辑 ([4733825](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/4733825a47e1f33c174031af07d4d8207ee9e9dd))
* **依赖循环**: 解决性能监控模块的循环依赖问题
* **UI 样式统一**: 统一 Git 设置与其他设置标签的视觉风格和布局结构

### 🎯 界面优化

* **设置界面重构**: 重新设计工具设置界面，使用统一的容器样式和布局模式  
* **快速设置面板**: 在快速设置中独立添加性能监控开关，不与开发者工具区域混合
* **响应式适配**: 优化移动端和桌面端的显示效果

---

# 更新日志

此项目的所有重要变更都将记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

## [1.0.0] - 2025-08-19

### ✨ 新增功能

#### 核心功能
- **桌面应用**: 基于 Electron 的纯桌面应用，内嵌 Node.js 服务器
- **Claude CLI 集成**: 完整集成 Claude Code CLI，支持所有命令和功能
- **项目管理**: 从 `~/.claude/projects/` 自动发现项目，支持手动添加
- **会话管理**: 创建、重命名、删除和组织对话，带会话保护系统
- **文件操作**: 完整的 CRUD 支持，自动创建备份
- **实时同步**: 基于 Chokidar 的文件监视器，WebSocket 实时通信

#### 使用量监控
- **实时监控**: 5 小时滑动窗口的令牌使用情况追踪
- **每日统计**: 详细的日使用量分析与成本计算
- **月度趋势**: 长期使用追踪与趋势分析
- **模型策略**: 快速切换 Default/Opus/Sonnet/Opus Plan 策略
- **多层缓存**: 优化性能的智能缓存系统

#### 编辑器功能
- **代码编辑器**: 基于 CodeMirror 的语法高亮编辑器
- **Markdown 预览**: 实时 Markdown 渲染和预览
- **Memory 管理**: 全局和项目级 Memory 编辑器
- **图片上传**: 支持拖拽和粘贴图片上传

#### 终端集成
- **原生终端**: 集成 xterm.js 和 PTY 的完整终端体验
- **Shell 会话**: 直接访问 Claude CLI 命令行界面
- **命令历史**: 保存和恢复命令历史

#### 权限系统
- **多种模式**: default、acceptEdits、bypassPermissions、plan
- **视觉指示**: 不同权限级别的颜色编码
- **工具管理**: 精细的工具允许/禁用控制

### 🔧 技术特性

- **框架**: Electron + React + Express + Vite
- **样式**: Tailwind CSS + 响应式设计
- **通信**: WebSocket 双向实时通信
- **数据库**: Better-SQLite3 本地数据存储
- **构建**: Electron-builder 跨平台打包
- **中文界面**: 完整的中文本地化支持

### 📦 依赖

- Electron v32.1.0
- React v18.2.0
- Express v4.18.2
- Vite v7.0.4
- 其他关键依赖见 package.json

### 🎯 支持平台

- macOS (Intel & Apple Silicon)
- Windows (x64)
- Linux (AppImage)

---

[1.0.0]: https://github.com/felix-liuyj/claude-code-ui-desktop/releases/tag/v1.0.0