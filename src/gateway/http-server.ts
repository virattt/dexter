/**
 * HTTP API server for Dexter - enables web frontends (e.g. Next.js chatbot) to connect.
 * Exposes POST /api/chat compatible with Vercel AI SDK useChat expectations.
 */

import { runAgentForMessage } from './agent-runner.js';

const DEFAULT_PORT = 3847;

export type HttpServerConfig = {
  port?: number;
  host?: string;
};

export type ChatRequestBody = {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  sessionId?: string;
  model?: string;
  modelProvider?: string;
};

export type ChatResponseJson = {
  text: string;
  sessionId?: string;
};

/**
 * Extracts the latest user message from the messages array.
 */
function getLatestUserMessage(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user' && messages[i]?.content) {
      return String(messages[i].content).trim();
    }
  }
  return '';
}

/**
 * Starts the Dexter HTTP API server.
 * POST /api/chat - Run the agent and return the response.
 * GET /health - Health check.
 */
export async function startHttpServer(config: HttpServerConfig = {}): Promise<{ stop: () => void }> {
  const port = config.port ?? Number(process.env.DEXTER_HTTP_PORT) ?? DEFAULT_PORT;
  const host = config.host ?? process.env.DEXTER_HTTP_HOST ?? '0.0.0.0';

  const server = Bun.serve({
    port,
    hostname: host,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
        return Response.json({ status: 'ok', service: 'dexter' });
      }

      if (req.method === 'OPTIONS' && url.pathname === '/api/chat') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/chat') {
        try {
          const body = (await req.json()) as ChatRequestBody;
          const messages = body.messages ?? [];
          const query = getLatestUserMessage(messages);

          if (!query) {
            return Response.json(
              { error: 'No user message found in messages array' },
              { status: 400 }
            );
          }

          const sessionKey = body.sessionId ?? 'web-default';
          const model = body.model ?? 'gpt-5.4';
          const modelProvider = body.modelProvider ?? 'openai';

          const answer = await runAgentForMessage({
            sessionKey,
            query,
            model,
            modelProvider,
            channel: 'web',
          });

          const response: ChatResponseJson = { text: answer, sessionId: sessionKey };
          return Response.json(response, {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json(
            { error: msg },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`Dexter HTTP API: http://${host}:${port}/api/chat`);
  return {
    stop: () => server.stop(),
  };
}
