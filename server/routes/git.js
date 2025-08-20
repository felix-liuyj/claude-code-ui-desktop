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
        console.error(`[validateGitRepository] Git command failed:`, error.message);
        if (error.message.includes('Project directory is not a git repository')) {
            throw error;
        }
        throw new Error('Not a git repository. This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.');
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
        console.error('Git status error:', error);
        res.json({
            error: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
                ? error.message
                : 'Git operation failed',
            details: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
                ? error.message
                : `Failed to get git status: ${ error.message }`
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

        // Commit with message
        const { stdout } = await execAsync(`git commit -m "${ message.replace(/"/g, '\\"') }"`, { cwd: projectPath });

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
        return generateRuleBasedMessage(files, diff, conventions, language);
        
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

// Get Git conventions from CLAUDE.md files
async function getGitConventions(projectPath) {
    const conventions = {
        format: null,
        types: null,
        scopes: null,
        rules: null
    };
    
    try {
        // 1. Try project-specific CLAUDE.md
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
        
        // 2. Try global CLAUDE.md (only if project conventions not found)
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
        
        // Use Claude CLI to generate commit message
        const { stdout } = await execAsync(
            `echo "${prompt.replace(/"/g, '\\"')}" | claude --no-stream`,
            { 
                cwd: projectPath,
                timeout: 30000 // 30 second timeout
            }
        );
        
        const generatedMessage = stdout.trim();
        if (generatedMessage && !generatedMessage.includes('Error') && !generatedMessage.includes('error')) {
            console.log('Successfully generated commit message using Claude CLI');
            return generatedMessage;
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
        ? '请为以下Git变更生成一个规范的提交消息：\n\n'
        : 'Please generate a standardized commit message for the following Git changes:\n\n';
    
    // Add file information
    prompt += isChineseLang 
        ? `变更文件 (${files.length}个):\n${files.map(f => `- ${f}`).join('\n')}\n\n`
        : `Changed files (${files.length}):\n${files.map(f => `- ${f}`).join('\n')}\n\n`;
    
    // Add conventions if available
    if (conventions.format) {
        prompt += isChineseLang 
            ? `提交消息格式要求: ${conventions.format}\n\n`
            : `Commit message format: ${conventions.format}\n\n`;
    }
    
    if (conventions.types) {
        prompt += isChineseLang 
            ? `允许的类型: ${conventions.types.join(', ')}\n\n`
            : `Allowed types: ${conventions.types.join(', ')}\n\n`;
    }
    
    if (conventions.rules) {
        prompt += isChineseLang 
            ? `特殊规则:\n${conventions.rules}\n\n`
            : `Special rules:\n${conventions.rules}\n\n`;
    }
    
    // Add diff sample (first 1000 chars to avoid token limits)
    const diffSample = diff.length > 1000 ? diff.substring(0, 1000) + '...' : diff;
    prompt += isChineseLang 
        ? `代码变更内容:\n${diffSample}\n\n请生成一个简洁、准确的提交消息（仅返回消息本身，不要额外说明）：`
        : `Code changes:\n${diffSample}\n\nPlease generate a concise, accurate commit message (return only the message, no additional explanation):`;
    
    return prompt;
}

// Enhanced rule-based message generation with conventions and language support
function generateRuleBasedMessage(files, diff, conventions, language) {
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
    
    // Generate description based on files
    let description;
    if (fileCount > 1) {
        const components = new Set(files.map(f => {
            const parts = f.split('/');
            return parts[parts.length - 2] || parts[0];
        }));
        
        if (components.size === 1) {
            const componentName = [...components][0];
            description = isChineseLang ? `${componentName}组件` : `${componentName} component`;
        } else {
            description = isChineseLang ? '多个组件' : 'multiple components';
        }
    } else {
        const fileName = files[0].split('/').pop();
        const componentName = fileName.replace(/\.(jsx?|tsx?|css|scss|py|js|ts)$/, '');
        description = componentName;
    }
    
    // Format according to conventions
    if (conventions.format) {
        // Try to match convention format (like "type(scope): description")
        const formatTemplate = conventions.format;
        if (formatTemplate.includes('type') && formatTemplate.includes('description')) {
            const scope = conventions.scopes && conventions.scopes.length > 0 ? conventions.scopes[0] : '';
            let message = formatTemplate
                .replace(/type/gi, action)
                .replace(/scope/gi, scope)
                .replace(/description/gi, description);
            
            // Clean up formatting
            message = message.replace(/\(\s*\)/, '').replace(/\s+/g, ' ').trim();
            return message;
        }
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
    if (isMultipleFiles) {
        const components = new Set(files.map(f => {
            const parts = f.split('/');
            return parts[parts.length - 2] || parts[0];
        }));

        if (components.size === 1) {
            return `${ action } ${ [...components][0] } component`;
        } else {
            return `${ action } multiple components`;
        }
    } else {
        const fileName = files[0].split('/').pop();
        const componentName = fileName.replace(/\.(jsx?|tsx?|css|scss)$/, '');
        return `${ action } ${ componentName }`;
    }
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