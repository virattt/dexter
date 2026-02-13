import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadSessionStore,
  resolveSessionStorePath,
  upsertSessionMeta,
} from './store.js';

describe('session store', () => {
  test('creates and updates session metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-sessions-'));
    process.env.DEXTER_SESSIONS_DIR = dir;
    try {
      const storePath = resolveSessionStorePath('agentA');
      upsertSessionMeta({
        storePath,
        sessionKey: 'agent:agentA:whatsapp:default:direct:+15551234567',
        channel: 'whatsapp',
        to: '+15551234567',
        accountId: 'default',
        agentId: 'agentA',
      });
      const store = loadSessionStore(storePath);
      const entry = store['agent:agentA:whatsapp:default:direct:+15551234567'];
      expect(entry).toBeDefined();
      expect(entry.lastAgentId).toBe('agentA');
      expect(entry.lastChannel).toBe('whatsapp');
    } finally {
      delete process.env.DEXTER_SESSIONS_DIR;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

