import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync } from 'node:fs';
import { trackFmpCall, getQuotaStatus, getQuotaWarning } from './fmp-quota.js';

let testDir: string;
let quotaPath: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `dexter-quota-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  quotaPath = join(testDir, 'fmp-quota.json');
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('trackFmpCall', () => {
  it('increments counter from 0 to 1 on first call', () => {
    const status = trackFmpCall(quotaPath);
    expect(status.used).toBe(1);
    expect(status.limit).toBe(250);
    expect(status.remaining).toBe(249);
  });

  it('increments counter on each subsequent call', () => {
    trackFmpCall(quotaPath);
    trackFmpCall(quotaPath);
    const status = trackFmpCall(quotaPath);
    expect(status.used).toBe(3);
    expect(status.remaining).toBe(247);
  });

  it('usedPct is correct fraction of daily limit', () => {
    for (let i = 0; i < 50; i++) trackFmpCall(quotaPath);
    const status = getQuotaStatus(quotaPath);
    expect(status.usedPct).toBeCloseTo(50 / 250);
  });

  it('resets counter when stored date does not match today', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    writeFileSync(quotaPath, JSON.stringify({ date: yesterday, count: 200 }));
    const status = trackFmpCall(quotaPath);
    expect(status.used).toBe(1); // reset
  });

  it('remaining is clamped to 0 when limit exceeded', () => {
    for (let i = 0; i < 260; i++) trackFmpCall(quotaPath);
    const status = getQuotaStatus(quotaPath);
    expect(status.remaining).toBe(0);
  });
});

describe('getQuotaStatus', () => {
  it('returns 0 used when no quota file exists', () => {
    const status = getQuotaStatus(quotaPath);
    expect(status.used).toBe(0);
    expect(status.usedPct).toBe(0);
    expect(status.remaining).toBe(250);
  });

  it('reads persisted count across calls', () => {
    trackFmpCall(quotaPath);
    trackFmpCall(quotaPath);
    const status = getQuotaStatus(quotaPath);
    expect(status.used).toBe(2);
  });
});

describe('getQuotaWarning', () => {
  it('returns null when usage is below 80%', () => {
    for (let i = 0; i < 100; i++) trackFmpCall(quotaPath);
    expect(getQuotaWarning(quotaPath)).toBeNull();
  });

  it('returns null at exactly 79% (< threshold)', () => {
    for (let i = 0; i < 197; i++) trackFmpCall(quotaPath); // 197/250 = 78.8%
    expect(getQuotaWarning(quotaPath)).toBeNull();
  });

  it('returns warning string at 80% threshold', () => {
    for (let i = 0; i < 200; i++) trackFmpCall(quotaPath); // 200/250 = 80%
    const warning = getQuotaWarning(quotaPath);
    expect(warning).not.toBeNull();
    expect(warning).toContain('⚠️');
    expect(warning).toContain('200/250');
  });

  it('returns exhausted warning when limit reached', () => {
    for (let i = 0; i < 250; i++) trackFmpCall(quotaPath);
    const warning = getQuotaWarning(quotaPath);
    expect(warning).not.toBeNull();
    expect(warning).toContain('exhausted');
    expect(warning).toContain('250/250');
  });

  it('warning mentions remaining calls when below limit', () => {
    for (let i = 0; i < 210; i++) trackFmpCall(quotaPath); // 210/250 = 84%
    const warning = getQuotaWarning(quotaPath);
    expect(warning).toContain('remaining');
    expect(warning).toContain('40');
  });
});
