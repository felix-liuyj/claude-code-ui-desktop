## [1.1.0](https://github.com/felix-liuyj/claude-code-ui-desktop/compare/v1.0.0...v1.1.0) (2025-08-18)

### ⚠ BREAKING CHANGES

* 移除了独立的 MemoryEditor 弹窗，改为内嵌式编辑

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

### Features

* add automatic changelog generation for version releases ([67bdb0d](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/67bdb0d4298aecb58da0a8f2b8cd099f5f2b18a3))
* 添加 Usage Monitor 使用量监控功能与优化 Memory 编辑体验 ([49e6a73](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/49e6a7365b618777a40c5b1e9e53db140ab0e876))

### Bug Fixes

* update version check logic and change package version to 1.0.0 ([252ec8a](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/252ec8a56892b79b846e666de52ee300ddf2672c))
* update version check logic and change package version to 1.0.0 ([37c25fd](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/37c25fd7a5c1a662f94e14c39bde33c89aff8de9))
* update version check logic and change package version to 1.0.0 ([376b52f](https://github.com/felix-liuyj/claude-code-ui-desktop/commit/376b52f07023939f9b62c58359373af338a5643a))
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