# Sector WACC Adjustments

Use these typical WACC ranges as starting points, then adjust based on company-specific factors.

## Determining Company Sector

Use `financial_search` with query `"[TICKER] company facts"` to retrieve the company's `sector` and `industry`. Map the returned sector to the table below.

**Common sector mappings:**
- "Technology" → Technology (assess growth stage for high-growth vs mature)
- "Consumer Defensive" → Consumer Staples
- "Consumer Cyclical" → Consumer Discretionary
- "Financial Services" → Financials
- "Healthcare" → Healthcare
- "Industrials" → Industrials
- "Energy" → Energy
- "Utilities" → Utilities
- "Real Estate" → Real Estate

## WACC by Sector

| Sector | Typical WACC Range | Notes |
|--------|-------------------|-------|
| Technology (high growth) | 9-12% | Higher risk premium for volatility |
| Technology (mature) | 8-10% | More stable cash flows |
| Consumer Staples | 7-8% | Defensive, stable demand |
| Consumer Discretionary | 8-10% | Cyclical exposure |
| Financials | 8-10% | Leverage already in business model |
| Healthcare | 8-10% | Regulatory and pipeline risk |
| Industrials | 8-9% | Moderate cyclicality |
| Energy | 9-11% | Commodity price exposure |
| Utilities | 6-7% | Regulated, stable cash flows |
| Real Estate | 7-9% | Interest rate sensitivity |

## Adjustment Factors

Add to base WACC:
- **High debt (D/E > 1.5)**: +1-2%
- **Small cap (< $2B market cap)**: +1-2%
- **Emerging markets exposure**: +1-3%
- **Concentrated customer base**: +0.5-1%
- **Regulatory uncertainty**: +0.5-1.5%

Subtract from base WACC:
- **Market leader with moat**: -0.5-1%
- **Recurring revenue model**: -0.5-1%
- **Investment grade credit rating**: -0.5%

## Reasonableness Checks

- WACC should typically be 2-4% below ROIC for value-creating companies
- If calculated WACC > ROIC, the company may be destroying value
- Compare to sector peers if available
