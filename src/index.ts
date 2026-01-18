import { parseConfig } from './config.js';
import { emitEvent, type ErrorEvent } from './events.js';
import { MandrelClient } from './mandrel/mandrelClient.js';
import { StateManager } from './state/stateManager.js';
import { runLoop } from './orchestrator/runLoop.js';
import { setupSignalHandlers, setStateManager } from './orchestrator/resumeFlow.js';

async function main(): Promise<void> {
  setupSignalHandlers();

  // Read config as a single newline-terminated line (don't wait for EOF)
  // This allows stdin to remain open for potential future use
  const configInput = await new Promise<string>((resolve) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');

    const onData = (chunk: string) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex !== -1) {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('end', onEnd);
        resolve(buffer.substring(0, newlineIndex));
      }
    };

    const onEnd = () => {
      process.stdin.removeListener('data', onData);
      resolve(buffer.trim());
    };

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
  });

  if (!configInput.trim()) {
    const error: ErrorEvent = {
      type: 'error',
      message: 'No configuration provided on stdin',
      fatal: true,
      timestamp: new Date().toISOString()
    };
    emitEvent(error);
    process.exit(1);
  }
  
  const configResult = parseConfig(configInput);
  
  if (!configResult.success) {
    const error: ErrorEvent = {
      type: 'error',
      message: `Invalid configuration: ${configResult.error}`,
      fatal: true,
      timestamp: new Date().toISOString()
    };
    emitEvent(error);
    process.exit(1);
  }
  
  const config = configResult.data;
  
  console.error(`[forge] Starting run: ${config.runName}`);
  console.error(`[forge] Total instances: ${config.totalInstances}`);
  console.error(`[forge] Project: ${config.project}`);
  console.error(`[forge] Seed: ${config.seedPath}`);
  
  const mandrelClient = new MandrelClient(config.mandrelUrl);
  
  try {
    await mandrelClient.checkHealth();
  } catch (err) {
    const error: ErrorEvent = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Mandrel health check failed',
      fatal: true,
      timestamp: new Date().toISOString()
    };
    emitEvent(error);
    process.exit(1);
  }
  
  const stateManager = new StateManager(config.runName, config.totalInstances);
  setStateManager(stateManager);
  
  const existingState = await stateManager.load();
  if (existingState) {
    console.error(`[forge] Found existing state: ${existingState.status}, instance ${existingState.currentInstance}/${existingState.totalInstances}`);
  }
  
  await stateManager.save();
  
  await runLoop(config, stateManager);
  
  console.error('[forge] Run complete');
}

main().catch((err) => {
  const error: ErrorEvent = {
    type: 'error',
    message: err instanceof Error ? err.message : String(err),
    fatal: true,
    timestamp: new Date().toISOString()
  };
  emitEvent(error);
  process.exit(1);
});
