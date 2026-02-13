import {
  isJidGroup,
  normalizeMessageContent,
  extractMessageContent,
  type ConnectionState,
  type WAMessage,
  type proto,
} from '@whiskeysockets/baileys';
import { createWaSocket, getStatusCode, isLoggedOutReason, waitForWaConnection } from './session.js';
import type { WhatsAppCloseReason, WhatsAppInboundMessage } from './types.js';
import { setActiveWebListener } from './outbound.js';
import { isRecentInboundMessage } from './dedupe.js';
import { readSelfId } from './auth-store.js';
import { checkInboundAccessControl } from '../../access-control.js';
import { resolveJidToPhoneJid, type LidLookup } from './lid.js';
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG_PATH = join(homedir(), '.dexter', 'gateway-debug.log');
function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

function extractText(message: WAMessage): string {
  const rawMsg = message.message;
  if (!rawMsg) {
    debugLog(`[extractText] no message content`);
    return '';
  }
  
  // Use Baileys' normalizeMessageContent to unwrap viewOnce, ephemeral, etc.
  const normalized = normalizeMessageContent(rawMsg);
  if (!normalized) {
    debugLog(`[extractText] normalizeMessageContent returned null`);
    return '';
  }
  
  // Log available message keys for debugging
  const keys = Object.keys(normalized);
  debugLog(`[extractText] message keys: ${keys.join(', ')}`);
  
  // Try extractMessageContent for deeper extraction
  const extracted = extractMessageContent(normalized);
  const candidates = [normalized, extracted && extracted !== normalized ? extracted : undefined];
  
  for (const candidate of candidates) {
    if (!candidate) continue;
    
    // Check conversation (simple text)
    if (typeof candidate.conversation === 'string' && candidate.conversation.trim()) {
      return candidate.conversation.trim();
    }
    
    // Check extended text message
    const extended = candidate.extendedTextMessage?.text;
    if (extended?.trim()) {
      return extended.trim();
    }
    
    // Check media captions
    const caption =
      candidate.imageMessage?.caption ??
      candidate.videoMessage?.caption ??
      candidate.documentMessage?.caption;
    if (caption?.trim()) {
      return caption.trim();
    }
  }
  
  return '';
}

function toPhoneFromJid(jid: string): string {
  const base = jid.split('@')[0] ?? '';
  const match = base.match(/^(\d+)(?::\d+)?$/);
  const digits = match?.[1] ?? base.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function jidToE164(jid?: string | null): string | null {
  if (!jid) {
    return null;
  }
  const phone = toPhoneFromJid(jid);
  return phone || null;
}

export async function monitorWebInbox(params: {
  accountId: string;
  authDir: string;
  verbose: boolean;
  allowFrom: string[];
  dmPolicy: 'pairing' | 'allowlist' | 'open' | 'disabled';
  groupPolicy: 'open' | 'allowlist' | 'disabled';
  groupAllowFrom: string[];
  sendReadReceipts?: boolean;
  onMessage: (msg: WhatsAppInboundMessage) => Promise<void>;
}): Promise<{
  sock: Awaited<ReturnType<typeof createWaSocket>>;
  onClose: Promise<WhatsAppCloseReason>;
  close: () => Promise<void>;
}> {
  const sock = await createWaSocket({
    authDir: params.authDir,
    printQr: false,
    verbose: params.verbose,
  });
  await waitForWaConnection(sock);
  console.log('[whatsapp] Connected');
  const connectedAtMs = Date.now();
  const selfJid = sock.user?.id;
  const selfFromSock = jidToE164(selfJid);
  const selfFromCreds = readSelfId(params.authDir).e164;
  const selfE164 = selfFromSock ?? selfFromCreds;

  // Get LID lookup for resolving LID JIDs to phone JIDs
  // Baileys 7.x provides signalRepository.lidMapping for LID resolution
  const lidMapping = sock.signalRepository?.lidMapping;
  const lidLookup: LidLookup | undefined = lidMapping ? {
    getPNForLID: lidMapping.getPNForLID?.bind(lidMapping),
  } : undefined;
  debugLog(`[inbound] lidLookup available: ${!!lidLookup}, getPNForLID: ${typeof lidLookup?.getPNForLID}`);

  let onCloseResolve: ((reason: WhatsAppCloseReason) => void) | null = null;
  const onClose = new Promise<WhatsAppCloseReason>((resolve) => {
    onCloseResolve = resolve;
  });
  const resolveClose = (reason: WhatsAppCloseReason) => {
    if (!onCloseResolve) {
      return;
    }
    const resolve = onCloseResolve;
    onCloseResolve = null;
    resolve(reason);
  };

  const onMessagesUpsert = async (upsert: { type?: string; messages?: WAMessage[] }) => {
    debugLog(`[inbound] upsert type=${upsert.type} count=${upsert.messages?.length ?? 0}`);
    if (upsert.type !== 'notify' && upsert.type !== 'append') {
      return;
    }
    for (const message of upsert.messages ?? []) {
      const remoteJid = message.key?.remoteJid;
      debugLog(`[inbound] message remoteJid=${remoteJid} fromMe=${message.key?.fromMe}`);
      if (!remoteJid) {
        continue;
      }

      // Skip duplicate messages
      const messageId = message.key?.id;
      const dedupeKey = messageId ? `${params.accountId}:${remoteJid}:${messageId}` : undefined;
      if (dedupeKey && isRecentInboundMessage(dedupeKey)) {
        debugLog(`[inbound] skipping duplicate ${dedupeKey}`);
        continue;
      }

      const isGroup = isJidGroup(remoteJid) === true;
      const senderJid = message.key?.participant ?? remoteJid;
      
      // For direct chats, resolve LID JID to phone JID for reliable replies
      let replyToJid = remoteJid;
      if (!isGroup) {
        debugLog(`[inbound] attempting LID resolution for ${remoteJid}, lidLookup available: ${!!lidLookup}, getPNForLID available: ${!!lidLookup?.getPNForLID}`);
        const resolvedJid = await resolveJidToPhoneJid(remoteJid, lidLookup, debugLog);
        debugLog(`[inbound] resolveJidToPhoneJid result: ${resolvedJid}`);
        if (resolvedJid) {
          replyToJid = resolvedJid;
          debugLog(`[inbound] using resolved JID ${resolvedJid} for replies`);
        } else {
          debugLog(`[inbound] LID resolution failed, using original ${remoteJid} for replies`);
        }
      }
      
      const from = toPhoneFromJid(isGroup ? senderJid : replyToJid);
      const messageTimestampMs = message.messageTimestamp
        ? Number(message.messageTimestamp) * 1000
        : undefined;
      debugLog(`[inbound] from=${from} selfE164=${selfE164} isGroup=${isGroup} isFromMe=${message.key?.fromMe} allowFrom=${JSON.stringify(params.allowFrom)} dmPolicy=${params.dmPolicy} groupPolicy=${params.groupPolicy}`);
      const access = await checkInboundAccessControl({
        accountId: params.accountId,
        from,
        selfE164,
        senderE164: isGroup ? toPhoneFromJid(senderJid) || null : from || null,
        group: isGroup,
        isFromMe: Boolean(message.key?.fromMe),
        dmPolicy: params.dmPolicy,
        groupPolicy: params.groupPolicy,
        allowFrom: params.allowFrom,
        groupAllowFrom: params.groupAllowFrom,
        messageTimestampMs,
        connectedAtMs,
        reply: async (text: string) => {
          await sock.sendMessage(remoteJid, { text });
        },
      });
      debugLog(
        `[inbound] access allowed=${access.allowed} denyReason=${access.denyReason ?? 'none'} isSelfChat=${access.isSelfChat} shouldMarkRead=${access.shouldMarkRead}`,
      );
      if (!access.allowed) {
        continue;
      }

      let groupSubject: string | undefined;
      let groupParticipants: string[] | undefined;
      if (isGroup) {
        try {
          const meta = await sock.groupMetadata(remoteJid);
          groupSubject = meta.subject;
          groupParticipants = meta.participants?.map((participant) => toPhoneFromJid(participant.id));
        } catch {
          // ignore metadata fetch failures
        }
      }

      const body = extractText(message);
      debugLog(`[inbound] body="${body.slice(0, 50)}..."`);
      if (!body.trim()) {
        debugLog(`[inbound] skipping empty body`);
        continue;
      }
      const inbound: WhatsAppInboundMessage = {
        id: message.key?.id ?? undefined,
        accountId: access.resolvedAccountId,
        chatId: remoteJid,
        replyToJid,
        chatType: isGroup ? 'group' : 'direct',
        from,
        senderId: from,
        senderName: message.pushName ? String(message.pushName) : undefined,
        isFromMe: Boolean(message.key?.fromMe),
        selfE164,
        groupSubject,
        groupParticipants,
        body,
        timestamp: messageTimestampMs,
        sendComposing: async () => {
          await sock.sendPresenceUpdate('composing', replyToJid);
        },
        reply: async (text: string) => {
          await sock.sendMessage(replyToJid, { text });
        },
        sendMedia: async (payload) => {
          await sock.sendMessage(replyToJid, payload);
        },
      };
      if (
        params.sendReadReceipts !== false &&
        message.key?.id &&
        access.shouldMarkRead &&
        !access.isSelfChat
      ) {
        await sock.readMessages([
          {
            remoteJid,
            id: message.key.id,
            participant: message.key.participant,
            fromMe: false,
          },
        ]);
      }
      // History/offline catch-up: mark read above but skip auto-reply.
      if (upsert.type === 'append') {
        debugLog(`[inbound] skipping append message (read-only, no reply)`);
        continue;
      }
      debugLog(`[inbound] calling onMessage for ${from}: "${body.slice(0, 30)}..."`);
      await params.onMessage(inbound);
    }
  };

  const onConnectionUpdate = (update: Partial<ConnectionState>) => {
    if (update.connection === 'close') {
      const status = getStatusCode(update.lastDisconnect?.error);
      const isLoggedOut = isLoggedOutReason(update.lastDisconnect?.error);
      console.log(`[whatsapp] Disconnected (status=${status}, loggedOut=${isLoggedOut})`);
      resolveClose({
        status,
        isLoggedOut,
        error: update.lastDisconnect?.error,
      });
    }
  };

  sock.ev.on('messages.upsert', onMessagesUpsert);
  sock.ev.on('connection.update', onConnectionUpdate);

  return {
    sock,
    onClose,
    close: async () => {
      resolveClose({
        status: 499,
        isLoggedOut: false,
      });
      sock.ev.off('messages.upsert', onMessagesUpsert);
      sock.ev.off('connection.update', onConnectionUpdate);
      setActiveWebListener(params.accountId, null);
      sock.ws.close();
    },
  };
}

