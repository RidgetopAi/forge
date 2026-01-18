import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { sessionStore } from '../session/index.js';
import { extractToolResults } from './requestTap.js';
import { ResponseTap } from './responseTap.js';
import { broadcastHub } from '../ws/index.js';
import { jsonlWriter } from '../logging/index.js';

export async function anthropicProxyRoute(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const targetUrl = `${config.anthropicBaseUrl}${req.originalUrl}`;

  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'host') continue;
      if (key.toLowerCase() === 'connection') continue;
      if (key.toLowerCase() === 'content-length') continue;
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    }

    // Read body using event-based approach (more reliable than async iteration)
    const body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    const session = sessionStore.snapshot();
    const toolResults = extractToolResults(body, session);
    for (const tr of toolResults) {
      broadcastHub.broadcast(tr);
      jsonlWriter.write(tr);
    }

    const fetchResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : new Uint8Array(body),
    });

    res.status(fetchResponse.status);

    for (const [key, value] of fetchResponse.headers.entries()) {
      if (key.toLowerCase() === 'transfer-encoding') continue;
      if (key.toLowerCase() === 'content-encoding') continue;
      res.setHeader(key, value);
    }

    if (!fetchResponse.body) {
      res.end();
      return;
    }

    const contentType = fetchResponse.headers.get('content-type') ?? '';
    const isSSE = contentType.includes('text/event-stream');

    const responseTap = isSSE ? new ResponseTap({ 
      getSession: () => session,
      onActivity: (activity) => jsonlWriter.write(activity),
    }) : null;
    const reader = fetchResponse.body.getReader();
    const decoder = new TextDecoder();

    const pump = async (): Promise<void> => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          responseTap?.flush();
          res.end();
          return;
        }

        if (responseTap) {
          responseTap.feed(decoder.decode(value, { stream: true }));
        }

        const ok = res.write(value);
        if (!ok) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    };

    await pump();
  } catch (err) {
    console.error('[proxy] Error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Proxy error', message: String(err) });
    } else {
      res.end();
    }
  }
}
