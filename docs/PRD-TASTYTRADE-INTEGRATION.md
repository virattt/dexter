# PRD: tastytrade Integration

**Version:** 2.0  
**Status:** Shipped  
**Last Updated:** 2026-03-08  
**Reference:** [tastytrade Developer Portal](https://developer.tastytrade.com/)

---

## 1. Executive Summary

Dexter is integrated with the **tastytrade API** for real-time portfolio sync, account data, theta income workflows, and optional order execution. tastytrade (formerly tastyworks) is a retail broker focused on options, stocks, futures, and crypto. The integration bridges Dexter's manual `PORTFOLIO.md` workflow with live broker data and delivers a full portfolio-aware theta engine.

**What's shipped:**
- **Read live positions and balances** — Compare actual tastytrade holdings to target portfolio (SOUL.md thesis)
- **Sync portfolio** — Update `~/.dexter/PORTFOLIO.md` from broker positions with Target/Actual/Gap columns
- **Option chain and market data** — Supplement Financial Datasets with tastytrade-specific data (options, quotes)
- **Order flow** — Dry-run, submit, cancel orders (Phase 3, user-controlled, `TASTYTRADE_ORDER_ENABLED=true`)
- **Portfolio-aware theta engine** — Position risk enrichment, SOUL-aligned theta scan, strategy preview, roll/repair (Phase 5)
- **Analytics tools** — Transaction history, earnings calendar, watchlist management, risk metrics scorecard (Phase 6)

---

## 2. tastytrade API Overview

### 2.1 Capabilities

| Domain | Endpoints | Dexter Use Case |
|--------|-----------|-----------------|
| **Accounts & Customers** | Account status, customer info | Multi-account support |
| **Balances & Positions** | Balances, positions | Portfolio sync, rebalance input |
| **Market Data** | Quotes, option chains, instruments | Options research, Greeks |
| **Market Metrics** | IV, Greeks, etc. | Options analysis |
| **Orders** | Submit, cancel, dry run, complex orders | Order execution (Phase 3) |
| **Transactions** | Trade history | Realized P&L, win rate |
| **Net Liquidating Value History** | NLV over time | Performance tracking |
| **Symbol Search** | Search symbols | Ticker resolution |
| **Watchlists** | Create/manage watchlists | Research workflow, SOUL universe |
| **Margin Requirements** | Margin calc | Risk awareness |

### 2.2 Authentication

- **OAuth2** — Primary auth flow. User authorizes Dexter; we store refresh token.
- **API token** — Alternative for programmatic access (if supported).
- **Sandbox** — Paper trading environment for development and testing.

**Base URLs:**
- Production: `https://api.tastytrade.com`
- Sandbox: `https://api.cert.tastyworks.com`

### 2.3 tastytrade Symbology

tastytrade uses its own symbology for options (OCC format). Dexter maps between:
- **Standard tickers** (AAPL, TSM) — Used in Financial Datasets, PORTFOLIO.md
- **tastytrade symbols** — Used in API requests/responses
- **SOUL.md ADRs** — BESI → BESIY, TEL → TOELY; crypto (HYPE, SOL, NEAR) are tastytrade crypto products, not US equity options

Full mapping rules: `docs/TASTYTRADE-SYMBOLOGY.md`

---

## 3. Integration Phases

### Phase 1: Read-Only Account Data ✅ Shipped

| Tool | Description | API Endpoints |
|------|-------------|---------------|
| `tastytrade_accounts` | List linked accounts | Accounts and Customers |
| `tastytrade_positions` | Fetch current positions (stocks, options, futures) | Balances and Positions |
| `tastytrade_balances` | Fetch account balances (equity, cash, margin) | Balances and Positions |

### Phase 2: Market Data & Options ✅ Shipped

| Tool | Description | API Endpoints |
|------|-------------|---------------|
| `tastytrade_option_chain` | Fetch option chain for a symbol | Market Data |
| `tastytrade_quote` | Fetch quote for symbol(s) | Market Data |
| `tastytrade_symbol_search` | Symbol search | Symbol Search |

### Phase 3: Order Flow ✅ Shipped (opt-in)

| Tool | Description | Requires |
|------|-------------|----------|
| `tastytrade_order_dry_run` | Validate order without submitting | Read-only |
| `tastytrade_live_orders` | List open/recent orders | `TASTYTRADE_ORDER_ENABLED=true` |
| `tastytrade_submit_order` | Submit equity/option order | `TASTYTRADE_ORDER_ENABLED=true` + user confirmation |
| `tastytrade_cancel_order` | Cancel open order | `TASTYTRADE_ORDER_ENABLED=true` + user confirmation |

### Phase 4: Portfolio Sync & Heartbeat ✅ Shipped

| Feature | Description |
|---------|-------------|
| `tastytrade_sync_portfolio` | Fetches positions + balances; builds PORTFOLIO.md table with **Ticker \| Target Weight \| Actual Weight \| Gap** columns. Optionally writes to `~/.dexter/PORTFOLIO.md`. Option symbols normalized to underlying. |
| Heartbeat drift check | When `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat compares live positions to SOUL.md/PORTFOLIO.md targets; flags drift above threshold (e.g. >5% of equity). |
| Session cache | Positions and balances cached in-session (5-min TTL) to avoid redundant API calls. Auto-populated on first broker query per session. |

### Phase 5: Portfolio-Aware Theta Engine ✅ Shipped

| Tool | Description |
|------|-------------|
| `tastytrade_position_risk` | Enriches live positions into a decision-ready risk view (DTE, delta, theta, concentration, challenged shorts). |
| `tastytrade_theta_scan` | Scans SOUL.md thesis names (from THETA-POLICY) for covered calls, CSPs, credit spreads, iron condors. SOUL-aligned defaults — **not** SPX/SPY/QQQ. Hard-block policy enforcement. |
| `tastytrade_strategy_preview` | Trade memo + THETA-POLICY validation + dry-run. Returns `policy_blocked` before any recommendation. |
| `tastytrade_roll_short_option` | Later-dated roll candidate with THETA-POLICY check and dry-run. |
| `tastytrade_repair_position` | Hold/roll/close/assignment analysis for challenged shorts. |

**THETA-POLICY alignment:** Allowed underlyings default to SOUL.md thesis names (AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN). No-call list defaults to Core Compounders (TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG). SPX/SPY/QQQ/IWM are not in the defaults.

**Detailed PRD:** [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md)

### Phase 6: Analytics Tools ✅ Shipped

| Tool | Description |
|------|-------------|
| `tastytrade_transactions` | Transaction history (realized P&L, win rate on theta trades, closed trades). Optional date range and type filter. |
| `tastytrade_earnings_calendar` | Upcoming earnings dates for THETA-POLICY underlyings + current positions. Flags `within_7_days`. Defaults to SOUL thesis names. |
| `tastytrade_watchlist` | List, create, update, delete tastytrade watchlists; scan watchlist for quotes with THETA-POLICY alignment markers. |
| `tastytrade_risk_metrics` | Portfolio risk scorecard: Herfindahl concentration index, top-5 weight %, aggregate theta/delta, buying power utilization. |

---

## 4. Architecture

### 4.1 Directory Structure

```
src/tools/tastytrade/
├── api.ts                    # HTTP client, auth, rate limiting, session cache
├── auth.ts                   # OAuth2 flow, token refresh
├── accounts-tool.ts
├── balances-tool.ts
├── positions-tool.ts
├── option-chain-tool.ts
├── quote-tool.ts
├── symbol-search-tool.ts
├── live-orders-tool.ts
├── order-dry-run-tool.ts
├── submit-order-tool.ts
├── cancel-order-tool.ts
├── sync-portfolio-tool.ts    # Phase 4 — writes Target/Actual/Gap to PORTFOLIO.md
├── position-risk-tool.ts     # Phase 5
├── theta-scan-tool.ts        # Phase 5 — SOUL-aligned underlyings
├── theta-helpers.ts          # Phase 5 — shared scan logic
├── strategy-preview-tool.ts  # Phase 5
├── roll-short-option-tool.ts # Phase 5
├── roll-helpers.ts           # Phase 5 — shared roll logic
├── repair-position-tool.ts   # Phase 5
├── transactions-tool.ts      # Phase 6
├── earnings-calendar-tool.ts # Phase 6
├── watchlist-tool.ts         # Phase 6
├── risk-metrics-tool.ts      # Phase 6
├── utils.ts                  # loadThetaPolicy, parseOptionSymbol, normalizeUnderlyingTicker
├── descriptions.ts           # Tool descriptions for system prompt
└── index.ts                  # Tool exports
```

### 4.2 API Client (`api.ts`)

- **Base URL:** Configurable (production vs sandbox)
- **Auth:** Bearer token from OAuth2; auto-refresh on 401
- **Concurrency:** Semaphore to avoid rate limits
- **Retries:** Exponential backoff, respect `Retry-After`
- **Session cache:** Positions and balances cached 5-min TTL per session; populated on first broker query, reused across tools in the same session

### 4.3 OAuth2 Flow

1. **User runs:** `bun run tastytrade:login` or `bun run start -- tastytrade login`
2. **Prerequisites:** `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`
3. **Obtain refresh token:** User opens [my.tastytrade.com → API Access → OAuth Applications](https://my.tastytrade.com/app.html#/manage/api-access/oauth-applications) and creates a grant; copies the refresh token
4. **Paste in CLI:** Script prompts for the token; exchanges it for access + refresh via `/oauth/token`; writes `~/.dexter/tastytrade-credentials.json` (gitignored, chmod 0600)
5. **Refresh:** Before each API call, check expiry; refresh if needed (`auth.ts`)

### 4.4 Tool Registry

Tools are registered when `TASTYTRADE_CLIENT_ID` is set and `~/.dexter/tastytrade-credentials.json` has a usable token. Phase 3 live order tools only when `TASTYTRADE_ORDER_ENABLED=true`.

---

## 5. Portfolio Sync Workflow

### 5.1 Sync from tastytrade → PORTFOLIO.md

1. User: "Sync my portfolio from tastytrade"
2. Agent calls `tastytrade_sync_portfolio`
3. Fetches positions + balances; normalizes option symbols to underlying ticker
4. Builds PORTFOLIO.md table: **Ticker | Target Weight | Actual Weight | Gap | Layer | Tier**
5. Layer and Tier populated from SOUL.md conviction tiers where matched
6. If `write_to_portfolio=true`, writes `~/.dexter/PORTFOLIO.md`

### 5.2 Heartbeat Integration

When `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat:
- Fetches live positions (or uses session cache)
- Compares to SOUL.md/PORTFOLIO.md target weights
- Flags drift: "NVDA 8% vs 5% target — consider trimming"
- Optionally includes "theta check": any short options expiring this week; any roll/repair suggested

---

## 6. Data Mapping

### 6.1 Position → Portfolio Row

| tastytrade Field | PORTFOLIO.md Column | Notes |
|------------------|---------------------|-------|
| `symbol` (equity) | Ticker | Direct use |
| `symbol` (option) | Ticker | Root extraction → underlying (e.g. `AAPL 250117C00150000` → AAPL) |
| `quantity` × `close_price` / total equity | Actual Weight % | Normalized per [TASTYTRADE-SYMBOLOGY.md](TASTYTRADE-SYMBOLOGY.md) |
| — | Target Weight % | From PORTFOLIO.md or SOUL.md allocation |
| Actual − Target | Gap % | Positive = overweight, negative = underweight |
| — | Layer | From SOUL.md (Layer 1–7 or crypto satellite) |
| — | Tier | From SOUL.md conviction tier |

---

## 7. Environment & Configuration

### 7.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TASTYTRADE_CLIENT_ID` | Yes (for OAuth) | OAuth2 client ID |
| `TASTYTRADE_CLIENT_SECRET` | Yes (for OAuth) | OAuth2 client secret |
| `TASTYTRADE_SANDBOX` | No | `true` = sandbox API |
| `TASTYTRADE_ORDER_ENABLED` | No | `true` = enable live order tools (submit, cancel, live_orders) |
| `TASTYTRADE_HEARTBEAT_ENABLED` | No | `true` = include broker drift check in heartbeat |

### 7.2 Credential Storage

- Path: `~/.dexter/tastytrade-credentials.json`
- Contents: `{ "access_token", "refresh_token", "expires_at" }`
- Permissions: 0600
- Never commit to git

---

## 8. Security & Compliance

### 8.1 Token Handling

- Never log tokens
- Refresh token stored securely; access token in memory only
- Revoke on `dexter tastytrade logout`

### 8.2 Order Safeguards

- Dry-run always available; live submit requires `TASTYTRADE_ORDER_ENABLED=true` + explicit user confirmation
- THETA-POLICY hard block: scan and preview exclude policy-violating candidates before returning results
- Audit log: log order attempts (symbol, side, qty) without full token

### 8.3 Regulatory

- tastytrade is FINRA/SIPC member; users are responsible for compliance
- Dexter does not provide investment advice; tools are execution/read-only utilities

---

## 9. Documentation

| Document | Description | Status |
|----------|-------------|--------|
| `docs/DATA-API-TASTYTRADE.md` | API reference (endpoints, params, tool behavior) | Shipped |
| `docs/TASTYTRADE-SYMBOLOGY.md` | OCC symbol format + SOUL.md ticker mapping | Shipped |
| `docs/TASTYTRADE.md` | User-facing workflow guide (common prompts, THETA-POLICY) | Shipped |
| `docs/THETA-POLICY.md` | THETA-POLICY.md format and field reference | Shipped |
| `docs/THETA-POLICY.example.md` | Example policy aligned to SOUL.md | Shipped |
| `docs/THETA-PROMPTS-12.md` | 12 canonical theta prompts (SOUL-aligned) | Shipped v1.1 |
| `env.example` | Documents all `TASTYTRADE_*` variables | Shipped |

---

## 10. Success Criteria

**Operator states:** `not_connected` → `read_only` (accounts, positions, balances, theta scan, strategy preview, order_dry_run) → `trading_enabled` (also live_orders, submit_order, cancel_order when `TASTYTRADE_ORDER_ENABLED=true`).

### Phase 1 ✅
- [x] `tastytrade_positions`, `tastytrade_balances`, `tastytrade_accounts`
- [x] OAuth2 login flow (`bun run tastytrade:login`)
- [x] "What's in my tastytrade account?" returns positions and balances

### Phase 2 ✅
- [x] `tastytrade_option_chain`, `tastytrade_quote`, `tastytrade_symbol_search`

### Phase 3 ✅
- [x] `tastytrade_order_dry_run` (read-only, no flag required)
- [x] `tastytrade_live_orders`, `tastytrade_submit_order`, `tastytrade_cancel_order` (require `TASTYTRADE_ORDER_ENABLED=true` + user confirmation)

### Phase 4 ✅
- [x] `tastytrade_sync_portfolio` writes Target/Actual/Gap table to PORTFOLIO.md
- [x] Heartbeat drift check when `TASTYTRADE_HEARTBEAT_ENABLED=true`
- [x] Session-level position/balance cache (5-min TTL); auto-populated on first broker query

### Phase 5 ✅
- [x] `tastytrade_position_risk` — enriched view with DTE, concentration, challenged shorts
- [x] `tastytrade_theta_scan` — SOUL-aligned underlyings (AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN); hard-block policy; no SPX/SPY/QQQ defaults
- [x] `tastytrade_strategy_preview` — THETA-POLICY validation + dry-run; returns `policy_blocked` before recommending
- [x] `tastytrade_roll_short_option`, `tastytrade_repair_position`
- [x] THETA-POLICY.md documented; missing file falls back to SOUL-aligned defaults

### Phase 6 ✅
- [x] `tastytrade_transactions` — realized P&L, win rate, closed trades
- [x] `tastytrade_earnings_calendar` — SOUL thesis underlyings + current positions; `within_7_days` flag
- [x] `tastytrade_watchlist` — list/create/update/delete + policy-aligned scan
- [x] `tastytrade_risk_metrics` — Herfindahl concentration, theta/delta aggregate, buying power utilization

---

## 11. Non-Goals

- **Streaming:** DXLink market data / account stream — use REST for now
- **Backtesting:** tastytrade backtesting API — future skill
- **Multi-broker:** Only tastytrade; no abstraction over IBKR, Schwab, etc.
- **Tax reporting:** Transactions available but no tax form generation
- **`tastytrade_market_metrics`:** Not implemented; Greeks/IV from quote data where available

---

## 12. References

- [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md) — Phase 5 detailed PRD
- [DATA-API-TASTYTRADE.md](DATA-API-TASTYTRADE.md) — Endpoints and tool behavior
- [TASTYTRADE.md](TASTYTRADE.md) — User-facing workflow guide
- [THETA-POLICY.md](THETA-POLICY.md) — Policy file format
- [TASTYTRADE-SYMBOLOGY.md](TASTYTRADE-SYMBOLOGY.md) — OCC symbol mapping
- [tastytrade Developer Portal](https://developer.tastytrade.com/)
