/**
 * Session persistence — file I/O layer.
 *
 * Storage layout:
 *   {baseDir}/.dexter/sessions/_index.json   — lightweight metadata for fast listing
 *   {baseDir}/.dexter/sessions/{id}.json     — full session file (two-layer format)
 *
 * Two-layer format keeps the file lean:
 *   llmMessages  — compact (query + answer + summary), seeded into InMemoryChatHistory on resume
 *   history      — full HistoryItem[] for terminal scrollback display
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { getDexterDir } from './paths.js';
import type { HistoryItem } from '../types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionLlmMessage {
  query: string;
  answer: string;
  summary: string | null;
}

export interface SessionIndexEntry {
  id: string;
  name: string;
  created: number;
  lastModified: number;
  queryCount: number;
  /** Filename (relative to sessions dir) */
  file: string;
}

interface SessionIndex {
  sessions: SessionIndexEntry[];
}

export interface SessionFile {
  version: 1;
  id: string;
  name: string;
  created: number;
  lastModified: number;
  queryCount: number;
  /** LLM-generated summary of exchanges older than DEFAULT_HISTORY_LIMIT */
  priorSummary?: string;
  /** Compact messages for seeding InMemoryChatHistory on resume */
  llmMessages: SessionLlmMessage[];
  /** Full HistoryItem[] for terminal scrollback display */
  history: HistoryItem[];
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const SESSIONS_DIR = 'sessions';
const INDEX_FILE = '_index.json';

function sessionsDir(baseDir: string): string {
  return join(baseDir, getDexterDir(), SESSIONS_DIR);
}

function indexPath(baseDir: string): string {
  return join(sessionsDir(baseDir), INDEX_FILE);
}

function sessionFilePath(id: string, baseDir: string): string {
  return join(sessionsDir(baseDir), `${id}.json`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureSessionsDir(baseDir: string): Promise<void> {
  const dir = sessionsDir(baseDir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function readIndex(baseDir: string): Promise<SessionIndex> {
  const path = indexPath(baseDir);
  if (!existsSync(path)) return { sessions: [] };
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as SessionIndex;
  } catch {
    return { sessions: [] };
  }
}

async function writeIndex(index: SessionIndex, baseDir: string): Promise<void> {
  const path = indexPath(baseDir);
  const tmp = `${path}.${randomBytes(3).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(index, null, 2), 'utf-8');
  await rename(tmp, path);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates a human-readable session name from the first query and creation timestamp.
 * Format: "YYYY-MM-DD first six words of query" (capped at 60 chars).
 */
export function generateSessionName(firstQuery: string, created: number): string {
  const d = new Date(created);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${day}`;

  const words = firstQuery.trim().split(/\s+/).slice(0, 6).join(' ');
  const full = `${dateStr} ${words}`;

  if (full.length > 60) {
    return full.slice(0, 59) + '…';
  }
  return full;
}

function createSessionId(): string {
  // Combine timestamp + 4 random bytes for uniqueness even in concurrent calls.
  return `${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * Creates a new empty session, persists it to disk, and updates the index.
 */
export async function createSession(
  firstQuery: string,
  baseDir: string = process.cwd(),
): Promise<SessionFile> {
  await ensureSessionsDir(baseDir);

  const id = createSessionId();
  const now = Date.now();
  const session: SessionFile = {
    version: 1,
    id,
    name: generateSessionName(firstQuery, now),
    created: now,
    lastModified: now,
    queryCount: 0,
    llmMessages: [],
    history: [],
  };

  // Atomic write: use a per-call unique tmp suffix to prevent concurrent saves
  // from clobbering each other's tmp file.
  const filePath = sessionFilePath(id, baseDir);
  const tmp = `${filePath}.${randomBytes(3).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(session, null, 2), 'utf-8');
  await rename(tmp, filePath);

  // Update index
  const index = await readIndex(baseDir);
  index.sessions.push({
    id,
    name: session.name,
    created: session.created,
    lastModified: session.lastModified,
    queryCount: session.queryCount,
    file: `${id}.json`,
  });
  await writeIndex(index, baseDir);

  return session;
}

/**
 * Atomically saves a session file and updates its index entry.
 */
export async function saveSession(
  session: SessionFile,
  baseDir: string = process.cwd(),
): Promise<void> {
  await ensureSessionsDir(baseDir);

  const filePath = sessionFilePath(session.id, baseDir);
  const tmp = `${filePath}.${randomBytes(3).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(session, null, 2), 'utf-8');
  await rename(tmp, filePath);

  const index = await readIndex(baseDir);
  const idx = index.sessions.findIndex((s) => s.id === session.id);
  const entry: SessionIndexEntry = {
    id: session.id,
    name: session.name,
    created: session.created,
    lastModified: session.lastModified,
    queryCount: session.queryCount,
    file: `${session.id}.json`,
  };
  if (idx >= 0) {
    index.sessions[idx] = entry;
  } else {
    index.sessions.push(entry);
  }
  await writeIndex(index, baseDir);
}

/**
 * Returns index entries sorted newest-first (no full session data).
 */
export async function listSessions(
  baseDir: string = process.cwd(),
): Promise<SessionIndexEntry[]> {
  const index = await readIndex(baseDir);
  return [...index.sessions].sort((a, b) => b.created - a.created);
}

/**
 * Loads the full session file by ID. Returns null if not found.
 */
export async function loadSession(
  id: string,
  baseDir: string = process.cwd(),
): Promise<SessionFile | null> {
  const filePath = sessionFilePath(id, baseDir);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as SessionFile;
  } catch {
    return null;
  }
}
