# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version check functionality for automatic update notifications
- GitHub release scripts for automated version management
- Desktop-only UI optimized for Electron environment

### Changed
- Improved error handling for version check API calls
- Updated project structure for desktop-first approach

### Fixed
- ENOENT error when reading package.json in compiled app
- GitHub API 404 error handling for repositories without releases

## [1.0.1] - 2024-01-XX

### Added
- Version check functionality
- Update notification in sidebar

### Fixed
- Package.json path resolution in Electron environment

## [1.0.0] - 2024-01-XX

### Added
- Initial desktop release
- Electron-based Claude Code UI
- Project management and session handling
- WebSocket communication with Claude CLI
- File browser and editor integration
- Terminal integration for direct Claude CLI access
- MCP (Model Context Protocol) support
- Image upload functionality
- Theme management (light/dark mode)
- Settings management
- Session protection system

### Features
- **Desktop App**: Pure Electron application with embedded Node.js server
- **Project Discovery**: Automatic detection from `~/.claude/projects/`
- **Session Management**: Create, rename, delete, and organize conversations
- **File Operations**: Full CRUD support with backup creation
- **Real-time Updates**: Chokidar file watcher with WebSocket communication
- **Permission System**: Multiple modes including plan mode and bypass permissions
- **Multi-language Support**: Chinese language interface
- **Responsive Design**: Optimized for desktop use

### Technical
- Built with Electron, React, and Express
- Uses Vite for fast development builds
- Tailwind CSS for styling
- WebSocket for real-time communication
- SQLite integration via better-sqlite3
- PTY support for terminal integration