# Newsletter Archive — ikigaistudio

Published essays from the Dexter → Claude → Substack workflow.

| Date | Title | Key Thesis Takeaway |
|------|-------|---------------------|
| 2026-03-07 | [The Terminal That Thinks Like We Do](https://ikigaistudio.substack.com/p/the-terminal-that-thinks-like-we) | Equipment thesis validated; power is not one trade; BTC concentration is regime risk; gold strength is a signal |

---

## Workflow

1. Dexter produces quarterly report (Query 4 or heartbeat)
2. Query 5 → reflection essay draft
3. Claude polish → publish to [ikigaistudio Substack](https://ikigaistudio.substack.com/)
4. Feed insights back to SOUL.md

See [ESSAY-WORKFLOW.md](../ESSAY-WORKFLOW.md).

---

## What we just built (2026-03-09)

The pipeline got a serious upgrade. Here's the tldr for anyone catching up.

### The problem

Dexter builds two-sleeve portfolios (tastytrade + Hyperliquid) and writes quarterly reports. But the whole thing was a one-brain operation — Dexter's thesis, Dexter's picks, Dexter's report, shipped straight to Substack after a Claude polish pass. No second opinion. No adversarial check. And the essay step was still manual: copy report into Claude, prompt it, paste into Substack.

### What changed

We wired in an entire second brain. The [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund) — 18 independent analyst agents (Buffett, Burry, Cathie Wood, Druckenmiller, technical, fundamentals, sentiment, etc.) plus a portfolio manager — now runs as a tool inside Dexter. One command, and 18 agents give their take on every ticker in both portfolios.

**How it works under the hood:**

- Dexter bundles a graph template (18 analyst nodes → 1 PM node) and POSTs it to AIHF's `/hedge-fund/run` endpoint along with all tickers (included + excluded).
- AIHF returns a Server-Sent Events stream. We parse it in real-time until the `complete` event drops the full payload: decisions, analyst signals, and current prices for every ticker.
- Each AIHF decision gets normalized to a `[-1, 1]` score (60% PM confidence × action direction + 40% analyst consensus). Then we compare against Dexter's portfolio:
  - **Agreement score** — what % of included tickers AIHF confirms
  - **High-conviction conflicts** — tickers where AIHF strongly disagrees (score below -0.3 at 70%+ confidence). Example: "You have NVDA at 10% weight, AIHF says SELL at 78% confidence."
  - **Excluded but interesting** — names Dexter passed on that AIHF actually likes (score above 0.5 at 70%+ confidence). Example: "You excluded MU for muddying the TSM thesis, but AIHF signals BUY at 80%."
- Full report saves to `~/.dexter/AIHF-DOUBLE-CHECK-YYYY-MM-DD.md`. Advisory only — never touches portfolio files.

**Then the essay writes itself.**

New `essay-synthesis` skill: a 6-step SKILL.md that reads the quarterly report, the AIHF double-check, and SOUL.md, identifies narrative threads (thesis validation, regime tension, "the committee disagreed on NVDA"), and drafts a 2,000–5,000 word essay in the ikigaistudio voice. Precise numbers. No hype. Ends with "Sixty-seven." Saves to `~/.dexter/ESSAY-DRAFT-YYYY-QN.md`.

The AIHF data gives the essays a new thread that was never possible before: "We asked the committee. The committee pushed back on NVDA. Here's whether the committee was right."

**And the heartbeat runs it automatically.**

Quarterly heartbeat (first week of Jan/Apr/Jul/Oct) now: writes the report → runs the double-check → includes the summary in the heartbeat alert. All conditional on `AIHF_API_URL` being set. Zero config change needed if you don't use AIHF.

**Self-improvement foundation.**

Every double-check run records to `~/.dexter/aihf-history.json` — agreement scores, conflicts, outcomes. Over time we can answer: "When AIHF flagged a conflict, was AIHF right or was Dexter right?" That's the loss function for the autoresearch loop. Not there yet, but the data collection starts now.

### New files

```
src/tools/aihf/
  types.ts              — all TypeScript interfaces
  aihf-graph.ts         — bundled 18-analyst graph template
  aihf-api.ts           — HTTP + SSE stream parser
  aihf-double-check.ts  — comparison logic (pure functions)
  aihf-double-check-tool.ts — the DynamicStructuredTool
  feedback.ts           — history tracking for self-improvement
  index.ts              — barrel exports
  aihf-double-check.test.ts — 15 unit tests
  __fixtures__/         — SSE stream + I/O fixtures

src/skills/essay-synthesis/
  SKILL.md              — full essay workflow in ikigaistudio voice
```

### How to use it

Add to `.env`:
```
AIHF_API_URL=http://localhost:8000
```

Then tell Dexter: "run a double-check on my portfolio" or "what does the hedge fund think?" or just let the quarterly heartbeat do it.

For essays: "write an essay from the quarterly report" triggers the skill.

### The bigger picture

This is step one of the full pipeline: Dexter suggests → AIHF validates → essay writes itself → feedback loop tracks accuracy → system improves. The Karpathy autoresearch vision, applied to financial research instead of model training. The "loss function" is portfolio performance and AIHF conflict accuracy. The "experiments" are thesis refinements. The GPU stays up all night; so does Dexter.
