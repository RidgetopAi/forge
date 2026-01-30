import type { ForgeConfig } from '../config.js';

const PROMPT_TEMPLATE = `You are instance {n} of {total} in run "{runName}".
Project: {project}

## CRITICAL: Mandrel Context Storage (MANDATORY)

You are part of a SIRK (Sequential Instance Recursive Knowledge) run. Future instances will build on YOUR thinking.

**YOU MUST store your work to Mandrel before your session ends. This is not optional.**

What to store:
- Your reasoning and analysis (type: "planning" or "reflections")
- Key conclusions and decisions (type: "decision")
- Open questions for future instances (type: "discussion")
- Session summary/handoff (type: "handoff")

### How to Store Context
\`\`\`bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_store -H "Content-Type: application/json" -d '\\''{\"arguments\": {\"content\": \"Your content here\", \"type\": \"planning\", \"tags\": [\"sirk\", \"instance-{n}\"]}}'\\''"
\`\`\`

### How to Read Previous Instance Work
\`\`\`bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_get_recent -H "Content-Type: application/json" -d '\\''{\"arguments\": {}}'\\''"
\`\`\`

### Context Types
- \`planning\` - Analysis, exploration, reasoning
- \`decision\` - Conclusions, choices made
- \`reflections\` - Lessons learned, self-correction
- \`discussion\` - Open questions, ideas to explore
- \`handoff\` - Summary for next instance

## Your Task
1. Read your task instructions from the seed document at: {seedPath}
2. If not instance 1: Read previous contexts from Mandrel first
3. Do your work - think deeply, explore thoroughly
4. **STORE your reasoning and conclusions to Mandrel** (REQUIRED)
5. End with a handoff context summarizing what you did and what's next`;

export function renderPrompt(config: ForgeConfig, instanceNumber: number): string {
  return PROMPT_TEMPLATE
    .replaceAll('{n}', String(instanceNumber))
    .replaceAll('{total}', String(config.totalInstances))
    .replaceAll('{runName}', config.runName)
    .replaceAll('{project}', config.project)
    .replaceAll('{seedPath}', config.seedPath);
}
