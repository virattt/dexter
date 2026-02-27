import type { AnyMessageContent } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WaSocket } from './session.js';
import { loadGatewayConfig, resolveWhatsAppAccount } from '../../config.js';
import { normalizeE164, toWhatsappJid } from '../../utils.js';

function debugLog(msg: string) {
  const dexterDir = path.join(os.homedir(), '.dexter');
  if (!fs.existsSync(dexterDir)) {
    fs.mkdirSync(dexterDir, { recursive: true });
  }
  const logPath = path.join(dexterDir, 'gateway-debug.log');
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
}

type ActiveListener = {
  accountId: string;
  sock: WaSocket;
};

const listeners = new Map<string, ActiveListener>();

export function setActiveWebListener(accountId: string, sock: WaSocket | null): void {
  if (!sock) {
    listeners.delete(accountId);
    return;
  }
  listeners.set(accountId, { accountId, sock });
}

function getActive(accountId?: string): ActiveListener {
  if (accountId) {
    const found = listeners.get(accountId);
    if (found) {
      return found;
    }
  }
  const first = listeners.values().next().value as ActiveListener | undefined;
  if (!first) {
    throw new Error('No active WhatsApp listener. Run dexter gateway run.');
  }
  return first;
}

function extractE164FromJid(jid: string): string | null {
  const localPart = jid.split('@')[0] ?? '';
  const rawPhone = localPart.includes(':') ? localPart.split(':')[0] : localPart;
  if (!/^\d+$/.test(rawPhone)) {
    return null;
  }
  return normalizeE164(rawPhone);
}

export function assertOutboundAllowed(params: {
  to: string;
  accountId?: string;
}): { toJid: string; recipientE164: string } {
  const cfg = loadGatewayConfig();
  const accountId = params.accountId ?? cfg.gateway.accountId;
  const account = resolveWhatsAppAccount(cfg, accountId);
  const toJid = toWhatsappJid(params.to);

  if (toJid.endsWith('@g.us')) {
    throw new Error('Outbound blocked: group destinations are disabled in strict self-chat mode.');
  }

  const recipientE164 = extractE164FromJid(toJid);
  if (!recipientE164) {
    throw new Error(`Outbound blocked: invalid recipient JID ${toJid}`);
  }

  // Strict mode: require explicit recipient allowlist entries and ignore wildcard.
  const explicitAllowedRecipients = account.allowFrom
    .filter((entry) => entry !== '*')
    .map(normalizeE164);
  if (explicitAllowedRecipients.length === 0) {
    throw new Error('Outbound blocked: no explicit allowFrom recipient configured.');
  }
  if (!explicitAllowedRecipients.includes(recipientE164)) {
    throw new Error(`Outbound blocked: ${recipientE164} is not in allowFrom.`);
  }

  return { toJid, recipientE164 };
}

export async function sendMessageWhatsApp(params: {
  to: string;
  body: string;
  accountId?: string;
  media?: AnyMessageContent;
}): Promise<{ messageId: string; toJid: string }> {
  const active = getActive(params.accountId);
  debugLog(`[outbound] input to=${params.to}`);
  const { toJid: to } = assertOutboundAllowed({ to: params.to, accountId: params.accountId });
  debugLog(`[outbound] normalized to=${to}`);
  const payload = params.media ?? { text: params.body };
  debugLog(`[outbound] sending message...`);
  const startedAt = Date.now();
  const result = await active.sock.sendMessage(to, payload);
  const durationMs = Date.now() - startedAt;
  const messageId = result?.key?.id ?? 'unknown';
  console.log(`Sent message ${messageId} -> ${to} (${durationMs}ms)`);
  debugLog(`[outbound] sendMessage result id=${messageId}`);
  return { messageId, toJid: to };
}

export async function sendComposing(params: { to: string; accountId?: string }): Promise<void> {
  const active = getActive(params.accountId);
  const { toJid: to } = assertOutboundAllowed({ to: params.to, accountId: params.accountId });
  await active.sock.sendPresenceUpdate('composing', to);
}

