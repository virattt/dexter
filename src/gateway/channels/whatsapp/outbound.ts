import type { AnyMessageContent } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WaSocket } from './session.js';
import { toWhatsappJid } from '../../utils.js';

function debugLog(msg: string) {
  const logPath = path.join(os.homedir(), '.dexter', 'gateway-debug.log');
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

export async function sendMessageWhatsApp(params: {
  to: string;
  body: string;
  accountId?: string;
  media?: AnyMessageContent;
}): Promise<{ messageId: string; toJid: string }> {
  const active = getActive(params.accountId);
  debugLog(`[outbound] input to=${params.to}`);
  const to = toWhatsappJid(params.to);
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
  const to = toWhatsappJid(params.to);
  await active.sock.sendPresenceUpdate('composing', to);
}

