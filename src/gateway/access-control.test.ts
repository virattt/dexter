import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkInboundAccessControl, isAllowedPhone, recordPairingRequest } from './access-control.js';

describe('access control', () => {
  test('allowFrom exact match', () => {
    const result = isAllowedPhone({
      from: '+1 (555) 123-4567',
      allowFrom: ['+15551234567'],
    });
    expect(result.allowed).toBe(true);
  });

  test('records pairing request for unknown sender', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-pairing-'));
    const path = join(dir, 'whatsapp.json');
    process.env.DEXTER_PAIRING_PATH = path;
    try {
      const pairing = recordPairingRequest('+15550001111');
      expect(pairing.code.length).toBe(6);
      const saved = JSON.parse(readFileSync(path, 'utf8')) as Record<string, { code: string }>;
      expect(saved['+15550001111']).toBeDefined();
      expect(saved['+15550001111'].code).toBe(pairing.code);
    } finally {
      delete process.env.DEXTER_PAIRING_PATH;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('allows self-chat fromMe direct message', async () => {
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15551234567',
      selfE164: '+15551234567',
      senderE164: '+15551234567',
      group: false,
      isFromMe: true,
      dmPolicy: 'pairing',
      groupPolicy: 'open',
      allowFrom: ['+15551234567'],
      groupAllowFrom: [],
      reply: async () => {},
    });
    expect(result.allowed).toBe(true);
    expect(result.isSelfChat).toBe(true);
  });

  test('blocks direct message when dmPolicy is disabled', async () => {
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15550000000',
      selfE164: '+15551234567',
      senderE164: '+15550000000',
      group: false,
      isFromMe: false,
      dmPolicy: 'disabled',
      groupPolicy: 'open',
      allowFrom: ['*'],
      groupAllowFrom: [],
      reply: async () => {},
    });
    expect(result.allowed).toBe(false);
    expect(result.shouldMarkRead).toBe(false);
  });

  test('blocks group message when sender not in group allowlist', async () => {
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15550000000',
      selfE164: '+15551234567',
      senderE164: '+15550000000',
      group: true,
      isFromMe: false,
      dmPolicy: 'open',
      groupPolicy: 'allowlist',
      allowFrom: ['*'],
      groupAllowFrom: ['+15551112222'],
      reply: async () => {},
    });
    expect(result.allowed).toBe(false);
  });

  test('blocks group messages in self-chat mode even when group policy is open', async () => {
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15551234567',
      selfE164: '+15551234567',
      senderE164: '+15551234567',
      group: true,
      isFromMe: true,
      dmPolicy: 'open',
      groupPolicy: 'open',
      allowFrom: ['+15551234567'],
      groupAllowFrom: ['*'],
      reply: async () => {},
    });
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe('group_blocked_self_chat_mode');
  });

  test('blocks non-self sender in self-chat mode', async () => {
    const result = await checkInboundAccessControl({
      accountId: 'default',
      from: '+15550000000',
      selfE164: '+15551234567',
      senderE164: '+15550000000',
      group: false,
      isFromMe: false,
      dmPolicy: 'open',
      groupPolicy: 'disabled',
      allowFrom: ['+15551234567'],
      groupAllowFrom: [],
      reply: async () => {},
    });
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe('sender_not_self_in_self_chat_mode');
  });
});

