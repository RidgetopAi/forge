/**
 * Spindles Streamer
 * Streams thinking blocks to the spindles viewer in real-time
 */

import { randomUUID } from 'crypto';

export interface SpindleData {
  id: string;
  timestamp: string;
  sessionId: string;
  type: 'thinking';
  content: string;
  tokenCount: number;
  runId?: string;
  turnNumber?: number;
}

export class SpindlesStreamer {
  private enabled: boolean;
  private viewerUrl: string;
  private sessionId: string;

  constructor(enabled: boolean = false, viewerUrl: string = 'http://localhost:3737') {
    this.enabled = enabled;
    this.viewerUrl = viewerUrl;
    this.sessionId = randomUUID();

    if (this.enabled) {
      console.log(`🎡 Spindles streaming ENABLED → ${viewerUrl}`);
      console.log(`📡 Session ID: ${this.sessionId}`);
    }
  }

  /**
   * Stream a thinking block to the viewer
   */
  async streamThinking(
    content: string,
    runId: string,
    turnNumber: number
  ): Promise<void> {
    if (!this.enabled || !content || content.trim().length === 0) {
      return;
    }

    const spindle: SpindleData = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      type: 'thinking',
      content: content.trim(),
      tokenCount: Math.round(content.split(' ').length * 1.3), // rough estimate
      runId,
      turnNumber,
    };

    try {
      // Send to viewer's POST endpoint
      const response = await fetch(`${this.viewerUrl}/spindles/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spindle }),
      });

      if (response.ok) {
        console.log(`  🎡 Streamed thinking block (${spindle.tokenCount} tokens)`);
      } else {
        console.error(`  ⚠️  Spindles POST failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Fail silently - don't interrupt execution if streaming fails
      console.error(`  ⚠️  Spindles streaming error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Stream multiple thinking blocks
   */
  async streamThinkingBlocks(
    thinkingBlocks: string[],
    runId: string,
    turnNumber: number
  ): Promise<void> {
    if (!this.enabled || thinkingBlocks.length === 0) {
      return;
    }

    for (const block of thinkingBlocks) {
      await this.streamThinking(block, runId, turnNumber);
    }
  }

  /**
   * Test connection to viewer
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await fetch(this.viewerUrl, { method: 'HEAD' });
      const connected = response.ok;

      if (connected) {
        console.log(`✅ Spindles viewer connected at ${this.viewerUrl}`);
      } else {
        console.log(`⚠️  Spindles viewer not responding at ${this.viewerUrl}`);
      }

      return connected;
    } catch (error) {
      console.log(`⚠️  Cannot connect to spindles viewer at ${this.viewerUrl}`);
      console.log(`   Make sure viewer is running: cd ~/aidis/spindles-viewer && ./start.sh`);
      return false;
    }
  }
}
