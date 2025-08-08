# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code UI is a desktop application for Claude Code CLI that provides a native interface for AI-assisted coding
sessions. Built with Electron, it combines a React frontend and Node.js backend with integrated WebSocket communication.

## Development Commands

```bash
# Web Development Mode (Legacy)
npm run dev                 # Start both frontend and backend for web
npm run server             # Start backend server only
npm run client             # Start frontend client only (Vite dev server)
npm run build              # Build React frontend for production
npm run start              # Start production web server
npm run preview            # Preview production build locally

# Electron Desktop App (Primary Development Focus)
npm run electron           # Run Electron app (requires build first)
npm run electron-dev       # Build and run Electron in development (recommended)
npm run electron-pack      # Build and package Electron app
npm run dist               # Create distributable Electron package for current platform

# Dependencies & Setup
npm install                # Install all dependencies (includes Electron)
cp .env.example .env       # Configure environment (for web mode only)
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

### Desktop App (Electron)

No environment configuration required - all settings are automatic:

- Server port: Fixed at 3001
- No authentication required for desktop security model
- Build output: `dist/` directory for renderer, `dist-electron/` for packages

### Web Mode (Legacy)

Copy `.env.example` to `.env` and configure:

- `PORT=3001` - Backend server port (can be changed)
- `VITE_PORT=5173` - Frontend development port
- No authentication database required for desktop security model

## Development Workflow

### Desktop App Development

1. **Prerequisites**: Node.js v20+, Claude Code CLI installed and configured
2. **Setup**: `npm install` (installs Electron and all dependencies)
3. **Development**: `npm run electron-dev` builds and launches desktop app
4. **Building**: `npm run dist` creates distributable packages for your platform

### Web Development (Legacy)

1. **Setup**: `npm install`, `cp .env.example .env`
2. **Development**: `npm run dev` starts both frontend and backend for web
3. **File Structure**: Frontend proxies API calls to backend during development

## Key Files

### Electron Desktop App

- `electron/main.js`: Electron main process with window management and embedded server
- `electron/preload.js`: Secure IPC bridge between main and renderer processes
- `src/utils/electron.js`: Electron integration utilities and context

### Core Application

- `server/index.js`: Main server with API routes and WebSocket handlers (dual mode)
- `src/App.jsx`: Main React component with routing, session management, and Electron integration
- `server/projects.js`: Claude project discovery and management with caching
- `server/claude-cli.js`: Claude CLI process spawning and communication
- `server/routes/`: API route handlers for git and MCP integration
- `server/database/`: SQLite database setup and management
- `vite.config.js`: Frontend build configuration with Electron support

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