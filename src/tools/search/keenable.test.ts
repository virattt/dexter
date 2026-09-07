import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { callKeenable, keenableSearch } from './keenable.js';

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

// Minimal Response stand-in for the fields callKeenable reads.
function makeResponse(opts: { status: number; body?: unknown; retryAfter?: string }): Response {
  return {
    status: opts.status,
    ok: opts.status >= 200 && opts.status < 300,
    headers: {
      get: (k: string) => (k.toLowerCase() === 'retry-after' ? opts.retryAfter ?? null : null),
    },
    json: async () => opts.body ?? {},
    text: async () => JSON.stringify(opts.body ?? {}),
  } as unknown as Response;
}

function stubFetch(response: Response): CapturedRequest {
  const captured: CapturedRequest = { url: '', headers: {}, body: {} };
  // @ts-expect-error - test stub
  globalThis.fetch = async (url: string, init: RequestInit) => {
    captured.url = url;
    captured.headers = init.headers as Record<string, string>;
    captured.body = JSON.parse(init.body as string);
    return response;
  };
  return captured;
}

const realFetch = globalThis.fetch;
const realApiKey = process.env.KEENABLE_API_KEY;

describe('callKeenable', () => {
  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realApiKey === undefined) {
      delete process.env.KEENABLE_API_KEY;
    } else {
      process.env.KEENABLE_API_KEY = realApiKey;
    }
  });

  test('uses the public endpoint with the app title header when no key is set', async () => {
    const req = stubFetch(makeResponse({ status: 200, body: { results: [] } }));

    await callKeenable('nvidia earnings');

    expect(req.url).toBe('https://api.keenable.ai/v1/search/public');
    expect(req.headers['X-Keenable-Title']).toBe('dexter');
    expect(req.headers['X-API-Key']).toBeUndefined();
    expect(req.body.query).toBe('nvidia earnings');
    expect(req.body.max_results).toBe(5);
  });

  test('uses the keyed endpoint when KEENABLE_API_KEY is set', async () => {
    process.env.KEENABLE_API_KEY = 'kn-test';
    const req = stubFetch(makeResponse({ status: 200, body: { results: [] } }));

    await callKeenable('nvidia earnings');

    expect(req.url).toBe('https://api.keenable.ai/v1/search');
    expect(req.headers['X-API-Key']).toBe('kn-test');
    expect(req.headers['X-Keenable-Title']).toBe('dexter');
  });

  test('treats the env.example placeholder as no key', async () => {
    process.env.KEENABLE_API_KEY = 'your-keenable-api-key';
    const req = stubFetch(makeResponse({ status: 200, body: { results: [] } }));

    await callKeenable('nvidia earnings');

    expect(req.url).toBe('https://api.keenable.ai/v1/search/public');
    expect(req.headers['X-API-Key']).toBeUndefined();
  });

  test('throws on 429 so the fallback chain can move on', async () => {
    stubFetch(makeResponse({ status: 429, retryAfter: '12', body: { error: 'Rate limit exceeded' } }));

    await expect(callKeenable('nvidia earnings')).rejects.toThrow('429');
  });

  test('throws on non-2xx responses', async () => {
    stubFetch(makeResponse({ status: 400, body: { error: 'bad request' } }));

    await expect(callKeenable('nvidia earnings')).rejects.toThrow('400');
  });
});

describe('keenableSearch tool', () => {
  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realApiKey !== undefined) {
      process.env.KEENABLE_API_KEY = realApiKey;
    }
  });

  test('maps snippet first, falls back to description, and collects source URLs', async () => {
    stubFetch(
      makeResponse({
        status: 200,
        body: {
          query: 'q',
          results: [
            { title: 'A', url: 'https://a.example', description: '', snippet: 'page text A' },
            { title: 'B', url: 'https://b.example', description: 'meta B', snippet: '' },
            { title: 'A again', url: 'https://a.example', snippet: 'dup' },
          ],
        },
      }),
    );

    const raw = await keenableSearch.invoke({ query: 'q' });
    const parsed = JSON.parse(raw as string);

    expect(parsed.data.results).toEqual([
      { title: 'A', url: 'https://a.example', snippet: 'page text A' },
      { title: 'B', url: 'https://b.example', snippet: 'meta B' },
      { title: 'A again', url: 'https://a.example', snippet: 'dup' },
    ]);
    expect(parsed.sourceUrls).toEqual(['https://a.example', 'https://b.example']);
  });

  test('prefixes errors with the provider name', async () => {
    stubFetch(makeResponse({ status: 429, body: {} }));

    await expect(keenableSearch.invoke({ query: 'q' })).rejects.toThrow('[Keenable API] 429');
  });
});
