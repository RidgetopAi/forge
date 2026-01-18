import type { AnthropicSSEEvent, ContentBlockStart, ContentBlockDelta } from '../types/anthropic.js';
import type { ActivityMessage, SirkSession } from '../types/activity.js';

interface PendingBlock {
  index: number;
  type: 'thinking' | 'text' | 'tool_use';
  content: string;
  toolId?: string;
  toolName?: string;
}

export type ActivityCallback = (activity: ActivityMessage) => void;

export class BlockAssembler {
  private blocks: Map<number, PendingBlock> = new Map();
  private onActivity: ActivityCallback;
  private getSession: () => SirkSession | null;

  constructor(onActivity: ActivityCallback, getSession: () => SirkSession | null) {
    this.onActivity = onActivity;
    this.getSession = getSession;
  }

  process(event: AnthropicSSEEvent): void {
    switch (event.type) {
      case 'content_block_start':
        this.handleBlockStart(event);
        break;
      case 'content_block_delta':
        this.handleBlockDelta(event);
        break;
      case 'content_block_stop':
        this.handleBlockStop(event.index);
        break;
      case 'error':
        this.emitError(event.error.message, event.error.type);
        break;
    }
  }

  private handleBlockStart(event: ContentBlockStart): void {
    const block = event.content_block;
    const pending: PendingBlock = {
      index: event.index,
      type: block.type,
      content: '',
    };

    if (block.type === 'thinking') {
      pending.content = block.thinking;
    } else if (block.type === 'text') {
      pending.content = block.text;
    } else if (block.type === 'tool_use') {
      pending.toolId = block.id;
      pending.toolName = block.name;
      pending.content = '';
    }

    this.blocks.set(event.index, pending);
  }

  private handleBlockDelta(event: ContentBlockDelta): void {
    const pending = this.blocks.get(event.index);
    if (!pending) return;

    const delta = event.delta;
    if (delta.type === 'thinking_delta') {
      pending.content += delta.thinking;
    } else if (delta.type === 'text_delta') {
      pending.content += delta.text;
    } else if (delta.type === 'input_json_delta') {
      pending.content += delta.partial_json;
    }
  }

  private handleBlockStop(index: number): void {
    const pending = this.blocks.get(index);
    if (!pending) return;

    this.blocks.delete(index);
    const timestamp = new Date().toISOString();
    const session = this.getSession();

    if (pending.type === 'thinking') {
      this.onActivity({
        type: 'thinking',
        content: pending.content,
        timestamp,
        session,
      });
    } else if (pending.type === 'text') {
      this.onActivity({
        type: 'text',
        content: pending.content,
        timestamp,
        session,
      });
    } else if (pending.type === 'tool_use') {
      let input: unknown;
      try {
        input = JSON.parse(pending.content);
      } catch {
        input = pending.content;
      }
      this.onActivity({
        type: 'tool_call',
        toolName: pending.toolName!,
        toolId: pending.toolId!,
        input,
        timestamp,
        session,
      });
    }
  }

  private emitError(message: string, code?: string): void {
    this.onActivity({
      type: 'error',
      message,
      code,
      timestamp: new Date().toISOString(),
      session: this.getSession(),
    });
  }

  reset(): void {
    this.blocks.clear();
  }
}
