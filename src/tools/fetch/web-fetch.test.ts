import { describe, test, expect } from 'bun:test';
import { webFetchTool } from './web-fetch.js';

// ---------------------------------------------------------------------------
// Blocked-domain guard — these tests confirm that known anti-scraping domains
// are rejected immediately (no network request) with an actionable message.
// ---------------------------------------------------------------------------

describe('web_fetch blocked-domain guard', () => {
  async function invoke(url: string): Promise<string> {
    return webFetchTool.invoke({ url }) as Promise<string>;
  }

  test('rejects finance.yahoo.com with a hint to use financial_search', async () => {
    const result = await invoke('https://finance.yahoo.com/quote/VWS.CO/');
    expect(result).toContain('Blocked domain');
    expect(result).toContain('financial_search');
  });

  test('rejects all finance.yahoo.com sub-paths', async () => {
    const result = await invoke('https://finance.yahoo.com/quote/AAPL/financials/');
    expect(result).toContain('Blocked domain');
  });

  test('rejects bloomberg.com with a hint to use web_search', async () => {
    const result = await invoke('https://www.bloomberg.com/news/articles/2025-01-01/example');
    expect(result).toContain('Blocked domain');
    expect(result).toContain('web_search');
  });

  test('rejects wsj.com with a hint about the paywall', async () => {
    const result = await invoke('https://www.wsj.com/articles/some-article');
    expect(result).toContain('Blocked domain');
    expect(result).toContain('paywalled');
  });

  test('does NOT reject legitimate news URLs', async () => {
    // cnbc.com, reuters.com, ft.com etc. should pass through to the real fetch
    // (we just verify the guard does not fire — the network call itself may fail
    //  in CI, so we only check that the message is not a "Blocked domain" one).
    const result = await invoke('https://httpbin.org/get').catch((e: Error) => e.message);
    expect(result).not.toContain('Blocked domain');
  });
});
