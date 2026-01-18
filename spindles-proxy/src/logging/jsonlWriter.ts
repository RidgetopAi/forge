import { createWriteStream, type WriteStream } from 'fs';
import { config } from '../config.js';
import type { ActivityMessage } from '../types/activity.js';

class JSONLWriter {
  private stream: WriteStream | null = null;
  private pending: string[] = [];

  init(): void {
    if (this.stream) return;

    this.stream = createWriteStream(config.logFile, { flags: 'a' });

    this.stream.on('error', (err) => {
      console.error('[jsonl] Write error:', err);
    });

    for (const line of this.pending) {
      this.stream.write(line);
    }
    this.pending = [];

    process.on('beforeExit', () => this.close());
    process.on('SIGINT', () => this.close());
  }

  write(activity: ActivityMessage): void {
    const line = JSON.stringify(activity) + '\n';

    if (this.stream) {
      this.stream.write(line);
    } else {
      this.pending.push(line);
    }
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

export const jsonlWriter = new JSONLWriter();
