# tastytrade API — Dexter Integration

**Version:** 1.0  
**Last Updated:** 2026-03-07  
**Reference:** [tastytrade Developer Portal](https://developer.tastytrade.com/) | [SDK](https://developer.tastytrade.com/sdk/)

---

## 1. Overview

tastytrade (formerly tastyworks) is a retail broker API for options, stocks, futures, and crypto. Dexter uses it in three operator states: **not_connected**, **read_only** (accounts, positions, theta scan, strategy preview, order dry-run), and **trading_enabled** (also live orders, submit, cancel when `TASTYTRADE_ORDER_ENABLED=true`). Dry-run and preview are available in read-only; submit/cancel require explicit enablement and user approval.

### Design

- **OAuth2** — Access and refresh tokens; refresh token stored in `~/.dexter/tastytrade-credentials.json`
- **REST** — All Phase 1 calls are GET; semaphore, retries, and backoff in `src/tools/tastytrade/api.ts`
- **User-Agent** — Required by API; Dexter sends `Dexter/1.0`

---

## 2. Authentication

| Mechanism | Where |
|-----------|--------|
| Client ID | `TASTYTRADE_CLIENT_ID` (env) |
| Client Secret | `TASTYTRADE_CLIENT_SECRET` (env) |
| Refresh token | `~/.dexter/tastytrade-credentials.json` (see below) |

**Credentials file** (`~/.dexter/tastytrade-credentials.json`):

- **CLI login (recommended):** Run `bun run tastytrade:login` or `bun run start -- tastytrade login`. Ensure `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` are in `.env`. The command prints the URL to create a grant; paste the refresh token when prompted; credentials are written to the file.
- **Manual:** Obtain a **refresh token** from [my.tastytrade.com → API Access → OAuth Applications](https://my.tastytrade.com/app.html#/manage/api-access/oauth-applications) (Create Grant). Paste it into the file as `{ "refresh_token": "..." }`, or run the CLI login and paste when prompted.
- Optionally paste an **access_token** and **expires_at** (Unix ms) to skip refresh until expiry.
- After first refresh, the file is updated with new access_token and expires_at.

Example:

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
| `/market-data/quotes` | POST | `tastytrade_quote` | Live quotes (bid, ask, mark, volume) for equities, indices, or options |
| `/symbols/search?prefix=` | GET | `tastytrade_symbol_search` | Symbol search by prefix or phrase |

### Phase 3 — Order flow

- **Read-only (no env required beyond credentials):** `tastytrade_order_dry_run` validates orders without submitting. Use with `tastytrade_strategy_preview` and `tastytrade_roll_short_option` to validate before enabling live trading.
- **Trading (opt-in):** Set `TASTYTRADE_ORDER_ENABLED=true` to register `tastytrade_live_orders`, `tastytrade_submit_order`, `tastytrade_cancel_order`. Submit and cancel require explicit user approval in the CLI.

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/accounts/{account_number}/orders/live` | GET | `tastytrade_live_orders` | Live and recent orders (working, filled, cancelled) |
| `/accounts/{account_number}/orders?dry_run=true` | POST | `tastytrade_order_dry_run` | Validate order, get buying power/fee impact |
| `/accounts/{account_number}/orders` | POST | `tastytrade_submit_order` | Submit order to the market |
| `/accounts/{account_number}/orders/{order_id}` | DELETE | `tastytrade_cancel_order` | Cancel an open order |

Tools are registered when `TASTYTRADE_CLIENT_ID` is set; Phase 3 tools only when `TASTYTRADE_ORDER_ENABLED=true`.

### Phase 4 — Portfolio sync & heartbeat

| Feature | Description |
|--------|--------------|
| **tastytrade_sync_portfolio** | Fetches positions + balances, builds PORTFOLIO.md-style table (Ticker \| Weight \| Layer \| Tier). Optionally writes to `~/.dexter/PORTFOLIO.md`. Option symbols normalized to underlying per [TASTYTRADE-SYMBOLOGY.md](./TASTYTRADE-SYMBOLOGY.md). |
| **Heartbeat drift check** | When `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat prompt instructs the agent to call tastytrade_positions/balances (or tastytrade_sync_portfolio), compare to SOUL.md/PORTFOLIO.md target, and flag position drift (e.g. >5% above target). |

No new API endpoints; reuses Phase 1 positions and account-balances.

### Phase 5 — Portfolio-aware theta engine

| Feature | Description |
|--------|--------------|
| **tastytrade_position_risk** | Enriches live positions into a risk view: DTE, option type, concentration by underlying, buying power usage, and challenged short options. |
| **tastytrade_theta_scan** | Scans covered calls, cash-secured puts, credit spreads, and iron condors using tastytrade positions, balances, option chains, quotes, and THETA-POLICY defaults. Returns ranked candidates with `order_json`. |
| **tastytrade_strategy_preview** | Builds a trade memo for a candidate or manual order and runs tastytrade dry-run when order flow is enabled. |
| **tastytrade_roll_short_option** | Builds a later-dated roll candidate for a short option and optionally dry-runs it. |
| **tastytrade_repair_position** | Analyzes a challenged short option and recommends hold, roll, close now, or possible assignment. |

Phase 5 reuses Phase 1/2 endpoints and Phase 3 dry-run when enabled. It also introduces a persistent user policy file at `~/.dexter/THETA-POLICY.md`.

---

## 5. Tool Behavior

**Phase 1**
- **tastytrade_accounts** — No input. Returns list of account numbers and nicknames.
- **tastytrade_balances** — Optional `account_number`. If omitted, uses first account from `/customers/me/accounts`.
- **tastytrade_positions** — Optional `account_number`. If omitted, uses first account.

**Phase 2**
- **tastytrade_option_chain** — `underlying_symbol` (e.g. SPY, AAPL, SPX). Returns nested chain with expirations and strikes.
- **tastytrade_quote** — `symbols` (comma-separated), optional `instrument_type`: Equity | Index | Equity Option. Returns quote data per symbol.
- **tastytrade_symbol_search** — `query` (prefix or phrase). Returns matching symbols and descriptions.

**Phase 3** (only when `TASTYTRADE_ORDER_ENABLED=true`)
- **tastytrade_live_orders** — Optional `account_number`. Returns list of live and recent orders.
- **tastytrade_order_dry_run** — `account_number`, `order_json` (JSON order per tastytrade order submission docs). Returns buying power effect and fees; does not submit.
- **tastytrade_submit_order** — `account_number`, `order_json`. Submits order. Use only after user confirmation (e.g. after dry_run).
- **tastytrade_cancel_order** — `account_number`, `order_id`. Cancels an open order.

**Phase 4**
- **tastytrade_sync_portfolio** — Optional `account_number`, `write_to_portfolio` (default false). Fetches positions and balances, aggregates by underlying ticker (see [TASTYTRADE-SYMBOLOGY.md](./TASTYTRADE-SYMBOLOGY.md)), computes weights, returns markdown table and summary. If `write_to_portfolio=true`, writes table to `~/.dexter/PORTFOLIO.md`.

**Phase 5**
- **tastytrade_position_risk** — Optional `account_number`. Returns enriched live positions with DTE, option type, concentration, portfolio theta/delta when available, and challenged short options.
- **tastytrade_theta_scan** — Optional `account_number`, optional `underlyings_csv`, `strategy_type`, DTE and delta bounds, `spread_width`, `min_credit`. Returns ranked theta candidates and `order_json` for preview/dry-run.
- **tastytrade_strategy_preview** — `account_number`, `order_json`, optional `thesis`, optional `exit_plan`. Returns a trade memo and dry-run result if order flow is enabled.
- **tastytrade_roll_short_option** — Optional `account_number`; identify a short option by `position_symbol` or underlying/type/strike. Returns a later-dated roll candidate, order_json, and dry-run result if enabled.
- **tastytrade_repair_position** — Optional `account_number`; identify a short option by `position_symbol` or underlying/type/strike. Returns alternatives (hold, close, roll, assignment) and a recommendation.

All tools return JSON. On auth or API errors, the tool throws with a clear message (e.g. missing credentials or 401).

---

## 6. Security

- Never commit `tastytrade-credentials.json` or `.env` with real tokens.
- `env.example` documents `TASTYTRADE_CLIENT_ID`, `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_SANDBOX`, and `TASTYTRADE_ORDER_ENABLED`.
- Phase 3 (order submission) is **opt-in**: set `TASTYTRADE_ORDER_ENABLED=true` to register live_orders, order_dry_run, submit_order, cancel_order. Always prefer dry_run before submit; require explicit user confirmation for live orders.
- Phase 5 introduces `~/.dexter/THETA-POLICY.md` so theta strategies respect allowed underlyings, no-call lists, DTE/delta limits, sizing caps, and event filters.
