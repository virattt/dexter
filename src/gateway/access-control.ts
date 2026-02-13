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
  denyReason?: string;
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
  const normalizedSelfE164 = params.selfE164 ? normalizeE164(params.selfE164) : null;
  const normalizedFrom = normalizeE164(params.from);
  const normalizedSenderE164 = params.senderE164 ? normalizeE164(params.senderE164) : null;
  const isSamePhone = normalizedSelfE164 != null && normalizedFrom === normalizedSelfE164;
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

  // Strict self-chat mode: only allow direct messages to/from the user's own number.
  // This provides fail-closed behavior even if policies are accidentally broadened.
  if (isSelfChat) {
    if (params.group) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'group_blocked_self_chat_mode',
      };
    }
    const senderIsSelf =
      normalizedSelfE164 != null &&
      (normalizedFrom === normalizedSelfE164 || normalizedSenderE164 === normalizedSelfE164);
    if (!senderIsSelf) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'sender_not_self_in_self_chat_mode',
      };
    }
    return {
      allowed: true,
      shouldMarkRead: true,
      isSelfChat,
      resolvedAccountId: params.accountId,
    };
  }

  // Block group messages unless explicitly allowed via 'open' or 'allowlist' policy.
  // Fail-safe: if groupPolicy is missing/invalid, groups are blocked.
  if (params.group) {
    if (params.groupPolicy !== 'open' && params.groupPolicy !== 'allowlist') {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'group_policy_not_permissive',
      };
    }
  }

  if (params.group && params.groupPolicy === 'allowlist') {
    if (normalizedGroupAllowFrom.length === 0 && !groupHasWildcard) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'group_allowlist_empty',
      };
    }
    const senderAllowed =
      groupHasWildcard ||
      (normalizedSenderE164 != null && normalizedGroupAllowFrom.includes(normalizedSenderE164));
    if (!senderAllowed) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'group_sender_not_allowlisted',
      };
    }
  }

  if (!params.group) {
    if (params.dmPolicy === 'disabled') {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'dm_policy_disabled',
      };
    }

    // Skip outbound DMs to other people (messages I sent to others)
    if (params.isFromMe && !isSamePhone) {
      return {
        allowed: false,
        shouldMarkRead: false,
        isSelfChat,
        resolvedAccountId: params.accountId,
        denyReason: 'outbound_dm_to_non_self',
      };
    }

    // For DMs from others, check allowlist (unless policy is 'open')
    if (params.dmPolicy !== 'open' && !isSamePhone) {
      const allowed =
        dmHasWildcard ||
        (normalizedAllowFrom.length > 0 && normalizedAllowFrom.includes(normalizedFrom));
      if (!allowed) {
        if (params.dmPolicy === 'pairing' && !suppressPairingReply) {
          const pairing = recordPairingRequest(normalizedFrom);
          await params.reply(buildPairingReply(pairing.code, normalizedFrom));
        }
        return {
          allowed: false,
          shouldMarkRead: false,
          isSelfChat,
          resolvedAccountId: params.accountId,
          denyReason: 'dm_sender_not_allowlisted',
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

