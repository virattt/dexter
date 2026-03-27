---
name: earnings-preview
description: >
  Prepares a structured pre-earnings briefing for a company: consensus estimates
  vs. historical actuals, revenue segment breakdown, guidance track record,
  options implied move, and bull/bear scenarios. Use when the user asks to
  prepare for upcoming earnings, wants an earnings preview, or asks what to
  expect when a company reports.
---

# Earnings Preview Skill

Full pre-earnings research checklist producing a structured briefing report.

## Workflow

### Step 1 — Consensus vs. Historical Actuals

Call `get_financials`:

**Query:** `"[TICKER] earnings history EPS beat miss surprise last 4 quarters analyst estimates"`

**Extract:**
- Consensus EPS estimate for the upcoming quarter
- Consensus revenue estimate for the upcoming quarter
- For each of the last 4 reported quarters:
  - Actual EPS vs. estimated EPS → beat/miss % = (actual − estimate) / |estimate| × 100
  - Actual revenue vs. estimated revenue
- Compute the average EPS beat/miss over 4 quarters (positive = consistent beat)

Present a beat/miss history table:

| Quarter | EPS Est | EPS Actual | Surprise % | Rev Est | Rev Actual | Rev Surprise % |
|---------|---------|-----------|-----------|---------|-----------|---------------|

---

### Step 2 — Revenue Segment Breakdown

Call `get_financials`:

**Query:** `"[TICKER] revenue segment breakdown by product line geography last 2 years"`

**Extract:** Revenue by business segment (e.g. Cloud, Devices, Advertising).

Identify:
- Which segments are growing fastest
- Which segments are decelerating
- What % of total revenue each segment represents

---

### Step 3 — Management Guidance Track Record

Call `get_financials`:

**Query:** `"[TICKER] management guidance history raised lowered EPS revenue guidance last 4 quarters"`

Classify each quarter as: Raised ↑ / Lowered ↓ / Met → / Withdrew

Present the guidance trend — does management consistently guide conservatively
(beat-and-raise) or has it been cutting guidance?

---

### Step 4 — Implied Move and Historical Earnings Reactions

Call `get_market_data`:

**Query:** `"[TICKER] options implied volatility earnings"`

Calculate:
- Implied move ≈ IV / √52 (or fetch directly if available)
- Historical average price move on the last 4 earnings days (absolute value)
- Is implied move above or below the historical average?

Use `web_search` if options data is unavailable:
**Query:** `"[TICKER] options implied earnings move [quarter] [year]"`

---

### Step 5 — Key Metrics to Watch

Based on the business segments and recent guidance, identify 3–5 specific
metrics that will determine whether the market reacts positively or negatively:

- Gross margin trend (expanding or compressing?)
- Forward guidance language ("accelerating", "headwinds", "uncertainty")
- Buyback cadence (continuing, pausing, or expanding?)
- Any company-specific KPI (e.g. GPU shipments, cloud bookings, same-store sales)

---

### Step 6 — Bull and Bear Scenarios

**Bull case (2 sentences):** What combination of beats + guidance raise would
send the stock up meaningfully? What multiple expansion justifies the move?

**Bear case (2 sentences):** What miss or guidance cut would send the stock
down? What is the downside price target in that scenario?

---

### Step 7 — Save Report

Use `write_file` to save:
- Path: `~/reports/[TICKER]-earnings-preview-{YYYY-MM-DD}.md`
- Include all sections above with a header: `# [TICKER] Earnings Preview — [Date]`
