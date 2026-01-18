export interface SirkSession {
  runName: string;
  instanceNumber: number;
  totalInstances: number;
  project: string;
}

export interface BaseActivity {
  timestamp: string;
  session: SirkSession | null;
}

export interface ThinkingActivity extends BaseActivity {
  type: 'thinking';
  content: string;
}

export interface ToolCallActivity extends BaseActivity {
  type: 'tool_call';
  toolName: string;
  toolId: string;
  input: unknown;
}

export interface ToolResultActivity extends BaseActivity {
  type: 'tool_result';
  toolId: string;
  content: unknown;
  isError: boolean;
}

export interface TextActivity extends BaseActivity {
  type: 'text';
  content: string;
}

export interface ErrorActivity extends BaseActivity {
  type: 'error';
  message: string;
  code?: string;
}

export interface ActivityConnectionAck {
  type: 'connection_ack';
  timestamp: string;
}

export type ActivityMessage =
  | ThinkingActivity
  | ToolCallActivity
  | ToolResultActivity
  | TextActivity
  | ErrorActivity;

export type WebSocketMessage = ActivityMessage | ActivityConnectionAck;
