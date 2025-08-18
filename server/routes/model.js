import express from 'express';
import { spawn } from 'child_process';

const router = express.Router();

/**
 * Get current model configuration
 */
router.get('/', async (req, res) => {
    try {
        // 由于claude model是交互式命令，我们直接返回默认策略
        // 用户可以通过UI进行更改
        console.log('Getting current model strategy...');
        
        res.json({
            success: true,
            data: {
                currentStrategy: 'default', // 默认策略
                raw: 'Current strategy: Default (recommended)'
            }
        });

    } catch (error) {
        console.error('Error in model route:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Set model configuration
 */
router.post('/', async (req, res) => {
    try {
        const { model: strategy } = req.body;
        
        if (!strategy) {
            return res.status(400).json({
                success: false,
                error: 'Model parameter is required'
            });
        }

        // 根据策略名称映射到对应的选项数字
        const strategyMap = {
            'default': '1',
            'opus': '2', 
            'sonnet': '3',
            'opus-plan': '4'
        };

        const optionNumber = strategyMap[strategy];
        if (!optionNumber) {
            return res.status(400).json({
                success: false,
                error: 'Invalid strategy. Valid options: default, opus, sonnet, opus-plan'
            });
        }

        console.log(`Setting model strategy to: ${strategy} (option ${optionNumber})`);
        
        const claudeProcess = spawn('claude', ['model'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
            timeout: 15000 // 15秒超时
        });

        let stdout = '';
        let stderr = '';
        let processComplete = false;

        // 设置超时处理
        const timeoutId = setTimeout(() => {
            if (!processComplete) {
                claudeProcess.kill('SIGKILL');
                console.error('Claude model command timed out');
            }
        }, 15000);

        claudeProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Claude stdout:', data.toString());
        });

        claudeProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('Claude stderr:', data.toString());
        });

        claudeProcess.on('close', (code) => {
            processComplete = true;
            clearTimeout(timeoutId);
            
            console.log(`Claude process closed with code: ${code}`);
            console.log('Final stdout:', stdout);
            console.log('Final stderr:', stderr);
            
            if (code === 0 || stdout.includes('Kept model') || stdout.includes('Set model')) {
                res.json({
                    success: true,
                    message: `Model strategy set to ${strategy}`,
                    data: {
                        strategy,
                        raw: stdout.trim()
                    }
                });
            } else {
                console.error('Claude model set command failed:', stderr);
                res.status(500).json({
                    success: false,
                    error: stderr || 'Failed to set model strategy'
                });
            }
        });

        claudeProcess.on('error', (error) => {
            processComplete = true;
            clearTimeout(timeoutId);
            console.error('Failed to execute claude model command:', error);
            res.status(500).json({
                success: false,
                error: 'Claude CLI not available'
            });
        });

        // 发送选择选项
        try {
            claudeProcess.stdin.write(optionNumber + '\n');
            claudeProcess.stdin.end();
            console.log(`Sent option ${optionNumber} to claude process`);
        } catch (err) {
            processComplete = true;
            clearTimeout(timeoutId);
            console.error('Failed to write to claude process:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to communicate with Claude CLI'
            });
        }

    } catch (error) {
        console.error('Error in model set route:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * List available model strategies
 */
router.get('/list', async (req, res) => {
    try {
        // 返回固定的策略列表，基于Claude CLI的实际选项
        const strategies = [
            {
                id: 'default',
                name: 'Default (recommended)',
                description: 'Opus 4.1 for up to 20% of usage limits, then use Sonnet 4',
                recommended: true
            },
            {
                id: 'opus',
                name: 'Opus',
                description: 'Opus 4.1 for complex tasks · Reaches usage limits faster',
                recommended: false
            },
            {
                id: 'sonnet',
                name: 'Sonnet',
                description: 'Sonnet 4 for daily use',
                recommended: false
            },
            {
                id: 'opus-plan',
                name: 'Opus Plan Mode',
                description: 'Use Opus 4.1 in plan mode, Sonnet 4 otherwise',
                recommended: false
            }
        ];

        res.json({
            success: true,
            data: strategies
        });

    } catch (error) {
        console.error('Error in model list route:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Extract current strategy from claude model output
 */
function extractCurrentStrategy(output) {
    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('Kept model as') || line.includes('Set model to')) {
            if (line.includes('Default')) {
                return 'default';
            } else if (line.includes('Opus Plan Mode')) {
                return 'opus-plan';
            } else if (line.includes('Opus')) {
                return 'opus';
            } else if (line.includes('Sonnet')) {
                return 'sonnet';
            }
        }
        // 检查带有箭头标记的选中项
        if (line.includes('❯') || line.includes('*')) {
            if (line.includes('Default')) {
                return 'default';
            } else if (line.includes('Opus Plan Mode')) {
                return 'opus-plan';
            } else if (line.includes('Opus') && !line.includes('Plan')) {
                return 'opus';
            } else if (line.includes('Sonnet')) {
                return 'sonnet';
            }
        }
    }
    return 'default'; // 默认返回 default
}

export default router;