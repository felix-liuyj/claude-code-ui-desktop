import express from 'express';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Claude CLI command routes

// GET /api/mcp/cli/list - List MCP servers using Claude CLI
router.get('/cli/list', async (req, res) => {
    try {
        console.log('📋 Listing MCP servers using Claude CLI');

        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const exec = promisify(spawn);

        const process = spawn('claude', ['mcp', 'list'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, output: stdout, servers: parseClaudeListOutput(stdout) });
            } else {
                console.error('Claude CLI error:', stderr);
                res.status(500).json({ error: 'Claude CLI command failed', details: stderr });
            }
        });

        process.on('error', (error) => {
            console.error('Error running Claude CLI:', error);
            res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
        });
    } catch (error) {
        console.error('Error listing MCP servers via CLI:', error);
        res.status(500).json({ error: 'Failed to list MCP servers', details: error.message });
    }
});

// POST /api/mcp/cli/add - Add MCP server using Claude CLI
router.post('/cli/add', async (req, res) => {
    try {
        const { name, type = 'stdio', command, args = [], url, headers = {}, env = {} } = req.body;

        console.log('➕ Adding MCP server using Claude CLI:', name);

        const { spawn } = await import('child_process');

        let cliArgs = ['mcp', 'add'];

        if (type === 'http') {
            cliArgs.push('--transport', 'http', '--scope', 'user', name, url);
            // Add headers if provided
            Object.entries(headers).forEach(([key, value]) => {
                cliArgs.push('--header', `${ key }: ${ value }`);
            });
        } else if (type === 'sse') {
            cliArgs.push('--transport', 'sse', '--scope', 'user', name, url);
            // Add headers if provided
            Object.entries(headers).forEach(([key, value]) => {
                cliArgs.push('--header', `${ key }: ${ value }`);
            });
        } else {
            // stdio (default): claude mcp add --scope user <name> <command> [args...]
            cliArgs.push('--scope', 'user');
            // Add environment variables
            Object.entries(env).forEach(([key, value]) => {
                cliArgs.push('-e', `${ key }=${ value }`);
            });
            cliArgs.push(name, command);
            if (args && args.length > 0) {
                cliArgs.push(...args);
            }
        }

        console.log('🔧 Running Claude CLI command:', 'claude', cliArgs.join(' '));

        const process = spawn('claude', cliArgs, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, output: stdout, message: `MCP server "${ name }" added successfully` });
            } else {
                console.error('Claude CLI error:', stderr);
                res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
            }
        });

        process.on('error', (error) => {
            console.error('Error running Claude CLI:', error);
            res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
        });
    } catch (error) {
        console.error('Error adding MCP server via CLI:', error);
        res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
    }
});

// DELETE /api/mcp/cli/remove/:name - Remove MCP server using Claude CLI
router.delete('/cli/remove/:name', async (req, res) => {
    try {
        const { name } = req.params;

        console.log('🗑️ Removing MCP server using Claude CLI:', name);

        const { spawn } = await import('child_process');

        const process = spawn('claude', ['mcp', 'remove', '--scope', 'user', name], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, output: stdout, message: `MCP server "${ name }" removed successfully` });
            } else {
                console.error('Claude CLI error:', stderr);
                res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
            }
        });

        process.on('error', (error) => {
            console.error('Error running Claude CLI:', error);
            res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
        });
    } catch (error) {
        console.error('Error removing MCP server via CLI:', error);
        res.status(500).json({ error: 'Failed to remove MCP server', details: error.message });
    }
});

// GET /api/mcp/cli/get/:name - Get MCP server details using Claude CLI
router.get('/cli/get/:name', async (req, res) => {
    try {
        const { name } = req.params;

        console.log('📄 Getting MCP server details using Claude CLI:', name);

        const { spawn } = await import('child_process');

        const process = spawn('claude', ['mcp', 'get', name], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, output: stdout, server: parseClaudeGetOutput(stdout) });
            } else {
                console.error('Claude CLI error:', stderr);
                res.status(404).json({ error: 'Claude CLI command failed', details: stderr });
            }
        });

        process.on('error', (error) => {
            console.error('Error running Claude CLI:', error);
            res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
        });
    } catch (error) {
        console.error('Error getting MCP server details via CLI:', error);
        res.status(500).json({ error: 'Failed to get MCP server details', details: error.message });
    }
});

// Helper functions to parse Claude CLI output
function parseClaudeListOutput(output) {
    // Parse the output from 'claude mcp list' command
    // Format: "<name>: <command> - <status>"
    console.log('🔍 Parsing Claude CLI output:', output);
    const servers = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
        // Skip header lines and health check messages
        if (line.includes('Checking MCP server health') || line.trim() === '') {
            continue;
        }

        // Parse format: "<name>: <command> - <status>"
        const match = line.match(/^(.+?):\s*(.+?)\s*-\s*(.+)$/);
        if (match) {
            const [, name, command, status] = match;
            const isHealthy = !status.includes('Failed');
            
            servers.push({
                id: name.trim(),
                name: name.trim(),
                type: 'stdio', // Default to stdio, will be updated by get details if needed
                scope: 'user',
                config: {
                    command: command.trim(),
                    args: [],
                    env: {},
                    timeout: 30000
                },
                status: isHealthy ? 'healthy' : 'failed',
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            });
        }
    }

    console.log('🔍 Parsed Claude CLI servers:', servers);
    return servers;
}

function parseClaudeGetOutput(output) {
    // Parse the output from 'claude mcp get <name>' command
    // Format is structured text with lines like "Type: stdio", "Command: echo", etc.
    try {
        const server = { raw_output: output };
        const lines = output.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.includes('Scope:')) {
                const scope = trimmedLine.split('Scope:')[1]?.trim();
                if (scope.includes('User config')) {
                    server.scope = 'user';
                } else if (scope.includes('Local config')) {
                    server.scope = 'local';
                } else if (scope.includes('Project config')) {
                    server.scope = 'project';
                }
            } else if (trimmedLine.includes('Type:')) {
                server.type = trimmedLine.split('Type:')[1]?.trim().toLowerCase();
            } else if (trimmedLine.includes('Command:')) {
                server.command = trimmedLine.split('Command:')[1]?.trim();
            } else if (trimmedLine.includes('Args:')) {
                const argsStr = trimmedLine.split('Args:')[1]?.trim();
                if (argsStr && argsStr !== '') {
                    server.args = argsStr.split(' ');
                } else {
                    server.args = [];
                }
            } else if (trimmedLine.includes('URL:')) {
                server.url = trimmedLine.split('URL:')[1]?.trim();
            } else if (trimmedLine.includes('Status:')) {
                const status = trimmedLine.split('Status:')[1]?.trim();
                server.status = status.includes('Failed') ? 'failed' : 'healthy';
            } else if (trimmedLine.includes('Environment:')) {
                // Environment variables would be listed after this line
                server.env = {};
            }
        }

        // Extract server name from the first line (format: "server-name:")
        const firstLine = lines[0]?.trim();
        if (firstLine && firstLine.endsWith(':')) {
            server.name = firstLine.slice(0, -1);
            server.id = server.name;
        }

        return server;
    } catch (error) {
        return { raw_output: output, parse_error: error.message };
    }
}

export default router;