import { Router, type Router as RouterType } from 'express';
import * as sessionStore from './sessionStore.js';
import type { SirkSession } from '../types/activity.js';

export const sessionRouter: RouterType = Router();

sessionRouter.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        (req as unknown as { body: unknown }).body = body ? JSON.parse(body) : {};
      } catch {
        (req as unknown as { body: unknown }).body = {};
      }
      next();
    });
  } else {
    next();
  }
});

sessionRouter.post('/sirk/session', (req, res) => {
  const body = (req as unknown as { body: Record<string, unknown> }).body;
  
  const { runName, instanceNumber, totalInstances, project } = body;
  
  if (typeof runName !== 'string' || typeof project !== 'string') {
    res.status(400).json({ error: 'runName and project are required strings' });
    return;
  }
  
  if (typeof instanceNumber !== 'number' || typeof totalInstances !== 'number') {
    res.status(400).json({ error: 'instanceNumber and totalInstances are required numbers' });
    return;
  }
  
  const session: SirkSession = { runName, instanceNumber, totalInstances, project };
  sessionStore.setCurrent(session);
  
  console.log(`[session] Set: ${project}/${runName} instance ${instanceNumber}/${totalInstances}`);
  res.status(201).json(session);
});

sessionRouter.get('/sirk/session', (_req, res) => {
  const session = sessionStore.getCurrent();
  if (!session) {
    res.status(404).json({ error: 'No active session' });
    return;
  }
  res.json(session);
});

sessionRouter.delete('/sirk/session', (_req, res) => {
  sessionStore.clear();
  console.log('[session] Cleared');
  res.status(204).end();
});
