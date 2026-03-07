# PRD: Web Frontend Feature Parity with Terminal

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07

---

## 1. Executive Summary

The Dexter web frontend (stocks app + HTTP API) currently supports read-only financial research. This PRD defines requirements to achieve **feature parity** with the terminal CLI so users get the same capabilities regardless of interface.

---

## 2. Background

| Interface | Current State |
|-----------|---------------|
| **Terminal (CLI)** | Full-featured: model selection, tool approval, real-time streaming, abort, input history, debug panel, evals |
| **Web (HTTP API + stocks)** | Read-only research only; no approval, no streaming, no model UI, no abort |

Users choosing the web interface lose critical capabilities, especially for workflows involving file edits or iterative research.

---

## 3. Goals & Non-Goals

### Goals

- Achieve functional parity between web and terminal for core agent workflows
- Preserve security: tool approval must not be bypassed
- Maintain compatibility with existing stocks frontend architecture

### Non-Goals

- Evals mode in web (CLI-only, developer tooling)
- Exact UI/UX match to terminal (web can have its own patterns)
- WhatsApp gateway changes (out of scope)

---

## 4. User Personas

- **Researcher**: Runs financial queries, needs real-time feedback and ability to cancel long runs
- **Power user**: Switches models, uses file-edit tools (e.g. save analysis to disk)
- **Casual user**: Prefers web over terminal; expects same capabilities

---

## 5. Requirements

### 5.1 Tool Approval (P0)

**Problem:** `write_file` and `edit_file` are denied in web because there is no interactive approval flow.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R1.1 | Web must support approval for `write_file` and `edit_file` | When agent requests a file edit, user sees a prompt with tool name, args, and options: Allow once / Allow this session / Deny |
| R1.2 | Approval state must be communicated over HTTP | HTTP API supports a "pending approval" response and a separate endpoint or mechanism to submit approval |
| R1.3 | Session-approved tools persist for the session | If user selects "Allow this session", subsequent `write_file`/`edit_file` calls in same session proceed without re-prompting |

**Technical Approach:**

- **Option A (Long polling):** HTTP API returns `202 Accepted` with `approval_required: { tool, args, requestId }`. Frontend polls or uses a callback URL to submit decision; then re-invokes or resumes the run.
- **Option B (Streaming + approval frames):** Stream includes a special frame type `approval_required`. Client renders prompt, sends approval via a separate `POST /api/chat/approve` with `requestId` and `decision`. Agent run resumes.
- **Option C (WebSocket):** Replace HTTP with WebSocket for chat. Agent streams events; when approval needed, connection pauses until client sends approval message.

**Recommended:** Option B (streaming + approval frames) — keeps HTTP, works with AI SDK streaming, no new infra.

---

### 5.2 Real-Time Streaming (P0)

**Problem:** Web only receives the final answer. User sees no thinking, tool progress, or intermediate state.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R2.1 | Stream thinking events | "Thinking" messages appear incrementally as the agent reasons |
| R2.2 | Stream tool lifecycle | Tool start, progress, end, error events are streamed and displayed |
| R2.3 | Stream format compatible with AI SDK | Frontend can consume stream via `useChat` or equivalent without custom parsing |
| R2.4 | Graceful degradation | If streaming fails, fall back to final-answer-only behavior |

**Technical Approach:**

- Extend Dexter HTTP API to support `Accept: text/event-stream` and return Server-Sent Events (SSE) or AI SDK data stream format
- Emit events: `thinking`, `tool_start`, `tool_progress`, `tool_end`, `tool_error`, `approval_required`, `done`
- Map Dexter events to AI SDK stream parts (e.g. `text-delta` for thinking, custom data parts for tool events)
- Stocks frontend extends chat component to render tool events (collapsible sections, progress indicators)

---

### 5.3 Model Selection (P1)

**Problem:** Model can be set via API body but stocks UI has no model selector.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R3.1 | Frontend exposes model selector | User can choose provider (OpenAI, Anthropic, Google, xAI, Ollama, OpenRouter) and model within provider |
| R3.2 | Selection persists per session | Model choice is sent with each request and optionally persisted (cookie/localStorage) |
| R3.3 | API accepts model params | `POST /api/chat` already accepts `model` and `modelProvider`; no backend change if frontend sends them |

**Technical Approach:**

- Add model selector UI to stocks chat (dropdown or modal)
- Reuse or adapt Dexter's `PROVIDERS` and `getModelsForProvider` logic; can expose via `GET /api/models` or bundle model list in frontend
- Pass `model` and `modelProvider` in request body from `useChat` body or headers

---

### 5.4 Abort / Cancel (P1)

**Problem:** User cannot cancel a long-running request mid-execution.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R4.1 | User can cancel in-flight request | Chat UI has a "Stop" or "Cancel" control visible while request is in progress |
| R4.2 | Backend respects abort | Dexter agent receives `AbortSignal` and stops cleanly |
| R4.3 | Frontend handles abort | On cancel, stream ends gracefully; partial response is shown if any |

**Technical Approach:**

- Use `AbortController` with `fetch` in frontend; pass `signal` to `fetch`
- HTTP API: support `AbortSignal` per request (Bun/Node `fetch` supports this)
- Gateway `runAgentForMessage` already accepts `signal`; wire it from HTTP request context
- Expose cancel via `useChat`'s `stop` or a manual AbortController ref

---

### 5.5 Input History (P2)

**Problem:** No up/down navigation through previous queries in web.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R5.1 | User can cycle through previous queries | ↑/↓ or dedicated UI cycles through recent user messages |
| R5.2 | History is session-scoped | History is per chat/session; no cross-session leakage |
| R5.3 | History persists across page reloads (optional) | If feasible, persist to localStorage or backend |

**Technical Approach:**

- Frontend maintains array of recent user messages for current chat
- On ↑/↓ (or click), populate input with previous/next message
- Optional: `GET /api/chat/history` or store in stocks DB if chat is persisted

---

### 5.6 Long-Term Persistence (P2)

**Problem:** Web sessions are in-memory only; history is lost when server restarts.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R6.1 | Conversation history persists | Chat history survives Dexter API restart |
| R6.2 | Persistence is per session/user | Sessions are keyed by `sessionId` or user id; no cross-user access |
| R6.3 | Optional: sync with stocks DB | If stocks persists chats, Dexter history could be synced or stored in same DB |

**Technical Approach:**

- Dexter: add optional file-based or DB-backed session store (similar to `LongTermChatHistory`)
- Store path: `.dexter/sessions/{sessionKey}.json` or SQLite/Postgres
- Gateway already has `InMemoryChatHistory` per session; replace with persistent implementation when configured

---

### 5.7 Debug Panel (P3)

**Problem:** No visibility into token usage, timing, or tool call details in web.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R7.1 | Optional debug view | User can expand a debug section showing token usage, duration, tool calls |
| R7.2 | Data available in stream or response | `done` event includes `tokenUsage`, `totalTime`, `toolCalls`; stream or final payload exposes these |

**Technical Approach:**

- `done` event already has `tokenUsage`, `tokensPerSecond`, `toolCalls`
- Include in stream as a data part or in final JSON
- Frontend: collapsible "Debug" section that renders this data

---

## 6. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Stocks Frontend (Next.js)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Model       │  │ Chat UI      │  │ Approval    │  │ Debug Panel    │  │
│  │ Selector    │  │ + Streaming  │  │ Modal       │  │ (optional)     │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └────────────────┘  │
│         │                  │                 │                           │
└─────────┼──────────────────┼─────────────────┼───────────────────────────┘
          │                  │                 │
          ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Dexter HTTP API (Enhanced)                             │
│  POST /api/chat (streaming)   POST /api/chat/approve   GET /api/models    │
│  - SSE / AI SDK stream       - requestId + decision   - providers + models│
│  - thinking, tool_*, done    - resumes agent run                          │
│  - approval_required frame                                                │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Dexter Agent                                     │
│  Agent.run() → events (thinking, tool_start, tool_end, approval, done)   │
│  requestToolApproval → wired from HTTP approval flow                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Streaming + Approval (P0)

| Task | Owner | Est. |
|------|-------|------|
| Add streaming support to HTTP API (`/api/chat` returns SSE) | Backend | 2–3 d |
| Emit thinking, tool_*, approval_required, done in stream | Backend | 1 d |
| Implement approval flow: pause on approval_required, resume on POST approve | Backend | 2 d |
| Wire `requestToolApproval` in gateway agent-runner for HTTP | Backend | 1 d |
| Stocks: consume stream, render thinking + tool events | Frontend | 2 d |
| Stocks: approval modal, call approve endpoint | Frontend | 1 d |

### Phase 2: Abort + Model Selection (P1)

| Task | Owner | Est. |
|------|-------|------|
| Pass AbortSignal from HTTP request to agent | Backend | 0.5 d |
| Stocks: add Stop button, wire AbortController | Frontend | 0.5 d |
| Add GET /api/models (or static list) | Backend | 0.5 d |
| Stocks: model selector UI, pass model in body | Frontend | 1 d |

### Phase 3: Input History + Persistence (P2)

| Task | Owner | Est. |
|------|-------|------|
| Stocks: input history (↑/↓) for current chat | Frontend | 1 d |
| Dexter: persistent session store (file or DB) | Backend | 2 d |

### Phase 4: Debug Panel (P3)

| Task | Owner | Est. |
|------|-------|------|
| Include tokenUsage/toolCalls in stream | Backend | 0.5 d |
| Stocks: collapsible debug section | Frontend | 1 d |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Feature parity checklist | All P0/P1 items complete |
| Tool approval success rate | User can approve and run write_file/edit_file in web |
| Streaming latency | First token/event within 2s of request |
| Abort latency | Request terminates within 2s of user cancel |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Approval flow adds latency | Design for minimal round-trips; consider WebSocket if HTTP becomes unwieldy |
| Streaming breaks AI SDK compatibility | Use AI SDK data stream format; test with useChat |
| Persistent storage adds ops burden | Start with file-based; optional DB later |

---

## 10. Open Questions

1. Should approval be mandatory for all file edits, or configurable (e.g. allow "auto-approve" for trusted sessions)?
2. Should we support WebSocket as an alternative to HTTP streaming for lower latency?
3. How to handle multi-user sessions when Dexter runs as a single process (session isolation)?

---

## 11. Appendix: Current vs Target State

| Feature | Current (Web) | Target (Web) |
|---------|---------------|--------------|
| Tool approval | Denied | Interactive modal, Allow once/session/Deny |
| Streaming | Final answer only | Thinking + tool events + final answer |
| Model selection | None | Provider + model dropdown |
| Abort | None | Stop button |
| Input history | None | ↑/↓ previous queries |
| Persistence | In-memory | File or DB per session |
| Debug | None | Optional token/timing panel |
