import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Use cross-spawn on Windows for better command execution
const spawnFunction = process.platform === 'win32' ? crossSpawn : spawn;

let activeClaudeProcesses = new Map(); // Track active processes by session ID

async function spawnClaude(command, options = {}, ws) {
    return new Promise(async (resolve, reject) => {
        const { sessionId, projectPath, cwd, resume, toolsSettings, permissionMode, images, background, smartCommit } = options;
        let capturedSessionId = sessionId; // Track session ID throughout the process
        let sessionCreatedSent = false; // Track if we've already sent session-created event

        // Use tools settings passed from frontend, or defaults
        const settings = toolsSettings || {
            allowedTools: [],
            disallowedTools: [],
            skipPermissions: false
        };

        // Build Claude CLI command - start with print/resume flags first
        const args = [];

        // Add print flag with command if we have a command
        if (command && command.trim()) {

            // Separate arguments for better cross-platform compatibility
            // This prevents issues with spaces and quotes on Windows
            args.push('--print');
            args.push(command);
        }

        // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
        const workingDir = cwd || process.cwd();

        // Handle images by saving them to temporary files and passing paths to Claude
        const tempImagePaths = [];
        let tempDir = null;
        if (images && images.length > 0) {
            try {
                // Create temp directory in the project directory so Claude can access it
                tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
                await fs.mkdir(tempDir, { recursive: true });

                // Save each image to a temp file
                for (const [index, image] of images.entries()) {
                    // Extract base64 data and mime type
                    const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
                    if (!matches) {
                        console.error('Invalid image data format');
                        continue;
                    }

                    const [, mimeType, base64Data] = matches;
                    const extension = mimeType.split('/')[1] || 'png';
                    const filename = `image_${ index }.${ extension }`;
                    const filepath = path.join(tempDir, filename);

                    // Write base64 data to file
                    await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
                    tempImagePaths.push(filepath);
                }

                // Include the full image paths in the prompt for Claude to reference
                // Only modify the command if we actually have images and a command
                if (tempImagePaths.length > 0 && command && command.trim()) {
                    const imageNote = `\n\n[Images provided at the following paths:]\n${ tempImagePaths.map((p, i) => `${ i + 1 }. ${ p }`).join('\n') }`;
                    const modifiedCommand = command + imageNote;

                    // Update the command in args - now that --print and command are separate
                    const printIndex = args.indexOf('--print');
                    if (printIndex !== -1 && printIndex + 1 < args.length && args[printIndex + 1] === command) {
                        args[printIndex + 1] = modifiedCommand;
                    }
                }


            } catch (error) {
                console.error('Error processing images for Claude:', error);
            }
        }

        // Add resume flag if resuming
        if (resume && sessionId) {
            args.push('--resume', sessionId);
        }

        // Add basic flags
        args.push('--output-format', 'stream-json', '--verbose');

        // Add MCP config flag only if MCP servers are configured
        try {
            console.log('🔍 Starting MCP config check...');
            // Use already imported modules (fs.promises is imported as fs, path, os)
            const fsSync = await import('fs'); // Import synchronous fs methods
            console.log('✅ Successfully imported fs sync methods');

            // Check for MCP config in ~/.claude.json
            const claudeConfigPath = path.join(os.homedir(), '.claude.json');

            console.log(`🔍 Checking for MCP configs in: ${ claudeConfigPath }`);
            console.log(`  Claude config exists: ${ fsSync.existsSync(claudeConfigPath) }`);

            let hasMcpServers = false;

            // Check Claude config for MCP servers
            if (fsSync.existsSync(claudeConfigPath)) {
                try {
                    const claudeConfig = JSON.parse(fsSync.readFileSync(claudeConfigPath, 'utf8'));

                    // Check global MCP servers
                    if (claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0) {
                        console.log(`✅ Found ${ Object.keys(claudeConfig.mcpServers).length } global MCP servers`);
                        hasMcpServers = true;
                    }

                    // Check project-specific MCP servers
                    if (!hasMcpServers && claudeConfig.claudeProjects) {
                        const currentProjectPath = process.cwd();
                        const projectConfig = claudeConfig.claudeProjects[currentProjectPath];
                        if (projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0) {
                            console.log(`✅ Found ${ Object.keys(projectConfig.mcpServers).length } project MCP servers`);
                            hasMcpServers = true;
                        }
                    }
                } catch (e) {
                    console.log(`❌ Failed to parse Claude config:`, e.message);
                }
            }

            console.log(`🔍 hasMcpServers result: ${ hasMcpServers }`);

            if (hasMcpServers) {
                // Use Claude config file if it has MCP servers
                let configPath = null;

                if (fsSync.existsSync(claudeConfigPath)) {
                    try {
                        const claudeConfig = JSON.parse(fsSync.readFileSync(claudeConfigPath, 'utf8'));

                        // Check if we have any MCP servers (global or project-specific)
                        const hasGlobalServers = claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0;
                        const currentProjectPath = process.cwd();
                        const projectConfig = claudeConfig.claudeProjects && claudeConfig.claudeProjects[currentProjectPath];
                        const hasProjectServers = projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0;

                        if (hasGlobalServers || hasProjectServers) {
                            configPath = claudeConfigPath;
                        }
                    } catch (e) {
                        // No valid config found
                    }
                }

                if (configPath) {
                    console.log(`📡 Adding MCP config: ${ configPath }`);
                    args.push('--mcp-config', configPath);
                } else {
                    console.log('⚠️ MCP servers detected but no valid config file found');
                }
            }
        } catch (error) {
            // If there's any error checking for MCP configs, don't add the flag
            console.log('❌ MCP config check failed:', error.message);
            console.log('📍 Error stack:', error.stack);
            console.log('Note: MCP config check failed, proceeding without MCP support');
        }

        // Add model for new sessions
        if (!resume) {
            args.push('--model', 'sonnet');
        }

        // We'll append --permission-mode later only if not using dangerous skip

        // Add tools settings flags
        // When dangerous skip is enabled, always use it and ignore permission mode
        if (settings.skipPermissions) {
            args.push('--dangerously-skip-permissions');
            console.log('⚠️  Using --dangerously-skip-permissions (skipping other tool settings and effectively ignoring permission mode)');
        } else {
            // Only add allowed/disallowed tools if not skipping permissions
            // And also add permission mode here when not skipping
            if (permissionMode && permissionMode !== 'default') {
                args.push('--permission-mode', permissionMode);
                console.log('🔒 Using permission mode:', permissionMode);
            }

            // Collect all allowed tools, including plan mode defaults
            let allowedTools = [...(settings.allowedTools || [])];

            // Add plan mode specific tools
            if (permissionMode === 'plan') {
                const planModeTools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite'];
                // Add plan mode tools that aren't already in the allowed list
                for (const tool of planModeTools) {
                    if (!allowedTools.includes(tool)) {
                        allowedTools.push(tool);
                    }
                }
                console.log('📝 Plan mode: Added default allowed tools:', planModeTools);
            }

            // Add allowed tools
            if (allowedTools.length > 0) {
                for (const tool of allowedTools) {
                    args.push('--allowedTools', tool);
                    console.log('✅ Allowing tool:', tool);
                }
            }

            // Add disallowed tools
            if (settings.disallowedTools && settings.disallowedTools.length > 0) {
                for (const tool of settings.disallowedTools) {
                    args.push('--disallowedTools', tool);
                    console.log('❌ Disallowing tool:', tool);
                }
            }

            // No-op
        }

        console.log('Spawning Claude CLI:', 'claude', args.map(arg => {
            const cleanArg = arg.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            return cleanArg.includes(' ') ? `"${ cleanArg }"` : cleanArg;
        }).join(' '));
        console.log('Working directory:', workingDir);
        console.log('Session info - Input sessionId:', sessionId, 'Resume:', resume);
        console.log('🔍 Full command args:', JSON.stringify(args, null, 2));
        console.log('🔍 Final Claude command will be: claude ' + args.join(' '));

        const claudeProcess = spawnFunction('claude', args, {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env } // Inherit all environment variables
        });

        // Attach temp file info to process for cleanup later
        claudeProcess.tempImagePaths = tempImagePaths;
        claudeProcess.tempDir = tempDir;

        // Store process reference for potential abort
        const processKey = capturedSessionId || sessionId || Date.now().toString();
        activeClaudeProcesses.set(processKey, claudeProcess);

        // Handle stdout (streaming JSON responses)
        claudeProcess.stdout.on('data', (data) => {
            const rawOutput = data.toString();
            console.log('📤 Claude CLI stdout:', rawOutput);

            const lines = rawOutput.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const response = JSON.parse(line);
                    console.log('📄 Parsed JSON response:', response);

                    // Check for usage limit in parsed response
                    if (response.message && response.message.content) {
                        let usageLimitDetected = false;
                        
                        if (Array.isArray(response.message.content)) {
                            for (const part of response.message.content) {
                                if (part.type === 'text' && part.text && part.text.includes('Claude AI usage limit reached|')) {
                                    usageLimitDetected = true;
                                    break;
                                }
                            }
                        } else if (typeof response.message.content === 'string' && response.message.content.includes('Claude AI usage limit reached|')) {
                            usageLimitDetected = true;
                        }
                        
                        if (usageLimitDetected) {
                            console.log('🚫 Usage limit detected, terminating Claude process');
                            // Send the response first so client can show the error
                            ws.send(JSON.stringify({
                                type: 'claude-response',
                                data: response
                            }));
                            // Then immediately terminate the process
                            claudeProcess.kill('SIGTERM');
                            return;
                        }
                    }

                    // Capture session ID if it's in the response
                    if (response.session_id && !capturedSessionId) {
                        capturedSessionId = response.session_id;
                        console.log('📝 Captured session ID:', capturedSessionId);

                        // Update process key with captured session ID
                        if (processKey !== capturedSessionId) {
                            activeClaudeProcesses.delete(processKey);
                            activeClaudeProcesses.set(capturedSessionId, claudeProcess);
                        }

                        // Send session-created event only once for new sessions (but not for smart commits)
                        if (!sessionId && !sessionCreatedSent && !smartCommit) {
                            sessionCreatedSent = true;
                            ws.send(JSON.stringify({
                                type: 'session-created',
                                sessionId: capturedSessionId
                            }));
                        }
                    }

                    // Clean Claude Code signatures from response data for smart commits
                    if (smartCommit && response) {
                        console.log('[SmartCommit] Cleaning Claude signatures from response');
                        
                        // Helper function to clean Claude signatures from text
                        const cleanClaudeSignatures = (text) => {
                            if (!text || typeof text !== 'string') return text;
                            
                            let cleaned = text;
                            
                            // Remove Claude Code signature variations
                            cleaned = cleaned.replace(/🤖\s*Generated with \[Claude Code\]\([^)]+\)/gi, '');
                            cleaned = cleaned.replace(/Generated with \[Claude Code\]\([^)]+\)/gi, '');
                            cleaned = cleaned.replace(/🤖\s*Generated with Claude Code/gi, '');
                            
                            // Remove Co-Authored-By variations
                            cleaned = cleaned.replace(/Co-Authored-By:\s*Claude\s*<[^>]+>/gi, '');
                            cleaned = cleaned.replace(/Co-Authored-By:\s*Claude\s*/gi, '');
                            
                            // Remove any standalone Claude signatures
                            cleaned = cleaned.replace(/^\s*🤖\s*$/gm, '');
                            cleaned = cleaned.replace(/^\s*Claude\s*$/gm, '');
                            
                            // Clean up excessive whitespace and newlines
                            cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
                            cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // trim
                            
                            return cleaned;
                        };

                        // Clean signatures from all possible text fields
                        if (response.stdout) {
                            const originalStdout = response.stdout;
                            response.stdout = cleanClaudeSignatures(response.stdout);
                            if (originalStdout !== response.stdout) {
                                console.log('[SmartCommit] Cleaned signatures from stdout');
                            }
                        }
                        
                        // Also clean from message content if it exists
                        if (response.message && response.message.content) {
                            if (Array.isArray(response.message.content)) {
                                response.message.content = response.message.content.map(part => {
                                    if (part.type === 'text' && part.text) {
                                        const originalText = part.text;
                                        const cleanedText = cleanClaudeSignatures(part.text);
                                        if (originalText !== cleanedText) {
                                            console.log('[SmartCommit] Cleaned signatures from message content array');
                                        }
                                        return { ...part, text: cleanedText };
                                    }
                                    return part;
                                });
                            } else if (typeof response.message.content === 'string') {
                                const originalContent = response.message.content;
                                response.message.content = cleanClaudeSignatures(response.message.content);
                                if (originalContent !== response.message.content) {
                                    console.log('[SmartCommit] Cleaned signatures from message content string');
                                }
                            }
                        }
                        
                        // Clean from stderr if it exists
                        if (response.stderr) {
                            const originalStderr = response.stderr;
                            response.stderr = cleanClaudeSignatures(response.stderr);
                            if (originalStderr !== response.stderr) {
                                console.log('[SmartCommit] Cleaned signatures from stderr');
                            }
                        }
                        
                        // Clean from any other text fields that might contain the signature
                        if (response.text) {
                            const originalText = response.text;
                            response.text = cleanClaudeSignatures(response.text);
                            if (originalText !== response.text) {
                                console.log('[SmartCommit] Cleaned signatures from text field');
                            }
                        }
                        
                        // Clean from tool results if they exist
                        if (response.tool_result && response.tool_result.output) {
                            const originalOutput = response.tool_result.output;
                            response.tool_result.output = cleanClaudeSignatures(response.tool_result.output);
                            if (originalOutput !== response.tool_result.output) {
                                console.log('[SmartCommit] Cleaned signatures from tool result output');
                            }
                        }
                    }

                    // Send parsed response to WebSocket
                    ws.send(JSON.stringify({
                        type: 'claude-response',
                        data: response,
                        sessionId: capturedSessionId,
                        background: background,
                        smartCommit: smartCommit
                    }));
                } catch (parseError) {
                    console.log('📄 Non-JSON response:', line);
                    
                    // Check for usage limit in non-JSON response
                    if (line.includes('Claude AI usage limit reached|')) {
                        console.log('🚫 Usage limit detected in raw output, terminating Claude process');
                        // Send the response first so client can show the error
                        ws.send(JSON.stringify({
                            type: 'claude-output',
                            data: line
                        }));
                        // Then immediately terminate the process
                        claudeProcess.kill('SIGTERM');
                        return;
                    }
                    
                    // If not JSON, send as raw text
                    ws.send(JSON.stringify({
                        type: 'claude-output',
                        data: line
                    }));
                }
            }
        });

        // Handle stderr
        claudeProcess.stderr.on('data', (data) => {
            console.error('Claude CLI stderr:', data.toString());
            
            // For smart commits, ensure we always send the correct session ID
            const responseSessionId = capturedSessionId || sessionId;
            
            ws.send(JSON.stringify({
                type: 'claude-error',
                error: data.toString(),
                sessionId: responseSessionId,
                background: background,
                smartCommit: smartCommit
            }));
        });

        // Handle process completion
        claudeProcess.on('close', async (code) => {
            console.log(`Claude CLI process exited with code ${ code }`);

            // For smart commits, clean up commit message after git commit
            if (smartCommit && code === 0) {
                try {
                    console.log('[SmartCommit] Post-processing: cleaning commit message');
                    
                    // Import spawn for git operations
                    const { spawn } = await import('child_process');
                    
                    // Check if we just made a commit by looking at git log
                    const gitLogProcess = spawn('git', ['log', '--format=%B', '-n', '1'], {
                        cwd: workingDir,
                        stdio: ['pipe', 'pipe', 'pipe']
                    });
                    
                    let commitMessage = '';
                    gitLogProcess.stdout.on('data', (data) => {
                        commitMessage += data.toString();
                    });
                    
                    await new Promise((resolve) => {
                        gitLogProcess.on('close', async (logCode) => {
                            if (logCode === 0 && commitMessage.trim()) {
                                // Check if commit message contains Claude signatures
                                const hasSignature = commitMessage.includes('Generated with [Claude Code]') || 
                                                   commitMessage.includes('Co-Authored-By: Claude');
                                
                                if (hasSignature) {
                                    console.log('[SmartCommit] Found Claude signature in commit, cleaning...');
                                    
                                    // Clean the commit message
                                    let cleanedMessage = commitMessage
                                        .replace(/🤖\s*Generated with \[Claude Code\]\([^)]+\)/gi, '')
                                        .replace(/Generated with \[Claude Code\]\([^)]+\)/gi, '')
                                        .replace(/🤖\s*Generated with Claude Code/gi, '')
                                        .replace(/Co-Authored-By:\s*Claude\s*<[^>]+>/gi, '')
                                        .replace(/Co-Authored-By:\s*Claude\s*/gi, '')
                                        .replace(/^\s*🤖\s*$/gm, '')
                                        .replace(/^\s*Claude\s*$/gm, '')
                                        .replace(/\n\s*\n\s*\n+/g, '\n\n')
                                        .trim();
                                    
                                    // Amend the commit with cleaned message
                                    const gitAmendProcess = spawn('git', ['commit', '--amend', '-m', cleanedMessage], {
                                        cwd: workingDir,
                                        stdio: ['pipe', 'pipe', 'pipe']
                                    });
                                    
                                    gitAmendProcess.on('close', (amendCode) => {
                                        if (amendCode === 0) {
                                            console.log('[SmartCommit] Successfully cleaned commit message');
                                        } else {
                                            console.log('[SmartCommit] Failed to amend commit message');
                                        }
                                        resolve();
                                    });
                                } else {
                                    console.log('[SmartCommit] No Claude signature found in commit');
                                    resolve();
                                }
                            } else {
                                console.log('[SmartCommit] Failed to read commit message');
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    console.error('[SmartCommit] Error during post-processing:', error);
                }
            }

            // Clean up process reference
            const finalSessionId = capturedSessionId || sessionId || processKey;
            activeClaudeProcesses.delete(finalSessionId);

            // For smart commits, ensure we always send the correct session ID
            // Use the original sessionId (from frontend) if capturedSessionId is not available
            const responseSessionId = capturedSessionId || sessionId;
            
            console.log('[SmartCommit] Sending claude-complete:', {
                exitCode: code,
                sessionId: responseSessionId,
                originalSessionId: sessionId,
                capturedSessionId: capturedSessionId,
                smartCommit: smartCommit
            });

            ws.send(JSON.stringify({
                type: 'claude-complete',
                exitCode: code,
                sessionId: responseSessionId,
                background: background,
                smartCommit: smartCommit,
                isNewSession: !sessionId && !!command // Flag to indicate this was a new session
            }));

            // Clean up temporary image files if any
            if (claudeProcess.tempImagePaths && claudeProcess.tempImagePaths.length > 0) {
                for (const imagePath of claudeProcess.tempImagePaths) {
                    await fs.unlink(imagePath).catch(err =>
                        console.error(`Failed to delete temp image ${ imagePath }:`, err)
                    );
                }
                if (claudeProcess.tempDir) {
                    await fs.rm(claudeProcess.tempDir, { recursive: true, force: true }).catch(err =>
                        console.error(`Failed to delete temp directory ${ claudeProcess.tempDir }:`, err)
                    );
                }
            }

            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Claude CLI exited with code ${ code }`));
            }
        });

        // Handle process errors
        claudeProcess.on('error', (error) => {
            console.error('Claude CLI process error:', error);

            // Clean up process reference on error
            const finalSessionId = capturedSessionId || sessionId || processKey;
            activeClaudeProcesses.delete(finalSessionId);

            // For smart commits, ensure we always send the correct session ID
            const responseSessionId = capturedSessionId || sessionId;

            ws.send(JSON.stringify({
                type: 'claude-error',
                error: error.message,
                sessionId: responseSessionId,
                background: background,
                smartCommit: smartCommit
            }));

            reject(error);
        });

        // Handle stdin for interactive mode
        if (command) {
            // For --print mode with arguments, we don't need to write to stdin
            claudeProcess.stdin.end();
        } else {
            // For interactive mode, we need to write the command to stdin if provided later
            // Keep stdin open for interactive session
            if (command !== undefined) {
                claudeProcess.stdin.write(command + '\n');
                claudeProcess.stdin.end();
            }
            // If no command provided, stdin stays open for interactive use
        }
    });
}

function abortClaudeSession(sessionId) {
    const process = activeClaudeProcesses.get(sessionId);
    if (process) {
        console.log(`🛑 Aborting Claude session: ${ sessionId }`);
        process.kill('SIGTERM');
        activeClaudeProcesses.delete(sessionId);
        return true;
    }
    return false;
}

export {
    spawnClaude,
    abortClaudeSession
};
