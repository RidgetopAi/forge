export const config = {
  httpPort: parseInt(process.env.HTTP_PORT ?? '8082', 10),
  wsPort: parseInt(process.env.WS_PORT ?? '8083', 10),
  wsPath: '/spindles',
  anthropicBaseUrl: process.env.ANTHROPIC_UPSTREAM_URL ?? 'https://api.anthropic.com',
  logFile: process.env.LOG_FILE ?? 'spindles.jsonl',
} as const;

export type Config = typeof config;
