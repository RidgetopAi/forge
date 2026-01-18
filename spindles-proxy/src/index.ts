import express from 'express';
import { config } from './config.js';
import { sessionRouter } from './session/index.js';
import { anthropicProxyRoute } from './proxy/index.js';
import { createWebSocketServer, broadcastHub } from './ws/index.js';
import { jsonlWriter } from './logging/index.js';

const app = express();

app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    wsClients: broadcastHub.clientCount,
  });
});

app.use(sessionRouter);

app.all('/v1/*', anthropicProxyRoute);

const httpServer = app.listen(config.httpPort, () => {
  console.log(`[spindles-proxy] HTTP server listening on port ${config.httpPort}`);
});

const wss = createWebSocketServer();

jsonlWriter.init();

process.on('SIGINT', () => {
  jsonlWriter.close();
  console.log('[spindles-proxy] Shutting down...');
  broadcastHub.close();
  wss.close();
  httpServer.close();
  process.exit(0);
});
