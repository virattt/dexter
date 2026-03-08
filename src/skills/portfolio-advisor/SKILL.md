---
name: portfolio-advisor
description: >
  Comprehensive portfolio review and buy/sell advisor. Triggers when user asks
  "what should I buy", "review my portfolio", "am I underweight", "rebalance
  suggestions", "portfolio advisor", or wants thesis-aligned investment ideas.
---

# Portfolio Advisor Skill

Structured workflow to compare live tastytrade holdings to SOUL.md and PORTFOLIO.md, identify gaps, and produce concrete keep/add/trim/close recommendations with thesis alignment.

## Workflow Checklist

```
Portfolio Advisor Progress:
- [ ] Step 1: Sync positions from tastytrade
- [ ] Step 2: Compare actual vs target weights (PORTFOLIO.md)
- [ ] Step 3: Classify each position by SOUL conviction tier
- [ ] Step 4: Identify gaps (underweight Core, overweight Speculative, Avoid list)
- [ ] Step 5: Generate 1–3 concrete buy recommendations
- [ ] Step 6: Optionally preview top idea with strategy_preview
- [ ] Step 7: Output structured summary (keep/add/trim/close per position)
```

## Step 1: Sync positions from tastytrade

Call `tastytrade_sync_portfolio` with `write_to_portfolio=true` so PORTFOLIO.md reflects current broker holdings. This ensures target vs actual and gap analysis use up-to-date data.

## Step 2: Compare actual vs target weights

Use the Current Portfolio context (injected from PORTFOLIO.md) and/or read PORTFOLIO.md. If the table has Target and Actual columns, compute gaps (Actual − Target). Flag:

- **Underweight:** Actual &lt; Target by more than ~2–3%
- **Overweight:** Actual &gt; Target by more than ~5%
- **On target:** Within band

If only a single Weight column exists, treat it as actual; use SOUL.md layer/tier targets as the reference for “should hold” vs “over/under”.

## Step 3: Classify each position by SOUL conviction tier

From Identity (SOUL.md), map each holding to:

- **Core Compounders** — durable bottleneck, long runway
- **Cyclical Beneficiaries** — real exposure but earnings swing with cycles
- **Speculative Optionality** — upside but fragile; keep small
- **Avoid / Too Crowded** — consensus extreme or weak bottleneck
- **Adjacent Watchlist** — not core thesis but relevant (e.g. MSTR, MSTY)
- **Not in thesis** — not in SOUL coverage universe

Use this to justify keep/add/trim/close.

## Step 4: Identify gaps

- **Underweight Core Compounders** — suggest adding (shares or defined-risk option)
- **Overweight Speculative** — suggest trimming
- **Holdings on Avoid list** — recommend trim or close with clear reason
- **Missing layer exposure** — if SOUL emphasizes a layer (e.g. equipment, power) and portfolio has none, suggest one name

## Step 5: Generate 1–3 concrete buy recommendations

For each recommendation provide:

- **Ticker or strategy** (e.g. “TSM shares”, “SPY put credit spread”)
- **Why it fits the thesis** (layer, tier, catalyst)
- **Rough size** (“start small”, “up to 5%”, “1 contract”)
- **Instrument** — shares, put, or spread
- **Policy check** — if options, note THETA-POLICY (allowed underlyings, no-call list, delta/DTE)

If something is on the Avoid list or would break policy, say so and do not recommend it.

## Step 6: Optionally preview top idea

If the top recommendation is an option strategy (e.g. put credit spread), call `tastytrade_strategy_preview` with the suggested underlying, strikes, and expiration. Present the preview (credit, max loss, breakeven) and stop; do not submit orders unless the user explicitly confirms.

## Step 7: Output format

Present a structured summary:

1. **Summary table:** Position | Actual % | Target % | Gap | Tier | Action (keep/add/trim/close)
2. **Gaps:** Underweight names, overweight names, Avoid list holdings
3. **Top 1–3 buys:** Ticker/strategy, thesis reason, size, instrument
4. **Caveats:** Earnings dates, concentration, regime (if relevant)

Keep tone aligned with Identity: accuracy over comfort, substance over performance, explicit about limits.
