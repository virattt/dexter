import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { xApiGet } from './x-search.js';

// Minimal Response stand-in for the fields xApiGet reads.
function makeResponse(opts: {
  status: number;
  resetSec?: number;
  body?: unknown;
}): Response {
  const headers = new Map<string, string>();
  if (opts.resetSec !== undefined) {
    headers.set(
      'x-rate-limit-reset',
      String(Math.floor(Date.now() / 1000) + opts.resetSec),
    );
  }
  return {
    status: opts.status,
    ok: opts.status >= 200 && opts.status < 300,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => opts.body ?? {},
    text: async () => JSON.stringify(opts.body ?? {}),
  } as unknown as Response;
}

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;

describe('xApiGet rate-limit handling', () => {
  beforeEach(() => {
    process.env.X_BEARER_TOKEN = 'test-token';
    // Resolve sleep() instantly so retries don't add real wall-clock delay.
    // @ts-expect-error - test stub
    globalThis.setTimeout = (fn: () => void) => {
      fn();
      return 0;
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
  });

  test('waits for the reset window and retries after a 429', async () => {
    const responses = [
      makeResponse({ status: 429, resetSec: 1 }),
      makeResponse({ status: 200, body: { data: [{ id: '1' }] } }),
    ];
    let calls = 0;
    // @ts-expect-error - test stub
    globalThis.fetch = async () => responses[calls++];

    const result = await xApiGet('https://api.x.com/2/test');

    expect(calls).toBe(2); // retried once after the 429
    expect(result.data).toEqual([{ id: '1' }]);
  });

  test('throws after exhausting retries on repeated 429s', async () => {
    let calls = 0;
    // @ts-expect-error - test stub
    globalThis.fetch = async () => {
      calls++;
      return makeResponse({ status: 429, resetSec: 1 });
    };

    await expect(xApiGet('https://api.x.com/2/test')).rejects.toThrow(
      /rate limited/i,
    );
    // initial attempt + 3 retries
    expect(calls).toBe(4);
  });

  test('does not wait when the reset window exceeds the cap', async () => {
    let calls = 0;
    let waited = false;
    // @ts-expect-error - test stub
    globalThis.setTimeout = (fn: () => void) => {
      waited = true;
      fn();
      return 0;
    };
    // @ts-expect-error - test stub
    globalThis.fetch = async () => {
      calls++;
      return makeResponse({ status: 429, resetSec: 3600 }); // 1h, beyond the cap
    };

    await expect(xApiGet('https://api.x.com/2/test')).rejects.toThrow(
      /rate limited/i,
    );
    expect(calls).toBe(1); // threw immediately, no retry
    expect(waited).toBe(false); // never slept
  });
});
