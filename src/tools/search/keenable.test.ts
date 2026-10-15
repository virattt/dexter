import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callKeenable, keenableSearch } from './keenable.js';
import { getToolRegistry } from '../registry.js';
import { SearchSelectionController } from '../../controllers/search-selection.js';
import { getSetting, setSetting } from '../../utils/config.js';

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

describe('Keenable is opt-in', () => {
  const KEENABLE_PUBLIC = 'https://api.keenable.ai/v1/search/public';
  const LANGSEARCH = 'https://api.langsearch.com/v1/web-search';
  const searchKeys = [
    'EXASEARCH_API_KEY',
    'PERPLEXITY_API_KEY',
    'TAVILY_API_KEY',
    'LANGSEARCH_API_KEY',
    'KEENABLE_API_KEY',
  ];
  const originalCwd = process.cwd();
  let directory: string;
  let savedKeys: (string | undefined)[];

  beforeEach(() => {
    // Settings live in ./.dexter/settings.json, so run each test in a scratch directory.
    directory = mkdtempSync(join(tmpdir(), 'dexter-keenable-'));
    process.chdir(directory);
    savedKeys = searchKeys.map((key) => process.env[key]);
    searchKeys.forEach((key) => delete process.env[key]);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    process.chdir(originalCwd);
    searchKeys.forEach((key, i) => {
      if (savedKeys[i] === undefined) delete process.env[key];
      else process.env[key] = savedKeys[i];
    });
    rmSync(directory, { recursive: true, force: true });
  });

  function webSearchTool() {
    return getToolRegistry('gpt-5.6-sol').find((t) => t.name === 'web_search')?.tool;
  }

  // Every request fails, so the chain tries each provider in order; record the order.
  function failingFetch(): string[] {
    const calls: string[] = [];
    // @ts-expect-error - test stub
    globalThis.fetch = async (url: string) => {
      calls.push(url);
      return makeResponse({ status: 503, body: { error: 'unavailable' } });
    };
    return calls;
  }

  test('with no key and no selection, web_search stays unregistered', () => {
    expect(webSearchTool()).toBeUndefined();
  });

  test('is not a fallback when keyed providers fail and Keenable is not selected', async () => {
    process.env.LANGSEARCH_API_KEY = 'fixture-key';
    const calls = failingFetch();

    await expect(webSearchTool()!.invoke({ query: 'q' })).rejects.toThrow('All providers failed');
    expect(calls).toEqual([LANGSEARCH]);
  });

  test('selecting it in /search commits without asking for a key', () => {
    const controller = new SearchSelectionController((message) => {
      throw new Error(message);
    });
    controller.handleProviderSelect('keenable');

    expect(controller.state.appState).toBe('idle');
    expect(getSetting('webSearchPreferredProvider', '')).toBe('keenable');
    expect(existsSync('.env')).toBe(false);
  });

  test('while selected it runs first and keyless, with keyed providers as fallbacks', async () => {
    setSetting('webSearchPreferredProvider', 'keenable');

    const keylessCalls = failingFetch();
    await expect(webSearchTool()!.invoke({ query: 'q' })).rejects.toThrow('All providers failed');
    expect(keylessCalls).toEqual([KEENABLE_PUBLIC]);

    process.env.LANGSEARCH_API_KEY = 'fixture-key';
    const chainCalls = failingFetch();
    await expect(webSearchTool()!.invoke({ query: 'q' })).rejects.toThrow('All providers failed');
    expect(chainCalls).toEqual([KEENABLE_PUBLIC, LANGSEARCH]);
  });
});
