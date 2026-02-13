import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export type SessionEntry = {
  sessionKey: string;
  createdAt: number;
  updatedAt: number;
  lastChannel?: string;
  lastTo?: string;
  lastAccountId?: string;
  lastAgentId?: string;
};

export type SessionStore = Record<string, SessionEntry>;

export function resolveSessionStorePath(agentId: string): string {
  const base = process.env.DEXTER_SESSIONS_DIR ?? join(homedir(), '.dexter', 'sessions');
  return join(base, agentId, 'sessions.json');
}

export function loadSessionStore(path: string): SessionStore {
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SessionStore;
  } catch {
    return {};
  }
}

export function saveSessionStore(path: string, store: SessionStore): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
}

export function upsertSessionMeta(params: {
  storePath: string;
  sessionKey: string;
  channel: string;
  to: string;
  accountId: string;
  agentId: string;
}): SessionEntry {
  const store = loadSessionStore(params.storePath);
  const existing = store[params.sessionKey];
  const now = Date.now();
  const next: SessionEntry = {
    sessionKey: params.sessionKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastChannel: params.channel,
    lastTo: params.to,
    lastAccountId: params.accountId,
    lastAgentId: params.agentId,
  };
  store[params.sessionKey] = next;
  saveSessionStore(params.storePath, store);
  return next;
}

