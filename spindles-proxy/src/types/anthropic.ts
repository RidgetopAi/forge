export interface MessageStart {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };
}

export interface ContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block:
    | { type: 'thinking'; thinking: string }
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
}

export interface ContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta:
    | { type: 'thinking_delta'; thinking: string }
    | { type: 'text_delta'; text: string }
    | { type: 'input_json_delta'; partial_json: string };
}

export interface ContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

export interface MessageDelta {
  type: 'message_delta';
  delta: { stop_reason: string | null };
  usage: { output_tokens: number };
}

export interface MessageStop {
  type: 'message_stop';
}

export interface Ping {
  type: 'ping';
}

export interface StreamError {
  type: 'error';
  error: { type: string; message: string };
}

export type AnthropicSSEEvent =
  | MessageStart
  | ContentBlockStart
  | ContentBlockDelta
  | ContentBlockStop
  | MessageDelta
  | MessageStop
  | Ping
  | StreamError;
