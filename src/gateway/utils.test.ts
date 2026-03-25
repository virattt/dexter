import { describe, expect, test } from 'vitest';
import { cleanMarkdownForWhatsApp, isSelfChatMode, normalizeE164, toWhatsappJid } from './utils.js';

describe('gateway utils', () => {
  describe('normalizeE164', () => {
    test('normalizes plain digits to +E164', () => {
      expect(normalizeE164('15551234567')).toBe('+15551234567');
      expect(normalizeE164('  1 555-123-4567  ')).toBe('+15551234567');
    });
    test('strips whatsapp: prefix and keeps plus', () => {
      expect(normalizeE164('whatsapp:+15551234567')).toBe('+15551234567');
      expect(normalizeE164('whatsapp: +1 (555) 123-4567')).toBe('+15551234567');
    });

    test('deduplicates multiple plus signs defensively', () => {
      expect(normalizeE164('++15551234567')).toBe('+15551234567');
    });
  });

  describe('isSelfChatMode', () => {
    test('returns false when selfE164 is missing', () => {
      expect(isSelfChatMode(null, ['+15551234567'])).toBe(false);
      expect(isSelfChatMode(undefined, ['+15551234567'])).toBe(false);
    });

    test('returns false when allowFrom is empty or not an array', () => {
      expect(isSelfChatMode('+15551234567', [])).toBe(false);
      expect(isSelfChatMode('+15551234567', null as unknown as string[])).toBe(false);
    });

    test('returns true when self number is explicitly allowlisted', () => {
      expect(isSelfChatMode('+1 (555) 123-4567', ['+15551234567'])).toBe(true);
      expect(isSelfChatMode('+15551234567', ['whatsapp:+1 (555) 123-4567'])).toBe(true);
    });

    test('ignores wildcard entries when checking for self-chat', () => {
      expect(isSelfChatMode('+15551234567', ['*'])).toBe(false);
      expect(isSelfChatMode('+15551234567', ['*', '+19998887777'])).toBe(false);
    });

    test('handles numeric allowFrom entries safely', () => {
      expect(isSelfChatMode('+15551234567', [15551234567])).toBe(true);
      expect(isSelfChatMode('+15551234567', [15550000000])).toBe(false);
    });
  });

  describe('cleanMarkdownForWhatsApp', () => {
    test('converts markdown bold to WhatsApp bold', () => {
      expect(cleanMarkdownForWhatsApp('This is **bold** text')).toBe('This is *bold* text');
      expect(cleanMarkdownForWhatsApp('**AAPL** vs **MSFT**')).toBe('*AAPL* vs *MSFT*');
    });

    test('merges adjacent bold sections', () => {
      expect(cleanMarkdownForWhatsApp('*foo* *bar*')).toBe('*foo bar*');
      expect(cleanMarkdownForWhatsApp('before *foo* *bar* after')).toBe('before *foo bar* after');
    });

    test('is idempotent on already WhatsApp-formatted text', () => {
      const input = '*bold* and *more bold*';
      expect(cleanMarkdownForWhatsApp(input)).toBe(input);
    });
  });

  describe('toWhatsappJid', () => {
    test('returns group JIDs as-is', () => {
      expect(toWhatsappJid('12345-67890@g.us')).toBe('12345-67890@g.us');
      expect(toWhatsappJid('whatsapp:12345-67890@g.us')).toBe('12345-67890@g.us');
    });

    test('normalizes user JIDs with device suffix', () => {
      expect(toWhatsappJid('15551234567:0@s.whatsapp.net')).toBe('15551234567@s.whatsapp.net');
      expect(toWhatsappJid('whatsapp:15551234567:3@s.whatsapp.net')).toBe('15551234567@s.whatsapp.net');
    });

    test('returns non-WhatsApp JIDs unchanged', () => {
      expect(toWhatsappJid('abc123@lid')).toBe('abc123@lid');
      expect(toWhatsappJid('whatsapp:abc123@lid')).toBe('abc123@lid');
    });

    test('converts raw phone numbers to @s.whatsapp.net JIDs', () => {
      expect(toWhatsappJid('+1 (555) 123-4567')).toBe('15551234567@s.whatsapp.net');
      expect(toWhatsappJid('whatsapp:+15551234567')).toBe('15551234567@s.whatsapp.net');
      expect(toWhatsappJid('15551234567')).toBe('15551234567@s.whatsapp.net');
    });
  });
});

