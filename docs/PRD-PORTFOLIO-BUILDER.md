# PRD: Portfolio Builder — Dexter's North Star

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07

---

## 1. Executive Summary

**North star:** Dexter exists to help users build and maintain a **near-perfect portfolio** — one that aligns with their investment thesis, conviction tiers, and sizing rules as defined in SOUL.md.

The agent is aware of what a near-perfect portfolio looks like. The heartbeat runs **weekly** to check if rebalancing is needed and **quarterly** to write a performance report.

---

## 2. Vision

Dexter is not just a research agent. It is a **Portfolio Builder** — a system that:

1. **Knows the target** — SOUL.md defines the thesis, coverage universe, conviction tiers, and sizing rules. A near-perfect portfolio is one that reflects this structure.
2. **Tracks the current state** — The user's actual holdings (in `~/.dexter/PORTFOLIO.md` or equivalent) are compared against the target.
3. **Monitors continuously** — The heartbeat runs on a schedule to detect drift and trigger action.
4. **Reports periodically** — Quarterly performance reports summarize how the portfolio performed and what changed.

---

## 3. Near-Perfect Portfolio (from SOUL.md)

A near-perfect portfolio, given the thesis in SOUL.md, has these properties:

### 3.1 Structure

| Dimension | Definition |
|-----------|------------|
| **Layer allocation** | Positions span the AI supply chain layers (chip designers, foundry, equipment, EDA, power, memory, networking) with weights that reflect where pricing power and durability live |
| **Conviction tiering** | Core Compounders dominate; Cyclical Beneficiaries add exposure; Speculative Optionality is sized small; Avoid/Too Crowded names are absent or minimal |
| **Regime awareness** | Sizing adjusts to macro regime — high-conviction positions get cut in capitulation; structural thesis unchanged, position sizing changes |
| **Catalyst timing** | Near-term catalysts (H2 2026 equipment cycle) get appropriate weight; long-duration compounders get patient sizing |
| **Diversification** | No single position or layer dominates; bottleneck diversity reduces single-point failure |

### 3.2 Performance Benchmarks (Essential)

A portfolio is useless if it does not outperform:

| Benchmark | Why it matters |
|-----------|----------------|
| **Best hedge funds** | Top funds (e.g. Situational Awareness LP, Tiger Cub returns) set the bar for active management |
| **Stock market indexes** | S&P 500, NASDAQ — if you can't beat the market, indexing wins |
| **BTC (Bitcoin)** | The baseline for risk-adjusted alternative allocation; if BTC outperforms, the opportunity cost is real |

The agent evaluates any portfolio against structure *and* performance. Quarterly reports must compare returns to these benchmarks. Rebalancing recommendations consider whether the current mix is likely to clear this bar.

---

## 4. Heartbeat — Weekly Rebalance + Quarterly Report

### 4.1 Weekly Rebalance Check

**When:** Every Monday (or first trading day of the week)  
**What:** Compare current portfolio to target. Flag if:
- Layer weights have drifted (e.g., equipment underweight, chip designers overweight)
- Conviction-tier mix has shifted (e.g., too much Speculative Optionality)
- Single positions exceed sizing limits
- Regime signals suggest cutting exposure (e.g., Burry danger signal)

**Output:** Brief alert if rebalancing recommended; otherwise HEARTBEAT_OK.

### 4.2 Quarterly Performance Report

**When:** First week of each quarter (Jan, Apr, Jul, Oct)  
**What:** Write a quarterly report covering:
- Portfolio performance vs benchmark (S&P 500, NASDAQ)
- Layer-level attribution (which layers contributed/detracted)
- Conviction-tier performance
- Notable changes (additions, trims, exits)
- Regime assessment and any sizing adjustments made
- Outlook for next quarter

**Output:** Full report delivered to user (WhatsApp, CLI, or web). Must include performance vs hedge funds, indexes, and BTC — a portfolio that doesn't outperform these benchmarks is not meeting the bar.

### 4.3 Implementation

- **Date awareness:** Heartbeat prompt receives `today's date`, `is Monday`, `is first week of quarter`
- **Portfolio input:** If `~/.dexter/PORTFOLIO.md` exists, its content is included so the agent knows current holdings
- **Schedule:** Heartbeat runs on existing interval (e.g. 30 min); agent checks date and runs weekly/quarterly logic only when appropriate

---

## 5. Portfolio File Format

**Path:** `~/.dexter/PORTFOLIO.md`

**Format (example):**
```markdown
# Current Portfolio

| Ticker | Weight | Layer | Tier |
|--------|--------|-------|------|
| TSM    | 12%    | 2     | CC   |
| AMAT   | 10%    | 3     | CC   |
| BE     | 8%     | 5     | SO   |
...
```

User maintains this file (or a future UI/tool does). The agent reads it for rebalance checks and reports.

---

## 6. Agent Awareness

The system prompt (via SOUL.md) already injects the thesis. Add explicit guidance:

- **North star:** Your primary purpose is to help build and maintain a near-perfect portfolio.
- **Target portfolio:** The thesis in SOUL.md defines what that looks like — layers, conviction tiers, sizing rules.
- **Heartbeat:** Weekly rebalance check; quarterly performance report. Use the date to decide what to run.

---

## 7. Success Criteria

- [ ] Agent explicitly knows portfolio building is the north star
- [ ] SOUL.md includes a "Near Perfect Portfolio" section
- [ ] Heartbeat checks date and runs weekly rebalance logic on Mondays
- [ ] Heartbeat writes quarterly report in first week of each quarter
- [ ] PORTFOLIO.md format documented and supported

---

## 8. Non-Goals (for this PRD)

- Automated trading or order execution
- Real-time portfolio sync from broker APIs
- Historical performance attribution (beyond what financial_search can provide)
