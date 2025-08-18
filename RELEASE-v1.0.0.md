# Claude Code UI Desktop v1.0.0 发布说明

## 📢 版本概述

**版本号**: v1.0.0  
**发布日期**: 2025-01-18  
**代码名称**: Usage Monitor  

这是 Claude Code UI Desktop 的一个重要功能更新版本，引入了全新的使用量监控功能，并大幅改进了 Memory 编辑体验。

## ✨ 主要新功能

### 1. 🎯 Usage Monitor 使用量监控模块

全新的使用量监控功能，让您实时掌握 Claude AI 的使用情况：

- **实时监控视图**
  - 5小时滚动窗口的令牌使用跟踪
  - 实时更新的使用量进度条
  - 剩余配额和重置时间显示

- **每日统计分析**
  - 按日期汇总的使用量数据
  - 成本计算（基于官方定价）
  - 会话数量和平均令牌统计

- **月度趋势分析**
  - 长期使用模式可视化
  - 月度成本预估
  - 使用趋势图表

- **模型策略配置**
  - Default (推荐): 智能切换模型
  - Opus: 复杂任务专用
  - Sonnet: 日常使用
  - Opus Plan Mode: 计划模式专用

### 2. 📝 优化全局 Memory 编辑体验

重新设计的 Memory 编辑功能，更直观、更高效：

- **统一的编辑区域**
  - 移除独立弹窗，直接在设置页面编辑
  - 默认显示预览内容
  - 无缝切换预览/编辑模式

- **Markdown 实时渲染**
  - 支持 GFM (GitHub Flavored Markdown)
  - 语法高亮
  - 实时预览效果

- **改进的交互体验**
  - 40vh 高度的编辑区域，充分利用屏幕空间
  - 智能保存按钮（仅在有变更时启用）
  - 快速刷新功能

## 🔧 技术改进

### 性能优化

- **JSONL 解析优化**
  - 错误率从 50% 降至接近 0
  - 智能错误恢复机制
  - 支持不完整 JSON 修复

- **多层缓存系统**
  - Session 数据缓存
  - Block 数据缓存
  - 文件监控缓存
  - 30秒缓存超时机制

### 开发体验

- **统一日志系统**
  - 环境变量控制 (VITE_DEBUG=true)
  - Logger 工具类
  - 减少生产环境噪音

- **错误处理**
  - 修复 Model API 404 错误
  - 统一参数命名规范
  - 改进错误提示

## 🐛 修复的问题

1. **JSONL 解析失败** - 通过智能恢复机制解决
2. **Model API 404** - 统一前后端参数名称
3. **过度日志输出** - 添加环境变量控制
4. **Memory 编辑器高度** - 优化为 40vh 固定高度
5. **重复预览区域** - 合并为单一编辑区域

## 💔 破坏性变更

- **移除独立 MemoryEditor 弹窗组件** - 现在集成在 ToolsSettings 中
- **API 参数变更** - `/api/model` 接口参数从 `strategy` 改为 `model`

## 📦 安装与升级

### 全新安装

```bash
# 克隆仓库
git clone https://github.com/felix-liuyj/claude-code-ui-desktop.git
cd claude-code-ui-desktop

# 安装依赖
npm install

# 运行开发版本
npm run electron-dev

# 或构建发布版本
npm run dist
```

### 从旧版本升级

1. 备份您的设置和 Memory 文件
2. 拉取最新代码：
   ```bash
   git fetch origin
   git checkout v1.0.0
   ```
3. 更新依赖：
   ```bash
   npm install
   npm rebuild
   ```
4. 运行新版本：
   ```bash
   npm run electron-dev
   ```

## 🚀 发布流程

### 1. 准备发布

```bash
# 确保在 usage-monitor 分支
git checkout usage-monitor

# 推送代码和标签
git push origin usage-monitor
git push origin v1.0.0
```

### 2. 合并到主分支

```bash
# 切换到主分支
git checkout master

# 合并功能分支
git merge usage-monitor

# 推送主分支
git push origin master
```

### 3. 创建 GitHub Release

方式一：使用 GitHub CLI
```bash
npm run release:gh
```

方式二：手动创建
1. 访问: https://github.com/felix-liuyj/claude-code-ui-desktop/releases/new
2. 选择标签: v1.0.0
3. 标题: v1.0.0 - Usage Monitor & Memory Editor Enhancement
4. 复制本文档内容作为发布说明

### 4. 构建分发包

```bash
# macOS
npm run dist

# Windows (在 Windows 系统上运行)
npm run dist

# Linux
npm run dist
```

构建产物将在 `dist-electron/` 目录中。

## 📋 测试清单

发布前请确保完成以下测试：

- [ ] Usage Monitor 实时数据更新正常
- [ ] 每日统计图表显示正确
- [ ] 月度分析数据准确
- [ ] 模型策略切换功能正常
- [ ] Memory 预览 Markdown 渲染正确
- [ ] Memory 编辑保存功能正常
- [ ] 无控制台错误
- [ ] 性能无明显退化

## 🙏 致谢

感谢所有贡献者和用户的支持！特别感谢：
- Claude AI 团队提供的优秀 AI 助手
- 社区用户的反馈和建议

## 📝 下一版本预告

v1.2.0 计划功能：
- 项目级 Memory 编辑器
- 使用量导出功能
- 自定义主题支持
- 更多图表类型

## 📞 联系与反馈

- GitHub Issues: https://github.com/felix-liuyj/claude-code-ui-desktop/issues
- Email: felixliuyj@gmail.com

---

**Happy Coding with Claude Code UI Desktop! 🚀**