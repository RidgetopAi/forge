import { readFileSync } from 'fs';
import type { ForgeConfig } from '../config.js';

const PROMPT_TEMPLATE = `You are instance {n} of {total} in run "{runName}".
Project: {project}

## Mandrel Access
To store context or access Mandrel tools, use SSH + curl:
\`\`\`bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/{toolName} -H "Content-Type: application/json" -d '\\''{\"arguments\": {...}}'\\'''
\`\`\`

Example - store a context:
\`\`\`bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_store -H "Content-Type: application/json" -d '\\''{\"arguments\": {\"content\": \"Your content here\", \"type\": \"completion\", \"tags\": [\"tag1\"]}}'\\''"
\`\`\`

Example - get recent contexts:
\`\`\`bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_get_recent -H "Content-Type: application/json" -d '\\''{\"arguments\": {}}'\\'''
\`\`\`

## Your Task (from seed document)
{seedContent}

---
Complete your task as described above. Remember to store your work to Mandrel.`;

export function renderPrompt(config: ForgeConfig, instanceNumber: number): string {
  let seedContent: string;
  try {
    seedContent = readFileSync(config.seedPath, 'utf-8');
  } catch (err) {
    seedContent = `[ERROR: Could not read seed file at ${config.seedPath}: ${err}]`;
  }

  return PROMPT_TEMPLATE
    .replace('{n}', String(instanceNumber))
    .replace('{total}', String(config.totalInstances))
    .replace('{runName}', config.runName)
    .replace('{project}', config.project)
    .replace('{seedContent}', seedContent);
}
