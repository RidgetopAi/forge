export interface RunStartedEvent {
  type: 'run_started';
  runName: string;
  totalInstances: number;
  timestamp: string;
}

export interface InstanceStartedEvent {
  type: 'instance_started';
  runName: string;
  instanceNumber: number;
  totalInstances: number;
  timestamp: string;
}

export interface InstanceCompletedEvent {
  type: 'instance_completed';
  runName: string;
  instanceNumber: number;
  success: boolean;
  durationMs: number;
  timestamp: string;
}

export interface InstanceFailedEvent {
  type: 'instance_failed';
  runName: string;
  instanceNumber: number;
  error: string;
  timestamp: string;
}

export interface RunCompletedEvent {
  type: 'run_completed';
  runName: string;
  successCount: number;
  failCount: number;
  timestamp: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  fatal: boolean;
  timestamp: string;
}

export type ForgeEvent = 
  | RunStartedEvent
  | InstanceStartedEvent
  | InstanceCompletedEvent
  | InstanceFailedEvent
  | RunCompletedEvent
  | ErrorEvent;

export function emitEvent(event: ForgeEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}
