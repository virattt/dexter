---
name: full-analysis
description: >
  Flagship comprehensive investment analysis that chains four sub-skills into one
  structured report: DCF valuation (intrinsic value), peer comparison (relative
  value), short thesis (bear case risks), and probability assessment (outcome
  odds). Use when the user wants a complete, multi-angle view of a stock — e.g.,
  "full analysis of AAPL", "complete investment report for NVDA", "is X worth
  buying?", or any request for thorough fundamental + probabilistic analysis.
---

# Full Analysis Skill

## Purpose
Orchestrate four sub-skills into a single, well-structured investment report.
Each sub-skill is invoked in sequence, and its findings feed the next stage.

---

## Workflow

### Step 1 — Identify the subject
Extract the ticker symbol (and company name if given). If multiple tickers are
mentioned, prompt for clarification unless the request is clearly comparative.

### Step 2 — DCF Valuation
Invoke skill `dcf-valuation` with the ticker.

Follow every step in that skill exactly. Key outputs to capture:
- Intrinsic value per share (base case)
- Upside / downside vs. current price (%)
- Key WACC and terminal growth assumptions
- Sensitivity table (bull / base / bear intrinsic values)

### Step 3 — Peer Comparison
Invoke skill `peer-comparison` with the ticker.

Follow every step in that skill exactly. Key outputs to capture:
- Valuation multiples vs. median peer (P/E, EV/EBITDA, P/S)
- Growth premium or discount (%)
- Quality score relative to peers (ROIC, margin profile)
- Overall relative attractiveness (cheap / fair / expensive vs. peers)

### Step 4 — Short Thesis (Bear Case)
Invoke skill `short-thesis` with the ticker.

Follow every step in that skill exactly. Key outputs to capture:
- Top 3 bear-case catalysts
- Bear-case price target
- Key risk timeline (when the risks could materialise)

### Step 5 — Probability Assessment
Invoke skill `probability_assessment` with the ticker (or the central investment
question, e.g., "Will AAPL trade above its DCF fair value in 12 months?").

Follow every step in that skill exactly. Key outputs to capture:
- Weighted probability for the bull scenario
- Signal breakdown (Polymarket, analyst consensus, sentiment, base rate)
- Confidence level (low / medium / high) and key uncertainty drivers

---

## Final Report Structure

Combine all findings into this template:

```
# Full Investment Analysis: [TICKER] — [COMPANY NAME]
*Generated: [DATE]*

---

## 1. Snapshot
| Metric | Value |
|--------|-------|
| Current Price | $X |
| Market Cap | $X B |
| Sector / Industry | ... |
| 52-Week Range | $X – $X |

---

## 2. DCF Valuation
- **Intrinsic Value (base case):** $X.XX per share
- **Upside / downside vs. current price:** +/- X%
- **WACC:** X% | **Terminal growth:** X%

| Scenario | Intrinsic Value | vs. Current Price |
|----------|----------------|-------------------|
| Bull | $X | +X% |
| Base | $X | +/-X% |
| Bear | $X | -X% |

*Key assumptions: [list 2–3 most important ones]*

---

## 3. Peer Comparison
| Metric | [TICKER] | Peer Median | Premium / Discount |
|--------|----------|-------------|-------------------|
| P/E (NTM) | X× | X× | ±X% |
| EV/EBITDA | X× | X× | ±X% |
| Revenue Growth | X% | X% | ±X pp |
| ROIC | X% | X% | ±X pp |

*Verdict: [cheap / fair / expensive] vs. peers — [1-sentence rationale]*

---

## 4. Bear Case (Short Thesis)
**Bear-case price target:** $X (−X% from current)

Top risks:
1. [Risk 1] — *Timeline: [when]*
2. [Risk 2] — *Timeline: [when]*
3. [Risk 3] — *Timeline: [when]*

---

## 5. Probability Assessment
**Central question:** Will [TICKER] outperform / reach $X in [horizon]?

| Signal | Reading | Weight | Bull Contribution |
|--------|---------|--------|-------------------|
| Polymarket | X% | X% | +X pp |
| Analyst consensus | X/5 | X% | +X pp |
| Social sentiment | X/100 | X% | +X pp |
| Historical base rate | X% | X% | +X pp |

**Weighted bull probability: X% ± Y%** (confidence: low / medium / high)

---

## 6. Overall Verdict

| Dimension | Assessment |
|-----------|-----------|
| Intrinsic value | [Undervalued / Fair / Overvalued] by X% |
| Relative value | [Cheap / Fair / Expensive] vs. peers |
| Bear-case risk | [Low / Medium / High] |
| Bull probability | X% |

**Bottom line:** [2–3 sentence investment conclusion integrating all four
dimensions — include the biggest single reason to buy AND the biggest single
reason to avoid]

*Confidence: [Low / Medium / High] — [one-sentence caveat about key unknown]*
```

---

## Important Notes

- **Do not skip sub-skills.** Each skill must run completely before proceeding to
  the next. Do not summarise or shortcut the sub-skill instructions.
- **Carry forward numbers.** Use the DCF bear-case price target as an input to
  the probability assessment ("probability of staying above bear target").
- **One LLM call per skill.** Invoke each via the `skill` tool, then do the
  required research, then proceed to the next skill.
- **Time box.** If token budget is running low, complete the current sub-skill
  first, then summarise remaining steps rather than starting them.
