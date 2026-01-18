import type { ForgeConfig } from '../config.js';

const PROMPT_TEMPLATE = `You are instance {n} of {total} in run "{runName}".
Project: {project}
Your task is defined in the seed document at: {seedPath}

Read the seed document to understand your task. At the end of your work, store a handoff context using Mandrel context_store with type "handoff".`;

export function renderPrompt(config: ForgeConfig, instanceNumber: number): string {
  return PROMPT_TEMPLATE
    .replace('{n}', String(instanceNumber))
    .replace('{total}', String(config.totalInstances))
    .replace('{runName}', config.runName)
    .replace('{project}', config.project)
    .replace('{seedPath}', config.seedPath);
}
