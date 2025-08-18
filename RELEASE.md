# 版本发布指南

Claude Code UI Desktop 项目的完整版本发布流程文档。本项目采用自动化的版本管理和发布系统，支持语义化版本控制和自动变更日志生成。

## 📋 目录

- [快速发布](#-快速发布)
- [完整发布流程](#-完整发布流程)
- [提交信息规范](#-提交信息规范)
- [版本管理策略](#-版本管理策略)
- [变更日志管理](#-变更日志管理)
- [GitHub Release](#-github-release)
- [发布前检查](#-发布前检查)
- [问题排查](#-问题排查)
- [最佳实践](#-最佳实践)

## 🚀 快速发布

### 一键发布命令

```bash
# 修订版本发布 (1.0.0 → 1.0.1) - 用于bug修复
npm run release:patch

# 次版本发布 (1.0.0 → 1.1.0) - 用于新功能
npm run release:minor

# 主版本发布 (1.0.0 → 2.0.0) - 用于重大更改
npm run release:major
```

### 发布流程说明

每个发布命令会自动执行以下步骤：
1. 🔢 更新版本号 (`package.json`)
2. 📝 生成变更日志 (`CHANGELOG.md`)
3. 🏗️ 构建项目 (`npm run build`)
4. 📦 提交所有变更到Git
5. 🏷️ 创建版本标签
6. 🚀 推送到GitHub
7. 📄 显示GitHub Release创建链接

## 📋 完整发布流程

### 步骤1: 开发准备

```bash
# 确保在master分支
git checkout master

# 拉取最新代码
git pull origin master

# 确保依赖是最新的
npm install

# 运行测试（如果有）
npm test
```

### 步骤2: 代码提交

使用约定式提交格式提交你的代码：

```bash
# 添加文件
git add .

# 使用规范的提交信息
git commit -m "feat: add new dashboard component"
# 或
git commit -m "fix: resolve authentication timeout issue"
# 或
git commit -m "docs: update API documentation"
```

### 步骤3: 版本发布

根据变更类型选择合适的发布命令：

```bash
# 🐛 只有bug修复
npm run release:patch

# ✨ 有新功能但向后兼容
npm run release:minor  

# 💥 有破坏性变更
npm run release:major
```

### 步骤4: GitHub Release（可选）

```bash
# 方式1: 自动创建（需要GitHub CLI认证）
npm run release:gh

# 方式2: 创建草稿版本
npm run release:gh-draft

# 方式3: 获取手动创建链接
npm run release:info
```

### 步骤5: 验证发布

```bash
# 检查GitHub上的tags
git ls-remote --tags origin

# 检查package.json中的版本
node -p "require('./package.json').version"

# 验证CHANGELOG.md已更新
head -20 CHANGELOG.md
```

## 📝 提交信息规范

本项目遵循 [约定式提交](https://conventionalcommits.org/) 规范，以便自动生成变更日志。

### 提交类型

| 类型 | emoji | 说明 | 版本影响 |
|------|-------|------|----------|
| `feat` | ✨ | 新功能 | minor |
| `fix` | 🐛 | bug修复 | patch |
| `docs` | 📚 | 文档更新 | patch |
| `style` | 💄 | 代码样式（不影响逻辑） | patch |
| `refactor` | ♻️ | 代码重构 | patch |
| `perf` | ⚡ | 性能优化 | patch |
| `test` | ✅ | 测试相关 | patch |
| `chore` | 🔧 | 构建维护 | patch |
| `build` | 👷 | 构建系统 | patch |
| `ci` | 🔄 | CI/CD相关 | patch |

### 提交格式

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

### 提交示例

```bash
# 简单提交
git commit -m "feat: add user authentication"

# 带作用域的提交
git commit -m "feat(auth): add JWT token validation"

# 带正文的提交
git commit -m "fix: resolve memory leak in WebSocket connection

The connection was not being properly closed when the component unmounted,
causing memory accumulation over time."

# 破坏性变更
git commit -m "feat!: change API response format

BREAKING CHANGE: The user API now returns user data in a different format.
Update your client code accordingly."
```

## 🏷️ 版本管理策略

### 语义化版本控制

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

```
主版本号.次版本号.修订版本号 (MAJOR.MINOR.PATCH)
```

- **主版本号 (MAJOR)**: 不兼容的API修改
- **次版本号 (MINOR)**: 向后兼容的功能新增
- **修订版本号 (PATCH)**: 向后兼容的问题修正

### 版本号管理命令

```bash
# 仅更新版本号（不发布）
npm run version:patch    # 1.0.0 → 1.0.1
npm run version:minor    # 1.0.0 → 1.1.0
npm run version:major    # 1.0.0 → 2.0.0

# 查看当前版本
npm run release:info
```

### 分步发布流程

如果你需要更精细的控制：

```bash
# 1. 仅更新版本号
npm run version:patch

# 2. 查看即将生成的变更日志
npm run changelog:preview

# 3. 生成变更日志并推送（不创建GitHub Release）
npm run release

# 4. 获取GitHub Release创建链接
npm run release:info

# 5. 手动创建GitHub Release
open "$(npm run release:info --silent | grep 'https')"
```

## 📝 变更日志管理

### 变更日志命令

```bash
# 预览即将生成的变更日志（不修改文件）
npm run changelog:preview

# 生成增量变更日志（追加到现有文件）
npm run changelog

# 重新生成完整变更日志（覆盖整个文件）
npm run changelog:all
```

### 变更日志特性

- ✨ **自动分类**: 按提交类型组织变更
- 🔗 **链接生成**: 自动生成GitHub提交和比较链接
- 😀 **emoji支持**: 每种变更类型都有对应emoji
- 📅 **版本标记**: 自动标记版本号和发布日期
- 🇨🇳 **中文化**: 支持中文分类标题

### CHANGELOG.md 结构

```markdown
# 更新日志

## [未发布]
### ✨ 新增功能
- 功能A
- 功能B

### 🐛 问题修复  
- 修复A
- 修复B

## [1.1.0] - 2025-01-15
### ✨ 新增功能
- 历史功能...
```

## 🏗️ GitHub Release

### 自动创建Release

```bash
# 需要GitHub CLI认证
gh auth login

# 创建正式版本
npm run release:gh

# 创建预发布版本
npm run release:gh-draft
```

### 手动创建Release

1. 获取创建链接：
```bash
npm run release:info
```

2. 访问显示的GitHub链接

3. 填写Release信息：
   - **Tag version**: v1.x.x（已自动填入）
   - **Release title**: v1.x.x 或自定义标题
   - **Description**: 从CHANGELOG.md复制相关内容

4. 选择发布选项：
   - [ ] Set as a pre-release（预发布版本）
   - [ ] Set as the latest release（最新版本）

5. 点击 "Publish release"

## ✅ 发布前检查

### 必备检查清单

- [ ] **代码质量**
  - [ ] 代码已通过linting检查
  - [ ] 没有console.log等调试代码
  - [ ] 所有TODO已完成或记录
  
- [ ] **功能测试**  
  - [ ] 新功能已在本地测试
  - [ ] 修复的bug已验证
  - [ ] 应用可以正常启动和运行

- [ ] **构建验证**
  - [ ] `npm run build` 无错误
  - [ ] `npm run dist` 可以正常打包
  - [ ] Electron应用可以正常运行

- [ ] **版本信息**
  - [ ] package.json版本号正确
  - [ ] 提交信息符合约定式提交规范
  - [ ] CHANGELOG.md内容准确

- [ ] **Git状态**
  - [ ] 工作目录干净（无未提交变更）
  - [ ] 在正确的分支（通常是master）
  - [ ] 已拉取最新的远程代码

### 预发布测试

```bash
# 构建测试
npm run build
npm run electron

# 打包测试  
npm run dist
ls dist-electron/

# 变更日志预览
npm run changelog:preview
```

## 🚨 问题排查

### 常见问题及解决方案

#### Q1: 提交信息格式不正确
```bash
# 问题：提交信息不符合约定式提交规范
# 解决：修改最近的提交信息
git commit --amend -m "feat: correct commit message format"

# 或者重写多个提交
git rebase -i HEAD~3
```

#### Q2: 版本号错误
```bash
# 问题：版本号不正确
# 解决：手动修改package.json，然后重新发布
npm run version:patch  # 重新设置正确版本
```

#### Q3: GitHub CLI认证失败
```bash
# 问题：gh command requires authentication
# 解决方案1：认证GitHub CLI
gh auth login

# 解决方案2：使用手动创建
npm run release:info
# 然后访问显示的链接手动创建
```

#### Q4: 推送失败
```bash
# 问题：git push失败
# 解决：检查远程仓库状态
git fetch origin
git status

# 如果有冲突，先解决冲突
git pull --rebase origin master
```

#### Q5: 构建失败
```bash
# 问题：npm run build失败
# 解决：检查依赖和代码
npm install --legacy-peer-deps  # 如果是依赖问题
npm run build -- --verbose      # 查看详细错误信息
```

#### Q6: 变更日志生成问题
```bash
# 问题：CHANGELOG.md内容不正确
# 解决：手动编辑或重新生成
npm run changelog:all  # 重新生成完整变更日志

# 或手动编辑CHANGELOG.md文件
```

### 发布回滚

如果发布出现问题，可以进行回滚：

```bash
# 删除本地标签
git tag -d v1.x.x

# 删除远程标签
git push --delete origin v1.x.x

# 回退版本号
# 手动编辑package.json恢复版本号

# 回退CHANGELOG.md
git checkout HEAD~1 -- CHANGELOG.md

# 删除GitHub Release（在GitHub网页操作）
```

## 💡 最佳实践

### 发布频率建议

- **修订版本 (patch)**: 每1-2周，主要修复bug
- **次版本 (minor)**: 每月，添加新功能
- **主版本 (major)**: 每季度或更长，重大更改

### 版本命名约定

- `v1.0.0` - 正式版本
- `v1.0.0-alpha.1` - Alpha版本（内部测试）
- `v1.0.0-beta.1` - Beta版本（公开测试）
- `v1.0.0-rc.1` - Release Candidate（发布候选）

### 开发工作流示例

```bash
# 1. 创建功能分支（可选）
git checkout -b feature/user-dashboard

# 2. 开发和提交
git add .
git commit -m "feat: implement user dashboard layout"
git commit -m "feat: add user statistics widgets"
git commit -m "fix: resolve responsive design issue"

# 3. 合并到主分支（如果使用功能分支）
git checkout master
git merge feature/user-dashboard

# 4. 发布版本
npm run release:minor

# 5. 创建GitHub Release
npm run release:info
```

### 团队协作建议

1. **保持分支整洁**: 定期同步master分支
2. **规范提交信息**: 团队成员都应遵循约定式提交
3. **发布责任**: 指定专人负责版本发布
4. **测试验证**: 发布前进行充分测试
5. **文档同步**: 及时更新README和文档

## 📖 相关资源

- [约定式提交规范](https://conventionalcommits.org/)
- [语义化版本控制](https://semver.org/lang/zh-CN/)
- [Keep a Changelog](https://keepachangelog.com/zh-CN/)
- [GitHub CLI 文档](https://cli.github.com/manual/)
- [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)

## 🆘 获取帮助

如果在发布过程中遇到问题：

1. 查看本文档的问题排查章节
2. 检查项目的GitHub Issues
3. 查看相关工具的官方文档
4. 联系项目维护者

---

## 📋 版本发布记录

### v1.0.0 (2025-01-18) - Usage Monitor & Memory Editor Enhancement

#### ⚠ BREAKING CHANGES

* 移除了独立的 MemoryEditor 弹窗，改为内嵌式编辑

#### ✨ 新增功能

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

#### 🔧 改进

* **JSONL 解析优化**
  - 修复 50% 解析失败率问题
  - 添加智能错误恢复机制
  - 支持不完整 JSON 行修复
  - 跳过 summary 类型行

* **日志系统优化**
  - 环境变量控制的调试日志 (VITE_DEBUG=true)
  - 统一的 Logger 工具类
  - 减少生产环境日志噪音

#### 🐛 修复

* 修复 Model API 404 错误 - 统一前后端参数命名 (strategy -> model)
* 修复 Memory 编辑器高度过低问题 - 调整为 40vh
* 修复预览显示原始 Markdown 代码 - 集成 ReactMarkdown 渲染
* 修复重复的全局 Memory 预览区域

#### 📦 依赖更新

* 添加 react-markdown 和 remark 插件支持
* 添加 recharts 图表库
* 添加 multer 文件上传支持

---

*本文档会随着项目发展持续更新，请定期查看最新版本。*