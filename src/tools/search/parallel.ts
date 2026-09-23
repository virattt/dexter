import { DynamicStructuredTool } from '@langchain/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

const ENDPOINT = 'https://search.parallel.ai/mcp';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_SNIPPET_CHARS = 4000;

const searchPayload = z.object({
  results: z.array(z.object({
    url: z.string().url(),
    title: z.string().nullish(),
    excerpts: z.array(z.string()),
    publish_date: z.string().nullish(),
  })),
  warnings: z.array(z.string()).nullish(),
});

// The SDK owns JSON-RPC and SSE. Bound bytes before it buffers either format.
async function boundedFetch(input: string | URL | Request, init: RequestInit | undefined, signal: AbortSignal): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    redirect: 'error',
    signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
  });
  if (!response.body) return response;
  let bytes = 0;
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        throw new Error('[Parallel MCP] Response exceeds 1 MiB.');
      }
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export const parallelSearch = new DynamicStructuredTool({
  name: 'web_search',
  description: 'Search the web for current information. Returns titles, URLs, and content snippets.',
  schema: z.object({
    query: z.string().trim().min(1).describe('The search query to look up on the web'),
  }),
  func: async ({ query }, _runManager, config) => {
    const deadline = AbortSignal.timeout(30_000);
    const signal = config?.signal ? AbortSignal.any([config.signal, deadline]) : deadline;
    signal.throwIfAborted();
    const client = new Client({ name: 'dexter', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
      fetch: (input, init) => boundedFetch(input, init, signal),
    });
    try {
      await client.connect(transport, { signal });
      // No conversation identity is available at this boundary. Omit optional
      // session metadata rather than sharing an identifier across users/tasks.
      const result = CallToolResultSchema.parse(await client.callTool({
        name: 'web_search',
        arguments: { objective: query, search_queries: [query] },
      }, undefined, { signal, timeout: 30_000 }));
      if (result.isError) {
        throw new Error('[Parallel MCP] Search tool returned an error.');
      }
      const text = result.content.find((item) => item.type === 'text');
      const payload = searchPayload.parse(result.structuredContent ?? (
        text?.type === 'text' ? JSON.parse(text.text) : undefined
      ));
      let truncated = payload.results.length > 5;
      const results = payload.results.slice(0, 5).map((item) => {
        const snippet = item.excerpts.join('\n');
        truncated ||= snippet.length > MAX_SNIPPET_CHARS;
        return {
          title: item.title,
          url: item.url,
          snippet: snippet.slice(0, MAX_SNIPPET_CHARS),
          publish_date: item.publish_date,
        };
      });
      return formatToolResult({ results, warnings: payload.warnings, truncated },
        [...new Set(results.map((item) => item.url))]);
    } finally {
      // Local close aborts open streams; it must never mask a result or error.
      await client.close().catch(() => {});
    }
  },
});
