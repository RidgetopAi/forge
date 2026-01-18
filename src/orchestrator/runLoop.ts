import type { ForgeConfig } from '../config.js';
import { StateManager, type SirkState } from '../state/stateManager.js';
import { SpindlesClient, type SirkSession } from '../proxy/spindlesClient.js';
import { ClaudeRunner } from '../cc/claudeRunner.js';
import { renderPrompt } from '../cc/prompt.js';
import { 
  emitEvent, 
  type RunStartedEvent, 
  type InstanceStartedEvent, 
  type InstanceCompletedEvent, 
  type InstanceFailedEvent, 
  type RunCompletedEvent 
} from '../events.js';

export async function runLoop(
  config: ForgeConfig,
  stateManager: StateManager
): Promise<void> {
  const spindlesClient = new SpindlesClient(config.spindlesProxyUrl);
  const claudeRunner = new ClaudeRunner({
    spindlesProxyUrl: config.spindlesProxyUrl,
    mandrelUrl: config.mandrelUrl
  });
  const timeoutMs = config.timeoutMinutes * 60 * 1000;
  
  const runStarted: RunStartedEvent = {
    type: 'run_started',
    runName: config.runName,
    totalInstances: config.totalInstances,
    timestamp: new Date().toISOString()
  };
  emitEvent(runStarted);
  
  let successCount = 0;
  let failCount = 0;
  
  const state = stateManager.getState();
  const startInstance = state?.currentInstance ?? 1;
  
  for (let instanceNumber = startInstance; instanceNumber <= config.totalInstances; instanceNumber++) {
    const instanceStarted: InstanceStartedEvent = {
      type: 'instance_started',
      runName: config.runName,
      instanceNumber,
      totalInstances: config.totalInstances,
      timestamp: new Date().toISOString()
    };
    emitEvent(instanceStarted);
    
    const startTime = Date.now();
    
    const session: SirkSession = {
      runName: config.runName,
      instanceNumber,
      totalInstances: config.totalInstances,
      project: config.project
    };
    
    try {
      await spindlesClient.setSession(session);
    } catch (err) {
      console.error(`[forge] Warning: Failed to set spindles session: ${err}`);
    }
    
    const prompt = renderPrompt(config, instanceNumber);
    
    let success = false;
    let lastError = '';
    
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        console.error(`[forge] Retrying instance ${instanceNumber} (attempt ${attempt + 1})`);
      }
      
      const result = await claudeRunner.run(prompt, timeoutMs);
      
      if (result.success) {
        success = true;
        break;
      }
      
      lastError = result.output || `Exit code: ${result.exitCode}`;
    }
    
    const durationMs = Date.now() - startTime;
    
    try {
      await spindlesClient.clearSession();
    } catch (err) {
      console.error(`[forge] Warning: Failed to clear spindles session: ${err}`);
    }
    
    await stateManager.markInstanceComplete(instanceNumber, success);
    
    if (success) {
      successCount++;
      const completed: InstanceCompletedEvent = {
        type: 'instance_completed',
        runName: config.runName,
        instanceNumber,
        success: true,
        durationMs,
        timestamp: new Date().toISOString()
      };
      emitEvent(completed);
    } else {
      failCount++;
      const failed: InstanceFailedEvent = {
        type: 'instance_failed',
        runName: config.runName,
        instanceNumber,
        error: lastError,
        timestamp: new Date().toISOString()
      };
      emitEvent(failed);
    }
  }
  
  const runCompleted: RunCompletedEvent = {
    type: 'run_completed',
    runName: config.runName,
    successCount,
    failCount,
    timestamp: new Date().toISOString()
  };
  emitEvent(runCompleted);
  
  stateManager.setStatus(failCount === 0 ? 'completed' : 'failed');
  await stateManager.save();
}
