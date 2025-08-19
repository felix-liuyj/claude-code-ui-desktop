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