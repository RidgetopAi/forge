import { spawn } from 'child_process';

export class MandrelClient {
  private mandrelUrl: string;
  
  constructor(mandrelUrl: string = 'http://localhost:8080') {
    this.mandrelUrl = mandrelUrl;
  }
  
  async ping(): Promise<boolean> {
    const curlCommand = `curl -s -X POST ${this.mandrelUrl}/mcp/tools/mandrel_ping -H "Content-Type: application/json" -d '{"arguments": {}}'`;
    
    return new Promise((resolve) => {
      const child = spawn('ssh', ['hetzner', curlCommand], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.on('error', () => {
        resolve(false);
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          resolve(false);
          return;
        }
        
        try {
          const response = JSON.parse(stdout);
          resolve(response.success === true || response.result?.includes('Pong'));
        } catch {
          resolve(stdout.includes('Pong') || stdout.includes('pong'));
        }
      });
      
      setTimeout(() => {
        child.kill();
        resolve(false);
      }, 10000);
    });
  }
  
  async checkHealth(): Promise<void> {
    console.error('[forge] Checking Mandrel health...');
    const healthy = await this.ping();
    
    if (!healthy) {
      throw new Error('Mandrel is unreachable. Ensure VPS is running and accessible via ssh hetzner.');
    }
    
    console.error('[forge] Mandrel health check passed');
  }
}
