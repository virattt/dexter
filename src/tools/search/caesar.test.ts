import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { caesarSearch } from './caesar.js';

const originalFetch = global.fetch;
const originalKey = process.env.CAESAR_API_KEY;

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function stubFetch(response: unknown, status = 200): CapturedRequest {
  const captured: CapturedRequest = { url: '', headers: {}, body: undefined };
  global.fetch = (async (url: string, init?: RequestInit) => {
    captured.url = String(url);
    captured.headers = (init?.headers as Record<string, string>) ?? {};
    captured.body = init?.body ? JSON.parse(init.body as string) : undefined;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    } as Response;
  }) as typeof global.fetch;
  return captured;
}

describe('caesarSearch', () => {
  beforeEach(() => {
    process.env.CAESAR_API_KEY = 'sk_live_test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.CAESAR_API_KEY;
    } else {
      process.env.CAESAR_API_KEY = originalKey;
    }
  });

  test('sends a Bearer header and maps results', async () => {
    const captured = stubFetch({
      results: [{ title: 'Rust runtimes', url: 'https://example.com/rust', snippet: 'tokio vs async-std' }],
    });

    const raw = await caesarSearch.invoke({ query: 'rust async runtime comparison' });

    expect(captured.url).toBe('https://alpha.api.trycaesar.com/v1/search');
    expect(captured.headers.Authorization).toBe('Bearer sk_live_test');
    expect(captured.body).toEqual({ query: 'rust async runtime comparison', max_results: 5 });

    const parsed = JSON.parse(raw as string);
    expect(parsed.data.results[0]).toEqual({
      title: 'Rust runtimes',
      url: 'https://example.com/rust',
      snippet: 'tokio vs async-std',
    });
    expect(parsed.sourceUrls).toEqual(['https://example.com/rust']);
  });

  test('throws when CAESAR_API_KEY is not set', async () => {
    delete process.env.CAESAR_API_KEY;
    stubFetch({ results: [] });

    await expect(caesarSearch.invoke({ query: 'q' })).rejects.toThrow(/CAESAR_API_KEY is not set/);
  });

  test('prefers query-selected passages over the meta description', async () => {
    stubFetch({
      results: [
        {
          title: 'Tokio scheduler',
          url: 'https://tokio.rs/blog/2019-10-scheduler',
          // Caesar's `snippet` is the page's meta description, not query-relevant text.
          snippet: 'A blog about the Tokio runtime.',
          passages: [{ text: 'Work stealing balances load across worker threads.' }, { text: 'The new scheduler avoids the atomic increment in wake_by_ref.' }],
          metadata: { published_at: '2019-10-13T00:00:00Z' },
        },
      ],
    });

    const parsed = JSON.parse((await caesarSearch.invoke({ query: 'q' })) as string);
    const [result] = parsed.data.results;
    expect(result.snippet).toBe(
      'Work stealing balances load across worker threads.\n\nThe new scheduler avoids the atomic increment in wake_by_ref.',
    );
    expect(result.published).toBe('2019-10-13T00:00:00Z');
  });

  test('falls back to the snippet when a result has no passages', async () => {
    stubFetch({ results: [{ title: 'A', url: 'https://a.test', snippet: 'only a snippet' }] });

    const parsed = JSON.parse((await caesarSearch.invoke({ query: 'q' })) as string);
    expect(parsed.data.results[0].snippet).toBe('only a snippet');
    expect(parsed.data.results[0].published).toBeUndefined();
  });

  test('ignores empty passage text', async () => {
    stubFetch({ results: [{ title: 'A', url: 'https://a.test', snippet: 'fallback', passages: [{ text: '   ' }] }] });

    const parsed = JSON.parse((await caesarSearch.invoke({ query: 'q' })) as string);
    expect(parsed.data.results[0].snippet).toBe('fallback');
  });

  test('tolerates alternate url/snippet field names', async () => {
    stubFetch({
      results: [
        { title: 'A', canonical_url: 'https://a.test', content: 'body a' },
        { title: 'B', source_url: 'https://b.test', passage: 'body b' },
      ],
    });

    const parsed = JSON.parse((await caesarSearch.invoke({ query: 'q' })) as string);
    expect(parsed.data.results).toEqual([
      { title: 'A', url: 'https://a.test', snippet: 'body a' },
      { title: 'B', url: 'https://b.test', snippet: 'body b' },
    ]);
    expect(parsed.sourceUrls).toEqual(['https://a.test', 'https://b.test']);
  });

  test('surfaces a clear error on 401', async () => {
    process.env.CAESAR_API_KEY = 'sk_live_bad';
    stubFetch({ error: 'invalid_api_key' }, 401);

    await expect(caesarSearch.invoke({ query: 'q' })).rejects.toThrow(/Caesar API.*401/);
  });
});
