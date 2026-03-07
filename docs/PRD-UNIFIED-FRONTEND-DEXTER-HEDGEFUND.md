# PRD: Unified Frontend — Dexter + AI Hedge Fund

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07

---

## 1. Executive Summary

Build a **unified financial research and analysis frontend** that combines:

1. **Dexter** — Conversational deep research (prices, fundamentals, filings, web search, DCF)
2. **AI Hedge Fund** — Multi-agent trading analysis (Buffett, Burry, Cathie Wood, etc. → Valuation, Sentiment, Fundamentals, Technicals → Risk Manager → Portfolio Manager) and backtester

Users get one interface to research stocks and run institutional-style AI analysis without switching apps.

---

## 2. Background

| System | Stack | Purpose |
|--------|-------|---------|
| **Dexter** | TypeScript/Bun, HTTP API :3847 | Chat-based financial research; tools for prices, filings, search, DCF |
| **AI Hedge Fund** | Python/FastAPI :8000, React/Vite :5173 | Multi-agent pipeline for trading signals; backtester |
| **Stocks** | Next.js :3000 | Chatbot UI (Vercel AI SDK, shadcn/ui) |

Today these run separately. Users must:
- Use Dexter CLI or stocks for research
- Use AI Hedge Fund app for trading analysis
- Manually copy tickers and context between tools

---

## 3. Vision

A single web app where users can:

- **Research** — Chat with Dexter to explore fundamentals, filings, news, DCF
- **Analyze** — Run AI Hedge Fund on tickers to get multi-agent views and signals
- **Backtest** — Run backtester on tickers and date ranges
- **Flow context** — Move from research to analysis without re-entering tickers

---

## 4. Goals & Non-Goals

### Goals

- One frontend for Dexter + AI Hedge Fund
- Seamless ticker/context flow between research and hedge fund
- Preserve full functionality of both backends
- Single deployment story (or clear multi-service setup)

### Non-Goals

- Merging Dexter and AI Hedge Fund codebases
- Real trading or order execution
- Replacing AI Hedge Fund’s existing React app (can coexist during migration)

---

## 4.1 Strategic Decision: WhatsApp-First vs Web-First

**Decision:** Prioritize **WhatsApp groups** as the primary interface for Dexter (Portfolio Builder, heartbeat, research) over building a custom web frontend.

### Rationale

| Factor | WhatsApp Groups | Web Frontend |
|--------|-----------------|--------------|
| **Friction** | Low — users already have WhatsApp | Higher — new app, login, onboarding |
| **Collaboration** | Natural — multiple people @-mention Dexter in one thread | Requires shared sessions, permissions |
| **Mobile** | Native — research and alerts on the go | Responsive but secondary |
| **Build cost** | Already built — group policy, @-mention detection | Significant — UI, auth, feature parity |
| **Heartbeat delivery** | Direct — weekly rebalance, quarterly reports to group | Requires polling or push setup |

### What WhatsApp Groups Excel At

- Portfolio Builder alerts (rebalance needed, quarterly report)
- Ad-hoc research ("What's our thesis on BE?")
- Collaborative discussion — team can react, reply, @-mention
- No deployment — add Dexter to a group and go

### What Web Frontend Still Adds (Secondary)

- Rich tables, charts, markdown rendering
- Tool approval flow (write_file, edit_file)
- Model selection, abort, streaming
- Discovery — public landing, sign-up

### Implication

- **Primary:** Invest in WhatsApp group experience — polish group policy, heartbeat delivery to groups, PORTFOLIO.md sync
- **Secondary:** Web frontend (Stocks, unified app) is optional or power-user only; deprioritize vs WhatsApp
- **AI Hedge Fund:** May remain web-first (charts, backtester need UI) or get a "summary to WhatsApp" path for key outputs

---

## 5. User Personas & Journeys

### Persona: Research-First Investor

1. Opens unified app
2. Asks Dexter: “What’s going on with NVDA’s margins?”
3. Gets research answer
4. Clicks “Run Hedge Fund Analysis on NVDA”
5. Sees multi-agent views (Buffett, Burry, etc.) and final signals

### Persona: Analysis-First Investor

1. Enters tickers (AAPL, MSFT, NVDA) in Hedge Fund panel
2. Runs analysis
3. Sees Warren Buffett agent is bullish; wants more detail
4. Switches to Research, asks: “Why would Buffett like MSFT?”
5. Dexter uses filings and fundamentals to explain

### Persona: Backtester

1. Enters tickers and date range
2. Runs backtester
3. Reviews performance
4. Asks Dexter: “What drove the drawdown in Q2 2024?”

---

## 6. Architecture

### 6.1 High-Level

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Unified Frontend (Stocks-based Next.js)                    │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌───────────┐  │
│  │ Research    │  │ Hedge Fund      │  │ Backtester      │  │ Shared    │  │
│  │ (Dexter)    │  │ (Multi-Agent)   │  │                 │  │ Ticker    │  │
│  │ Chat        │  │ Analysis        │  │                 │  │ Context   │  │
│  └──────┬──────┘  └────────┬────────┘  └────────┬────────┘  └─────┬─────┘  │
│         │                   │                    │                  │        │
└─────────┼───────────────────┼────────────────────┼──────────────────┼────────┘
          │                   │                    │                  │
          ▼                   ▼                    ▼                  │
┌─────────────────┐  ┌───────────────────────────────────────────────┴───────┐
│ Dexter HTTP API │  │ AI Hedge Fund Backend (FastAPI)                        │
│ :3847           │  │ :8000                                                  │
│ POST /api/chat  │  │ POST /hedge-fund/run, /flows, /flow-runs, etc.         │
└─────────────────┘  │ Backtester (CLI or API)                                │
                      └───────────────────────────────────────────────────────┘
```

### 6.2 Integration Approaches

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A. Stocks as shell** | Use stocks (Next.js) as base; add Research + Hedge Fund + Backtester as tabs/views | Single app, shared auth/DB | Requires porting Hedge Fund UI or embedding |
| **B. Proxy/BFF** | Stocks frontend; single backend proxies to Dexter + Hedge Fund | Clean separation | Extra backend layer |
| **C. Iframe / micro-frontend** | Embed AI Hedge Fund React app in stocks | Reuse existing Hedge Fund UI | Styling/UX inconsistency, cross-origin |
| **D. Full port** | Rebuild Hedge Fund UI in Next.js, call Hedge Fund API | Consistent UX | More work |

**Recommended:** **A (Stocks as shell)** with new Hedge Fund and Backtester views built in Next.js, calling AI Hedge Fund API directly. Reuse stocks’ chat for Dexter; add new pages for Hedge Fund analysis and backtester.

---

## 7. Requirements

### 7.1 Research (Dexter) — P0

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R1.1 | Research chat uses Dexter | Chat UI sends messages to Dexter HTTP API; responses rendered in chat |
| R1.2 | Ticker extraction | System extracts tickers from research messages for “Run Analysis” |
| R1.3 | Quick action | “Run Hedge Fund Analysis” on extracted or selected tickers |

### 7.2 Hedge Fund Analysis — P0

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R2.1 | Ticker input | User can enter one or more tickers (e.g. AAPL,MSFT,NVDA) |
| R2.2 | Run analysis | Calls AI Hedge Fund API; shows progress |
| R2.3 | Results display | Agent views (Buffett, Burry, etc.), signals, and final portfolio decision |
| R2.4 | Date range (optional) | Support start/end dates if API allows |
| R2.5 | Ollama/local models | Toggle for local models if supported by API |

### 7.3 Backtester — P1

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R3.1 | Ticker + date input | User enters tickers and optional date range |
| R3.2 | Run backtest | Calls backtester (CLI or API) |
| R3.3 | Results display | Performance metrics, equity curve, drawdowns |

### 7.4 Context Flow — P1

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R4.1 | Ticker from Research → Hedge Fund | Tickers mentioned in chat can be sent to Hedge Fund with one action |
| R4.2 | Ticker from Hedge Fund → Research | Tickers from analysis can open a Research chat pre-filled with that ticker |
| R4.3 | Shared ticker bar | Global or persistent ticker context visible across views |

### 7.5 Navigation & Layout — P1

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R5.1 | Mode switcher | Clear switch between Research, Hedge Fund, Backtester |
| R5.2 | Responsive layout | Works on desktop and tablet |
| R5.3 | Consistent styling | Shared design system (e.g. shadcn) across all views |

### 7.6 Configuration — P2

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R6.1 | API URLs configurable | DEXTER_API_URL, HEDGE_FUND_API_URL in env |
| R6.2 | Health checks | Frontend can verify Dexter and Hedge Fund are reachable |

---

## 8. API Integration

### 8.1 Dexter (Existing)

- `POST /api/chat` — `{ messages, sessionId?, model?, modelProvider? }` → `{ text }`
- `GET /health` — Health check

### 8.2 AI Hedge Fund (Existing)

From [app/backend](https://github.com/eliza420ai-beep/ai-hedge-fund/tree/main/app/backend):

- `POST /hedge-fund/run` — Run pipeline (tickers, dates, etc.)
- `GET /ping` — Health
- Flows, flow runs, storage, Ollama, language models, API keys — as needed

**Action:** Confirm exact request/response schemas for `hedge-fund/run` and backtester (CLI vs API).

### 8.3 Backtester

- **Current:** `poetry run python src/backtester.py --ticker AAPL,MSFT,NVDA`
- **Option 1:** Expose backtester via FastAPI endpoint (new)
- **Option 2:** Run as subprocess from a BFF; stream or poll for results
- **Option 3:** Integrate backtester into existing Hedge Fund backend

---

## 9. UI/UX Wireframes (Conceptual)

### 9.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [Research] [Hedge Fund] [Backtester]     Tickers: AAPL, MSFT     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  RESEARCH MODE:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Chat with Dexter                                             │ │
│  │ User: What's NVDA's revenue growth?                          │ │
│  │ Dexter: ...                                                  │ │
│  │ [Run Hedge Fund Analysis on NVDA]                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  HEDGE FUND MODE:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Tickers: [AAPL, MSFT, NVDA    ] [Run Analysis] [Backtest]   │ │
│  │ Date range: [2024-01-01] to [2024-12-31]                    │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ Agent Views | Signals | Portfolio Decision                   │ │
│  │ Warren Buffett: Bullish...                                   │ │
│  │ Michael Burry: ...                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Research → Hedge Fund Flow

1. User asks: “Compare AAPL and MSFT margins”
2. Dexter responds with analysis
3. UI shows: “Run Hedge Fund Analysis on AAPL, MSFT”
4. User clicks → navigates to Hedge Fund with tickers pre-filled; analysis runs

---

## 10. Implementation Phases

### Phase 1: Research + Hedge Fund (P0)

| Task | Owner | Est. |
|------|-------|------|
| Add Hedge Fund page to stocks | Frontend | 2 d |
| Ticker input + Run Analysis | Frontend | 1 d |
| Call Hedge Fund API, display results | Frontend | 2 d |
| Add “Run Analysis” from Research chat | Frontend | 1 d |
| Ticker extraction from messages (simple regex or LLM) | Frontend | 0.5 d |
| Env: HEDGE_FUND_API_URL | DevOps | 0.5 d |

### Phase 2: Backtester (P1)

| Task | Owner | Est. |
|------|-------|------|
| Expose backtester via Hedge Fund API (or BFF) | Backend | 2 d |
| Backtester page in stocks | Frontend | 1.5 d |
| Date range, results display | Frontend | 1 d |

### Phase 3: Context Flow + Polish (P1–P2)

| Task | Owner | Est. |
|------|-------|------|
| Shared ticker bar / context | Frontend | 1 d |
| Ticker from Hedge Fund → Research | Frontend | 0.5 d |
| Health checks, config UI | Frontend | 1 d |
| Responsive layout, design polish | Frontend | 1 d |

---

## 11. Technical Considerations

### 11.1 CORS

- Dexter: `Access-Control-Allow-Origin: *`
- AI Hedge Fund: Currently `http://localhost:5173`; add `http://localhost:3000` (or stocks URL) for unified app

### 11.2 Auth

- Stocks may use Auth.js
- Hedge Fund API may be unauthenticated
- Decide: same auth for both, or Hedge Fund behind same session

### 11.3 Deployment

- **Option A:** Three services: stocks (Vercel), Dexter (e.g. Railway/Fly.io), Hedge Fund (e.g. Railway/Fly.io)
- **Option B:** Monorepo or docker-compose for local dev; same for prod with separate services
- **Option C:** BFF that runs Dexter + proxies to Hedge Fund; single backend entrypoint

### 11.4 Ticker Extraction

- Regex: `\b[A-Z]{1,5}\b` with exclusion list (e.g. common words)
- Or: LLM call to extract tickers from last N messages
- Or: User selection in chat (highlight → “Analyze”)

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Research → Hedge Fund flow | User can run analysis on tickers from chat in &lt; 3 clicks |
| Hedge Fund results load | Results visible within 2 min of run |
| Backtester results | Results visible within 5 min |
| Cross-mode usage | &gt; 30% of sessions use both Research and Hedge Fund |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hedge Fund runs are slow | Show progress; consider streaming or polling |
| Two backends to operate | Document runbook; consider BFF for single entrypoint |
| Ticker extraction errors | Allow manual override; show extracted tickers for confirmation |
| API schema changes | Version APIs; maintain adapter layer in frontend |

---

## 14. Dependencies

- [Dexter](https://github.com/virattt/dexter) — HTTP API, FRONTEND.md
- [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund) — FastAPI backend, React frontend
- [Stocks](https://github.com/eliza420ai-beep/stocks) — Next.js chatbot base

---

## 15. Open Questions

1. Does AI Hedge Fund expose backtester via REST, or only CLI?
2. What is the exact request/response schema for `POST /hedge-fund/run`?
3. Should we use stocks as the base, or AI Hedge Fund’s React app?
4. Shared auth across Dexter and Hedge Fund, or keep them independent?
