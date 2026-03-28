---
name: probability_assessment
description: >
  Structured probability assessment that combines Polymarket crowd-implied
  odds, social sentiment, analyst consensus, and historical base rates into
  a single quantified estimate using weighted log-odds. Use when the user
  wants to know the probability of a future event (earnings beat, rate cut,
  regulatory outcome, recession, FDA approval, etc.) with explicit signal
  breakdown and uncertainty range.
---

# Probability Assessment Workflow

You are running the `probability_assessment` skill. Your job is to collect
multiple independent probability signals, synthesise them using the
**weighted log-odds framework**, and output a structured assessment.

---

## Step 1 — Identify the event and asset

Restate the binary or probabilistic question you are answering, e.g.:
- "Will NVDA beat Q2 2026 EPS consensus?"
- "Will the Fed cut rates before July 2026?"
- "Will PFE receive FDA approval for [drug] in 2026?"

Identify the **asset type** (tech_semiconductor, healthcare, financials, energy,
consumer, crypto, macro) so you know which signal categories to prioritise.

---

## Step 2 — Check pre-injected Polymarket context

Look in the system prompt for the **🎯 Prediction Markets** block. If it is
present, read the crowd-implied probabilities and their signal categories
directly — do **not** make redundant Polymarket API calls for the same queries.

If the block is absent or incomplete, call `polymarket_search` using the most
relevant signal-category search phrases (see default signal maps below).

**Default signal weights by asset type:**

| Asset Type       | Signal 1 (wt)         | Signal 2 (wt)     | Signal 3 (wt)      | Signal 4 (wt)         |
|------------------|-----------------------|-------------------|--------------------|-----------------------|
| Tech/Semi        | Earnings (0.35)       | Regulation (0.20) | Fed rates (0.20)   | Recession (0.15)      |
| Healthcare       | FDA Approval (0.40)   | Earnings (0.25)   | Drug policy (0.20) | Fed rates (0.15)      |
| Financials       | Fed rates (0.35)      | Earnings (0.30)   | Recession (0.25)   | Regulation (0.10)     |
| Energy           | OPEC/Oil (0.35)       | Earnings (0.25)   | Geopolitical (0.25)| Recession (0.15)      |
| Consumer         | Earnings (0.35)       | Recession (0.30)  | Fed rates (0.20)   | Tariffs (0.15)        |
| Crypto           | SEC/Regulation (0.35) | ETF/Product (0.30)| Fed rates (0.20)   | Recession (0.15)      |
| Macro (general)  | Fed rates (0.35)      | Recession (0.35)  | Tariffs (0.20)     | Geopolitical (0.10)   |

---

## Step 3 — Gather remaining signals

Collect as many of these as are relevant and available. Each becomes a
`LogOddsSignal` with a probability [0,1] and its category weight from
the table above.

### 3a. Social sentiment
Call `social_sentiment` or `x_search` with the asset ticker or event keyword.
Convert the bullish/bearish ratio to a probability:
- 70% bullish posts → probability ≈ 0.70
- Assign weight: **0.15** (social sentiment is a noisy signal)

### 3b. Analyst consensus
- Use `get_financials` to retrieve EPS estimates or analyst ratings.
- If analysts forecast a beat by ≥5%: probability ≈ 0.72
- If estimates are flat: probability ≈ 0.50
- If estimates revised down: probability ≈ 0.30
- Assign weight: **0.25**

### 3c. Historical base rate
- What fraction of similar events has happened historically? (e.g. NVDA beats
  EPS ~80% of recent quarters → probability = 0.80)
- Use `web_search` for company earnings history if not in memory.
- Assign weight: **0.20**

---

## Step 4 — Compute weighted log-odds combination

Apply the formula to each signal you have (drop absent signals, re-normalise
remaining weights to sum to 1.0):

```
log_odds(p) = ln(p / (1 − p))          [clamp p to 0.001–0.999]

combined_log_odds = Σ wᵢ × log_odds(pᵢ)

p_combined = 1 / (1 + exp(−combined_log_odds))

σ = √(Σ wᵢ × (log_odds(pᵢ) − combined_log_odds)²)
lower = 1 / (1 + exp(−(combined_log_odds − σ)))
upper = 1 / (1 + exp(−(combined_log_odds + σ)))
```

Flag divergence (⚠️) when σ > 0.3.

---

## Step 5 — Output structured assessment

Produce the following table exactly:

```
📊 Probability Assessment: [Event question]

| Signal                  | Probability | Weight |
|-------------------------|-------------|--------|
| Polymarket (crowd)      |         68% |    40% |
| Analyst consensus       |         72% |    25% |
| Historical base rate    |         78% |    20% |
| Social sentiment        |         62% |    15% |
|-------------------------|-------------|--------|
| **Combined (log-odds)** | **72% ±7pp**|        |

*Signals are [consistent / ⚠️ divergent — treat with caution].*
```

Then provide a one-paragraph interpretation:
- What the combined probability implies for the investment thesis
- Which signal is the most informative and why
- Any caveats (thin Polymarket liquidity, wide analyst dispersion, etc.)
- A suggested action framing: e.g. "If your thesis requires >60% probability
  for the event to justify the position, the combined 72% estimate provides
  mild support."

---

## Constraints

- Never report a probability below 1% or above 99%.
- If only one signal is available, report it with a ±15pp uncertainty band and
  note that it is a single-source estimate.
- Do not fabricate Polymarket probabilities — only use values returned by
  `polymarket_search` or the pre-injected 🎯 block.
- Polymarket probabilities are market-implied, not guaranteed outcomes. Always
  include a disclaimer at the end.
