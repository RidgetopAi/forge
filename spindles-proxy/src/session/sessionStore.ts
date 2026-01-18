import type { SirkSession } from '../types/activity.js';

let currentSession: SirkSession | null = null;

export function getCurrent(): SirkSession | null {
  return currentSession;
}

export function setCurrent(session: SirkSession): void {
  currentSession = session;
}

export function clear(): void {
  currentSession = null;
}

export function snapshot(): SirkSession | null {
  return currentSession ? { ...currentSession } : null;
}
