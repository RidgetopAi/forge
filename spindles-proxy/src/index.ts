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

// Test endpoint to inject a message into the broadcast stream
app.post('/test-broadcast', express.json(), (req, res) => {
  const testMsg = req.body.message || {
    type: 'text',
    content: '🧪 TEST MESSAGE - If you see this, the stream is working!',
    timestamp: new Date().toISOString(),
    session: {
      runName: 'test-broadcast',
      instanceNumber: 99,
      totalInstances: 99,
      project: 'test'
    }
  };
  broadcastHub.broadcast(testMsg);
  res.json({ success: true, broadcast: testMsg, clients: broadcastHub.clientCount });
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
