# Connecting Dexter to a Web Frontend

Dexter exposes an HTTP API that web frontends (e.g. [Next.js chatbot](https://github.com/eliza420ai-beep/stocks)) can use to run financial research queries.

## 1. Start Dexter's HTTP API

```bash
# From the dexter repo
bun run api
```

This starts the API server at **http://localhost:3847**. Endpoints:

- `POST /api/chat` – Run the agent (see request/response format below)
- `GET /health` – Health check

Environment variables:

- `DEXTER_HTTP_PORT` – Port (default: 3847)
- `DEXTER_HTTP_HOST` – Host (default: 0.0.0.0)

## 2. Request Format

**POST /api/chat**

```json
{
  "messages": [
    { "role": "user", "content": "What is AAPL's revenue growth?" }
  ],
  "sessionId": "optional-session-id",
  "model": "gpt-5.4",
  "modelProvider": "openai"
}
```

- `messages` – Array of `{ role, content }`. The latest `user` message is used as the query.
- `sessionId` – Optional. Used for conversation history (default: `web-default`).
- `model` / `modelProvider` – Optional. Defaults: `gpt-5.4`, `openai`.

## 3. Response Format

```json
{
  "text": "Apple's revenue grew from $394.3B in FY23 to $383.3B in FY24...",
  "sessionId": "web-default"
}
```

## 4. Stocks Frontend Integration (eliza420ai-beep/stocks)

The [stocks](https://github.com/eliza420ai-beep/stocks) repo is a Next.js chatbot template. To use Dexter as the backend:

### Step 1: Clone and set up

```bash
git clone https://github.com/eliza420ai-beep/stocks.git
cd stocks
pnpm install
```

### Step 2: Add Dexter API route

Create or replace `app/api/chat/route.ts` so it proxies to Dexter:

```typescript
// app/api/chat/route.ts
const DEXTER_API_URL = process.env.DEXTER_API_URL ?? 'http://localhost:3847';

export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastUser = messages?.filter((m: { role: string }) => m.role === 'user').pop();
  const query = lastUser?.content ?? '';

  if (!query) {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }

  const res = await fetch(`${DEXTER_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      sessionId: req.headers.get('x-session-id') ?? 'web-default',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(
      { error: err.error ?? res.statusText },
      { status: res.status }
    );
  }

  const { text } = await res.json();

  // Stream the response in AI SDK format so useChat works
  const id = crypto.randomUUID();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:{"type":"message_start","messageId":"${id}","message":{"role":"assistant","content":[{"type":"text","text":""}]}}\n`));
      controller.enqueue(encoder.encode(`2:${JSON.stringify({ type: 'text_delta', textDelta: text })}\n`));
      controller.enqueue(encoder.encode(`0:{"type":"message_finish","messageId":"${id}"}\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
```

### Step 3: Environment

Add to `.env.local`:

```
DEXTER_API_URL=http://localhost:3847
```

### Step 4: Run both services

```bash
# Terminal 1: Dexter API
cd dexter && bun run api

# Terminal 2: Stocks frontend
cd stocks && pnpm dev
```

Open http://localhost:3000 and chat. Queries go to Dexter for financial research.

## 5. CORS

The Dexter HTTP API sets `Access-Control-Allow-Origin: *` on `/api/chat` and `/health`. For production, restrict origins in the HTTP server if needed.
