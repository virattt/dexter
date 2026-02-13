import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomInt } from 'node:crypto';
import { isSelfChatMode, normalizeE164 } from './utils.js';

const PAIRING_REPLY_HISTORY_GRACE_MS = 30_000;

type PairingRequest = {
  phone: string;
  code: string;
  createdAt: number;
};

type PairingStore = Record<string, PairingRequest>;

function pairingPath(): string {
  return (
    process.env.DEXTER_PAIRING_PATH ??
    join(homedir(), '.dexter', 'pairing', 'whatsapp.json')
  );
}

function loadPairingStore(): PairingStore {
  const path = pairingPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PairingStore;
  } catch {
    return {};
  }
}

function savePairingStore(store: PairingStore): void {
  const path = pairingPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
}

export function createPairingCode(): string {
  return String(randomInt(100000, 999999));
}

export function recordPairingRequest(phone: string): PairingRequest {
  const normalized = normalizeE164(phone);
  const store = loadPairingStore();
  const existing = store[normalized];
  if (existing) {
    return existing;
  }
  const request: PairingRequest = {
    phone: normalized,
    code: createPairingCode(),
    createdAt: Date.now(),
  };
  store[normalized] = request;
  savePairingStore(store);
  return request;
}

export function isAllowedPhone(params: {
  from: string;
  allowFrom: string[];
}): { allowed: boolean; normalizedFrom: string } {
  const normalizedFrom = normalizeE164(params.from);
  const allowFrom = params.allowFrom.map(normalizeE164).filter(Boolean);
  if (allowFrom.includes('+*') || params.allowFrom.includes('*')) {
    return { allowed: true, normalizedFrom };
  }
  return { allowed: allowFrom.includes(normalizedFrom), normalizedFrom };
}

export function buildPairingReply(code: string, senderId: string): string {
  return [
    'Dexter access request received.',
    `Sender ID: ${senderId}`,
    `Approval code: ${code}`,
    'Ask the operator to approve this code in Dexter gateway config.',
  ].join('\n');
}

export type InboundAccessControlResult = {
  allowed: boolean;
  shouldMarkRead: boolean;
  isSelfChat: boolean;
  resolvedAccountId: string;
};

export async function checkInboundAccessControl(params: {
  accountId: string;
  from: string;
  selfE164: string | null;
  senderE164: string | null;
  group: boolean;
  pushName?: string;
  isFromMe: boolean;
  dmPolicy: 'pairing' | 'allowlist' | 'open' | 'disabled';
  groupPolicy: 'open' | 'allowlist' | 'disabled';
  allowFrom: string[];
  groupAllowFrom: string[];
  messageTimestampMs?: number;
  connectedAtMs?: number;
  pairingGraceMs?: number;
  reply: (text: string) => Promise<void>;
}): Promise<InboundAccessControlResult> {
  const isSamePhone = params.from === params.selfE164;
  const isSelfChat = isSelfChatMode(params.selfE164, params.allowFrom);
  const pairingGraceMs =
    typeof params.pairingGraceMs === 'number' && params.pairingGraceMs > 0
      ? params.pairingGraceMs
      : PAIRING_REPLY_HISTORY_GRACE_MS;
  const suppressPairingReply =
    typeof params.connectedAtMs === 'number' &&
    typeof params.messageTimestampMs === 'number' &&
    params.messageTimestampMs < params.connectedAtMs - pairingGraceMs;

  const dmHasWildcard = params.allowFrom.includes('*');
  const normalizedAllowFrom = params.allowFrom.filter((entry) => entry !== '*').map(normalizeE164);
  const groupHasWildcard = params.groupAllowFrom.includes('*');
  const normalizedGroupAllowFrom = params.groupAllowFrom
    .filter((entry) => entry !== '*')
    .map(normalizeE164);

  if (params.group && params.groupPolicy === 'disabled') {
    return {
      allowed: false,
      shouldMarkRead: false,
      isSelfChat,
      resolvedAccountId: params.accountId,
    };
  }

  if (params.group && params.groupPolicy === 'allowlist') {
    if (normalizedGroupAllowFrom.length === 0 && !groupHasWildcard) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
      };
    }
    const senderAllowed =
      groupHasWildcard ||
      (params.senderE164 != null && normalizedGroupAllowFrom.includes(params.senderE164));
    if (!senderAllowed) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
      };
    }
  }

  if (!params.group) {
    // Skip outbound DMs to other people, but allow self-chat
    // In self-chat mode with LID format, isSamePhone may be false even for self-chat
    if (params.isFromMe && !isSamePhone && !isSelfChat) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
      };
    }
    if (params.dmPolicy === 'disabled') {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
      };
    }
    // In self-chat mode, skip allowlist check (LID won't match phone number)
    if (params.dmPolicy !== 'open' && !isSamePhone && !isSelfChat) {
      const allowed =
        dmHasWildcard ||
        (normalizedAllowFrom.length > 0 && normalizedAllowFrom.includes(params.from));
      if (!allowed) {
        if (params.dmPolicy === 'pairing' && !suppressPairingReply) {
          const pairing = recordPairingRequest(params.from);
          await params.reply(buildPairingReply(pairing.code, params.from));
        }
        return {
          allowed: false,
          shouldMarkRead: false,
          isSelfChat,
          resolvedAccountId: params.accountId,
        };
      }
    }
  }

  return {
    allowed: true,
    shouldMarkRead: true,
    isSelfChat,
    resolvedAccountId: params.accountId,
  };
}

