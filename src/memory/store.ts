/**
 * File-based memory store for the Dexter-Br agent.
 *
 * Persists notes across sessions using plain markdown files:
 *  - ~/.dexter/MEMORY.md       — long-term notes (manual / agent-written)
 *  - ~/.dexter/daily/YYYY-MM-DD.md — daily session notes
 *
 * This is the persistence layer. No vector search or SQLite required.
 * A future upgrade can layer semantic recall on top of these files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const DEXTER_DIR = join(homedir(), '.dexter');
const LONG_TERM_PATH = join(DEXTER_DIR, 'MEMORY.md');
const DAILY_DIR = join(DEXTER_DIR, 'daily');

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailyPath(date?: string): string {
  return join(DAILY_DIR, `${date ?? todayString()}.md`);
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Read the long-term memory file. Returns empty string if not found. */
export function readLongTermMemory(): string {
  if (!existsSync(LONG_TERM_PATH)) return '';
  try {
    return readFileSync(LONG_TERM_PATH, 'utf-8');
  } catch {
    return '';
  }
}

/** Read today's daily notes. Returns empty string if not found. */
export function readDailyMemory(date?: string): string {
  const path = dailyPath(date);
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Load recent memory context suitable for injection into the agent prompt.
 * Combines long-term memory + today's notes, trimmed to a token budget.
 *
 * @param maxChars - Approximate character budget (default: 8000 ≈ 2000 tokens)
 */
export function loadSessionContext(maxChars = 8000): string {
  const longTerm = readLongTermMemory();
  const daily = readDailyMemory();

  const parts: string[] = [];

  if (longTerm.trim()) {
    parts.push(`## Memória de longo prazo\n${longTerm.trim()}`);
  }
  if (daily.trim()) {
    parts.push(`## Notas de hoje (${todayString()})\n${daily.trim()}`);
  }

  if (parts.length === 0) return '';

  const combined = parts.join('\n\n');
  return combined.length > maxChars ? combined.slice(-maxChars) : combined;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Append a note to today's daily memory file. */
export function appendDailyMemory(content: string): void {
  const path = dailyPath();
  ensureDir(path);
  const timestamp = new Date().toISOString();
  appendFileSync(path, `\n<!-- ${timestamp} -->\n${content}\n`, 'utf-8');
}

/** Append a note to the long-term memory file. */
export function appendLongTermMemory(content: string): void {
  ensureDir(LONG_TERM_PATH);
  const timestamp = new Date().toISOString();
  appendFileSync(LONG_TERM_PATH, `\n<!-- ${timestamp} -->\n${content}\n`, 'utf-8');
}

/** Overwrite the long-term memory file entirely. */
export function writeLongTermMemory(content: string): void {
  ensureDir(LONG_TERM_PATH);
  writeFileSync(LONG_TERM_PATH, content, 'utf-8');
}
