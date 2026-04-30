---
name: india_tax_calculator
description: >
  Calculates post-tax returns on Indian investments, applying correct
  STCG/LTCG/dividend/debt taxation, surcharge, cess, STT, and transaction
  costs. Use this skill whenever an investment plan, return projection, or
  tax implication is requested for an Indian investor.
---

# India Tax Calculator Skill

## When to use this skill
- User asks for investment returns, portfolio planning, or "after-tax" numbers
- Any financial plan involving Indian equities, MFs, bonds, REITs, FDs
- Tax-loss harvesting, rebalancing cost analysis, or exit planning

## Step-by-step process

### Step 1: Identify instrument type
Classify the instrument:
- [ ] Listed equity shares
- [ ] Equity Mutual Fund / ETF (>65% equity)
- [ ] Debt Mutual Fund
- [ ] Government Bond / Corporate Bond / NCD
- [ ] Fixed Deposit (FD) / Recurring Deposit (RD)
- [ ] REIT / InvIT
- [ ] Gold / Gold ETF / SGB
- [ ] F&O (Futures & Options)

### Step 2: Determine holding period
- < 12 months = Short Term (STCG applies for equity)
- ≥ 12 months = Long Term (LTCG applies for equity)
- < 36 months = Short Term for REITs/InvITs/Gold
- ≥ 36 months = Long Term for REITs/InvITs/Gold/pre-Apr2023 debt

### Step 3: Apply correct tax rate (FY 2025-26)

| Instrument | Holding | Tax Rate | Indexation |
|---|---|---|---|
| Listed equity / Equity MF | < 12 months | STCG 20% | No |
| Listed equity / Equity MF | ≥ 12 months | LTCG 12.5% above ₹1.25L | No |
| Debt MF (post Apr 2023) | Any | Slab rate | No |
| Bonds / FD interest | Any | Slab rate | No |
| REITs/InvITs | < 36 months | Slab rate | No |
| REITs/InvITs | ≥ 36 months | LTCG 12.5% | No |
| F&O | Any | Business income / slab | No |

### Step 4: Apply surcharge
- Income ₹50L–₹1Cr: +10% surcharge on tax
- Income ₹1Cr–₹2Cr: +15% surcharge
- Income ₹2Cr–₹5Cr: +25% surcharge (capped 15% for equity gains)
- Income > ₹5Cr: +37% surcharge (capped 15% for equity gains)

### Step 5: Apply 4% Health & Education Cess
`Final tax = (base tax + surcharge) × 1.04`

### Step 6: Calculate transaction costs
- STT: 0.1% buy + 0.1% sell (delivery equity)
- Brokerage: 0.03% or ₹20/order (lower of two)
- GST on brokerage: 18%
- Stamp duty: 0.015% on buy
- Exchange charges: 0.00297% (NSE equity)
- DP charges: ₹15/ISIN per sell transaction

### Step 7: Compute net return
```
Net Return = Sale proceeds
           - Purchase cost
           - All transaction costs (both sides)
           - Tax on capital gain
```

### Step 8: Output table
Present results as:

| Metric | Value |
|---|---|
| Purchase price | ₹X |
| Sale price | ₹X |
| Gross gain | ₹X |
| Transaction costs | ₹X |
| Taxable gain | ₹X |
| STCG/LTCG tax | ₹X (rate%) |
| Surcharge | ₹X |
| Cess (4%) | ₹X |
| Total tax | ₹X |
| Net post-tax profit | ₹X |
| Pre-tax CAGR | X% |
| Post-tax CAGR | X% |
| Net-of-cost CAGR | X% |

## Sanity checks
- [ ] Verify holding period was calculated correctly (buy date inclusive, sell exclusive)
- [ ] Confirm LTCG exemption of ₹1.25L was applied correctly (FY 2025-26)
- [ ] Confirm grandfathering rule if purchase was before 31 Jan 2018
- [ ] Confirm debt MF purchased after Apr 2023 gets slab rate (no LTCG benefit)
- [ ] Check if surcharge cap (15%) applies for equity gains for HNI investors