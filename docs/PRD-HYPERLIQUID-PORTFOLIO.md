# PRD: Hyperliquid Portfolio (Third Portfolio)

**Status:** Draft  
**Last Updated:** 2026-03-07

---

## 1. Motivation

We benchmark performance against **SPY, GLD, and BTC**. We want to also benchmark stock selection against a basket of **on-chain stocks, indices, and commodities** available on Hyperliquid (HIP-3).

**Why it matters:**
- **24/7 trading** — No market hours; trade anytime
- **No fiat conversion** — No stablecoin → EUR/USD → bank wire → broker. Stays onchain.
- **Tax efficiency** — Avoids 30% flat tax on fiat conversion in many jurisdictions
- **Speed** — Settlement and execution without traditional banking rails

The VINCE terminal tracks these Hyperliquid assets. We want Dexter to:
1. **Suggest** a third portfolio (only Hyperliquid-tradeable tickers)
2. **Save** it to `~/.dexter/PORTFOLIO-HYPERLIQUID.md`
3. **Track** its performance vs SPY, GLD, BTC — and vs the Hyperliquid basket itself
4. **Benchmark** — use the HL basket as an additional benchmark for all portfolios

---

## 2. Hyperliquid Universe (from VINCE)

### Commodities
| HL Symbol | FD Ticker | Data Feasibility |
|-----------|-----------|------------------|
| USOIL | USO | ✅ USO (United States Oil Fund) |
| NATGAS | UNG | ✅ UNG (Natural Gas) |
| OIL | USO | ✅ Same as USOIL |
| SILVER | SLV | ✅ SLV (Silver) |
| GOLD | GLD | ✅ GLD (Gold) |
| COPPER | CPER | ✅ CPER (Copper) |

### Indices
| HL Symbol | FD Ticker | Data Feasibility |
|-----------|-----------|------------------|
| US500 | SPY | ✅ SPY (S&P 500) |
| XYZ100 | — | ❌ FD has no indices; no direct proxy |
| MAG7 | — | ❌ Custom index; QQQ is tech proxy |
| SEMIS | SMH | ✅ SMH (Semiconductors) |
| SMALL2000 | IWM | ✅ IWM (Russell 2000) |
| INFOTECH | — | ❌ Custom; QQQ or XLK as proxy |
| ROBOT | — | ❌ Custom; no direct proxy |

### Stocks
| HL Symbol | FD Ticker | Data Feasibility |
|-----------|-----------|------------------|
| AAPL, NVDA, MSFT, PLTR, RIVN, GOOGL, NFLX, AMZN, TSLA, META, ORCL, COIN, HOOD, AMD, MSTR, CRCL | Same | ✅ All US tickers — FD has full coverage |

### AI / Tech (Pre-IPO)
| HL Symbol | FD Ticker | Data Feasibility |
|-----------|-----------|------------------|
| OPENAI | — | ❌ Pre-IPO; FD has no data. Use web_search or HL API. |
| SPACEX | — | ❌ Pre-IPO |
| ANTHROPIC | — | ❌ Pre-IPO |

---

## 3. Financial Datasets Coverage

From [DATA-API-FINANCIAL-DATASETS.md](DATA-API-FINANCIAL-DATASETS.md) and [FD Market Coverage](https://docs.financialdatasets.ai/market-coverage.md):

- **US stocks & ETFs:** ~30,000+ tickers ✅
- **Crypto:** BTC-USD, ETH-USD, etc. ✅
- **Indices:** Not available ❌
- **Commodities (spot):** Not available ❌ — but **commodity ETFs** (USO, GLD, SLV, UNG, CPER) are US-listed and covered

**Strategy:** Use ETF proxies for commodities and indices where FD has no direct match. For OPENAI, SPACEX, ANTHROPIC — either exclude from FD-backed analysis or add a future Hyperliquid API integration.

---

## 4. Symbol Mapping (HL → FD)

A config file `~/.dexter/hyperliquid-symbol-map.json` (optional) or bundled mapping in code:

```json
{
  "commodities": {
    "USOIL": "USO",
    "NATGAS": "UNG",
    "OIL": "USO",
    "SILVER": "SLV",
    "GOLD": "GLD",
    "COPPER": "CPER"
  },
  "indices": {
    "US500": "SPY",
    "SEMIS": "SMH",
    "SMALL2000": "IWM",
    "MAG7": "QQQ",
    "INFOTECH": "QQQ",
    "ROBOT": "BOTZ",
    "XYZ100": "SPY"
  },
  "stocks": {},
  "no_fd_data": ["OPENAI", "SPACEX", "ANTHROPIC"]
}
```

Stocks use 1:1 mapping (HL symbol = FD ticker). `no_fd_data` — use web_search or skip for performance calc.

---

## 5. Third Portfolio: PORTFOLIO-HYPERLIQUID.md

### File Location
`~/.dexter/PORTFOLIO-HYPERLIQUID.md`

### Format
Same as PORTFOLIO.md:
```markdown
# Hyperliquid Portfolio (On-Chain)

| Ticker | Weight | Category | Notes |
|--------|--------|----------|-------|
| GLD | 15% | Commodity | Gold |
| NVDA | 10% | Stock | |
| USO | 5% | Commodity | Oil |
...
```

### Tool Extension
Extend `portfolio` tool with `portfolio_id`:
- `portfolio_id=default` → PORTFOLIO.md (main)
- `portfolio_id=hyperliquid` → PORTFOLIO-HYPERLIQUID.md (third)

Or add `portfolio_hl` as a separate tool for clarity.

---

## 6. Performance History Extension

Add `hl_basket` (or `hl_index`) to quarterly records:

```json
{
  "quarters": [
    {
      "period": "2026-Q1",
      "portfolio": -0.058,
      "btc": -0.236,
      "spy": -0.016,
      "gld": 0.229,
      "hl_basket": -0.012,
      "portfolio_hl": -0.031
    }
  ]
}
```

- `hl_basket` — return of the Hyperliquid benchmark basket (equal-weight or volume-weighted)
- `portfolio_hl` — return of the user's Hyperliquid portfolio (PORTFOLIO-HYPERLIQUID.md)

---

## 7. Prompt Updates

### Agent System Prompt
- Add: "You can suggest a **Hyperliquid portfolio** — tickers tradeable 24/7 on HIP-3, no fiat conversion. Save to ~/.dexter/PORTFOLIO-HYPERLIQUID.md via portfolio tool with portfolio_id=hyperliquid."
- Add: "When suggesting a Hyperliquid portfolio, only use tickers from the HL universe (see HYPERLIQUID-UNIVERSE.md or tool description)."

### Heartbeat
- Weekly: If PORTFOLIO-HYPERLIQUID.md exists, include it in rebalance check
- Quarterly: Include portfolio_hl and hl_basket in performance report

### Example Queries
- "Suggest a Hyperliquid portfolio — only tickers available on HIP-3"
- "Compare my Hyperliquid portfolio's performance vs SPY, GLD, BTC and the HL basket"
- "What's the weekly performance of my on-chain portfolio?"

---

## 8. Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | Symbol mapping doc, PRD | Small |
| 2 | Extend portfolio tool (portfolio_id) | Small |
| 3 | Extend performance_history (hl_basket, portfolio_hl) | Small |
| 4 | Prompt updates, heartbeat integration | Small |
| 5 | HL basket benchmark computation (map HL symbols → FD, fetch prices, compute return) | Medium |
| 6 | (Future) Hyperliquid API for OPENAI/SPACEX/ANTHROPIC | Medium |

---

## 9. References

- [DATA-API-FINANCIAL-DATASETS.md](DATA-API-FINANCIAL-DATASETS.md)
- [PRD-PORTFOLIO-BUILDER.md](PRD-PORTFOLIO-BUILDER.md)
- VINCE terminal screenshots (Hyperliquid assets by category)
- [Hyperliquid HIP-3](https://hyperliquid.xyz) — on-chain stocks, indices, commodities
