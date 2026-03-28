# Sector WACC Reference

> **Usage:** The `wacc_inputs` tool now computes WACC directly using the CAPM formula and live beta data.
> Use this file for (1) reasonableness checks, (2) beta fallback reference, and (3) small-cap / EM adjustments that the tool cannot auto-detect.

---

## CAPM / WACC Formulas

```
Ke  =  Rfr  +  β × ERP                    (cost of equity — CAPM)
WACC = E/V × Ke  +  D/V × Kd × (1 − T)   (weighted-average cost of capital)

  E/V  = 1 / (1 + D/E)
  D/V  = (D/E) / (1 + D/E)
  Kd after-tax = pre-tax Kd × (1 − effective_tax_rate)
```

**Key defaults (override when better data is available):**

| Parameter | Default | Source |
|-----------|---------|--------|
| Rfr (risk-free rate) | 4.3% | 10Y US Treasury yield — fetch fresh via `web_search` when possible |
| ERP (equity risk premium) | 5.5% | Damodaran implied ERP (long-run US) |
| Pre-tax Kd (cost of debt) | 5.5% | IG corporate average; use actual interest expense / total debt |
| Effective tax rate | 21% | US statutory rate; always override from Step 1.7 |

---

## Sector Beta Fallbacks (Damodaran, January 2025)

Used by `wacc_inputs` when no market-derived beta is available.

| Sector | Fallback Beta | Typical WACC Range* |
|--------|---------------|---------------------|
| Communication Services | 1.00 | 8–10% |
| Consumer Discretionary | 1.20 | 8–10% |
| Consumer Staples | 0.60 | 7–8% |
| Energy | 1.10 | 9–11% |
| Financials | 1.00 | 8–10% |
| Health Care | 0.85 | 8–10% |
| Industrials | 1.05 | 8–9% |
| Information Technology | 1.30 | 8–12% |
| Materials | 1.10 | 8–10% |
| Real Estate | 0.80 | 7–9% |
| Utilities | 0.40 | 6–7% |

*Typical range at Rfr = 4.3%, ERP = 5.5%, moderate leverage, T = 21%.

---

## Manual Adjustments

Apply **after** the `wacc_inputs` result when company-specific factors warrant:

**Add to WACC:**
- Small cap (market cap < $2B): +1–2% (size premium, Duff & Phelps)
- Emerging markets revenue exposure > 30%: +1–3%
- Key-person risk or single-customer concentration: +0.5–1%
- Significant regulatory uncertainty (new drugs, novel tech): +0.5–1.5%

**Subtract from WACC:**
- Dominant market position with durable moat: −0.5–1%
- Majority recurring / subscription revenue: −0.5–1%
- Investment-grade credit rating (Moody's Baa or better): −0.5%

---

## Reasonableness Checks

- WACC should be **2–4% below ROIC** for value-creating companies; if WACC > ROIC, the company may be destroying value — flag as a risk
- Computed WACC should fall within the sector range above; if not, review the beta source (`betaSource` field in `wacc_inputs` output) and D/E ratio
- Terminal growth rate **must not exceed** the risk-free rate (prevents numerically infinite terminal value)

