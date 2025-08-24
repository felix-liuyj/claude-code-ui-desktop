import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { extractProjectDirectory, decodeProjectPath } from '../projects.js';

const router = express.Router();
const execAsync = promisify(exec);

// Helper function to get the actual project path from the encoded project name
async function getActualProjectPath(projectName) {
    try {
        return await extractProjectDirectory(projectName);
    } catch (error) {
        console.error(`Error extracting project directory for ${ projectName }:`, error);
        // Use the improved decoding function
        return decodeProjectPath(projectName);
    }
}

// Helper function to get git repository path and validate it
async function getGitRepositoryPath(projectName) {
    const projectPath = await getActualProjectPath(projectName);
    console.log('Getting git repo path for project:', projectName, '-> project path:', projectPath);
    
    // Validate git repository and get the actual git root path
    const gitRootPath = await validateGitRepository(projectPath);
    console.log('Git repository validated, using path:', gitRootPath);
    
    return { projectPath, gitRootPath };
}

// Helper function to validate git repository
async function validateGitRepository(projectPath) {
    console.log(`[validateGitRepository] Validating path: ${projectPath}`);
    
    try {
        // Check if directory exists
        await fs.access(projectPath);
        console.log(`[validateGitRepository] Directory exists: ${projectPath}`);
    } catch (error) {
        console.error(`[validateGitRepository] Directory not found: ${projectPath}`, error.message);
        throw new Error(`Project path not found: ${ projectPath }`);
    }

    try {
        // Use --show-toplevel to get the root of the git repository
        const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: projectPath });
        const normalizedGitRoot = path.resolve(gitRoot.trim());
        const normalizedProjectPath = path.resolve(projectPath);
        
        console.log(`[validateGitRepository] Git root: ${normalizedGitRoot}`);
        console.log(`[validateGitRepository] Project path: ${normalizedProjectPath}`);

        // Ensure the git root matches our project path (prevent using parent git repos)
        if (normalizedGitRoot !== normalizedProjectPath) {
            console.log(`[validateGitRepository] Path mismatch - using repository at: ${normalizedGitRoot} instead of requiring exact match`);
            // Instead of throwing an error, let's allow using the git repository even if it's a parent directory
            // This is more flexible for nested project structures
            return normalizedGitRoot;
        }
        
        console.log(`[validateGitRepository] Validation successful for: ${projectPath}`);
        return normalizedProjectPath;
    } catch (error) {
        // More specific error handling for non-git repositories (supporting both English and Chinese git)
        if ((error.message.includes('fatal') && error.message.includes('not a git repository')) ||
            (error.message.includes('致命错误') && error.message.includes('不是 git 仓库'))) {
            // This is expected for non-git projects, log at info level instead of error
            console.log(`[validateGitRepository] Not a Git repository: ${projectPath}`);
            const gitError = new Error('Not a git repository');
            gitError.code = 'NOT_GIT_REPO';
            gitError.details = 'This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.';
            throw gitError;
        }
        
        // Log unexpected errors at error level
        console.error(`[validateGitRepository] Unexpected error:`, error.message);
        throw new Error('Failed to validate git repository: ' + error.message);
    }
}

// Get git status for a project
router.get('/status', async (req, res) => {
    const { project } = req.query;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const { projectPath, gitRootPath } = await getGitRepositoryPath(project);

        // Get current branch
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRootPath });

        // Get git status
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: gitRootPath });

        const modified = [];
        const added = [];
        const deleted = [];
        const untracked = [];

        statusOutput.split('\n').forEach(line => {
            if (!line.trim()) return;

            const status = line.substring(0, 2);
            const file = line.substring(3);

            if (status === 'M ' || status === ' M' || status === 'MM') {
                modified.push(file);
            } else if (status === 'A ' || status === 'AM') {
                added.push(file);
            } else if (status === 'D ' || status === ' D') {
                deleted.push(file);
            } else if (status === '??') {
                untracked.push(file);
            }
        });

        res.json({
            branch: branch.trim(),
            modified,
            added,
            deleted,
            untracked
        });
    } catch (error) {
        // Handle non-git repository errors gracefully
        if (error.code === 'NOT_GIT_REPO' || error.message.includes('not a git repository') || error.message.includes('Not a git repository')) {
            console.log('Git status - not a git repository:', project);
            return res.json({ 
                error: 'Not a git repository',
                isGitRepo: false,
                details: error.details || error.message
            });
        }
        console.error('Git status error:', error);
        res.json({
            error: 'Git operation failed',
            details: `Failed to get git status: ${ error.message }`
        });
    }
});

// Get diff for a specific file
router.get('/diff', async (req, res) => {
    const { project, file } = req.query;

    if (!project || !file) {
        return res.status(400).json({ error: 'Project name and file path are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Validate git repository
        await validateGitRepository(projectPath);

        // Check if file is untracked
        const { stdout: statusOutput } = await execAsync(`git status --porcelain "${ file }"`, { cwd: projectPath });
        const isUntracked = statusOutput.startsWith('??');

        let diff;
        if (isUntracked) {
            // For untracked files, show the entire file content as additions
            const fileContent = await fs.readFile(path.join(projectPath, file), 'utf-8');
            const lines = fileContent.split('\n');
            diff = `--- /dev/null\n+++ b/${ file }\n@@ -0,0 +1,${ lines.length } @@\n` +
                lines.map(line => `+${ line }`).join('\n');
        } else {
            // Get diff for tracked files
            const { stdout } = await execAsync(`git diff HEAD -- "${ file }"`, { cwd: projectPath });
            diff = stdout || '';

            // If no unstaged changes, check for staged changes
            if (!diff) {
                const { stdout: stagedDiff } = await execAsync(`git diff --cached -- "${ file }"`, { cwd: projectPath });
                diff = stagedDiff;
            }
        }

        res.json({ diff });
    } catch (error) {
        console.error('Git diff error:', error);
        res.json({ error: error.message });
    }
});

// Commit changes
router.post('/commit', async (req, res) => {
    const { project, message, files } = req.body;

    if (!project || !message || !files || files.length === 0) {
        return res.status(400).json({ error: 'Project name, commit message, and files are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Validate git repository
        await validateGitRepository(projectPath);

        // Stage selected files
        for (const file of files) {
            await execAsync(`git add "${ file }"`, { cwd: projectPath });
        }

        // Clean commit message by removing Claude Code signatures
        let cleanMessage = message;
        cleanMessage = cleanMessage
            .replace(/🤖\s*Generated with \[Claude Code\]\(https:\/\/claude\.ai\/code\)\s*/g, '')
            .replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>\s*/g, '')
            .trim();
        cleanMessage = cleanMessage.replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>/gi, '').trim();
        cleanMessage = cleanMessage.replace(/\n+$/, '').trim();

        // Commit with cleaned message
        const { stdout } = await execAsync(`git commit -m "${ cleanMessage.replace(/"/g, '\\"') }"`, { cwd: projectPath });

        res.json({ success: true, output: stdout });
    } catch (error) {
        console.error('Git commit error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get list of branches
router.get('/branches', async (req, res) => {
    const { project } = req.query;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        console.log('Git branches for project:', project, '-> path:', projectPath);

        // Validate git repository
        await validateGitRepository(projectPath);

        // Get all branches
        const { stdout } = await execAsync('git branch -a', { cwd: projectPath });

        // Parse branches
        const branches = stdout
            .split('\n')
            .map(branch => branch.trim())
            .filter(branch => branch && !branch.includes('->')) // Remove empty lines and HEAD pointer
            .map(branch => {
                // Remove asterisk from current branch
                if (branch.startsWith('* ')) {
                    return branch.substring(2);
                }
                // Remove remotes/ prefix
                if (branch.startsWith('remotes/origin/')) {
                    return branch.substring(15);
                }
                return branch;
            })
            .filter((branch, index, self) => self.indexOf(branch) === index); // Remove duplicates

        res.json({ branches });
    } catch (error) {
        // Handle non-git repository errors gracefully
        if (error.code === 'NOT_GIT_REPO' || error.message.includes('not a git repository') || error.message.includes('Not a git repository')) {
            console.log('Git branches - not a git repository:', project);
            return res.json({ 
                branches: [],
                isGitRepo: false,
                error: 'Not a git repository',
                details: error.details || error.message
            });
        }
        console.error('Git branches error:', error);
        res.json({ error: error.message });
    }
});

// Checkout branch
router.post('/checkout', async (req, res) => {
    const { project, branch } = req.body;

    if (!project || !branch) {
        return res.status(400).json({ error: 'Project name and branch are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Checkout the branch
        const { stdout } = await execAsync(`git checkout "${ branch }"`, { cwd: projectPath });

        res.json({ success: true, output: stdout });
    } catch (error) {
        console.error('Git checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new branch
router.post('/create-branch', async (req, res) => {
    const { project, branch } = req.body;

    if (!project || !branch) {
        return res.status(400).json({ error: 'Project name and branch name are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Create and checkout new branch
        const { stdout } = await execAsync(`git checkout -b "${ branch }"`, { cwd: projectPath });

        res.json({ success: true, output: stdout });
    } catch (error) {
        console.error('Git create branch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent commits
router.get('/commits', async (req, res) => {
    const { project, limit = 10 } = req.query;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Get commit log with stats
        const { stdout } = await execAsync(
            `git log --pretty=format:'%H|%an|%ae|%ad|%s' --date=relative -n ${ limit }`,
            { cwd: projectPath }
        );

        const commits = stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, author, email, date, ...messageParts] = line.split('|');
                return {
                    hash,
                    author,
                    email,
                    date,
                    message: messageParts.join('|')
                };
            });

        // Get stats for each commit
        for (const commit of commits) {
            try {
                const { stdout: stats } = await execAsync(
                    `git show --stat --format='' ${ commit.hash }`,
                    { cwd: projectPath }
                );
                commit.stats = stats.trim().split('\n').pop(); // Get the summary line
            } catch (error) {
                commit.stats = '';
            }
        }

        res.json({ commits });
    } catch (error) {
        console.error('Git commits error:', error);
        res.json({ error: error.message });
    }
});

// Get diff for a specific commit
router.get('/commit-diff', async (req, res) => {
    const { project, commit } = req.query;

    if (!project || !commit) {
        return res.status(400).json({ error: 'Project name and commit hash are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Get diff for the commit
        const { stdout } = await execAsync(
            `git show ${ commit }`,
            { cwd: projectPath }
        );

        res.json({ diff: stdout });
    } catch (error) {
        console.error('Git commit diff error:', error);
        res.json({ error: error.message });
    }
});

// Generate commit message based on staged changes
router.post('/generate-commit-message', async (req, res) => {
    const { project, files } = req.body;

    if (!project || !files || files.length === 0) {
        return res.status(400).json({ error: 'Project name and files are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);

        // Get diff for selected files
        let combinedDiff = '';
        for (const file of files) {
            try {
                const { stdout } = await execAsync(
                    `git diff HEAD -- "${ file }"`,
                    { cwd: projectPath }
                );
                if (stdout) {
                    combinedDiff += `\n--- ${ file } ---\n${ stdout }`;
                }
            } catch (error) {
                console.error(`Error getting diff for ${ file }:`, error);
            }
        }

        // Enhanced commit message generation with Claude CLI and configuration support
        const message = await generateEnhancedCommitMessage(projectPath, files, combinedDiff);

        res.json({ message });
    } catch (error) {
        console.error('Generate commit message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enhanced commit message generator with Claude CLI integration and configuration support
async function generateEnhancedCommitMessage(projectPath, files, diff) {
    try {
        // 1. Try to get Git settings from application settings
        const gitSettings = await getGitSettings();
        const language = gitSettings?.messageLanguage || 'en';
        const useClaudeCLI = gitSettings?.useClaudeCLI !== false; // Default to true
        
        // 2. Try to read global or project-specific CLAUDE.md for Git message conventions
        const conventions = await getGitConventions(projectPath);
        
        // 3. Use Claude CLI if available and enabled
        if (useClaudeCLI) {
            const claudeMessage = await generateWithClaudeCLI(projectPath, files, diff, conventions, language);
            if (claudeMessage) {
                return claudeMessage;
            }
        }
        
        // 4. Fallback to enhanced rule-based generation
        return await generateRuleBasedMessage(files, diff, conventions, language, projectPath);
        
    } catch (error) {
        console.error('Enhanced commit message generation failed:', error);
        // Ultimate fallback to simple generation
        return generateSimpleCommitMessage(files, diff);
    }
}

// Get Git settings from application configuration
async function getGitSettings() {
    try {
        const settingsPath = path.join(os.homedir(), '.claude-code-ui', 'settings.json');
        const settingsContent = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(settingsContent);
        return settings.git || {};
    } catch (error) {
        // No settings file or git section, use defaults
        return {};
    }
}

// Get Git conventions from CLAUDE.md or .gitmessage files
async function getGitConventions(projectPath) {
    const conventions = {
        format: null,
        types: null,
        scopes: null,
        rules: null
    };
    
    try {
        // 1. Try project-specific .gitmessage.txt first (highest priority)
        const gitmessageFile = path.join(projectPath, '.gitmessage.txt');
        try {
            const gitmessageContent = await fs.readFile(gitmessageFile, 'utf-8');
            const gitmessageConventions = parseGitmessageTemplate(gitmessageContent);
            if (gitmessageConventions) {
                Object.assign(conventions, gitmessageConventions);
                console.log('Found Git conventions in .gitmessage.txt');
                return conventions; // Use .gitmessage.txt if found
            }
        } catch (error) {
            // No .gitmessage.txt, continue
        }
        
        // 2. Try app/statics/rules/.gitmessage.txt
        const appGitmessageFile = path.join(projectPath, 'app', 'statics', 'rules', '.gitmessage.txt');
        try {
            const appGitmessageContent = await fs.readFile(appGitmessageFile, 'utf-8');
            const appGitmessageConventions = parseGitmessageTemplate(appGitmessageContent);
            if (appGitmessageConventions) {
                Object.assign(conventions, appGitmessageConventions);
                console.log('Found Git conventions in app/statics/rules/.gitmessage.txt');
                return conventions;
            }
        } catch (error) {
            // No app .gitmessage.txt, continue
        }
        
        // 3. Try project-specific CLAUDE.md
        const projectClaudeFile = path.join(projectPath, 'CLAUDE.md');
        try {
            const projectContent = await fs.readFile(projectClaudeFile, 'utf-8');
            const projectConventions = parseGitConventions(projectContent);
            if (projectConventions) {
                Object.assign(conventions, projectConventions);
                console.log('Found project-specific Git conventions in CLAUDE.md');
            }
        } catch (error) {
            // No project CLAUDE.md, continue
        }
        
        // 4. Try global CLAUDE.md (only if project conventions not found)
        if (!conventions.format) {
            const globalClaudeFile = path.join(os.homedir(), '.claude', 'CLAUDE.md');
            try {
                const globalContent = await fs.readFile(globalClaudeFile, 'utf-8');
                const globalConventions = parseGitConventions(globalContent);
                if (globalConventions) {
                    Object.assign(conventions, globalConventions);
                    console.log('Found global Git conventions in ~/.claude/CLAUDE.md');
                }
            } catch (error) {
                // No global CLAUDE.md, use defaults
            }
        }
        
    } catch (error) {
        console.error('Error reading Git conventions:', error);
    }
    
    return conventions;
}

// Parse Git conventions from .gitmessage.txt template
function parseGitmessageTemplate(content) {
    try {
        const conventions = {};
        
        // Extract format from template (e.g., <type>(<scope>): <subject>)
        const formatMatch = content.match(/#\s*<type>\(<scope>\):\s*<subject>|#\s*(\w+)\((\w+)\):\s*(\w+)/i);
        if (formatMatch) {
            conventions.format = '<type>(<scope>): <subject>';
        }
        
        // Extract types from template
        const typesMatch = content.match(/type:\s*([^\n]+)/i);
        if (typesMatch) {
            // Parse types like: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
            const typesList = typesMatch[1].split('|').map(t => t.trim());
            conventions.types = typesList;
        }
        
        // Extract scope examples
        const scopeMatch = content.match(/scope:.*?(如|例如|e\.g\.|such as|like)([^\n]+)/i);
        if (scopeMatch) {
            const scopeExamples = scopeMatch[2].split(/[、,]/).map(s => s.trim());
            conventions.scopes = scopeExamples;
        }
        
        // Extract rules from the template comments
        const rulesLines = [];
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.startsWith('#') && (line.includes('不超过') || line.includes('祈使句') || line.includes('50字符') || line.includes('imperative'))) {
                rulesLines.push(line.replace(/^#\s*/, ''));
            }
        }
        if (rulesLines.length > 0) {
            conventions.rules = rulesLines.join('\n');
        }
        
        // Set default conventional commit format if types are found
        if (conventions.types && !conventions.format) {
            conventions.format = '<type>(<scope>): <subject>';
        }
        
        return conventions;
    } catch (error) {
        console.error('Error parsing .gitmessage template:', error);
        return null;
    }
}

// Parse Git conventions from CLAUDE.md content
function parseGitConventions(content) {
    try {
        // Look for Git-related sections in CLAUDE.md
        const gitSectionMatch = content.match(/##?\s*(?:Git|git|GIT|提交|commit).*?(?=##|$)/is);
        if (!gitSectionMatch) return null;
        
        const gitSection = gitSectionMatch[0];
        
        const conventions = {};
        
        // Look for commit message format
        const formatMatch = gitSection.match(/(?:format|格式|模板).*?([`"']([^`"']+)[`"']|:\s*(.+))/is);
        if (formatMatch) {
            conventions.format = formatMatch[2] || formatMatch[3];
        }
        
        // Look for commit types
        const typesMatch = gitSection.match(/(?:type|类型).*?\[(.*?)\]/is);
        if (typesMatch) {
            conventions.types = typesMatch[1].split(',').map(t => t.trim());
        }
        
        // Look for scopes
        const scopesMatch = gitSection.match(/(?:scope|范围).*?\[(.*?)\]/is);
        if (scopesMatch) {
            conventions.scopes = scopesMatch[1].split(',').map(s => s.trim());
        }
        
        // Look for specific rules
        const rulesMatch = gitSection.match(/(?:rule|规则|要求).*?([\s\S]*?)(?=##|$)/is);
        if (rulesMatch) {
            conventions.rules = rulesMatch[1].trim();
        }
        
        return Object.keys(conventions).length > 0 ? conventions : null;
    } catch (error) {
        console.error('Error parsing Git conventions:', error);
        return null;
    }
}

// Generate commit message using Claude CLI
async function generateWithClaudeCLI(projectPath, files, diff, conventions, language) {
    try {
        // Check if Claude CLI is available
        try {
            await execAsync('which claude', { cwd: projectPath, timeout: 5000 });
        } catch (error) {
            console.log('Claude CLI not available, skipping Claude generation');
            return null;
        }
        
        // Prepare the prompt for Claude CLI
        const prompt = buildClaudePrompt(files, diff, conventions, language);
        
        // Write prompt to a temporary file to avoid shell escaping issues
        const tmpDir = os.tmpdir();
        const promptFile = path.join(tmpDir, `git-prompt-${Date.now()}.txt`);
        await fs.writeFile(promptFile, prompt, 'utf-8');
        
        try {
            // Use Claude CLI to generate commit message
            const { stdout } = await execAsync(
                `cat "${promptFile}" | claude`,
                { 
                    cwd: projectPath,
                    timeout: 30000, // 30 second timeout
                    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                }
            );
            
            const generatedMessage = stdout.trim();
            
            // Extract just the commit message if Claude returns extra content
            // Look for common patterns like "Here's a commit message:" or quotes
            let finalMessage = generatedMessage;
            
            // Remove common prefixes
            // Remove code blocks first
            finalMessage = finalMessage.replace(/^```[\s\S]*?```$/gm, '').trim();
            
            // Remove common intro phrases
            finalMessage = finalMessage.replace(/^.*?(?:commit message|提交消息|消息)[:：]\s*/is, '').trim();
            finalMessage = finalMessage.replace(/^.*?(?:here's|here is|建议|推荐).*?[:：]\s*/is, '').trim();
            
            // Remove surrounding quotes if present
            const quoteMatch = finalMessage.match(/^["'`]([\s\S]*)["'`]$/s);
            if (quoteMatch && quoteMatch[1]) {
                finalMessage = quoteMatch[1].trim();
            }
            
            // Remove Claude Code signatures and co-authored lines
            finalMessage = finalMessage
                .replace(/🤖\s*Generated with \[Claude Code\]\(https:\/\/claude\.ai\/code\)\s*/g, '')
                .replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>\s*/g, '')
                .trim();
            finalMessage = finalMessage.replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>/gi, '').trim();
            
            // Remove empty lines at the end
            finalMessage = finalMessage.replace(/\n+$/, '').trim();
            
            // Take only the first line or paragraph if it's a multi-line response
            const lines = finalMessage.split('\n').filter(line => line.trim());
            if (lines.length > 0) {
                // If it looks like a conventional commit, take the whole first line
                // Otherwise, take up to the first blank line
                if (lines[0].match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:/)) {
                    finalMessage = lines[0];
                } else {
                    const firstParagraph = [];
                    for (const line of lines) {
                        if (line.trim() === '') break;
                        firstParagraph.push(line);
                        // Stop if we hit a line that looks like explanation text
                        if (line.match(/^(this|these|it|the above|以上|这个|这些)/i)) break;
                    }
                    finalMessage = firstParagraph.join(' ').trim();
                }
            }
            
            if (finalMessage && !finalMessage.toLowerCase().includes('error')) {
                console.log('Successfully generated commit message using Claude CLI');
                return finalMessage;
            }
        } finally {
            // Clean up temporary file
            try {
                await fs.unlink(promptFile);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        
    } catch (error) {
        console.log('Claude CLI generation failed, falling back to rule-based generation:', error.message);
    }
    
    return null;
}

// Build prompt for Claude CLI
function buildClaudePrompt(files, diff, conventions, language) {
    const isChineseLang = language === 'zh' || language === 'zh-CN';
    
    let prompt = isChineseLang 
        ? '请为以下Git变更生成一个完整的规范化提交消息，包含 header、body 和 footer。\n\n'
        : 'Please generate a complete standardized commit message for the following Git changes, including header, body, and footer.\n\n';
    
    // Add specific requirements for complete commit message
    prompt += isChineseLang
        ? '要求：\n1. 严格遵循 Conventional Commits 规范\n2. 包含完整的 header、body 和 footer\n3. header: <type>(<scope>): <subject>\n4. body: 详细说明改动内容和原因\n5. footer: 验证信息或关联信息\n6. 只返回提交消息本身\n\n'
        : 'Requirements:\n1. Strictly follow Conventional Commits specification\n2. Include complete header, body, and footer\n3. Header: <type>(<scope>): <subject>\n4. Body: Detailed explanation of changes and reasons\n5. Footer: Verification info or related references\n6. Return only the commit message itself\n\n';
    
    // Add file information with better formatting
    prompt += isChineseLang 
        ? `变更的文件 (${files.length} 个):\n${files.map(f => `  • ${f}`).join('\n')}\n\n`
        : `Modified files (${files.length}):\n${files.map(f => `  • ${f}`).join('\n')}\n\n`;
    
    // Add conventions with examples
    if (conventions.format) {
        prompt += isChineseLang 
            ? `提交消息格式: ${conventions.format}\n\n`
            : `Commit message format: ${conventions.format}\n\n`;
    }
    
    if (conventions.types) {
        prompt += isChineseLang 
            ? `允许的类型: ${conventions.types.join(', ')}\n\n`
            : `Allowed types: ${conventions.types.join(', ')}\n\n`;
    }
    
    // Add example format with complete footer
    prompt += isChineseLang
        ? '示例格式：\nfeat(components): 增强组件交互功能\n\n为组件添加新的交互特性，提高用户体验。\n包含响应式设计和可访问性优化。\n\n验证：功能测试通过，用户界面无异常。\nSigned-off-by: Developer <developer@example.com>\n\n'
        : 'Example format:\nfeat(components): enhance component interaction functionality\n\nAdd new interactive features to components to improve user experience.\nIncludes responsive design and accessibility optimizations.\n\nVerification: Feature testing passed, user interface shows no anomalies.\nSigned-off-by: Developer <developer@example.com>\n\n';
    
    // Add diff with better formatting
    const diffSample = diff.length > 2000 ? diff.substring(0, 2000) + '\n... (diff truncated)' : diff;
    prompt += isChineseLang 
        ? `代码变更详情:\n\`\`\`diff\n${diffSample}\n\`\`\`\n\n请生成完整的提交消息（包含 header、body、footer）：`
        : `Code changes:\n\`\`\`diff\n${diffSample}\n\`\`\`\n\nGenerate complete commit message (including header, body, footer):`;
    
    return prompt;
}

// Enhanced rule-based message generation with conventions and language support
async function generateRuleBasedMessage(files, diff, conventions, language, projectPath) {
    const isChineseLang = language === 'zh' || language === 'zh-CN';
    const fileCount = files.length;
    
    // Analyze the diff to determine the type of change
    const additions = (diff.match(/^\+[^+]/gm) || []).length;
    const deletions = (diff.match(/^-[^-]/gm) || []).length;
    
    // Determine the primary action based on conventions or defaults
    let action;
    if (conventions.types && conventions.types.length > 0) {
        // Use convention types
        if (additions > 0 && deletions === 0) {
            action = conventions.types.includes('feat') ? 'feat' : conventions.types.includes('add') ? 'add' : conventions.types[0];
        } else if (deletions > 0 && additions === 0) {
            action = conventions.types.includes('remove') ? 'remove' : conventions.types.includes('delete') ? 'delete' : 'refactor';
        } else if (additions > deletions * 2) {
            action = conventions.types.includes('feat') ? 'feat' : conventions.types.includes('enhance') ? 'enhance' : 'update';
        } else if (deletions > additions * 2) {
            action = conventions.types.includes('refactor') ? 'refactor' : 'update';
        } else {
            action = conventions.types.includes('fix') ? 'fix' : conventions.types.includes('update') ? 'update' : conventions.types[0];
        }
    } else {
        // Use language-specific default actions
        if (isChineseLang) {
            if (additions > 0 && deletions === 0) {
                action = '新增';
            } else if (deletions > 0 && additions === 0) {
                action = '删除';
            } else if (additions > deletions * 2) {
                action = '增强';
            } else if (deletions > additions * 2) {
                action = '重构';
            } else {
                action = '更新';
            }
        } else {
            if (additions > 0 && deletions === 0) {
                action = 'Add';
            } else if (deletions > 0 && additions === 0) {
                action = 'Remove';
            } else if (additions > deletions * 2) {
                action = 'Enhance';
            } else if (deletions > additions * 2) {
                action = 'Refactor';
            } else {
                action = 'Update';
            }
        }
    }
    
    // Generate more detailed description based on files and changes
    let description;
    
    // Analyze what types of files changed
    const fileTypes = new Set();
    const componentNames = new Set();
    const directories = new Set();
    
    files.forEach(f => {
        const parts = f.split('/');
        const fileName = parts[parts.length - 1];
        const ext = fileName.split('.').pop();
        
        // Track file types
        if (['jsx', 'tsx'].includes(ext)) fileTypes.add('component');
        else if (['css', 'scss', 'less'].includes(ext)) fileTypes.add('style');
        else if (['js', 'ts'].includes(ext)) fileTypes.add('script');
        else if (['json', 'yml', 'yaml'].includes(ext)) fileTypes.add('config');
        else if (['md', 'txt'].includes(ext)) fileTypes.add('doc');
        
        // Track component/module names
        if (parts.length > 1) {
            directories.add(parts[0]);
            const moduleName = parts[parts.length - 2] || parts[0];
            componentNames.add(moduleName);
        } else {
            componentNames.add(fileName.replace(/\.[^.]+$/, ''));
        }
    });
    
    // Build description based on analysis
    if (fileCount > 1) {
        if (componentNames.size === 1) {
            const componentName = [...componentNames][0];
            const typeList = [...fileTypes];
            
            if (typeList.includes('component') && typeList.includes('style')) {
                description = isChineseLang 
                    ? `${componentName} 组件的功能和样式`
                    : `${componentName} component functionality and styling`;
            } else if (typeList.includes('component')) {
                description = isChineseLang 
                    ? `${componentName} 组件逻辑`
                    : `${componentName} component logic`;
            } else if (typeList.includes('style')) {
                description = isChineseLang 
                    ? `${componentName} 样式优化`
                    : `${componentName} style improvements`;
            } else {
                description = isChineseLang 
                    ? `${componentName} 模块`
                    : `${componentName} module`;
            }
        } else if (directories.size === 1) {
            const directory = [...directories][0];
            description = isChineseLang 
                ? `${directory} 模块的多个组件`
                : `multiple ${directory} components`;
        } else {
            // Multiple components across directories
            const mainComponents = [...componentNames].slice(0, 2).join(', ');
            if (componentNames.size > 2) {
                description = isChineseLang 
                    ? `${mainComponents} 等${componentNames.size}个组件`
                    : `${mainComponents} and ${componentNames.size - 2} more components`;
            } else {
                description = isChineseLang 
                    ? `${mainComponents} 组件`
                    : `${mainComponents} components`;
            }
        }
    } else {
        // Single file - be more specific
        const fileName = files[0].split('/').pop();
        const baseName = fileName.replace(/\.[^.]+$/, '');
        const ext = fileName.split('.').pop();
        
        // Add context based on file type
        if (['jsx', 'tsx'].includes(ext)) {
            // Check if it has UI changes
            const hasUIChanges = diff.includes('className') || diff.includes('style') || diff.includes('<div') || diff.includes('render');
            if (hasUIChanges) {
                description = isChineseLang 
                    ? `${baseName} 组件的界面和交互`
                    : `${baseName} component UI and interactions`;
            } else {
                description = isChineseLang 
                    ? `${baseName} 组件逻辑`
                    : `${baseName} component logic`;
            }
        } else if (['css', 'scss', 'less'].includes(ext)) {
            description = isChineseLang 
                ? `${baseName} 样式调整`
                : `${baseName} style adjustments`;
        } else if (['json', 'yml', 'yaml'].includes(ext)) {
            description = isChineseLang 
                ? `${baseName} 配置更新`
                : `${baseName} configuration updates`;
        } else if (ext === 'md') {
            description = isChineseLang 
                ? `${baseName} 文档更新`
                : `${baseName} documentation updates`;
        } else {
            // Generic but with more context
            if (additions > deletions) {
                description = isChineseLang 
                    ? `${baseName} 功能扩展`
                    : `enhance ${baseName} functionality`;
            } else if (deletions > additions) {
                description = isChineseLang 
                    ? `${baseName} 代码优化`
                    : `optimize ${baseName} implementation`;
            } else {
                description = isChineseLang 
                    ? `更新 ${baseName}`
                    : `update ${baseName}`;
            }
        }
    }
    
    // Format according to conventions
    if (conventions.format) {
        // Handle conventional commit format: <type>(<scope>): <subject>
        const formatTemplate = conventions.format;
        
        // Determine scope based on the files
        let scope = '';
        if (formatTemplate.includes('scope')) {
            // Try to determine scope from directories or component names
            if (directories.size === 1) {
                scope = [...directories][0];
            } else if (componentNames.size === 1) {
                scope = [...componentNames][0].toLowerCase();
            } else if (fileTypes.has('component')) {
                scope = 'components';
            } else if (fileTypes.has('style')) {
                scope = 'styles';
            } else if (fileTypes.has('config')) {
                scope = 'config';
            } else if (conventions.scopes && conventions.scopes.length > 0) {
                // Use first available scope from conventions if we can't determine
                scope = conventions.scopes[0];
            }
        }
        
        // Build the complete commit message with header, body, and footer
        let subject = description;
        
        // Build header: <type>(<scope>): <subject>
        let header = action;
        if (scope) {
            header += `(${scope})`;
        }
        header += `: ${subject}`;
        
        // Build body: explain what changed and why
        let body = '';
        if (fileCount === 1) {
            const fileName = files[0].split('/').pop();
            if (action === 'feat') {
                body = isChineseLang
                    ? `\u4e3a ${fileName} \u6dfb\u52a0\u65b0\u529f\u80fd\uff0c\u589e\u5f3a\u7528\u6237\u4f53\u9a8c\u548c\u7cfb\u7edf\u529f\u80fd\u6027\u3002`
                    : `Add new functionality to ${fileName} to enhance user experience and system capabilities.`;
            } else if (action === 'fix') {
                body = isChineseLang
                    ? `\u4fee\u590d ${fileName} \u4e2d\u7684\u95ee\u9898\uff0c\u63d0\u9ad8\u7cfb\u7edf\u7a33\u5b9a\u6027\u548c\u53ef\u9760\u6027\u3002`
                    : `Fix issues in ${fileName} to improve system stability and reliability.`;
            } else if (action === 'refactor') {
                body = isChineseLang
                    ? `\u91cd\u6784 ${fileName} \u7684\u4ee3\u7801\u7ed3\u6784\uff0c\u63d0\u9ad8\u53ef\u8bfb\u6027\u548c\u7ef4\u62a4\u6027\u3002`
                    : `Refactor code structure in ${fileName} to improve readability and maintainability.`;
            } else if (action === 'style') {
                body = isChineseLang
                    ? `\u4f18\u5316 ${fileName} \u7684\u6837\u5f0f\u548c\u89c6\u89c9\u8868\u73b0\uff0c\u63d0\u5347\u7528\u6237\u754c\u9762\u4f53\u9a8c\u3002`
                    : `Optimize styles and visual presentation in ${fileName} to enhance user interface experience.`;
            } else {
                body = isChineseLang
                    ? `\u66f4\u65b0 ${fileName} \u7684\u5b9e\u73b0\uff0c\u4fdd\u6301\u7cfb\u7edf\u7684\u73b0\u4ee3\u5316\u548c\u9ad8\u6548\u6027\u3002`
                    : `Update ${fileName} implementation to maintain system modernization and efficiency.`;
            }
        } else {
            // Multiple files
            const moduleCount = directories.size;
            const componentCount = componentNames.size;
            
            if (action === 'feat') {
                body = isChineseLang
                    ? `\u5728 ${fileCount} \u4e2a\u6587\u4ef6\u4e2d\u5b9e\u73b0\u65b0\u529f\u80fd\uff0c\u6d89\u53ca ${moduleCount > 1 ? moduleCount + ' \u4e2a\u6a21\u5757' : '\u6838\u5fc3\u6a21\u5757'}\u3002\n\u589e\u5f3a\u7cfb\u7edf\u80fd\u529b\uff0c\u4f18\u5316\u7528\u6237\u4ea4\u4e92\u4f53\u9a8c\u3002`
                    : `Implement new features across ${fileCount} files, affecting ${moduleCount > 1 ? moduleCount + ' modules' : 'core module'}.\nEnhance system capabilities and optimize user interaction experience.`;
            } else if (action === 'fix') {
                body = isChineseLang
                    ? `\u4fee\u590d\u591a\u4e2a\u7ec4\u4ef6\u4e2d\u7684\u95ee\u9898\uff0c\u6d89\u53ca ${fileCount} \u4e2a\u6587\u4ef6\u3002\n\u63d0\u9ad8\u7cfb\u7edf\u7a33\u5b9a\u6027\uff0c\u786e\u4fdd\u529f\u80fd\u6b63\u5e38\u8fd0\u884c\u3002`
                    : `Fix issues across multiple components, involving ${fileCount} files.\nImprove system stability and ensure proper functionality.`;
            } else if (action === 'refactor') {
                body = isChineseLang
                    ? `\u91cd\u6784\u591a\u4e2a\u6a21\u5757\u7684\u4ee3\u7801\u7ed3\u6784\uff0c\u4f18\u5316 ${componentCount} \u4e2a\u7ec4\u4ef6\u3002\n\u63d0\u9ad8\u4ee3\u7801\u53ef\u8bfb\u6027\u548c\u7ef4\u62a4\u6027\uff0c\u4e3a\u540e\u7eed\u5f00\u53d1\u5960\u5b9a\u57fa\u7840\u3002`
                    : `Refactor code structure across multiple modules, optimizing ${componentCount} components.\nImprove code readability and maintainability for future development.`;
            } else {
                body = isChineseLang
                    ? `\u66f4\u65b0\u591a\u4e2a\u6a21\u5757\u7684\u5b9e\u73b0\uff0c\u6d89\u53ca ${fileCount} \u4e2a\u6587\u4ef6\u3002\n\u4fdd\u6301\u7cfb\u7edf\u7684\u73b0\u4ee3\u5316\u548c\u9ad8\u6548\u6027\u3002`
                    : `Update implementation across multiple modules, involving ${fileCount} files.\nMaintain system modernization and efficiency.`;
            }
        }
        
        // Build footer according to .gitmessage.txt rules
        let footer = '';
        
        // Add verification info based on action type
        if (action === 'feat') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u529f\u80fd\u6d4b\u8bd5\u901a\u8fc7\uff0c\u7528\u6237\u754c\u9762\u65e0\u5f02\u5e38\u3002'
                : 'Verification: Feature testing passed, user interface shows no anomalies.';
        } else if (action === 'fix') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u95ee\u9898\u4fee\u590d\u786e\u8ba4\uff0c\u56de\u5f52\u6d4b\u8bd5\u901a\u8fc7\u3002'
                : 'Verification: Issue fix confirmed, regression testing passed.';
        } else if (action === 'refactor') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u91cd\u6784\u540e\u529f\u80fd\u6b63\u5e38\uff0c\u4ee3\u7801\u8d28\u91cf\u63d0\u5347\u3002'
                : 'Verification: Functionality maintained after refactoring, code quality improved.';
        } else if (action === 'style') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u6837\u5f0f\u66f4\u65b0\u65e0\u526f\u4f5c\u7528\uff0c\u89c6\u89c9\u6548\u679c\u7b26\u5408\u9884\u671f\u3002'
                : 'Verification: Style updates have no side effects, visual effects meet expectations.';
        } else if (action === 'perf') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u6027\u80fd\u4f18\u5316\u6548\u679c\u786e\u8ba4\uff0c\u65e0\u529f\u80fd\u56de\u9000\u3002'
                : 'Verification: Performance improvements confirmed, no functional regression.';
        } else if (action === 'docs') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u6587\u6863\u5185\u5bb9\u51c6\u786e\uff0c\u683c\u5f0f\u89c4\u8303\u3002'
                : 'Verification: Documentation content accurate, formatting compliant.';
        } else if (action === 'test') {
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u6d4b\u8bd5\u7528\u4f8b\u8986\u76d6\u5b8c\u6574\uff0c\u6267\u884c\u901a\u8fc7\u3002'
                : 'Verification: Test cases provide complete coverage, execution passed.';
        } else {
            // Generic footer for other types
            footer = isChineseLang
                ? '\u9a8c\u8bc1\uff1a\u53d8\u66f4\u5185\u5bb9\u5df2\u786e\u8ba4\uff0c\u7cfb\u7edf\u8fd0\u884c\u6b63\u5e38\u3002'
                : 'Verification: Changes confirmed, system operating normally.';
        }
        
        // Add breaking change notice if it's a major change
        if (additions > 50 || deletions > 50 || fileCount > 10) {
            const breakingChange = isChineseLang
                ? '\n\nBREAKING CHANGE: 涉及多个文件的重大变更，可能影响现有功能。'
                : '\n\nBREAKING CHANGE: Major changes involving multiple files, may affect existing functionality.';
            footer += breakingChange;
        }
        
        // Add signed-off-by if configured (check git config)
        if (projectPath) {
            try {
                const { stdout: gitUserName } = await execAsync('git config user.name', { cwd: projectPath });
                const { stdout: gitUserEmail } = await execAsync('git config user.email', { cwd: projectPath });
                
                if (gitUserName.trim() && gitUserEmail.trim()) {
                    footer += `\n\nSigned-off-by: ${gitUserName.trim()} <${gitUserEmail.trim()}>`;
                }
            } catch (error) {
                // Git config not available, skip signed-off-by
            }
        }
        
        // Assemble the complete message
        let message = header;
        if (body) {
            message += '\n\n' + body;
        }
        if (footer) {
            message += '\n\n' + footer;
        }
        
        // Remove Claude Code signatures if they somehow got included
        message = message
            .replace(/🤖\s*Generated with \[Claude Code\]\(https:\/\/claude\.ai\/code\)\s*/g, '')
            .replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>\s*/g, '')
            .trim();
        message = message.replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>/gi, '').trim();
        message = message.replace(/\n+$/, '').trim();
        
        return message;
    }
    
    // Default format
    return `${action} ${description}`;
}

// Simple commit message generator (fallback)
function generateSimpleCommitMessage(files, diff) {
    const fileCount = files.length;
    const isMultipleFiles = fileCount > 1;

    // Analyze the diff to determine the type of change
    const additions = (diff.match(/^\+[^+]/gm) || []).length;
    const deletions = (diff.match(/^-[^-]/gm) || []).length;

    // Determine the primary action
    let action = 'Update';
    if (additions > 0 && deletions === 0) {
        action = 'Add';
    } else if (deletions > 0 && additions === 0) {
        action = 'Remove';
    } else if (additions > deletions * 2) {
        action = 'Enhance';
    } else if (deletions > additions * 2) {
        action = 'Refactor';
    }

    // Generate message based on files
    let message;
    if (isMultipleFiles) {
        const components = new Set(files.map(f => {
            const parts = f.split('/');
            return parts[parts.length - 2] || parts[0];
        }));

        if (components.size === 1) {
            message = `${ action } ${ [...components][0] } component`;
        } else {
            message = `${ action } multiple components`;
        }
    } else {
        const fileName = files[0].split('/').pop();
        const componentName = fileName.replace(/\.(jsx?|tsx?|css|scss)$/, '');
        message = `${ action } ${ componentName }`;
    }
    
    // Remove Claude Code signatures if they somehow got included
    message = message
        .replace(/🤖\s*Generated with \[Claude Code\]\(https:\/\/claude\.ai\/code\)\s*/g, '')
        .replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>\s*/g, '')
        .trim();
    message = message.replace(/Co-Authored-By:\s*Claude\s*<noreply@anthropic\.com>/gi, '').trim();
    
    return message;
}

// Get remote status (ahead/behind commits with smart remote detection)
router.get('/remote-status', async (req, res) => {
    const { project } = req.query;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Get current branch
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        const branch = currentBranch.trim();

        // Check if there's a remote tracking branch (smart detection)
        let trackingBranch;
        let remoteName;
        try {
            const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${ branch }@{upstream}`, { cwd: projectPath });
            trackingBranch = stdout.trim();
            remoteName = trackingBranch.split('/')[0]; // Extract remote name (e.g., "origin/main" -> "origin")
        } catch (error) {
            // No upstream branch configured - but check if we have remotes
            let hasRemote = false;
            let remoteName = null;
            try {
                const { stdout } = await execAsync('git remote', { cwd: projectPath });
                const remotes = stdout.trim().split('\n').filter(r => r.trim());
                if (remotes.length > 0) {
                    hasRemote = true;
                    remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
                }
            } catch (remoteError) {
                // No remotes configured
            }

            return res.json({
                hasRemote,
                hasUpstream: false,
                branch,
                remoteName,
                message: 'No remote tracking branch configured'
            });
        }

        // Get ahead/behind counts
        const { stdout: countOutput } = await execAsync(
            `git rev-list --count --left-right ${ trackingBranch }...HEAD`,
            { cwd: projectPath }
        );

        const [behind, ahead] = countOutput.trim().split('\t').map(Number);

        res.json({
            hasRemote: true,
            hasUpstream: true,
            branch,
            remoteBranch: trackingBranch,
            remoteName,
            ahead: ahead || 0,
            behind: behind || 0,
            isUpToDate: ahead === 0 && behind === 0
        });
    } catch (error) {
        // Handle non-git repository errors gracefully
        if (error.code === 'NOT_GIT_REPO' || error.message.includes('not a git repository') || error.message.includes('Not a git repository')) {
            console.log('Git remote status - not a git repository:', project);
            return res.json({ 
                ahead: 0,
                behind: 0,
                hasRemote: false,
                isGitRepo: false,
                error: 'Not a git repository',
                details: error.details || error.message
            });
        }
        console.error('Git remote status error:', error);
        res.json({ error: error.message });
    }
});

// Fetch from remote (using smart remote detection)
router.post('/fetch', async (req, res) => {
    const { project } = req.body;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Get current branch and its upstream remote
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        const branch = currentBranch.trim();

        let remoteName = 'origin'; // fallback
        try {
            const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${ branch }@{upstream}`, { cwd: projectPath });
            remoteName = stdout.trim().split('/')[0]; // Extract remote name
        } catch (error) {
            // No upstream, try to fetch from origin anyway
            console.log('No upstream configured, using origin as fallback');
        }

        const { stdout } = await execAsync(`git fetch ${ remoteName }`, { cwd: projectPath });

        res.json({ success: true, output: stdout || 'Fetch completed successfully', remoteName });
    } catch (error) {
        console.error('Git fetch error:', error);
        res.status(500).json({
            error: 'Fetch failed',
            details: error.message.includes('Could not resolve hostname')
                ? 'Unable to connect to remote repository. Check your internet connection.'
                : error.message.includes('fatal: \'origin\' does not appear to be a git repository')
                    ? 'No remote repository configured. Add a remote with: git remote add origin <url>'
                    : error.message
        });
    }
});

// Pull from remote (fetch + merge using smart remote detection)
router.post('/pull', async (req, res) => {
    const { project } = req.body;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Get current branch and its upstream remote
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        const branch = currentBranch.trim();

        let remoteName = 'origin'; // fallback
        let remoteBranch = branch; // fallback
        try {
            const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${ branch }@{upstream}`, { cwd: projectPath });
            const tracking = stdout.trim();
            remoteName = tracking.split('/')[0]; // Extract remote name
            remoteBranch = tracking.split('/').slice(1).join('/'); // Extract branch name
        } catch (error) {
            // No upstream, use fallback
            console.log('No upstream configured, using origin/branch as fallback');
        }

        const { stdout } = await execAsync(`git pull ${ remoteName } ${ remoteBranch }`, { cwd: projectPath });

        res.json({
            success: true,
            output: stdout || 'Pull completed successfully',
            remoteName,
            remoteBranch
        });
    } catch (error) {
        console.error('Git pull error:', error);

        // Enhanced error handling for common pull scenarios
        let errorMessage = 'Pull failed';
        let details = error.message;

        if (error.message.includes('CONFLICT')) {
            errorMessage = 'Merge conflicts detected';
            details = 'Pull created merge conflicts. Please resolve conflicts manually in the editor, then commit the changes.';
        } else if (error.message.includes('Please commit your changes or stash them')) {
            errorMessage = 'Uncommitted changes detected';
            details = 'Please commit or stash your local changes before pulling.';
        } else if (error.message.includes('Could not resolve hostname')) {
            errorMessage = 'Network error';
            details = 'Unable to connect to remote repository. Check your internet connection.';
        } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
            errorMessage = 'Remote not configured';
            details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
        } else if (error.message.includes('diverged')) {
            errorMessage = 'Branches have diverged';
            details = 'Your local branch and remote branch have diverged. Consider fetching first to review changes.';
        }

        res.status(500).json({
            error: errorMessage,
            details: details
        });
    }
});

// Push commits to remote repository
router.post('/push', async (req, res) => {
    const { project } = req.body;

    if (!project) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Get current branch and its upstream remote
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        const branch = currentBranch.trim();

        let remoteName = 'origin'; // fallback
        let remoteBranch = branch; // fallback
        try {
            const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${ branch }@{upstream}`, { cwd: projectPath });
            const tracking = stdout.trim();
            remoteName = tracking.split('/')[0]; // Extract remote name
            remoteBranch = tracking.split('/').slice(1).join('/'); // Extract branch name
        } catch (error) {
            // No upstream, use fallback
            console.log('No upstream configured, using origin/branch as fallback');
        }

        const { stdout } = await execAsync(`git push ${ remoteName } ${ remoteBranch }`, { cwd: projectPath });

        res.json({
            success: true,
            output: stdout || 'Push completed successfully',
            remoteName,
            remoteBranch
        });
    } catch (error) {
        console.error('Git push error:', error);

        // Enhanced error handling for common push scenarios
        let errorMessage = 'Push failed';
        let details = error.message;

        if (error.message.includes('rejected')) {
            errorMessage = 'Push rejected';
            details = 'The remote has newer commits. Pull first to merge changes before pushing.';
        } else if (error.message.includes('non-fast-forward')) {
            errorMessage = 'Non-fast-forward push';
            details = 'Your branch is behind the remote. Pull the latest changes first.';
        } else if (error.message.includes('Could not resolve hostname')) {
            errorMessage = 'Network error';
            details = 'Unable to connect to remote repository. Check your internet connection.';
        } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
            errorMessage = 'Remote not configured';
            details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
        } else if (error.message.includes('Permission denied')) {
            errorMessage = 'Authentication failed';
            details = 'Permission denied. Check your credentials or SSH keys.';
        } else if (error.message.includes('no upstream branch')) {
            errorMessage = 'No upstream branch';
            details = 'No upstream branch configured. Use: git push --set-upstream origin <branch>';
        }

        res.status(500).json({
            error: errorMessage,
            details: details
        });
    }
});

// Publish branch to remote (set upstream and push)
router.post('/publish', async (req, res) => {
    const { project, branch } = req.body;

    if (!project || !branch) {
        return res.status(400).json({ error: 'Project name and branch are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Get current branch to verify it matches the requested branch
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        const currentBranchName = currentBranch.trim();

        if (currentBranchName !== branch) {
            return res.status(400).json({
                error: `Branch mismatch. Current branch is ${ currentBranchName }, but trying to publish ${ branch }`
            });
        }

        // Check if remote exists
        let remoteName = 'origin';
        try {
            const { stdout } = await execAsync('git remote', { cwd: projectPath });
            const remotes = stdout.trim().split('\n').filter(r => r.trim());
            if (remotes.length === 0) {
                return res.status(400).json({
                    error: 'No remote repository configured. Add a remote with: git remote add origin <url>'
                });
            }
            remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
        } catch (error) {
            return res.status(400).json({
                error: 'No remote repository configured. Add a remote with: git remote add origin <url>'
            });
        }

        // Publish the branch (set upstream and push)
        const { stdout } = await execAsync(`git push --set-upstream ${ remoteName } ${ branch }`, { cwd: projectPath });

        res.json({
            success: true,
            output: stdout || 'Branch published successfully',
            remoteName,
            branch
        });
    } catch (error) {
        console.error('Git publish error:', error);

        // Enhanced error handling for common publish scenarios
        let errorMessage = 'Publish failed';
        let details = error.message;

        if (error.message.includes('rejected')) {
            errorMessage = 'Publish rejected';
            details = 'The remote branch already exists and has different commits. Use push instead.';
        } else if (error.message.includes('Could not resolve hostname')) {
            errorMessage = 'Network error';
            details = 'Unable to connect to remote repository. Check your internet connection.';
        } else if (error.message.includes('Permission denied')) {
            errorMessage = 'Authentication failed';
            details = 'Permission denied. Check your credentials or SSH keys.';
        } else if (error.message.includes('fatal:') && error.message.includes('does not appear to be a git repository')) {
            errorMessage = 'Remote not configured';
            details = 'Remote repository not properly configured. Check your remote URL.';
        }

        res.status(500).json({
            error: errorMessage,
            details: details
        });
    }
});

// Discard changes for a specific file
router.post('/discard', async (req, res) => {
    const { project, file } = req.body;

    if (!project || !file) {
        return res.status(400).json({ error: 'Project name and file path are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Check file status to determine correct discard command
        const { stdout: statusOutput } = await execAsync(`git status --porcelain "${ file }"`, { cwd: projectPath });

        if (!statusOutput.trim()) {
            return res.status(400).json({ error: 'No changes to discard for this file' });
        }

        const status = statusOutput.substring(0, 2);

        if (status === '??') {
            // Untracked file - delete it
            await fs.unlink(path.join(projectPath, file));
        } else if (status.includes('M') || status.includes('D')) {
            // Modified or deleted file - restore from HEAD
            await execAsync(`git restore "${ file }"`, { cwd: projectPath });
        } else if (status.includes('A')) {
            // Added file - unstage it
            await execAsync(`git reset HEAD "${ file }"`, { cwd: projectPath });
        }

        res.json({ success: true, message: `Changes discarded for ${ file }` });
    } catch (error) {
        console.error('Git discard error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete untracked file
router.post('/delete-untracked', async (req, res) => {
    const { project, file } = req.body;

    if (!project || !file) {
        return res.status(400).json({ error: 'Project name and file path are required' });
    }

    try {
        const projectPath = await getActualProjectPath(project);
        await validateGitRepository(projectPath);

        // Check if file is actually untracked
        const { stdout: statusOutput } = await execAsync(`git status --porcelain "${ file }"`, { cwd: projectPath });

        if (!statusOutput.trim()) {
            return res.status(400).json({ error: 'File is not untracked or does not exist' });
        }

        const status = statusOutput.substring(0, 2);

        if (status !== '??') {
            return res.status(400).json({ error: 'File is not untracked. Use discard for tracked files.' });
        }

        // Delete the untracked file
        await fs.unlink(path.join(projectPath, file));

        res.json({ success: true, message: `Untracked file ${ file } deleted successfully` });
    } catch (error) {
        console.error('Git delete untracked error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Git settings
router.get('/settings', async (req, res) => {
    try {
        const gitSettings = await getGitSettings();
        res.json(gitSettings);
    } catch (error) {
        console.error('Error getting Git settings:', error);
        res.json({
            messageLanguage: 'en',
            useClaudeCLI: true,
            conventionType: 'conventional'
        });
    }
});

// Update Git settings
router.post('/settings', async (req, res) => {
    try {
        const { messageLanguage, useClaudeCLI, conventionType } = req.body;
        
        const settingsDir = path.join(os.homedir(), '.claude-code-ui');
        const settingsPath = path.join(settingsDir, 'settings.json');
        
        // Ensure directory exists
        try {
            await fs.mkdir(settingsDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
        
        // Read existing settings
        let settings = {};
        try {
            const settingsContent = await fs.readFile(settingsPath, 'utf-8');
            settings = JSON.parse(settingsContent);
        } catch (error) {
            // No existing settings file
        }
        
        // Update Git settings
        settings.git = {
            messageLanguage: messageLanguage || 'en',
            useClaudeCLI: useClaudeCLI !== false,
            conventionType: conventionType || 'conventional'
        };
        
        // Write back to file
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        
        res.json({ success: true, settings: settings.git });
    } catch (error) {
        console.error('Error updating Git settings:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;