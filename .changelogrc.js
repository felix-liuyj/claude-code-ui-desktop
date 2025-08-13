module.exports = {
  preset: 'conventionalcommits',
  releaseCommitMessageFormat: 'chore(release): {{currentTag}}',
  types: [
    { type: 'feat', section: '✨ Features' },
    { type: 'feature', section: '✨ Features' },
    { type: 'fix', section: '🐛 Bug Fixes' },
    { type: 'perf', section: '⚡ Performance Improvements' },
    { type: 'revert', section: '⏪ Reverts' },
    { type: 'docs', section: '📚 Documentation' },
    { type: 'style', section: '💄 Styles' },
    { type: 'chore', section: '🔧 Maintenance' },
    { type: 'refactor', section: '♻️ Code Refactoring' },
    { type: 'test', section: '✅ Tests' },
    { type: 'build', section: '👷 Build System' },
    { type: 'ci', section: '🔄 CI/CD' }
  ],
  commitUrlFormat: 'https://github.com/felix-liuyj/claude-code-ui-desktop/commit/{{hash}}',
  compareUrlFormat: 'https://github.com/felix-liuyj/claude-code-ui-desktop/compare/{{previousTag}}...{{currentTag}}',
  issueUrlFormat: 'https://github.com/felix-liuyj/claude-code-ui-desktop/issues/{{id}}',
  userUrlFormat: 'https://github.com/{{user}}',
  releaseCommitMessageFormat: 'chore(release): v{{currentTag}}',
  issuePrefixes: ['#'],
  ignoreReverted: false,
  ignoredAuthors: []
};