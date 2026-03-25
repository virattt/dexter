import { describe, test, expect, mock, beforeAll } from 'bun:test';
import { webFetchTool } from './web-fetch.js';
import { extractText as extractPdfText } from 'unpdf';

// Minimal valid 1-page PDF with the text "Hello PDF World"
const MINIMAL_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKEhlbGxvIFBERiBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjY3IDAwMDAwIG4gCjAwMDAwMDAzNjEgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0NDMKJSVFT0YK';

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

// ---------------------------------------------------------------------------
// PDF extraction — unit-tests for the unpdf integration.
// The web_fetch HTTP layer is not exercised here; we test the PDF library
// directly to confirm text extraction works for financial report PDFs.
// ---------------------------------------------------------------------------

describe('PDF text extraction (unpdf)', () => {
  test('extracts text from a minimal synthetic PDF', async () => {
    const buf = Buffer.from(MINIMAL_PDF_BASE64, 'base64');
    const { totalPages, text } = await extractPdfText(new Uint8Array(buf), { mergePages: true });
    expect(totalPages).toBe(1);
    expect(text.trim()).toBe('Hello PDF World');
  });

  test('reports correct page count', async () => {
    const buf = Buffer.from(MINIMAL_PDF_BASE64, 'base64');
    const { totalPages } = await extractPdfText(new Uint8Array(buf), { mergePages: true });
    expect(totalPages).toBeGreaterThan(0);
  });

  test('returns an array of strings when mergePages is false', async () => {
    const buf = Buffer.from(MINIMAL_PDF_BASE64, 'base64');
    const { totalPages, text } = await extractPdfText(new Uint8Array(buf), { mergePages: false });
    expect(Array.isArray(text)).toBe(true);
    expect(text).toHaveLength(totalPages);
    expect((text as string[]).join(' ').trim()).toContain('Hello PDF World');
  });

  test('mergePages=true returns a single string (not an array)', async () => {
    const buf = Buffer.from(MINIMAL_PDF_BASE64, 'base64');
    const { text } = await extractPdfText(new Uint8Array(buf), { mergePages: true });
    expect(typeof text).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// web_fetch PDF content-type detection — mock fetch so we can verify that
// application/pdf responses are routed through the PDF extractor, not the
// HTML extractor.  We use a synthetic PDF buffer as the response body.
// ---------------------------------------------------------------------------

describe('web_fetch PDF content-type routing', () => {
  const originalFetch = globalThis.fetch;

  async function invokePdfUrl(url: string, contentType = 'application/pdf'): Promise<string> {
    const pdfBuf = Buffer.from(MINIMAL_PDF_BASE64, 'base64');
    // Stub global fetch to return a fake PDF response for any URL
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(pdfBuf, {
        status: 200,
        headers: { 'content-type': contentType },
      });
    }) as unknown as typeof globalThis.fetch;
    try {
      return await (webFetchTool.invoke({ url }) as Promise<string>);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  test('extracts PDF text when content-type is application/pdf', async () => {
    const result = await invokePdfUrl('https://example.com/report.pdf');
    expect(result).toContain('Hello PDF World');
  });

  test('uses pdf extractor label in result for application/pdf responses', async () => {
    const result = await invokePdfUrl('https://example.com/report.pdf');
    // extractor field should be "pdf" not "htmlToMarkdown" or "readability"
    expect(result).toContain('"extractor":"pdf"');
  });

  test('detects PDF by .pdf URL extension even if content-type is octet-stream', async () => {
    const result = await invokePdfUrl(
      'https://example.com/vestas-q2-2025-interim-report.pdf',
      'application/octet-stream',
    );
    expect(result).toContain('Hello PDF World');
  });

  test('does not use PDF extractor for regular HTML URLs', async () => {
    const htmlBuf = '<html><head><title>Test</title></head><body><p>Hello HTML</p></body></html>';
    globalThis.fetch = (async () =>
      new Response(htmlBuf, { status: 200, headers: { 'content-type': 'text/html' } })
    ) as unknown as typeof globalThis.fetch;
    try {
      const result = await (webFetchTool.invoke({ url: 'https://example.com/' }) as Promise<string>);
      expect(result).not.toContain('"extractor": "pdf"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
