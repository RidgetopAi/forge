import { mkdir, readFile, writeFile, rename } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';

export interface CompletedInstance {
  instanceNumber: number;
  success: boolean;
  timestamp: string;
}

export interface SirkState {
  runName: string;
  currentInstance: number;
  totalInstances: number;
  completedInstances: CompletedInstance[];
  status: 'running' | 'paused' | 'completed' | 'failed';
}

export class StateManager {
  private stateFilePath: string;
  private state: SirkState | null = null;
  
  constructor(runName: string, totalInstances: number) {
    const forgeDir = join(homedir(), '.forge', 'runs', runName);
    this.stateFilePath = join(forgeDir, 'state.json');
    this.state = {
      runName,
      currentInstance: 1,
      totalInstances,
      completedInstances: [],
      status: 'running'
    };
  }
  
  async load(): Promise<SirkState | null> {
    try {
      const content = await readFile(this.stateFilePath, 'utf8');
      this.state = JSON.parse(content) as SirkState;
      return this.state;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }
  
  async save(state?: SirkState): Promise<void> {
    if (state) {
      this.state = state;
    }
    
    if (!this.state) {
      throw new Error('No state to save');
    }
    
    const dir = dirname(this.stateFilePath);
    await mkdir(dir, { recursive: true });
    
    const tempPath = this.stateFilePath + '.tmp';
    const content = JSON.stringify(this.state, null, 2);
    
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, this.stateFilePath);
  }
  
  async markInstanceComplete(instanceNumber: number, success: boolean): Promise<void> {
    if (!this.state) {
      throw new Error('State not initialized');
    }
    
    this.state.completedInstances.push({
      instanceNumber,
      success,
      timestamp: new Date().toISOString()
    });
    
    this.state.currentInstance = instanceNumber + 1;
    
    if (instanceNumber >= this.state.totalInstances) {
      const allSuccess = this.state.completedInstances.every(i => i.success);
      this.state.status = allSuccess ? 'completed' : 'failed';
    }
    
    await this.save();
  }
  
  getState(): SirkState | null {
    return this.state;
  }
  
  setStatus(status: SirkState['status']): void {
    if (this.state) {
      this.state.status = status;
    }
  }
}
