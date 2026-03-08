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

### 2.1 Top Volume Tickers (Prioritize for Liquidity)

When suggesting or rebalancing the Hyperliquid portfolio, prefer underlyings with the highest 24h volume for better execution and tighter spreads. Below are the top HL markets by 24h volume (symbol–collateral and leverage vary; underlying is what matters for portfolio weights).

| Rank | Underlying | Example Market(s) | 24H Volume (approx) | Note |
|------|------------|-------------------|--------------------|------|
| 1 | NVDA | NVDA-USDC 20x, NVDA-USDT 20x, NVDA-USDH 12x | ~$70M+ combined | Dominant; use for core tech weight |
| 2 | MU | MU-USDC 10x | ~$26M | High liquidity |
| 3 | SNDNK | SNDNK-USDC 10x | ~$15M | |
| 4 | HOOD | HOOD-USDT 20x, HOOD-USDC 10x | ~$15M combined | |
| 5 | CRCL | CRCL-USDC 10x | ~$12M | |
| 6 | TSLA | TSLA-USDC 10x, TSLA-USDT 20x | ~$18M combined | |
| 7 | INTC | INTC-USDT 20x | ~$7M | |
| 8 | ORCL | ORCL-USDC 10x | ~$5M | |
| 9 | EWY | EWY-USDC 20x | ~$4M | Korea ETF |
| 10 | GOOGL | GOOGL-USDC 10x, GOOGL-USDT 20x | ~$6M combined | |
| 11 | COIN | COIN-USDC 10x | ~$3M | |
| 12 | MSTR | MSTR-USDC 10x | ~$3M | |
| 13 | META | META-USDT 20x | ~$2M | |
| 14 | AMZN | AMZN-USDT 20x, AMZN-USDC 10x | ~$4M combined | |
| 15 | MSFT | MSFT-USDT 20x | ~$1.6M | |

**Usage:** When building or suggesting PORTFOLIO-HYPERLIQUID.md, prefer underlyings from this list for larger weights; lower-volume names (e.g. PLTR, RIVN, niche variants) can be smaller weights or omitted to keep the basket liquid. **For live data,** use the `hyperliquid_liquidity` tool (get_ranked_by_volume); this table is a fallback when the tool is unavailable.

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
- Add: "When suggesting a Hyperliquid portfolio, only use tickers from the HL universe (see HYPERLIQUID-UNIVERSE.md or tool description). Size by thesis conviction, not by volume — volume matters for execution quality (spreads, slippage) but should not drive allocation weights."

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
| 6a | Hyperliquid price API (all HIP-3 assets including pre-IPO; hyperliquid_prices tool) | Medium |
| 6b | Hyperliquid volume/OI API (hyperliquid_liquidity tool for live volume ranking) | Small–Medium |
| 7 | HL performance tool (hl_basket + portfolio_hl for period); completes Phase 5 | Small |
| 8 | Deterministic HL portfolio ops (rebalance_check, quarterly_summary, validate_target); HIP-3 target parsing; performance_history summary/ytd/since_inception | Medium |
| 9 | **Live account sync** — HYPERLIQUID_ACCOUNT_ADDRESS, hyperliquid_positions, hyperliquid_sync_portfolio; heartbeat/ops prefer live synced holdings when configured, markdown fallback | Medium |

---

## 10. Phase 9: Live Account Sync (Shipped)

When `HYPERLIQUID_ACCOUNT_ADDRESS` is set (42-char hex wallet address), Dexter can:

1. **hyperliquid_positions** — Fetch live clearinghouse state (account value, withdrawable, positions with symbol, size, value, weight). Read-only; no private key required.
2. **hyperliquid_sync_portfolio** — Convert live positions to the same markdown format as PORTFOLIO-HYPERLIQUID.md; optionally write to `~/.dexter/PORTFOLIO-HYPERLIQUID.md`.
3. **Live-first rebalance/report** — Heartbeat and agent prompts instruct: when HL account is configured, call `hyperliquid_sync_portfolio` with `write_to_file=true` first, then `hyperliquid_portfolio_ops` (rebalance_check or quarterly_summary). Otherwise use the existing markdown file as-is.

**Scope:** Phase 9 is position sync and live-aware ops only. Order submission (dry run, submit) is explicitly out of scope and deferred to a later phase.

**Fund config:** Optional `aum_hl` in `~/.dexter/fund-config.json` enables dollar-denominated trim/add recommendations for the HL sleeve; `hyperliquid_portfolio_ops` rebalance_check returns `suggestedDollar` per action when `aum_hl` is set.

---

## 11. Phase 9b / Phase 10: Execution Layer

### Phase 9b (preview-only)

- **Execution intent model** — Normalized order payload (symbol, marketSymbol, side, notionalUsd, size, orderType, limitPx, timeInForce, reduceOnly, source, reason). Data handoff between rebalance/preview and submit.
- **Market resolver** — Maps underlying (e.g. NVDA) to the most liquid tradable market (e.g. xyz:NVDA) using 24h volume. See `hyperliquid-market-resolver.ts`.
- **hyperliquid_order_preview** — Converts rebalance_check output into reviewable order intents; resolves markets; validates against `~/.dexter/hl-execution-policy.json` when present. Requires `aum_hl` (fund-config or param).
- **Preview-first UX** — Prompts and heartbeat instruct: sync → portfolio_ops → order_preview → present and **stop**. Never auto-submit. Heartbeat must never call submit/cancel.

### Phase 10 (live execution, opt-in)

- **Env:** `HYPERLIQUID_ORDER_ENABLED=true` and `HYPERLIQUID_PRIVATE_KEY` (hex) to enable submit/cancel/live_orders tools.
- **Tools:** `hyperliquid_live_orders`, `hyperliquid_submit_order`, `hyperliquid_cancel_order`. Registry-gated; only registered when execution is configured.
- **Approval:** `hyperliquid_submit_order` and `hyperliquid_cancel_order` require runtime user approval (same as write_file/edit_file).
- **Idempotency:** Optional `preview_token` (client order ID) on submit to avoid duplicate orders.
- **Post-trade:** After submit/cancel, tools return reconciled open orders and a receipt; run `hyperliquid_sync_portfolio` with `write_to_file=true` to refresh PORTFOLIO-HYPERLIQUID.md.

**Execution flow:** sync → portfolio_ops rebalance_check → order_preview → user confirms → submit_order (or cancel_order) → reconcile → optional sync_portfolio.

---

## 9. References

- [DATA-API-FINANCIAL-DATASETS.md](DATA-API-FINANCIAL-DATASETS.md)
- [PRD-PORTFOLIO-BUILDER.md](PRD-PORTFOLIO-BUILDER.md)
- VINCE terminal screenshots (Hyperliquid assets by category)
- [Hyperliquid HIP-3](https://hyperliquid.xyz) — on-chain stocks, indices, commodities
