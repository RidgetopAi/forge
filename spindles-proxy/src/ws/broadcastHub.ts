import type { WebSocket } from 'ws';
import type { WebSocketMessage } from '../types/activity.js';

const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB backpressure threshold

class BroadcastHub {
  private clients: Set<WebSocket> = new Set();

  add(ws: WebSocket): void {
    this.clients.add(ws);
    console.log(`[ws] Client connected (${this.clients.size} total)`);

    const ack: WebSocketMessage = {
      type: 'connection_ack',
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(ack));

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`[ws] Client disconnected (${this.clients.size} total)`);
    });

    ws.on('error', (err) => {
      console.error('[ws] Client error:', err);
      this.clients.delete(ws);
    });
  }

  broadcast(message: WebSocketMessage): void {
    const json = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState !== 1) { // 1 = OPEN
        continue;
      }

      if (client.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        console.warn('[ws] Dropping slow client due to backpressure');
        client.close(1008, 'Backpressure limit exceeded');
        this.clients.delete(client);
        continue;
      }

      client.send(json);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  close(): void {
    for (const client of this.clients) {
      client.close(1001, 'Server shutting down');
    }
    this.clients.clear();
  }
}

export const broadcastHub = new BroadcastHub();
