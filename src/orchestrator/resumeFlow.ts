import { StateManager, type SirkState } from '../state/stateManager.js';
import { emitEvent, type ErrorEvent } from '../events.js';

let pauseRequested = false;
let currentStateManager: StateManager | null = null;

export function isPauseRequested(): boolean {
  return pauseRequested;
}

export function setStateManager(manager: StateManager): void {
  currentStateManager = manager;
}

export async function pauseRun(): Promise<void> {
  pauseRequested = true;
  
  if (currentStateManager) {
    const state = currentStateManager.getState();
    if (state) {
      currentStateManager.setStatus('paused');
      await currentStateManager.save();
      console.error('[forge] Run paused. State saved.');
    }
  }
}

export async function resumeRun(runName: string): Promise<SirkState | null> {
  const tempManager = new StateManager(runName, 0);
  const state = await tempManager.load();
  
  if (!state) {
    console.error(`[forge] No saved state found for run: ${runName}`);
    return null;
  }
  
  if (state.status === 'completed') {
    console.error(`[forge] Run ${runName} is already completed`);
    return null;
  }
  
  if (state.status === 'failed') {
    console.error(`[forge] Run ${runName} failed. Can resume from instance ${state.currentInstance}`);
  } else if (state.status === 'paused') {
    console.error(`[forge] Resuming paused run ${runName} from instance ${state.currentInstance}`);
  } else {
    console.error(`[forge] Recovering run ${runName} from instance ${state.currentInstance}`);
  }
  
  return state;
}

export function setupSignalHandlers(): void {
  const handleSignal = async (signal: string) => {
    console.error(`[forge] Received ${signal}, pausing gracefully...`);
    await pauseRun();
    
    const error: ErrorEvent = {
      type: 'error',
      message: `Run paused by ${signal}`,
      fatal: false,
      timestamp: new Date().toISOString()
    };
    emitEvent(error);
    
    process.exit(0);
  };
  
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}
