# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code UI Desktop is a pure Electron desktop application that provides a native interface for Claude Code CLI. Based on siteboon/claudecodeui, all web functionality has been removed to focus exclusively on desktop experience. The app features an embedded Express server running directly in Electron's main process, React frontend with Vite, and WebSocket-based real-time communication.

## Development Commands

```bash
# Primary Development
npm run electron-dev       # Build and run Electron in development mode (recommended)
npm run electron           # Run Electron app (requires build first)
npm run dist               # Create distributable package for current platform

# Build & Dependencies
npm run build              # Build React frontend for production
npm install                # Install all dependencies including Electron
npm rebuild                # Rebuild native dependencies for Electron

# Version & Release (uses Conventional Commits with Chinese changelog)
npm run version:patch       # Bump patch version (1.0.0 -> 1.0.1)
npm run version:minor       # Bump minor version (1.0.0 -> 1.1.0)  
npm run version:major       # Bump major version (1.0.0 -> 2.0.0)
npm run changelog           # Generate CHANGELOG.md from commits
npm run release:gh          # Create GitHub release with auto-generated notes

# Release workflow
npm run release:patch       # Auto-version, changelog, commit, tag, and push
```

## High-Level Architecture

### Embedded Server Architecture
The Express server runs directly in Electron's main process, not as a separate process:
- Server imports resolved at runtime: `await import(serverPath)` in `electron/main.js:213`
- Fixed port 3001 for desktop (no dynamic allocation)
- Server lifecycle automatically managed with Electron app
- No authentication layer - direct local communication only

### Session Protection System
Complex state management prevents WebSocket updates from interrupting active conversations:
- `activeSessions` Set tracks conversations in progress (`src/App.jsx:84-88`)
- Supports temporary session IDs (`new-session-*`) before real IDs assigned
- `isUpdateAdditive()` function distinguishes safe sidebar updates from disruptive changes
- 300ms debouncing on file system changes to prevent excessive updates

### WebSocket Architecture
Single server with URL-based routing:
- `/ws` endpoint: Chat messages, project updates, session management
- `/shell` endpoint: Direct Claude CLI terminal access with PTY
- Real-time project sync via chokidar file watcher
- No authentication required for desktop security model

### Critical API Client Pattern
**IMPORTANT**: Always use `apiFetch()` wrapper, never direct `fetch()`:
```javascript
// ✅ CORRECT - Will work in Electron
import { apiFetch } from './utils/api';
const response = await apiFetch('/api/projects');

// ❌ WRONG - Will fail with file:// protocol error
const response = await fetch('/api/projects');
```

The `apiFetch()` function (`src/utils/api.js`) automatically:
- Detects Electron environment and constructs proper URLs
- Sets appropriate headers (except for FormData)
- Handles base URL construction (`http://localhost:3001`)

### Permission Mode System
Visual color-coded permission levels in chat interface:
- **Gray**: Default/standard Claude Code operation
- **Green**: Auto-accept file modifications  
- **Orange**: Bypass permissions (danger warning - not red!)
- **Blue**: Planning mode with specialized tools
- **Red**: Completely disabled/error states

Plan mode automatically includes: Read, Task, exit_plan_mode, TodoRead, TodoWrite

### Usage Monitoring System
Complete offline usage analytics (`src/components/UsageMonitor/`):
- Real-time 5-hour window token tracking
- Daily usage analysis with cost calculation
- Monthly trend analysis
- Model strategy quick switcher (Default/Opus/Sonnet/Opus Plan)
- Multi-layer caching for performance

### Project Discovery & Management
Intelligent project detection from Claude sessions:
- JSONL parsing extracts project directories from `~/.claude/projects/`
- In-memory cache for directory extraction performance
- Smart fallback to most recent/frequent working directory
- Manual project addition via filesystem path
- Display names from package.json or path

### Image Upload System
Sophisticated temporary file handling:
- Multer middleware handles multipart/form-data (`server/index.js:779`)
- 5MB size limit for JPEG/PNG/GIF/WebP/SVG
- Temporary storage in `.tmp/images/` project subdirectory
- Base64 conversion for frontend display
- Automatic cleanup after Claude CLI session

### MCP Server Integration
Model Context Protocol server management:
- Auto-detects `~/.claude.json` configurations
- Uses `claude mcp list` command (without deprecated `-s` flag)
- Graceful fallback when no servers configured
- Passes `--mcp-config` flag only when MCP detected

## Key Implementation Details

### Native Module Dependencies
Platform-specific modules requiring special attention:
- `better-sqlite3`: Native database (run `npm rebuild` if issues)
- `node-pty`: Terminal PTY support (platform-specific)
- `sharp`: Image processing (optional, for build)
- `chokidar`: Cross-platform file watching

### Electron-Specific Considerations
- Dynamic ES module imports in main process
- PATH enhancement for Claude CLI access (`electron/main.js:151-207`)
- Chinese menu system with keyboard shortcuts
- DevTools disabled in production (`electron/main.js:46-76`)
- macOS titlebar handling and window management

### File System Integration
- Chokidar watcher with 300ms debounce
- Automatic backup creation on file edits
- Binary file serving with proper MIME types
- Permission handling and depth limiting in file tree

### Build Configuration
- Vite base path set to `'./'` for Electron compatibility
- All assets use relative paths
- Artifact naming: `${name}-${version}-${os}-${arch}.${ext}`
- Output directories: `dist/` (frontend), `dist-electron/` (packages)

## Common Development Issues

1. **Port Conflicts**: `scripts/start-electron.js` auto-kills port 3001 processes
2. **Build Missing**: Run `npm run build` before `npm run electron` if dist/ missing
3. **API Failures**: Ensure using `apiFetch()` not direct `fetch()`
4. **Native Modules**: Run `npm rebuild` for platform-specific dependencies
5. **Image Upload**: Check multer installed and temp directory writable
6. **MCP Errors**: Verify `~/.claude.json` exists and properly formatted

## Testing Approach

No automated tests - manual verification only:
- Development: `npm run electron-dev`
- Distribution: `npm run dist` then test installer
- Core features to verify: file browsing, Claude CLI integration, WebSocket communication, image upload

## Changelog Configuration

Uses Conventional Commits with Chinese sections (`.changelogrc.cjs`):
- Commit types: feat, fix, perf, docs, style, chore, refactor, test, build, ci, revert
- Auto-generates Chinese section headers (✨ 新增功能, 🐛 问题修复, etc.)
- Release workflow: version bump → changelog → commit → tag → push → GitHub release