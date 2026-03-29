import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDexterDir } from './paths.js';

export interface ErrorLogEntry {
  timestamp: string;  // ISO 8601
  type: string;       // classifyError result
  message: string;
  context?: string;   // optional caller context (e.g., "tool:get_stock_price")
  stack?: string;
}

function getLogsDir(): string {
  return join(getDexterDir(), 'logs');
}

function getLogFile(): string {
  return join(getLogsDir(), 'errors.jsonl');
}

export function logError(entry: Omit<ErrorLogEntry, 'timestamp'>): void {
  try {
    const logsDir = getLogsDir();
    mkdirSync(logsDir, { recursive: true });

    const fullEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    appendFileSync(getLogFile(), JSON.stringify(fullEntry) + '\n', 'utf-8');
  } catch {
    // Silently swallow — logging must never crash the app
  }
}
