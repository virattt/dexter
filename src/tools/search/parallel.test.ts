import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { parallelSearch } from './parallel.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const page = { title: 'Example', url: 'https://example.com', excerpts: ['Useful evidence'] };

type RpcRequest = { id?: number; method: string; params?: { arguments?: unknown } };
function serveResult(reply: (request: RpcRequest, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === 'GET') return new Response(null, { status: 405 });
    const request = JSON.parse(String(init?.body)) as RpcRequest;
    if (request.method === 'initialize') {
      return Response.json({ jsonrpc: '2.0', id: request.id, result: {
        protocolVersion: '2025-03-26', capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1.0.0' },
      } });
    }
    if (request.method.startsWith('notifications/')) return new Response(null, { status: 202 });
    return reply(request, init);
  }) as typeof fetch;
}

function success(payload: unknown, textOnly = false) {
  serveResult((request) => Response.json({ jsonrpc: '2.0', id: request.id, result: {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    ...(textOnly ? {} : { structuredContent: payload }),
  } }));
}

describe('Parallel search through the MCP SDK', () => {
  test('sends anonymous MCP arguments and preserves citations and warnings', async () => {
    serveResult((request, init) => {
      expect(request.method).toBe('tools/call');
      expect(request.params?.arguments).toEqual({ objective: 'example', search_queries: ['example'] });
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      expect(new Headers(init?.headers).has('x-api-key')).toBe(false);
      expect(init?.redirect).toBe('error');
      return Response.json({ jsonrpc: '2.0', id: request.id, result: {
        structuredContent: { results: [page], warnings: ['Query adjusted'] },
        content: [{ type: 'text', text: 'Do not duplicate this representation' }],
      } });
    });
    const result = JSON.parse(await parallelSearch.invoke({ query: 'example' }));
    expect(result.sourceUrls).toEqual([page.url]);
    expect(result.data.results[0].snippet).toBe('Useful evidence');
    expect(result.data.warnings).toEqual(['Query adjusted']);
    expect(result.data.truncated).toBe(false);
  });

  test('accepts JSON text-only payloads and valid empty results', async () => {
    success({ results: [], warnings: null }, true);
    expect(JSON.parse(await parallelSearch.invoke({ query: 'example' })).data.results).toEqual([]);
  });

  test('caps result count and snippets without breaking JSON or source URLs', async () => {
    success({ results: Array.from({ length: 7 }, (_, i) => ({
      ...page, url: `https://example.com/${i}`, excerpts: ['x'.repeat(5000)],
    })) });
    const result = JSON.parse(await parallelSearch.invoke({ query: 'example' }));
    expect(result.data.results).toHaveLength(5);
    expect(result.data.results[0].snippet).toHaveLength(4000);
    expect(result.sourceUrls).toHaveLength(5);
    expect(result.data.truncated).toBe(true);
  });

  test('rejects malformed success payloads instead of returning empty results', async () => {
    success({ results: [{ url: 'invalid', excerpts: [] }] });
    await expect(parallelSearch.invoke({ query: 'example' })).rejects.toThrow();
  });

  test('rejects HTTP, JSON-RPC, and MCP tool errors', async () => {
    for (const reply of [
      () => new Response('Unavailable', { status: 503 }),
      (request: RpcRequest) => Response.json({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: 'Unavailable' } }),
      (request: RpcRequest) => Response.json({ jsonrpc: '2.0', id: request.id, result: { isError: true, content: [{ type: 'text', text: 'Unavailable' }] } }),
    ]) {
      serveResult(reply);
      await expect(parallelSearch.invoke({ query: 'example' })).rejects.toThrow();
    }
  });

  test('rejects oversized responses before the SDK buffers them', async () => {
    success({ results: [{ ...page, excerpts: ['x'.repeat(1024 * 1024)] }] });
    await expect(parallelSearch.invoke({ query: 'example' })).rejects.toThrow('exceeds 1 MiB');
  });

  test('propagates cancellation to an in-flight network request', async () => {
    const controller = new AbortController();
    let networkAborted = false;
    serveResult((_request, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        networkAborted = true;
        reject(init.signal?.reason);
      }, { once: true });
      controller.abort(new Error('Canceled fixture'));
    }));
    await expect(parallelSearch.invoke({ query: 'example' }, { signal: controller.signal })).rejects.toThrow();
    expect(networkAborted).toBe(true);
  });

  test('cleanup failure cannot replace a successful search or its original error', async () => {
    const close = Client.prototype.close;
    const cleanup = spyOn(Client.prototype, 'close').mockImplementation(async function (this: Client) {
      await close.call(this);
      throw new Error('Cleanup failed');
    });
    try {
      success({ results: [] });
      expect(JSON.parse(await parallelSearch.invoke({ query: 'example' })).data.results).toEqual([]);
      serveResult((request) => Response.json({ jsonrpc: '2.0', id: request.id,
        error: { code: -32603, message: 'Original failure' } }));
      await expect(parallelSearch.invoke({ query: 'example' })).rejects.toThrow('Original failure');
    } finally {
      cleanup.mockRestore();
    }
  });

  test('rejects redirects without delivering the query to the destination', async () => {
    let destinationCalls = 0;
    const destination = Bun.serve({ port: 0, fetch: () => {
      destinationCalls++;
      return new Response('Unexpected');
    } });
    const redirect = Bun.serve({ port: 0, fetch: () => Response.redirect(destination.url, 307) });
    try {
      globalThis.fetch = ((_url, init) => realFetch(redirect.url, init)) as typeof fetch;
      await expect(parallelSearch.invoke({ query: 'example' })).rejects.toThrow();
      expect(destinationCalls).toBe(0);
    } finally {
      redirect.stop(true);
      destination.stop(true);
    }
  });
});
