#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🚀 Starting Claude Code UI Desktop App...');

async function main() {
    // Port will be dynamically allocated in 30000-39999 range by Electron main process

    // Check if dist folder exists
    if (!existsSync(path.join(projectRoot, 'dist'))) {
        console.log('📦 Building application...');

        const buildProcess = spawn('npm', ['run', 'build'], {
            stdio: 'inherit',
            shell: true,
            cwd: projectRoot
        });

        buildProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Build completed successfully');
                startElectron();
            } else {
                console.error('❌ Build failed with code:', code);
                process.exit(1);
            }
        });
    } else {
        console.log('📁 Using existing build...');
        startElectron();
    }
}

main();

function startElectron() {
    console.log('🖥️  Starting Electron app...');

    const electronProcess = spawn('electron', ['.'], {
        stdio: 'inherit',
        shell: true,
        cwd: projectRoot,
        env: {
            ...process.env,
            NODE_ENV: 'development',
            ELECTRON_APP: 'true'
        }
    });

    electronProcess.on('close', (code) => {
        console.log(`👋 Electron app closed with code: ${ code }`);
        process.exit(code);
    });

    electronProcess.on('error', (error) => {
        console.error('❌ Failed to start Electron:', error);
        process.exit(1);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        electronProcess.kill();
    });
}