import { describe, expect, test } from 'bun:test';
import { normalizeE164, isSelfChatMode, cleanMarkdownForWhatsApp, toWhatsappJid } from './utils.js';

describe('normalizeE164', () => {
  test('adds + prefix to plain digits', () => {
    expect(normalizeE164('15551234567')).toBe('+15551234567');
  });

  test('keeps existing + prefix', () => {
    expect(normalizeE164('+15551234567')).toBe('+15551234567');
  });

  test('strips whatsapp: prefix', () => {
    expect(normalizeE164('whatsapp:+15551234567')).toBe('+15551234567');
  });

  test('removes dashes and spaces', () => {
    expect(normalizeE164('1 555-123-4567')).toBe('+15551234567');
  });

  test('preserves a single leading plus sign', () => {
    expect(normalizeE164('+15551234567')).toBe('+15551234567');
  });

  test('handles Brazilian number format', () => {
    expect(normalizeE164('+5511999999999')).toBe('+5511999999999');
  });

  test('strips parentheses', () => {
    expect(normalizeE164('+55 (11) 99999-9999')).toBe('+5511999999999');
  });
});

describe('isSelfChatMode', () => {
  test('returns false when selfE164 is null', () => {
    expect(isSelfChatMode(null, ['+15551234567'])).toBe(false);
  });

  test('returns false when allowFrom is empty', () => {
    expect(isSelfChatMode('+15551234567', [])).toBe(false);
  });

  test('returns false when allowFrom is null', () => {
    expect(isSelfChatMode('+15551234567', null)).toBe(false);
  });

  test('returns true when own number is in allowlist', () => {
    expect(isSelfChatMode('+15551234567', ['+15551234567'])).toBe(true);
  });

  test('returns false when wildcard is in allowlist (not self-chat)', () => {
    expect(isSelfChatMode('+15551234567', ['*'])).toBe(false);
  });

  test('returns false when different number is in allowlist', () => {
    expect(isSelfChatMode('+15551234567', ['+15559999999'])).toBe(false);
  });

  test('handles numeric values in allowFrom array', () => {
    expect(isSelfChatMode('+15551234567', [15551234567])).toBe(true);
  });

  test('is idempotent with formatted numbers', () => {
    expect(isSelfChatMode('+5511999999999', ['5511999999999'])).toBe(true);
  });
});

describe('cleanMarkdownForWhatsApp', () => {
  test('converts **bold** to *bold*', () => {
    expect(cleanMarkdownForWhatsApp('**hello**')).toBe('*hello*');
  });

  test('merges adjacent bold sections', () => {
    expect(cleanMarkdownForWhatsApp('**foo** **bar**')).toBe('*foo bar*');
  });

  test('leaves non-bold text unchanged', () => {
    expect(cleanMarkdownForWhatsApp('plain text')).toBe('plain text');
  });

  test('handles multiple bold sections in sentence', () => {
    const input = 'Buy **PETR4** and **VALE3** today';
    const result = cleanMarkdownForWhatsApp(input);
    expect(result).toBe('Buy *PETR4* and *VALE3* today');
  });

  test('is idempotent on WhatsApp-formatted text', () => {
    const input = '*already bold*';
    expect(cleanMarkdownForWhatsApp(input)).toBe('*already bold*');
  });
});

describe('toWhatsappJid', () => {
  test('converts plain phone to @s.whatsapp.net JID', () => {
    expect(toWhatsappJid('15551234567')).toBe('15551234567@s.whatsapp.net');
  });

  test('returns group JID as-is', () => {
    expect(toWhatsappJid('120363407692865732@g.us')).toBe('120363407692865732@g.us');
  });

  test('strips device suffix from JID', () => {
    expect(toWhatsappJid('15551234567:0@s.whatsapp.net')).toBe('15551234567@s.whatsapp.net');
  });

  test('strips whatsapp: prefix', () => {
    expect(toWhatsappJid('whatsapp:+15551234567')).toBe('15551234567@s.whatsapp.net');
  });

  test('handles already-formatted JID without device suffix', () => {
    expect(toWhatsappJid('15551234567@s.whatsapp.net')).toBe('15551234567@s.whatsapp.net');
  });

  test('handles Brazilian phone number', () => {
    expect(toWhatsappJid('+5511999999999')).toBe('5511999999999@s.whatsapp.net');
  });
});
