import express, { type Express } from 'express';
import { anthropicProxyRoute } from './anthropicProxyRoute.js';

export function createProxyApp(): Express {
  const app = express();

  app.all('/v1/*', anthropicProxyRoute);

  return app;
}
