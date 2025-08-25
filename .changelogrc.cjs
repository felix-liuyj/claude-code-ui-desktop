const config = {
    types: [
        { type: 'feat', section: '✨ 新增功能' },
        { type: 'feature', section: '✨ 新增功能' },
        { type: 'fix', section: '🐛 问题修复' },
        { type: 'perf', section: '⚡ 性能优化' },
        { type: 'revert', section: '⏪ 代码回滚' },
        { type: 'docs', section: '📚 文档更新' },
        { type: 'style', section: '💄 代码样式' },
        { type: 'chore', section: '🔧 构建维护' },
        { type: 'refactor', section: '♻️ 代码重构' },
        { type: 'test', section: '✅ 测试相关' },
        { type: 'build', section: '👷 构建系统' },
        { type: 'ci', section: '🔄 持续集成' }
    ],
    commitIgnore: (commit) => {
        // 排除发布相关的 chore 提交
        return commit.type === 'chore' && commit.subject && commit.subject.includes('release v');
    },
    // 添加changelog生成配置
    releaseCommitMessageFormat: 'chore(release): {{currentTag}}',
    // 设置基础标签匹配
    tagPrefix: 'v'
};

module.exports = config;