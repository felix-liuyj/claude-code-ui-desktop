# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code UI Desktop is a pure desktop application for Claude Code CLI that provides a native Electron interface for AI-assisted coding sessions. This is a desktop-only version based on siteboon/claudecodeui, with all web functionality removed to focus on desktop experience. Built with Electron, it combines a React frontend and Node.js backend with integrated WebSocket communication.

## Development Commands

```bash
# Desktop Development (Primary)
npm run electron-dev       # Build and run Electron in development (recommended)
npm run electron           # Run Electron app (requires build first)
npm run electron-pack      # Build and package Electron app
npm run dist               # Create distributable Electron package for current platform

# Build Commands
npm run build              # Build React frontend for production
npm start                  # Start Electron app (alias for electron-dev)

# Dependencies & Setup
npm install                # Install all dependencies (includes Electron)
```

## Architecture

### Electron Desktop App

- **Main Process**: `electron/main.js` - Window management, menu, and backend integration
- **Preload Script**: `electron/preload.js` - Secure IPC bridge between main and renderer
- **Renderer Process**: React frontend running in Electron's Chromium renderer

### Frontend (React + Vite)

- **Main App**: `src/App.jsx` - Central router with session protection and Electron integration
- **Components**: Modular React components in `src/components/`
- **Context**: Theme and Electron providers in `src/contexts/`
- **Utils**: API client, WebSocket utilities, and Electron bridge in `src/utils/`
- **Electron Integration**: `src/utils/electron.js` - Native desktop features

### Backend (Node.js + Express) - Embedded in Electron

- **Main Server**: `server/index.js` - Express server with WebSocket support (runs in main process)
- **Claude CLI Integration**: `server/claude-cli.js` - Spawns and manages Claude processes
- **Project Management**: `server/projects.js` - Handles Claude project discovery
- **No Authentication**: Direct access for desktop application security
- **Port**: 3001 (fixed for Electron), dynamic for web mode

### Key Architecture Patterns

1. **Embedded Server Architecture**:
    - Express server runs directly in Electron main process (not as separate process)
    - Server imports are resolved at runtime: `await import(serverPath)`
    - Fixed port 3001 for desktop, dynamic for web mode
    - Automatic server lifecycle management with Electron app

2. **Dual Environment Support**:
    - Same codebase supports both Electron desktop and web deployment
    - Environment detection via `window.electronAPI` and `process.env.ELECTRON_APP`
    - Adaptive API endpoints and WebSocket connections based on environment

3. **Session Protection System** (`src/App.jsx:75-456`):
    - Prevents WebSocket project updates from clearing active chat messages
    - Uses `activeSessions` Set to track conversations in progress
    - Supports both real session IDs and temporary "new-session-*" identifiers
    - `isUpdateAdditive()` function allows sidebar updates while protecting active chats

4. **WebSocket Communication Architecture**:
    - Single WebSocket server with URL-based routing (`/ws` vs `/shell`)
    - `/ws` endpoint: Chat messages, project updates, session management
    - `/shell` endpoint: Direct Claude CLI terminal access with PTY
    - Real-time project synchronization via chokidar file system watcher

5. **Project Discovery & Management**:
    - Auto-discovery from `~/.claude/projects/` with metadata extraction
    - Chokidar-based file watcher with 300ms debouncing for performance
    - In-memory project directory cache with cache invalidation
    - Manual project addition via filesystem path input

## Environment Configuration

### Desktop App (Pure Desktop Version)

No environment configuration required - all settings are automatic:

- Server port: Fixed at 3001
- No authentication required for desktop security model  
- Build output: `dist/` directory for renderer, `dist-electron/` for packages
- No web mode support in this version

## Development Workflow

### Desktop App Development

1. **Prerequisites**: Node.js v20+, Claude Code CLI installed and configured
2. **Setup**: `npm install` (installs Electron and all dependencies)
3. **Development**: `npm run electron-dev` builds and launches desktop app
4. **Building**: `npm run dist` creates distributable packages for your platform
5. **Start Script**: `scripts/start-electron.js` handles build detection and port cleanup

## Key Files

### Electron Desktop App

- `electron/main.js`: Electron main process with window management and embedded server
- `electron/preload.js`: Secure IPC bridge between main and renderer processes  
- `src/utils/electron.js`: Electron integration utilities and context
- `scripts/start-electron.js`: Development startup script with build detection and port cleanup

### Core Application

- `server/index.js`: Main server with API routes and WebSocket handlers (desktop-only mode)
- `src/App.jsx`: Main React component with routing, session management, and Electron integration
- `server/projects.js`: Claude project discovery and management with caching
- `server/claude-cli.js`: Claude CLI process spawning and communication with image handling
- `server/routes/`: API route handlers for git and MCP integration
- `vite.config.js`: Frontend build configuration optimized for Electron

## Important Implementation Details

### Session Protection System

The app implements a sophisticated system to prevent WebSocket updates from interrupting active conversations:

- **Active Session Tracking**: `activeSessions` Set in `src/App.jsx:79`
- **Temporary Session Handling**: Supports "new-session-*" identifiers before real IDs are assigned
- **Update Filtering**: `isUpdateAdditive()` function distinguishes between safe sidebar updates and disruptive content
  changes
- **Lifecycle Management**: Sessions marked active on message send, inactive on completion/abort

### File System Integration

- **Project Directory Extraction**: `server/projects.js` handles complex project path resolution
- **File Tree Generation**: Recursive directory traversal with permission handling and depth limiting
- **File Operations**: Full CRUD support with backup creation for safety
- **Binary File Serving**: Proper MIME type detection and streaming for images/assets

### WebSocket Architecture

- **Single Server, Dual Routing**: URL-based routing (`/ws` vs `/shell`) within one WebSocket server
- **Terminal Integration**: PTY spawning for real Claude CLI access with proper environment setup
- **Direct Connection**: WebSocket connections without authentication for desktop security
- **Real-time Updates**: Chokidar file watcher with optimized debouncing and filtering

## API Client Architecture

### API Utilities (`src/utils/api.js`)

The application uses a centralized API client system:

- **`apiFetch()` Function**: Wrapper around native fetch with automatic URL construction
- **Base URL Detection**: Automatically detects Electron environment and constructs `http://localhost:3001`
- **Header Management**: Automatically sets JSON Content-Type except for FormData uploads
- **Environment Adaptation**: Uses `window.electronAPI?.getConfig?.()?.PORT` for port detection

**Critical Implementation Note**: Always use `apiFetch()` instead of direct `fetch()` calls to ensure proper URL
construction in Electron environment. Direct fetch calls will resolve to `file://` protocol and fail.

### MCP (Model Context Protocol) Integration

The application includes MCP server management capabilities:

- **CLI Integration**: Routes in `server/routes/mcp.js` interface with Claude CLI for MCP server management
- **Graceful Fallback**: When Claude CLI is not available, returns empty server lists instead of errors
- **Command Format**: Uses `claude mcp list` (without deprecated `-s` flag) for server discovery
- **Error Handling**: Implements robust error handling with JSON responses, avoiding HTML error pages

## Image Upload System

### Upload Architecture

- **Multer Integration**: Uses multer for handling multipart form data in `server/index.js:779`
- **Temporary Storage**: Files stored in OS temp directory (`os.tmpdir()`)
- **Format Support**: JPEG, PNG, GIF, WebP, SVG with 5MB file size limit
- **Base64 Conversion**: Images converted to base64 data URLs for frontend display
- **Automatic Cleanup**: Temporary files deleted immediately after processing

### Usage Pattern

```javascript
const formData = new FormData();
attachedImages.forEach(file => formData.append('images', file));
const response = await api.uploadImages(projectName, formData);
```

## Permission System

The application includes a sophisticated permission mode system in the chat interface:

### Permission Modes

- **default**: Standard Claude Code operation (gray indicator)
- **acceptEdits**: Auto-accept file modifications (green indicator)
- **bypassPermissions**: Skip all permission checks (orange indicator - danger warning)
- **plan**: Planning mode (blue indicator)

### UI Color Coding

- **Gray**: Default/safe operations
- **Green**: Auto-accept modes
- **Orange**: Dangerous/bypass modes (warning color)
- **Red**: Completely disabled/error states

**Important**: The `bypassPermissions` mode uses orange coloring as a visual warning for dangerous operations.

## Claude CLI Integration

### Image Upload System

The application supports image uploads through a sophisticated temporary file system:

- **Multer Integration**: Handles multipart form data with 5MB file size limit
- **Temporary Storage**: Images saved to `.tmp/images/` in project directory
- **Base64 Processing**: Converts uploaded images to base64, then back to files for Claude CLI
- **Format Support**: JPEG, PNG, GIF, WebP, SVG
- **Automatic Cleanup**: Temporary files deleted after Claude CLI session ends

### MCP Server Integration

- **Auto-Detection**: Scans `~/.claude.json` for MCP server configurations
- **Global & Project Servers**: Supports both global and project-specific MCP servers
- **Graceful Fallback**: Works without MCP if no servers configured
- **Configuration Path**: Passes `--mcp-config` flag only when MCP servers detected

### Tools & Permission Management

- **Permission Modes**: default, acceptEdits, bypassPermissions, plan
- **Plan Mode Tools**: Automatically includes Read, Task, exit_plan_mode, TodoRead, TodoWrite
- **Tools Settings**: Frontend manages allowed/disallowed tools list
- **Skip Permissions**: Uses `--dangerously-skip-permissions` when enabled

## Project Discovery & Management

### Intelligent Project Detection

- **JSONL Parsing**: Analyzes Claude session files to extract project directories
- **Caching System**: In-memory cache for project directory extraction (performance)
- **Smart Fallback**: Uses most recent or most frequently used working directory
- **Manual Addition**: Supports adding projects by filesystem path
- **Display Names**: Auto-generates from package.json or path, with custom override support

## Development Debugging

### Common Issues & Solutions

1. **MCP API Errors**: Ensure `apiFetch()` is used instead of direct `fetch()` calls
2. **Image Upload Failures**: Check that multer dependency is installed (`npm install multer`)  
3. **WebSocket Connection Issues**: Verify port 3001 is available and server is running
4. **File Path Resolution**: Use absolute paths in API calls, relative paths may fail in Electron
5. **Build Issues**: Run `npm run build` before `npm run electron` if dist/ doesn't exist
6. **Port Conflicts**: `scripts/start-electron.js` automatically kills processes on port 3001

### Electron-Specific Considerations

- **Dynamic Imports**: Server uses dynamic imports at runtime for embedded architecture
- **Path Resolution**: Server runs in main process with different path context than renderer
- **Security**: Electron apps run with node integration, requiring careful handling of external data
- **Menu Integration**: Chinese language menu system with keyboard shortcuts
- **Window Management**: macOS-specific titlebar handling and proper window sizing