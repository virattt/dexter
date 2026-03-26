/**
 * TDD tests for session-store.ts — session persistence file I/O.
 * All tests use an isolated tmp directory; no side effects on .dexter/.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HistoryItem } from '../types.js';
import {
  generateSessionName,
  createSession,
  saveSession,
  listSessions,
  loadSession,
  type SessionFile,
} from './session-store.js';

// ─── helpers ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'dexter-sessions-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeItem(query: string, answer: string): HistoryItem {
  return { id: String(Date.now()), query, events: [], answer, status: 'complete' };
}

// Fixed UTC timestamps for deterministic name assertions.
const TS_2026_03_26 = new Date('2026-03-26T12:00:00.000Z').getTime();

// ─── generateSessionName ────────────────────────────────────────────────────

describe('generateSessionName', () => {
  it('prefixes with UTC date derived from timestamp', () => {
    const name = generateSessionName('hello world', TS_2026_03_26);
    expect(name.startsWith('2026-03-26 ')).toBe(true);
  });

  it('appends first 6 words of the query', () => {
    const name = generateSessionName('perform a deep analysis of Chevron stock today', TS_2026_03_26);
    // "perform a deep analysis of Chevron" — 6 words, "stock today" omitted
    expect(name).toBe('2026-03-26 perform a deep analysis of Chevron');
  });

  it('works fine with fewer than 6 words', () => {
    const name = generateSessionName('hello', TS_2026_03_26);
    expect(name).toBe('2026-03-26 hello');
  });

  it('truncates names longer than 60 chars with ellipsis', () => {
    // Use long individual words so the first 6 exceed 60 chars when combined with the date.
    const long = Array.from({ length: 6 }, () => 'averylongtoken').join(' ');
    const name = generateSessionName(long, TS_2026_03_26);
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name.endsWith('…')).toBe(true);
  });

  it('does not add ellipsis when name fits within 60 chars', () => {
    const name = generateSessionName('short query', TS_2026_03_26);
    expect(name.endsWith('…')).toBe(false);
    expect(name.length).toBeLessThanOrEqual(60);
  });
});

// ─── createSession ───────────────────────────────────────────────────────────

describe('createSession', () => {
  it('returns a SessionFile with correct initial shape', async () => {
    const session = await createSession('analyze Chevron stock', tmpDir);
    expect(session.version).toBe(1);
    expect(typeof session.id).toBe('string');
    expect(session.id.length).toBeGreaterThan(0);
    expect(session.name).toContain('analyze Chevron');
    expect(session.queryCount).toBe(0);
    expect(session.llmMessages).toEqual([]);
    expect(session.history).toEqual([]);
    expect(typeof session.created).toBe('number');
    expect(typeof session.lastModified).toBe('number');
  });

  it('persists the session file to disk', async () => {
    const session = await createSession('my first query', tmpDir);
    const loaded = await loadSession(session.id, tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
  });

  it('adds the new session to the index', async () => {
    await createSession('first query', tmpDir);
    const sessions = await listSessions(tmpDir);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toContain('first query');
  });

  it('generates unique IDs for concurrent calls', async () => {
    // Even if called in very quick succession the IDs must differ.
    const [a, b] = await Promise.all([
      createSession('query A', tmpDir),
      createSession('query B', tmpDir),
    ]);
    expect(a.id).not.toBe(b.id);
  });
});

// ─── saveSession ─────────────────────────────────────────────────────────────

describe('saveSession', () => {
  it('persists llmMessages and history to disk', async () => {
    const session = await createSession('analyze Tesla', tmpDir);
    const item = makeItem('analyze Tesla', 'Tesla is an EV manufacturer');
    const updated: SessionFile = {
      ...session,
      queryCount: 1,
      lastModified: Date.now(),
      llmMessages: [{ query: 'analyze Tesla', answer: 'Tesla is an EV manufacturer', summary: 'EV analysis' }],
      history: [item],
    };
    await saveSession(updated, tmpDir);

    const loaded = await loadSession(session.id, tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.llmMessages).toHaveLength(1);
    expect(loaded!.llmMessages[0].query).toBe('analyze Tesla');
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.queryCount).toBe(1);
  });

  it('updates the index queryCount and lastModified', async () => {
    const session = await createSession('analyze Tesla', tmpDir);
    const updated: SessionFile = {
      ...session,
      queryCount: 7,
      lastModified: session.created + 60_000,
      llmMessages: [],
      history: [],
    };
    await saveSession(updated, tmpDir);

    const sessions = await listSessions(tmpDir);
    expect(sessions[0].queryCount).toBe(7);
    expect(sessions[0].lastModified).toBe(session.created + 60_000);
  });

  it('persists priorSummary when provided', async () => {
    const session = await createSession('long session', tmpDir);
    const updated: SessionFile = {
      ...session,
      queryCount: 15,
      lastModified: Date.now(),
      priorSummary: 'Key insight: Chevron is undervalued.',
      llmMessages: [],
      history: [],
    };
    await saveSession(updated, tmpDir);

    const loaded = await loadSession(session.id, tmpDir);
    expect(loaded!.priorSummary).toBe('Key insight: Chevron is undervalued.');
  });

  it('is atomic — full file is readable after save', async () => {
    const session = await createSession('resilience test', tmpDir);
    // Simulate multiple rapid saves
    const saves = Array.from({ length: 5 }, (_, i) =>
      saveSession({ ...session, queryCount: i + 1, lastModified: Date.now(), llmMessages: [], history: [] }, tmpDir),
    );
    await Promise.all(saves);
    const loaded = await loadSession(session.id, tmpDir);
    expect(loaded).not.toBeNull();
    // queryCount should be one of 1-5 — file is not corrupted
    expect(loaded!.queryCount).toBeGreaterThanOrEqual(1);
    expect(loaded!.queryCount).toBeLessThanOrEqual(5);
  });
});

// ─── listSessions ────────────────────────────────────────────────────────────

describe('listSessions', () => {
  it('returns empty array when no sessions exist', async () => {
    expect(await listSessions(tmpDir)).toEqual([]);
  });

  it('returns sessions newest-first', async () => {
    await createSession('first', tmpDir);
    // Small delay so `created` timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    await createSession('second', tmpDir);

    const sessions = await listSessions(tmpDir);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].name).toContain('second');
    expect(sessions[1].name).toContain('first');
  });

  it('returns only index metadata — no llmMessages or history', async () => {
    await createSession('metadata only', tmpDir);
    const sessions = await listSessions(tmpDir);
    expect((sessions[0] as any).llmMessages).toBeUndefined();
    expect((sessions[0] as any).history).toBeUndefined();
  });

  it('includes id, name, created, lastModified, queryCount, file', async () => {
    await createSession('structured entry', tmpDir);
    const [entry] = await listSessions(tmpDir);
    expect(entry.id).toBeTruthy();
    expect(entry.name).toBeTruthy();
    expect(entry.created).toBeGreaterThan(0);
    expect(entry.lastModified).toBeGreaterThan(0);
    expect(typeof entry.queryCount).toBe('number');
    expect(entry.file).toMatch(/\.json$/);
  });
});

// ─── loadSession ─────────────────────────────────────────────────────────────

describe('loadSession', () => {
  it('returns null for a non-existent ID', async () => {
    expect(await loadSession('ghost-id-999', tmpDir)).toBeNull();
  });

  it('returns the full SessionFile by ID', async () => {
    const session = await createSession('load me please', tmpDir);
    const loaded = await loadSession(session.id, tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
    expect(loaded!.name).toContain('load me');
  });
});
