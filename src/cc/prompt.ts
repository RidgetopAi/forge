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

## Your Task
Read your task instructions from the seed document at: {seedPath}

After reading, complete the task and store your work to Mandrel.`;

export function renderPrompt(config: ForgeConfig, instanceNumber: number): string {
  return PROMPT_TEMPLATE
    .replace('{n}', String(instanceNumber))
    .replace('{total}', String(config.totalInstances))
    .replace('{runName}', config.runName)
    .replace('{project}', config.project)
    .replace('{seedPath}', config.seedPath);
}
