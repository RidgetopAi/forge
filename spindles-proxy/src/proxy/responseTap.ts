import type { AnthropicSSEEvent } from '../types/anthropic.js';
import type { ActivityMessage, SirkSession } from '../types/activity.js';
import { SSEParser } from '../sse/sseParser.js';
import { BlockAssembler } from '../sse/blockAssembler.js';
import { broadcastHub } from '../ws/index.js';

export interface ResponseTapOptions {
  getSession: () => SirkSession | null;
  onActivity?: (activity: ActivityMessage) => void;
}

export class ResponseTap {
  private parser: SSEParser;
  private assembler: BlockAssembler;
  private snapshotSession: SirkSession | null;
  private onActivity?: (activity: ActivityMessage) => void;

  constructor(options: ResponseTapOptions) {
    this.snapshotSession = options.getSession();
    this.onActivity = options.onActivity;

    this.assembler = new BlockAssembler(
      (activity) => {
        broadcastHub.broadcast(activity);
        this.onActivity?.(activity);
      },
      () => this.snapshotSession
    );

    this.parser = new SSEParser((event) => {
      this.handleSSEEvent(event.data);
    });
  }

  private handleSSEEvent(data: string): void {
    try {
      const parsed = JSON.parse(data) as AnthropicSSEEvent;
      this.assembler.process(parsed);
    } catch {
      // Not valid JSON - ignore
    }
  }

  feed(chunk: string): void {
    this.parser.feed(chunk);
  }

  flush(): void {
    this.parser.flush();
  }

  reset(): void {
    this.assembler.reset();
  }
}
