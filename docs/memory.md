# Memory System

Dexter maintains persistent memory across sessions using plain markdown files stored in `.dexter/memory/`. This lets the agent remember your investment preferences, research notes, and portfolio context without re-explaining them every session.

---

## Memory Files

| File | Purpose |
|------|---------|
| `MEMORY.md` | Long-term facts: user preferences, data-source routing, procedural notes |
| `FINANCE.md` | Financial context: positions, watchlist theses, valuation assumptions |
| `YYYY-MM-DD.md` | Daily flush output — created automatically when the session context fills up |
| `archive/YYYY-MM-DD.md` | Daily files processed by Dream consolidation (read-only history) |
| `.dream-meta.json` | Dream run state (last run time, session counter, total runs) |

---

## Memory Priority System

All memory content uses a four-tier priority system:

| Priority | Tier | What to store |
|----------|------|---------------|
| **P1 — CRITICAL** | Always keep | Ticker routing decisions, user risk profile, explicit buy/sell/hold decisions |
| **P2 — IMPORTANT** | Keep when possible | Investment theses, analyst consensus, WACC / DCF assumptions (date-stamped) |
| **P3 — USEFUL** | Trim when crowded | Sector notes, general market observations, reference data |
| **P4 — NOISE** | Prune aggressively | Real-time prices, duplicate news snippets, vague impressions |

> **Tip:** Always date-stamp financial data so future sessions know how fresh it is.
> Example: `AAPL P/E 28x TTM (2026-Q1), forward P/E 24x (analyst consensus 2026-03)`

---

## Session Flush

When the session context approaches the token limit, Dexter automatically flushes durable facts from the conversation into today's `YYYY-MM-DD.md` file. This prevents context overflow while preserving research value.

Flush output follows the P1–P4 priority system and includes date-stamped financial data.

---

## Dream — Memory Consolidation

Inspired by Claude Code's AutoDream, **Dream** is a background consolidation cycle that runs between sessions. It works like REM sleep: merging fragmented daily notes, removing stale data, resolving contradictions, and rewriting `MEMORY.md` and `FINANCE.md` into clean, up-to-date summaries.

### What Dream does

1. **Orientation** — reads `.dream-meta.json`, lists all memory files, estimates total token load
2. **Signal gathering** — detects relative-date language ("last week", "recently"), duplicate ticker mentions across files, and contradiction candidates
3. **LLM consolidation** — sends all file contents (tagged with filenames) to the LLM with instructions to merge, prune, and rewrite
4. **Rewrite** — saves updated `MEMORY.md` and `FINANCE.md`, moves processed daily files to `archive/`, updates `.dream-meta.json`

### Auto-trigger conditions

Dream auto-runs at startup when **all three** conditions are true:

- ≥ 2 daily `YYYY-MM-DD.md` files exist
- ≥ 24 hours have elapsed since the last Dream run
- ≥ 3 sessions have been started since the last Dream run

The session counter increments automatically every time Dexter starts.

### Manual trigger

```
/dream            # run if conditions are met
/dream force      # bypass conditions and run immediately
```

Status is shown briefly in the header line during the run:
- `🌙 Dream running…` — consolidation in progress
- `✨ Dream: archived 3 files, memory updated` — completed successfully
- `🌙 Dream: Not yet due — 1/3 sessions, 2h/24h elapsed` — conditions not met

### Consolidation rules (applied by the LLM)

- **Merge duplicates** — same ticker data from multiple files is combined; most recent, most specific wins
- **Absolute dates** — relative timestamps ("last week") are replaced with the source file date or removed
- **Contradiction resolution** — when two files disagree (e.g. different price targets), the most recent file's value is kept with a date note
- **P1/P2 preservation** — critical and important notes are never pruned
- **P3/P4 cleanup** — stale noise and redundant observations are removed
- **File separation** — `MEMORY.md` gets general/procedural content; `FINANCE.md` gets financial/portfolio content

### Archived files

Processed daily files are moved to `.dexter/memory/archive/` — they are never deleted. You can inspect them at any time to review what was consolidated.

---

## Memory Search

When memory is enabled (requires an embedding provider), Dexter uses hybrid vector + keyword search to retrieve the most relevant memory chunks for each query.

Search is triggered automatically for financial queries and returns ranked results with source file, line range, and an explanation score (`v=vector k=keyword src=both`).

---

## Memory Auto-Injection

At the start of **every query**, Dexter automatically scans the input for stock tickers (e.g. `AAPL`, `$NVDA`, `MSFT`) and silently searches memory for prior research on those tickers. If relevant notes are found, they are prepended to the prompt as a `📚 Prior Research:` block before the agent starts working.

### What it looks like

When you ask:
```
What is AAPL's current valuation vs its 5-year average P/E?
```

If memory contains a note about Apple, the agent sees:
```
📚 Prior Research:
• [AAPL] Services segment gross margin expanded to 74% in Q1 2026, up from 70.8% (2026-01-30)
• [AAPL] P/E TTM 28x, forward P/E 24x — historically trades 24–30x (2026-03-10)

What is AAPL's current valuation vs its 5-year average P/E?
```

The agent then factors in the prior context without needing to re-fetch data it has already analysed, reducing tool calls and improving continuity across sessions.

### Limits

| Setting | Default | Effect |
|---------|---------|--------|
| Max tickers per query | 2 | Looks up at most 2 tickers (the first two found in the query) |
| Max results per ticker | 3 | At most 3 memory snippets per ticker |
| Snippet length | 300 chars | Each snippet is truncated to 300 characters |

### Requirements

Memory auto-injection requires an embedding provider (same as memory search). If no embedding provider is configured, the feature is silently skipped — queries run normally.

### Enabling memory

Set an embedding provider in your environment:

```bash
# .env
OPENAI_API_KEY=sk-...          # enables OpenAI embeddings (text-embedding-3-small)
# or
OLLAMA_BASE_URL=http://...     # enables Ollama embeddings (nomic-embed-text)
```

Memory is disabled by default when no embedding provider is configured.

---

## Context Summaries (Smarter Clearing)

When a long research session causes the agent's context window to fill up, Dexter must drop the oldest tool results to make room. Instead of simply discarding them, it first generates a compact **context summary** — a condensed digest of what was in the dropped results — and injects it into the scratchpad.

### Why this matters

Without summaries, dropping old tool results could cause the agent to "forget" that it already fetched AAPL's income statement at step 3 and re-fetch it at step 9. With summaries, the agent sees a brief note like:

```
### [Prior Research Summary]
The following 2 earlier tool result(s) were condensed to save context:
- get_income_statements(ticker=AAPL, period=annual): Revenue $394B, Net Income $97B…
- get_stock_price(ticker=AAPL): $182.50 (+1.2%) as of 2026-03-28…
```

This keeps analysis continuity without consuming the full token budget of the original results.

### What gets summarised

Each condensed entry includes:
- **Tool name** and **arguments** (which ticker, which period, etc.)
- **First 600 characters** of the raw result — enough to preserve key numbers

### Viewing in scratchpad

Context summary entries appear in the `.dexter/scratchpad/*.jsonl` debug files with `"type": "context_summary"`:

```json
{"type":"context_summary","timestamp":"...","content":"The following 2 earlier tool result(s) were condensed…"}
```

---

## File Layout

```
.dexter/
  memory/
    MEMORY.md              ← always loaded at session start
    FINANCE.md             ← always loaded at session start
    2026-03-25.md          ← daily flush file
    2026-03-26.md          ← daily flush file
    archive/
      2026-03-20.md        ← archived by Dream
      2026-03-21.md        ← archived by Dream
    .dream-meta.json       ← Dream run state
```
