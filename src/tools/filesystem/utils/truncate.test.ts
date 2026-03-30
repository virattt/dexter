import { describe, test, expect } from 'bun:test';
import {
  formatSize,
  truncateHead,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_BYTES,
} from './truncate.js';

describe('DEFAULT_MAX_LINES', () => {
  test('is a positive number', () => {
    expect(DEFAULT_MAX_LINES).toBeGreaterThan(0);
  });
});

describe('DEFAULT_MAX_BYTES', () => {
  test('is a positive number', () => {
    expect(DEFAULT_MAX_BYTES).toBeGreaterThan(0);
  });
});

describe('formatSize', () => {
  test('returns bytes when under 1024', () => {
    expect(formatSize(0)).toBe('0B');
    expect(formatSize(512)).toBe('512B');
    expect(formatSize(1023)).toBe('1023B');
  });

  test('returns KB with one decimal when between 1024 and 1MB', () => {
    expect(formatSize(1024)).toBe('1.0KB');
    expect(formatSize(2048)).toBe('2.0KB');
    expect(formatSize(1536)).toBe('1.5KB');
  });

  test('returns MB with one decimal when >= 1MB', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0MB');
    expect(formatSize(1024 * 1024 * 2)).toBe('2.0MB');
  });
});

describe('truncateHead — no truncation needed', () => {
  test('returns full content when within limits', () => {
    const content = 'line1\nline2\nline3';
    const result = truncateHead(content, { maxLines: 100, maxBytes: 10000 });
    expect(result.content).toBe(content);
    expect(result.truncated).toBe(false);
    expect(result.truncatedBy).toBeNull();
    expect(result.firstLineExceedsLimit).toBe(false);
  });

  test('uses DEFAULT_MAX_LINES and DEFAULT_MAX_BYTES when no options provided', () => {
    const content = 'short content';
    const result = truncateHead(content);
    expect(result.maxLines).toBe(DEFAULT_MAX_LINES);
    expect(result.maxBytes).toBe(DEFAULT_MAX_BYTES);
    expect(result.truncated).toBe(false);
  });

  test('reports correct totalLines and totalBytes', () => {
    const content = 'a\nb\nc';
    const result = truncateHead(content, { maxLines: 100, maxBytes: 100 });
    expect(result.totalLines).toBe(3);
    expect(result.totalBytes).toBe(Buffer.byteLength(content, 'utf-8'));
    expect(result.outputLines).toBe(3);
  });
});

describe('truncateHead — first line exceeds byte limit', () => {
  test('returns empty content when first line alone exceeds maxBytes', () => {
    const longLine = 'a'.repeat(200);
    const result = truncateHead(longLine, { maxLines: 1000, maxBytes: 100 });
    expect(result.content).toBe('');
    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.firstLineExceedsLimit).toBe(true);
    expect(result.outputLines).toBe(0);
    expect(result.outputBytes).toBe(0);
  });
});

describe('truncateHead — truncated by lines', () => {
  test('truncates when content exceeds maxLines', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    const content = lines.join('\n');
    const result = truncateHead(content, { maxLines: 10, maxBytes: 100000 });
    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.outputLines).toBe(10);
    expect(result.content.split('\n').length).toBe(10);
  });
});

describe('truncateHead — truncated by bytes', () => {
  test('truncates by bytes when byte limit is reached before line limit', () => {
    // Create content where bytes limit triggers before lines limit
    const lines = Array.from({ length: 100 }, () => 'a'.repeat(50));
    const content = lines.join('\n');
    const result = truncateHead(content, { maxLines: 1000, maxBytes: 200 });
    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.outputBytes).toBeLessThanOrEqual(200);
  });
});

describe('truncateHead — output integrity', () => {
  test('output content matches the reported outputLines', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const content = lines.join('\n');
    const result = truncateHead(content, { maxLines: 5, maxBytes: 100000 });
    const actualLines = result.content.split('\n').length;
    expect(actualLines).toBe(result.outputLines);
  });

  test('output content is a prefix of input', () => {
    const content = 'first\nsecond\nthird\nfourth\nfifth';
    const result = truncateHead(content, { maxLines: 3, maxBytes: 100000 });
    expect(content.startsWith(result.content)).toBe(true);
  });
});
