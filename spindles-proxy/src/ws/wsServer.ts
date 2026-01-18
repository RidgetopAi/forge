import { WebSocketServer } from 'ws';
import { config } from '../config.js';
import { broadcastHub } from './broadcastHub.js';

export function createWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ port: config.wsPort, path: config.wsPath });

  wss.on('listening', () => {
    console.log(`[spindles-proxy] WebSocket server listening on port ${config.wsPort}${config.wsPath}`);
  });

  wss.on('connection', (ws) => {
    broadcastHub.add(ws);
  });

  wss.on('error', (err) => {
    console.error('[ws] Server error:', err);
  });

  return wss;
}
