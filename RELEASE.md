# 发布指南 (Release Guide)

本项目使用自动化的版本发布系统，每次发布都会自动生成版本变更日志。

## 🚀 快速发布

### 一键发布命令：
```bash
# 修订版本发布 (1.0.0 → 1.0.1)
npm run release:patch

# 次版本发布 (1.0.0 → 1.1.0)  
npm run release:minor

# 主版本发布 (1.0.0 → 2.0.0)
npm run release:major
```

## 📝 提交信息规范

为了自动生成高质量的变更日志，请遵循[约定式提交](https://conventionalcommits.org/)规范：

### 提交类型：
- `feat:` ✨ 新功能
- `fix:` 🐛 修复bug
- `docs:` 📚 文档更新
- `style:` 💄 代码样式修改
- `refactor:` ♻️ 代码重构
- `perf:` ⚡ 性能优化
- `test:` ✅ 测试相关
- `chore:` 🔧 维护工作
- `build:` 👷 构建系统
- `ci:` 🔄 CI/CD相关

### 示例提交信息：
```bash
git commit -m "feat: add dark mode toggle functionality"
git commit -m "fix: resolve memory leak in WebSocket connection"
git commit -m "docs: update installation instructions"
git commit -m "refactor: improve file upload performance"
```

## 📋 发布流程详解

### 自动执行的步骤：
1. **生成变更日志** - 基于约定式提交自动生成 CHANGELOG.md
2. **构建项目** - 运行 `npm run build`
3. **更新版本号** - 自动递增版本号
4. **Git操作** - 提交变更、创建标签、推送到远程
5. **生成发布链接** - 显示GitHub Release创建链接

### 手动步骤（可选）：
```bash
# 创建GitHub Release（需要GitHub CLI认证）
npm run release:gh

# 或创建草稿版本
npm run release:gh-draft
```

## 🔧 变更日志管理

### 变更日志相关命令：
```bash
# 预览即将生成的变更日志
npm run changelog:preview

# 生成增量变更日志
npm run changelog

# 重新生成完整变更日志
npm run changelog:all
```

### 变更日志特性：
- **自动分类** - 按类型组织提交（功能、修复、文档等）
- **链接生成** - 自动生成GitHub提交和比较链接
- **emoji支持** - 每种类型都有对应的emoji图标
- **版本标记** - 自动标记版本号和发布日期

## 📚 版本管理命令

### 仅更新版本号（不发布）：
```bash
npm run version:patch    # 1.0.0 → 1.0.1
npm run version:minor    # 1.0.0 → 1.1.0  
npm run version:major    # 1.0.0 → 2.0.0
```

### 分步发布：
```bash
# 1. 更新版本号
npm run version:patch

# 2. 生成变更日志并推送
npm run release

# 3. 获取GitHub Release创建链接
npm run release:info

# 4. 手动创建GitHub Release或使用CLI
npm run release:gh
```

## 🎯 最佳实践

### 发布前检查清单：
- [ ] 确保所有测试通过
- [ ] 检查构建无错误
- [ ] 提交信息符合约定式提交规范
- [ ] 已经在本地测试新功能

### 发布频率建议：
- **修订版本 (patch)**: 修复bug、小改进
- **次版本 (minor)**: 新功能、API改进
- **主版本 (major)**: 重大更改、破坏性变更

### 示例工作流：
```bash
# 开发新功能
git add .
git commit -m "feat: add user profile management"

# 修复问题
git add .
git commit -m "fix: resolve login form validation issue"

# 发布新版本
npm run release:minor

# 查看发布信息
npm run release:info
```

## 🔗 相关工具

- [Conventional Commits](https://conventionalcommits.org/) - 提交信息规范
- [Semantic Versioning](https://semver.org/) - 版本号语义
- [Keep a Changelog](https://keepachangelog.com/) - 变更日志格式
- [GitHub CLI](https://cli.github.com/) - GitHub命令行工具

## 📞 问题排查

### 常见问题：

**Q: 提交信息不符合规范怎么办？**
A: 变更日志仍会生成，但可能分类不准确。建议使用 `git commit --amend` 修改最近的提交信息。

**Q: GitHub CLI认证失败？**
A: 运行 `gh auth login` 进行认证，或使用 `npm run release:info` 获取手动创建Release的链接。

**Q: 版本号错误？**
A: 可以手动编辑 package.json 中的版本号，然后重新运行发布命令。

**Q: 如何跳过某些提交？**
A: 在提交信息中添加 `[skip ci]` 或修改 `.changelogrc.js` 配置文件。