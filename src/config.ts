import { z } from 'zod';

export const ForgeConfigSchema = z.object({
  runName: z.string().min(1, 'runName is required'),
  totalInstances: z.number().int().positive('totalInstances must be positive'),
  project: z.string().min(1, 'project is required'),
  seedPath: z.string().min(1, 'seedPath is required'),
  spindlesProxyUrl: z.string().url().default('http://localhost:8082'),
  mandrelUrl: z.string().url().default('http://localhost:8080'),
  timeoutMinutes: z.number().positive().default(30)
});

export type ForgeConfig = z.infer<typeof ForgeConfigSchema>;

export type ParseResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export function parseConfig(input: string): ParseResult<ForgeConfig> {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(input);
  } catch {
    return { success: false, error: 'Invalid JSON input' };
  }
  
  const result = ForgeConfigSchema.safeParse(parsed);
  
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { success: false, error: issues };
  }
  
  return { success: true, data: result.data };
}
