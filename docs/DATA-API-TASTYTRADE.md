# tastytrade API — Dexter Integration

**Version:** 2.0  
**Last Updated:** 2026-03-08  
**Reference:** [tastytrade Developer Portal](https://developer.tastytrade.com/) | [SDK](https://developer.tastytrade.com/sdk/)

---

## 1. Overview

tastytrade (formerly tastyworks) is a retail broker API for options, stocks, futures, and crypto. Dexter uses it in three operator states:

| State | Available tools |
|-------|----------------|
| `not_connected` | None — no credentials configured |
| `read_only` | accounts, positions, balances, option_chain, quote, symbol_search, sync_portfolio, position_risk, theta_scan, strategy_preview, order_dry_run, roll_short_option, repair_position, transactions, earnings_calendar, watchlist, risk_metrics |
| `trading_enabled` | All above + live_orders, submit_order, cancel_order (requires `TASTYTRADE_ORDER_ENABLED=true` + explicit user confirmation) |

Dry-run and preview are available in read-only. Submit/cancel require explicit enablement and user approval.

### Design

- **OAuth2** — Access and refresh tokens; refresh token stored in `~/.dexter/tastytrade-credentials.json`
- **REST** — All calls are GET or POST; semaphore, retries, and exponential backoff in `src/tools/tastytrade/api.ts`
- **Session cache** — Positions and balances cached in-session (5-min TTL); auto-populated on first broker query, reused across tools in the same session
- **User-Agent** — Required by API; Dexter sends `Dexter/1.0`

---

## 2. Authentication

| Mechanism | Where |
|-----------|--------|
| Client ID | `TASTYTRADE_CLIENT_ID` (env) |
| Client Secret | `TASTYTRADE_CLIENT_SECRET` (env) |
| Refresh token | `~/.dexter/tastytrade-credentials.json` |

**Credentials file** (`~/.dexter/tastytrade-credentials.json`):

- **CLI login (recommended):** Run `bun run tastytrade:login`. Ensure `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` are in `.env`. Command prints the URL to create a grant; paste the refresh token when prompted; credentials are written to the file.
- **Manual:** Obtain a **refresh token** from [my.tastytrade.com → API Access → OAuth Applications](https://my.tastytrade.com/app.html#/manage/api-access/oauth-applications) (Create Grant). Paste as `{ "refresh_token": "..." }`, or run CLI login.
- After first refresh, file is updated with new `access_token` and `expires_at`.

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1234567890123
}
```

**Sandbox:** Set `TASTYTRADE_SANDBOX=true`. Sandbox base URL: `https://api.cert.tastyworks.com` (separate credentials).

---

## 3. Base URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.tastytrade.com` |
| Sandbox | `https://api.cert.tastyworks.com` |

---

## 4. Endpoints Used by Dexter

### Phase 1 — Account data

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/customers/me/accounts` | GET | `tastytrade_accounts` | List linked accounts |
| `/accounts/{account_number}/account-balances` | GET | `tastytrade_balances` | Account balances (equity, cash, margin) |
| `/accounts/{account_number}/positions` | GET | `tastytrade_positions` | Current positions (stocks, options, futures) |

### Phase 2 — Market data & options

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/option-chains/{underlying_symbol}/nested` | GET | `tastytrade_option_chain` | Nested option chain (expirations, strikes, call/put symbols) |
| `/market-data/quotes` | POST | `tastytrade_quote` | Live quotes (bid, ask, mark, volume) |
| `/symbols/search?prefix=` | GET | `tastytrade_symbol_search` | Symbol search by prefix or phrase |

### Phase 3 — Order flow

- **Read-only (no env flag required beyond credentials):** `tastytrade_order_dry_run` validates orders without submitting. Use with `tastytrade_strategy_preview` and `tastytrade_roll_short_option` to validate before enabling live trading.
- **Trading (opt-in):** Set `TASTYTRADE_ORDER_ENABLED=true` to register `tastytrade_live_orders`, `tastytrade_submit_order`, `tastytrade_cancel_order`. Submit and cancel require explicit user approval.

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/accounts/{account_number}/orders/live` | GET | `tastytrade_live_orders` | Live and recent orders (working, filled, cancelled) |
| `/accounts/{account_number}/orders?dry_run=true` | POST | `tastytrade_order_dry_run` | Validate order, get buying power/fee impact |
| `/accounts/{account_number}/orders` | POST | `tastytrade_submit_order` | Submit order to market |
| `/accounts/{account_number}/orders/{order_id}` | DELETE | `tastytrade_cancel_order` | Cancel an open order |

### Phase 4 — Portfolio sync & heartbeat

| Feature | Description |
|---------|-------------|
| **tastytrade_sync_portfolio** | Fetches positions + balances; builds PORTFOLIO.md-style table (Ticker \| Target Weight \| Actual Weight \| Gap \| Layer \| Tier). Optionally writes to `~/.dexter/PORTFOLIO.md`. Option symbols normalized to underlying per [TASTYTRADE-SYMBOLOGY.md](./TASTYTRADE-SYMBOLOGY.md). |
| **Session cache** | In-memory positions and balances cache with 5-min TTL. Auto-populated on first call to positions or balances; all Phase 5/6 tools reuse the cache to avoid redundant API calls. |
| **Heartbeat drift check** | When `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat instructs the agent to compare live positions to SOUL.md/PORTFOLIO.md targets and flag drift above threshold. |

Reuses Phase 1 positions and account-balances endpoints.

### Phase 5 — Portfolio-aware theta engine

| Feature | Description |
|---------|-------------|
| **tastytrade_position_risk** | Enriches live positions into a risk view: DTE, option type, concentration by underlying, buying power usage, challenged short options. |
| **tastytrade_theta_scan** | Scans SOUL.md thesis names (from THETA-POLICY `Allowed underlyings`) for covered calls, CSPs, credit spreads, iron condors. **Not SPX/SPY/QQQ by default** — defaults are SOUL thesis names across 7 supply chain layers. Policy is enforced as a **hard block**: only compliant candidates with `portfolio_fit` pass. Output includes `policy_mode: "hard_block"`, `excluded_by_policy` (reason buckets), `excluded_by_earnings`, `earnings_exclusion_degraded` when earnings data unavailable, and when no candidates pass: `no_candidates: true` + `next_steps`. |
| **tastytrade_strategy_preview** | Validates order against THETA-POLICY before dry-run. If violated: `policy_blocked: true` + `violations` list — do not recommend. If compliant: `policy_blocked: false`, trade memo, portfolio_fit, and dry-run result when order flow enabled. |
| **tastytrade_roll_short_option** | Later-dated roll candidate for a short option; THETA-POLICY validated; dry-run if enabled. |
| **tastytrade_repair_position** | Analyzes challenged short option; recommends hold, roll, close, or assignment. Roll candidate includes `policy_blocked` status. |

Phase 5 reuses Phase 1/2 endpoints and Phase 3 dry-run when enabled. Persistent policy file at `~/.dexter/THETA-POLICY.md`.

### Phase 6 — Analytics tools

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/accounts/{account_number}/transactions` | GET | `tastytrade_transactions` | Transaction history with optional date range and type filter |
| `/watchlists` | GET/POST/PUT/DELETE | `tastytrade_watchlist` | List, create, update, delete watchlists; scan watchlist for quotes |
| *(Financial Datasets)* | — | `tastytrade_earnings_calendar` | Upcoming earnings dates; defaults to THETA-POLICY underlyings + position underlyings |
| *(Derived from Phase 1 + 5)* | — | `tastytrade_risk_metrics` | Portfolio risk scorecard (concentration, theta/delta, buying power %) |

---

## 5. Tool Behavior

**Phase 1**
- **tastytrade_accounts** — No input. Returns list of account numbers and nicknames.
- **tastytrade_balances** — Optional `account_number`. Uses first account if omitted. Results cached 5-min per session.
- **tastytrade_positions** — Optional `account_number`. Uses first account if omitted. Results cached 5-min per session.

**Phase 2**
- **tastytrade_option_chain** — `underlying_symbol` (e.g. AAPL, TSM, AMAT). Returns nested chain with expirations and strikes. Use SOUL.md thesis names; for index options use index symbol (e.g. SPX — add to THETA-POLICY if you want index theta).
- **tastytrade_quote** — `symbols` (comma-separated), optional `instrument_type`: Equity | Index | Equity Option. Returns quote data per symbol.
- **tastytrade_symbol_search** — `query` (prefix or phrase). Returns matching symbols and descriptions. Use for SOUL ADRs (BESIY, TOELY) to confirm tastytrade availability.

**Phase 3** (live order tools only when `TASTYTRADE_ORDER_ENABLED=true`)
- **tastytrade_live_orders** — Optional `account_number`. Returns list of live and recent orders.
- **tastytrade_order_dry_run** — `account_number`, `order_json`. Returns buying power effect and fees; does not submit. Available in read-only mode.
- **tastytrade_submit_order** — `account_number`, `order_json`. Submits order. Requires user confirmation after dry_run or preview.
- **tastytrade_cancel_order** — `account_number`, `order_id`. Cancels an open order.

**Phase 4**
- **tastytrade_sync_portfolio** — Optional `account_number`, `write_to_portfolio` (default false). Fetches positions and balances; aggregates by underlying ticker per [TASTYTRADE-SYMBOLOGY.md](./TASTYTRADE-SYMBOLOGY.md); computes Target/Actual/Gap columns; returns markdown table. If `write_to_portfolio=true`, writes to `~/.dexter/PORTFOLIO.md`.

**Phase 5**
- **tastytrade_position_risk** — Optional `account_number`. Returns enriched positions (DTE, option type, concentration, portfolio theta/delta, challenged shorts). Uses session cache.
- **tastytrade_theta_scan** — Optional `account_number`, `underlyings_csv` (override THETA-POLICY list), `strategy_type`, DTE and delta bounds, `spread_width`, `min_credit`, `exclude_earnings`. Returns only SOUL-aligned, policy-compliant candidates (hard block). Candidates include `order_json` for preview/dry-run.
- **tastytrade_strategy_preview** — `account_number`, `order_json`, optional `thesis`, optional `exit_plan`. Validates against THETA-POLICY; returns `policy_blocked: true/false` before any recommendation or dry-run.
- **tastytrade_roll_short_option** — Optional `account_number`; identify short by `position_symbol` or underlying/type/strike. Returns roll candidate, order_json, dry-run if enabled, policy_blocked status.
- **tastytrade_repair_position** — Optional `account_number`; identify short by `position_symbol` or underlying/type/strike. Returns hold/close/roll/assignment alternatives and a recommendation.

**Phase 6**
- **tastytrade_transactions** — Optional `account_number`, `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `type` (e.g. Trade, Money Movement). Returns list of transactions with date, type, symbol, action, quantity, value, fees. Use for realized P&L analysis and theta win rate.
- **tastytrade_earnings_calendar** — Optional `tickers_csv` (defaults to THETA-POLICY allowed underlyings), `include_positions` (adds current position underlyings), `within_days` (default 14). Returns next earnings date and `days_until`; flags `within_7_days`. Requires `FINANCIAL_DATASETS_API_KEY`; without it returns degraded response.
- **tastytrade_watchlist** — `action`: list | create | add_symbols | remove_symbols | delete | scan. For scan: fetches quotes for all symbols in the watchlist and marks THETA-POLICY alignment. Use to maintain a SOUL thesis watchlist in tastytrade.
- **tastytrade_risk_metrics** — Optional `account_number`. Returns: Herfindahl concentration index, top-5 underlying weight %, aggregate theta exposure, aggregate delta exposure, buying power utilization %. Use for "portfolio risk" and "concentration" queries.

All tools return JSON. On auth or API errors, the tool returns a clear error message (missing credentials, 401, rate limit).

---

## 6. THETA-POLICY and SOUL Alignment

When no `~/.dexter/THETA-POLICY.md` is present, `loadThetaPolicy()` returns SOUL.md-aligned code defaults:

**Allowed underlyings (by SOUL layer):**
- Layer 1 — Chip Designers: `AAPL`, `AMD`, `AVGO`
- Layer 2 — Foundry: `TSM`
- Layer 3 — Equipment: `AMAT`, `ASML`, `LRCX`, `KLAC`
- Layer 5 — Power/Infra: `VRT`, `CEG`
- Layer 6 — Memory: `MU`
- Layer 7 — Networking: `ANET`
- Cyclical / Adjacent: `PLTR`, `MSFT`, `AMZN`, `META`, `COIN`

**No-call list (Core Compounders — covered calls blocked, puts and spreads valid):**
`TSM`, `ASML`, `AMAT`, `LRCX`, `KLAC`, `SNPS`, `CDNS`, `ANET`, `CEG`

**Not in defaults:**

| Excluded | Reason |
|----------|--------|
| SPX, SPY, QQQ, IWM | Generic indices — not in SOUL thesis; add to THETA-POLICY if you want index theta |
| NVDA, MSTR | SOUL "Avoid/Too Crowded" — thin edge for new positions |
| HYPE, SOL, NEAR, SUI, ETH | Crypto-only on tastytrade — no US equity options |
| BESI / BESIY | ADR — typically thin option market |
| TEL / TOELY | ADR — typically thin option market |

---

## 7. Security

- Never commit `tastytrade-credentials.json` or `.env` with real tokens.
- `env.example` documents `TASTYTRADE_CLIENT_ID`, `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_SANDBOX`, `TASTYTRADE_ORDER_ENABLED`, and `TASTYTRADE_HEARTBEAT_ENABLED`.
- Phase 3 live order tools are **opt-in**: set `TASTYTRADE_ORDER_ENABLED=true`. Always prefer dry_run before submit; require explicit user confirmation for live orders.
- Phase 5 THETA-POLICY hard block ensures no policy-violating candidates are returned or recommended. `policy_blocked: true` from strategy_preview means the agent must not suggest placing the trade.
