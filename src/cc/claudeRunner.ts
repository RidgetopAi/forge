import { spawn, type ChildProcess } from 'child_process';

export interface RunResult {
  success: boolean;
  output: string;
  exitCode: number | null;
}

export interface ClaudeRunnerConfig {
  spindlesProxyUrl: string;
  mandrelUrl: string;
}

export class ClaudeRunner {
  private config: ClaudeRunnerConfig;

  constructor(config: ClaudeRunnerConfig) {
    this.config = config;
  }

  async run(prompt: string, timeoutMs: number): Promise<RunResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      console.error(`[forge] Spawning Claude Code with timeout ${timeoutMs}ms`);

      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: this.config.spindlesProxyUrl
      };

      const child: ChildProcess = spawn('claude', [
        '--print',
        '--dangerously-skip-permissions',
        prompt
      ], {
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      };
      
      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        process.stderr.write(chunk);
      });
      
      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        process.stderr.write(chunk);
      });
      
      child.on('error', (err) => {
        cleanup();
        console.error(`[forge] Claude Code spawn error: ${err.message}`);
        resolve({
          success: false,
          output: `Spawn error: ${err.message}`,
          exitCode: null
        });
      });
      
      child.on('close', (code) => {
        cleanup();
        
        if (killed) {
          console.error('[forge] Claude Code killed (timeout)');
          resolve({
            success: false,
            output: 'Process killed due to timeout',
            exitCode: null
          });
          return;
        }
        
        const success = code === 0;
        console.error(`[forge] Claude Code exited with code ${code}`);
        
        resolve({
          success,
          output: stdout || stderr,
          exitCode: code
        });
      });
      
      timeoutHandle = setTimeout(() => {
        killed = true;
        console.error(`[forge] Timeout reached (${timeoutMs}ms), killing Claude Code`);
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeoutMs);
    });
  }
}
