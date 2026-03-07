# Dexter + Stocks Frontend Integration

Complete instructions for connecting [Dexter](https://github.com/virattt/dexter) (CLI financial research agent) with the [stocks](https://github.com/eliza420ai-beep/stocks) Next.js chatbot frontend.

---

## Web vs Terminal: Feature Parity

The web frontend does **not** have full parity with the terminal. Here’s what differs:

| Feature | Terminal (CLI) | Web (HTTP API + stocks) |
|---------|----------------|--------------------------|
| **Financial research** (prices, fundamentals, filings, search, DCF) | ✅ | ✅ |
| **Conversation history** (multi-turn) | ✅ | ✅ (per session) |
| **Model selection** | ✅ `/model` – OpenAI, Anthropic, Google, xAI, Ollama, OpenRouter | ⚠️ Via API body only; stocks UI doesn’t expose it |
| **Tool approval** (`write_file`, `edit_file`) | ✅ Prompts for Yes / Yes for session / No | ❌ **Denied** – no interactive approval in HTTP |
| **Real-time streaming** (thinking, tool progress) | ✅ Live updates | ❌ Only final answer when done |
| **Abort / cancel** mid-run | ✅ Ctrl+C | ❌ Not supported |
| **Input history** (↑/↓ previous queries) | ✅ | ❌ Stocks UI doesn’t implement it |
| **Debug panel** | ✅ | ❌ |
| **Evals mode** | ✅ | ❌ CLI-only |
| **Long-term persistence** (`.dexter/messages/`) | ✅ | ❌ In-memory only per session |

**Summary:** The web path is best for read-only research (prices, fundamentals, filings, web search, DCF). For file edits, model switching, and real-time feedback, use the terminal.

---

## Overview

| Component | Role |
|-----------|------|
| **Dexter** | Backend agent that runs financial research (prices, fundamentals, filings, web search, DCF, etc.) |
| **Stocks** | Next.js chatbot UI (Vercel AI SDK, shadcn/ui, Auth.js, Neon Postgres) |

The stocks app uses route groups: chat routes live under `app/(chat)/api/chat/`. We add a **Dexter proxy route** at `app/(chat)/api/dexter/route.ts` so the frontend can send messages to Dexter instead of (or in addition to) the default AI Gateway.

---

## Prerequisites

- **Dexter**: Bun, OpenAI API key, Financial Datasets API key (see [Dexter README](https://github.com/virattt/dexter))
- **Stocks**: Node.js 18+, pnpm (see [stocks README](https://github.com/eliza420ai-beep/stocks))

---

## Part 1: Dexter Setup

### 1.1 Clone and configure Dexter

```bash
git clone https://github.com/virattt/dexter.git
cd dexter
bun install
cp env.example .env
# Edit .env: add OPENAI_API_KEY, FINANCIAL_DATASETS_API_KEY, EXASEARCH_API_KEY (optional)
```

### 1.2 Start Dexter HTTP API

```bash
bun run api
```

Dexter listens at **http://localhost:3847**:

- `POST /api/chat` – run agent
- `GET /health` – health check

Environment variables (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEXTER_HTTP_PORT` | 3847 | API port |
| `DEXTER_HTTP_HOST` | 0.0.0.0 | Bind host |

---

## Part 2: Stocks Frontend Setup

### 2.1 Clone and install stocks

```bash
git clone https://github.com/eliza420ai-beep/stocks.git
cd stocks
pnpm install
```

### 2.2 Add Dexter API route

Create `app/(chat)/api/dexter/route.ts`:

```typescript
const DEXTER_API_URL = process.env.DEXTER_API_URL ?? "http://localhost:3847";

export const maxDuration = 120;

function getTextFromMessage(
  msg: { role?: string; content?: string; parts?: { type?: string; text?: string }[] }
): string {
  if (typeof msg.content === "string") return msg.content;
  if (msg.parts) {
    const textPart = msg.parts.find((p) => p.type === "text");
    return textPart && "text" in textPart ? String(textPart.text) : "";
  }
  return "";
}

export async function POST(req: Request) {
  let body: { messages?: Array<{ role?: string; parts?: { type?: string; text?: string }[] }> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m?.role === "user");
  const query = lastUser ? getTextFromMessage(lastUser) : "";

  if (!query.trim()) {
    return Response.json({ error: "No user message found" }, { status: 400 });
  }

  const res = await fetch(`${DEXTER_API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m?.role ?? "user",
        content: getTextFromMessage(m),
      })),
      sessionId: req.headers.get("x-session-id") ?? "web-default",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(
      { error: (err as { error?: string }).error ?? res.statusText },
      { status: res.status }
    );
  }

  const { text } = (await res.json()) as { text: string };

  const id = crypto.randomUUID();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `0:{"type":"message_start","messageId":"${id}","message":{"role":"assistant","content":[{"type":"text","text":""}]}}\n`
        )
      );
      controller.enqueue(
        encoder.encode(`2:${JSON.stringify({ type: "text_delta", textDelta: text })}\n`)
      );
      controller.enqueue(
        encoder.encode(`0:{"type":"message_finish","messageId":"${id}"}\n`)
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}
```

### 2.3 Environment variables

Add to `.env.local` (or `.env`):

```
DEXTER_API_URL=http://localhost:3847
```

For production, set `DEXTER_API_URL` to your deployed Dexter API URL.

### 2.4 Wire up the chat to use Dexter

The stocks app uses a custom chat flow with auth and DB. To use Dexter:

**Option A: Add Dexter as a model choice**

In the model selector / chat config, add a "Dexter" option that points the chat to `/api/dexter` instead of `/api/chat`. The exact change depends on how the frontend calls the API (e.g. `useChat`, custom fetch, or Server Action).

**Option B: Standalone Dexter chat page (no auth)**

Create a minimal page that uses Dexter only:

1. Create `app/(chat)/dexter/page.tsx` (or similar) with a chat UI that calls `/api/dexter`.
2. Use `useChat` from `@ai-sdk/react` with `api: "/api/dexter"`.

Example minimal page:

```tsx
// app/(chat)/dexter/page.tsx
"use client";

import { useChat } from "@ai-sdk/react";

export default function DexterChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/dexter",
  });

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Dexter – Financial Research</h1>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
            <span className="font-medium">{m.role}:</span> {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about stocks, fundamentals, filings..."
          className="flex-1 border rounded px-3 py-2"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded">
          Send
        </button>
      </form>
    </div>
  );
}
```

Then open `http://localhost:3000/dexter`.

---

## Part 3: Run Both Services

```bash
# Terminal 1: Dexter API
cd dexter
bun run api

# Terminal 2: Stocks frontend
cd stocks
pnpm db:migrate   # if using DB
pnpm dev
```

- Dexter: http://localhost:3847  
- Stocks: http://localhost:3000  

---

## Part 4: Dexter API Reference

### POST /api/chat

**Request:**

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

- `messages` – Array of `{ role, content }`. The latest `user` message is used.
- `sessionId` – Optional. Conversation history key (default: `web-default`).
- `model` / `modelProvider` – Optional. Defaults: `gpt-5.4`, `openai`.

**Response:**

```json
{
  "text": "Apple's revenue grew from $394.3B in FY23 to $383.3B in FY24...",
  "sessionId": "web-default"
}
```

---

## Part 5: Production Deployment

1. **Deploy Dexter API**  
   Run Dexter behind a reverse proxy (nginx, Caddy) or a process manager (PM2, systemd). Expose it on a public URL or internal network.

2. **Configure stocks**  
   Set `DEXTER_API_URL` to the Dexter API base URL (e.g. `https://dexter.yourdomain.com`).

3. **CORS**  
   Dexter allows `*` by default. For production, restrict `Access-Control-Allow-Origin` in `src/gateway/http-server.ts` to your frontend domain.

4. **Auth**  
   The `/api/dexter` route above does not enforce auth. Add your own auth (e.g. NextAuth session check) if needed.

---

## Part 6: Troubleshooting

| Issue | Fix |
|-------|-----|
| `fetch failed` / connection refused | Ensure Dexter is running (`bun run api`) and `DEXTER_API_URL` is correct. |
| `No user message found` | Request body must include `messages` with at least one `role: "user"` message. |
| Empty or garbled stream | Check `X-Vercel-AI-Data-Stream: v1` header and that the response is a valid AI SDK data stream. |
| CORS errors | Dexter sets `Access-Control-Allow-Origin: *`. If calling from a different origin, verify CORS headers. |
| Timeout | Dexter can take 30–120s for complex research. Set `maxDuration = 120` (or higher) in the route. |

---

## Summary

1. Run Dexter: `cd dexter && bun run api`
2. Add `app/(chat)/api/dexter/route.ts` in stocks (code above)
3. Set `DEXTER_API_URL` in stocks `.env.local`
4. Use `/api/dexter` from the chat UI (model switcher or standalone page)
5. Run stocks: `cd stocks && pnpm dev`

For more on Dexter (CLI, tools, skills), see the [Dexter README](https://github.com/virattt/dexter).
