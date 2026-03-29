# Dexter — New Features Reference

This document covers features added in the 2025 improvements milestone.

---

## 🌊 Streaming Final Answer

The agent now streams its final answer token-by-token rather than delivering it
all at once. Long responses (DCF reports, sector overviews, full-analysis
reports) start appearing within seconds instead of making you wait for the
entire generation to complete.

**How it works internally:**
- When the agent has no more tool calls to make, it re-runs the final answer
  generation through LangChain's `.stream()` API.
- Tokens are yielded as `answer_chunk` events and progressively appended to
  the TUI history item.
- A `<think>…</think>` filter strips reasoning blocks from thinking models
  (qwen3, deepseek-r1) so only the final answer is displayed.

No configuration required — streaming is on by default for all providers.

---

## 🧠 Context Summary with Key Facts Preserved

When the agent's context window fills up and old tool results must be dropped,
Dexter now extracts key numeric facts before clearing them.

**Preserved fact types:**
- Prices and market caps (`$12.34`, `$2.3B`)
- Percentages (`+3.5%`, `-12%`)
- Valuation ratios (`P/E 22×`, `EV/EBITDA 14×`, `P/B 3.1×`)
- Factor IC values (`IC = 0.045`, `ICIR: 1.2`)
- Probabilities (`probability = 65%`, `likely 30%`)
- WACC / ROIC values

These are embedded in the condensed summary as a `[KEY FACTS: ...]` tag so the
agent can reference them without re-fetching the same data.

---

## 💾 Auto-Save Memory Mid-Session

Memory is now flushed to disk every **5 iterations**, not just when context
overflows. This means:

- A session crash at iteration 12 doesn't lose all research from iterations 1–11.
- Long compound queries (DCF + peer comparison + probability) produce
  recoverable state.
- The flush is **additive** — it appends to the same daily `.md` file, so
  multiple flushes within a session are safe.

The periodic flush is independent of the context-overflow flush. Both can fire
in the same session without conflict.

---

## 📅 Scheduled Research Jobs

Run Dexter headlessly without the TUI using the `schedule` subcommand.

### Setup

Create `~/.dexter/schedules.json`:

```json
[
  {
    "id": "morning-briefing",
    "description": "Daily watchlist briefing",
    "query": "Run the watchlist-briefing skill for my portfolio",
    "outputFile": "~/.dexter/reports/{date}-briefing.md"
  },
  {
    "id": "nvda-weekly",
    "description": "Weekly NVDA analysis",
    "query": "Use the full-analysis skill for NVDA",
    "outputFile": "~/.dexter/reports/{date}-nvda-full.md"
  }
]
```

`{date}` is replaced with the current ISO date (`YYYY-MM-DD`). Paths starting
with `~` are expanded to your home directory. Output directories are created
automatically.

### Commands

```bash
# List all configured jobs
bun start schedule list

# Run all jobs sequentially
bun start schedule run

# Run one specific job
bun start schedule run morning-briefing

# Show help
bun start schedule help
```

### Cron example (macOS / Linux)

Add to crontab (`crontab -e`) to run every weekday at 7 AM:

```
0 7 * * 1-5 cd /path/to/dexter && bun start schedule run morning-briefing >> ~/.dexter/logs/schedule.log 2>&1
```

---

## 🔗 Full-Analysis Meta-Skill

A flagship meta-skill that chains four skills into one comprehensive report:

1. **DCF Valuation** — intrinsic value with CAPM-derived WACC
2. **Peer Comparison** — side-by-side vs. sector competitors
3. **Short Thesis** — bear case with trough-multiple downside target
4. **Probability Assessment** — Polymarket + sentiment + analyst consensus

**Invocation:**
```
Use the full-analysis skill for AAPL
```

**Output structure:**
1. Executive Summary (buy/hold/sell + conviction level)
2. DCF Valuation (with WACC, terminal growth, bull/bear/base scenarios)
3. Peer Comparison table
4. Downside Analysis (short thesis key risks)
5. Probability-Weighted Scenarios with Polymarket signals
6. Investment Decision framework

---

## ⚡ FMP API Quota Tracking

Dexter now tracks Financial Modeling Prep API calls in `~/.dexter/fmp-quota.json`
and emits a warning when you approach the free tier limit (250 calls/day).

- Warning at 80% usage (200 calls)
- Error message at 100% (250 calls) explaining the limit
- Resets automatically at midnight UTC

---

## 🕐 Stale Memory TTL

Memory entries now expire based on their content type:

| Memory tag | TTL |
|------------|-----|
| `routing:*` | Never (permanent routing decisions) |
| `analysis:consensus` | 7 days |
| `analysis:valuation`, `analysis:thesis`, `analysis:risk` | 90 days |
| Everything else | 60 days |

Expired entries are silently skipped on recall, so the agent won't act on
outdated analyst estimates or stale guidance.

---

## 🕸 Browser Timeout Surfacing

When a browser page loads only partially (network timeout, JS-heavy SPA),
the result now includes:

```json
{ "partial": true, "loadWarning": "Page load timed out after 30s" }
```

This lets the agent know it may have incomplete data and should caveat its
conclusions rather than confidently summarising a 30%-loaded page.

---

## 🔢 Configurable Max Iterations

Default max iterations raised from 15 → **25** for better multi-skill workflow
coverage. For deep compound queries, use the `--deep` flag (50 iterations):

```
bun start --deep
```

---

## 🛡️ Graceful Degradation at Max Iterations

When the agent exhausts its iteration budget without producing a final answer,
it now synthesises a **best-effort response** from all the data it gathered —
rather than returning a bare "I could not complete the research" failure.

The synthesis call re-uses the full scratchpad contents (prices, metrics,
filings, search snippets) and produces a structured answer clearly marked:

```
**[Best-effort summary — research may be incomplete]**

Based on the data gathered so far: …
```

This is particularly useful for long compound queries (DCF + peer comparison +
probability assessment) where the agent collects useful data but runs out of
steps before assembling the final narrative.

---

## ⚡ Parallel Tool Execution

Multiple tool calls within a single agent iteration now run **concurrently**
rather than sequentially. Three independent web searches that previously took
~9 s (3 × 3 s) now complete in ~3 s.

**How it works:**
- All tools in a batch are launched simultaneously as concurrent async tasks.
- Events (`tool_start`, `tool_end`) stream to the TUI in real-time as each
  tool lands — you see all tools activate at once, then each result appears
  as its HTTP call completes.
- Skill deduplication (each skill runs at most once per query) is checked
  before the batch is launched, not after.

No configuration required — parallel execution is on by default.

---

## 📊 Portfolio Risk Metrics

A dedicated `portfolio_risk` skill analyses your watchlist (or any set of
tickers) for quantitative risk metrics:

| Metric | Description |
|--------|-------------|
| **VaR (95%)** | Maximum expected 1-day loss at 95% confidence |
| **CVaR / Expected Shortfall** | Average loss in the worst 5% of days |
| **Sharpe Ratio** | Annualised risk-adjusted return (excess return / vol) |
| **Max Drawdown** | Worst peak-to-trough decline in the lookback window |
| **Volatility** | Annualised standard deviation of daily returns |
| **Correlation Matrix** | Pairwise correlations — identify concentration risk |

**Invocation:**
```
Use the portfolio_risk skill for my watchlist
```
or for a specific set:
```
Use the portfolio_risk skill for AAPL NVDA MSFT
```

The skill fetches historical prices via `financial_search`, computes metrics
from daily returns, and outputs an interpretation with flags for high-risk
positions (VaR > 5%, negative Sharpe, drawdown > 25%).

---

## 💹 DCF Skill — CAPM-Based WACC

The DCF valuation skill now derives **WACC dynamically** from market data
instead of using a static sector default.

**Calculation chain:**
1. Fetch company **beta** via `wacc_inputs` tool (tries Financial Datasets API
   snapshot first, falls back to FMP, then sector median)
2. Apply **CAPM** to derive cost of equity:
   `Ke = Rfr + β × ERP` (10-year Treasury rate + equity risk premium)
3. Compute **WACC**:
   `WACC = E/V × Ke + D/V × Kd × (1 − T)` using the company's actual D/E ratio
4. Cross-check against the sector WACC table — if outside range, the skill
   flags a beta/D/E review

The DCF output table now includes `betaSource`, `Ke`, equity/debt weights,
and the final `waccPct` so you can audit every assumption.

**Why this matters:** A 2% WACC error changes a DCF fair-value estimate by
~15–25%. Fetching beta dynamically eliminates the most common source of
unreliable DCF outputs.

---

## 🎯 Polymarket — Tag-Based Search

The Polymarket integration was fully rebuilt to work around a discovered
limitation: the Gamma API `keyword` parameter is **non-functional** (searching
`keyword=gold` and `keyword=xyzxyz` return identical top-volume global markets).

**New architecture:**
1. `inferTagSlugs()` maps the query to verified Gamma tag slugs
   (e.g. `"gold"` → `["commodities", "economy"]`)
2. `searchEventsByTag()` fetches `/events?tag_slug=X` — the only endpoint
   where tag filtering actually works
3. Client-side text filter narrows results to events whose title/description
   matches the original query
4. Results from multiple slugs are deduplicated by event ID

**Coverage:** bitcoin, ethereum, crypto, Fed rates, economic policy, tariffs,
commodities, big-tech, elections, US politics, global events, IPOs, health.

Queries about topics outside these slugs (e.g. niche sports) fall back to a
top-volume global market sample.

---

## 🏷️ Memory Namespaces

Financial insights can now be stored in named scopes to prevent cross-workflow
contamination. Before namespaces, running a DCF analysis and a short thesis on
the same ticker could mix WACC assumptions with bear-case notes.

**Usage (via agent):**

```
Store insight scoped to DCF:
  store_financial_insight(ticker=AAPL, namespace="dcf",
    content="WACC 8.1%, terminal growth 2.5%", tags=["analysis:valuation"])

Recall only DCF context:
  recall_financial_context(ticker=AAPL, namespace="dcf")

Recall only short-thesis context:
  recall_financial_context(ticker=AAPL, namespace="short-thesis")
```

Global insights (no `namespace` field) remain visible in all recall calls.
The namespace tag `ns:<name>` is automatically appended to the insight's tags.

**Standard namespaces:** `dcf`, `short-thesis`, `peer-comparison`,
`probability-assessment`, `earnings-preview`.

---

## 🗂️ Ticker→API Routing Cache

Dexter now persists API routing decisions to `.dexter/api-routing.json`.
After discovering that VWS.CO requires Yahoo Finance (FMP is premium), that
preference is saved and used on every subsequent session — no repeated probing.

- **Auto-populated** from successful and failed API calls (no manual setup)
- **TTL 30 days** — refreshed automatically when coverage changes
- **Injected as hints** into the LLM router system prompt for smarter routing

---

## ⚡ Async Dream Startup

Dream consolidation now waits **400 ms** after the TUI paints before running,
ensuring the interface is fully interactive before background consolidation
begins. The `🌙 Dream running…` header indicator appears only after the user
can see the interface — eliminating the perception of a slow startup.
