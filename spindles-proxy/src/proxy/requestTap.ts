import type { SirkSession, ToolResultActivity } from '../types/activity.js';

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}

interface MessageContent {
  role: string;
  content: unknown;
}

interface MessagesRequest {
  messages?: MessageContent[];
}

export function extractToolResults(
  body: Buffer,
  session: SirkSession | null
): ToolResultActivity[] {
  const activities: ToolResultActivity[] = [];

  try {
    const parsed = JSON.parse(body.toString('utf-8')) as MessagesRequest;
    if (!parsed.messages || !Array.isArray(parsed.messages)) {
      return activities;
    }

    const timestamp = new Date().toISOString();

    for (const message of parsed.messages) {
      if (!Array.isArray(message.content)) continue;

      for (const block of message.content) {
        if (block && typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
          const tr = block as ToolResultContent;
          activities.push({
            type: 'tool_result',
            toolId: tr.tool_use_id,
            content: tr.content,
            isError: tr.is_error ?? false,
            timestamp,
            session,
          });
        }
      }
    }
  } catch {
    // Not JSON or malformed - ignore
  }

  return activities;
}
