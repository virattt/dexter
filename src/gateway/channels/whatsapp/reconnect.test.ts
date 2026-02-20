import { describe, expect, test } from 'bun:test';
import { computeBackoff, DEFAULT_RECONNECT_POLICY, resolveReconnectPolicy } from './reconnect.js';
import type { GatewayConfig } from '../../config.js';

describe('whatsapp reconnect policy', () => {
  test('computeBackoff grows with attempts and caps at max', () => {
    const noJitter = { ...DEFAULT_RECONNECT_POLICY, jitter: 0 };
    const attempt1 = computeBackoff(noJitter, 1);
    const attempt2 = computeBackoff(noJitter, 2);
    const attempt20 = computeBackoff(noJitter, 20);
    expect(attempt2).toBeGreaterThan(attempt1);
    expect(attempt20).toBeLessThanOrEqual(noJitter.maxMs);
  });

  test('resolveReconnectPolicy clamps invalid values', () => {
    const cfg = {
      gateway: {
        accountId: 'default',
        logLevel: 'info',
        reconnect: {
          initialMs: 1,
          maxMs: 10,
          factor: 0.5,
          jitter: 3,
          maxAttempts: -2,
        },
      },
      channels: { whatsapp: { enabled: true, accounts: {}, allowFrom: [] } },
      bindings: [],
    } satisfies GatewayConfig;
    const resolved = resolveReconnectPolicy(cfg);
    expect(resolved.initialMs).toBe(250);
    expect(resolved.maxMs).toBe(250);
    expect(resolved.factor).toBe(1.1);
    expect(resolved.jitter).toBe(1);
    expect(resolved.maxAttempts).toBe(0);
  });
});
