# PRD: tastytrade Integration

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07  
**Reference:** [tastytrade Developer Portal](https://developer.tastytrade.com/)

---

## 1. Executive Summary

Integrate Dexter with the **tastytrade API** to enable real-time portfolio sync, account data, and optional order execution. tastytrade (formerly tastyworks) is a retail broker focused on options, stocks, futures, and crypto. This integration bridges the gap between Dexter’s manual `PORTFOLIO.md` workflow and live broker data.

**Core value:**
- **Read live positions and balances** — Compare actual tastytrade holdings to target portfolio (SOUL.md thesis)
- **Sync portfolio file** — Update `~/.dexter/PORTFOLIO.md` from broker positions for rebalance checks
- **Option chain and market data** — Supplement Financial Datasets with tastytrade-specific data (options, Greeks)
- **Optional order flow** — Dry-run, submit, cancel orders (Phase 3, user-controlled)

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
| **Transactions** | Trade history | Performance attribution |
| **Net Liquidating Value History** | NLV over time | Performance tracking |
| **Symbol Search** | Search symbols | Ticker resolution |
| **Watchlists** | Create/manage watchlists | Research workflow |
| **Margin Requirements** | Margin calc | Risk awareness |
| **Backtesting** | Strategy backtest | Future skill |

### 2.2 Authentication

- **OAuth2** — Primary auth flow. User authorizes Dexter; we store refresh token.
- **API token** — Alternative for programmatic access (if supported).
- **Sandbox** — Paper trading environment for development and testing.

**Base URLs:**
- Production: `https://api.tastytrade.com`
- Sandbox: `https://api.cert.tastytrade.com` (or equivalent per docs)

### 2.3 tastytrade Symbology

tastytrade uses its own symbology for options (e.g. OCC format). Dexter must map between:
- **Standard tickers** (AAPL, SPY) — Used in Financial Datasets, PORTFOLIO.md
- **tastytrade symbols** — Used in API requests/responses

Document mapping rules in `docs/TASTYTRADE-SYMBOLOGY.md` (similar to HYPERLIQUID-SYMBOL-MAP.md).

---

## 3. Integration Phases

### Phase 1: Read-Only Account Data (MVP)

**Goal:** Dexter can read live positions and balances from tastytrade.

| Tool | Description | API Endpoints |
|------|-------------|---------------|
| `tastytrade_positions` | Fetch current positions (stocks, options, futures) | Balances and Positions |
| `tastytrade_balances` | Fetch account balances (equity, cash, margin) | Balances and Positions |
| `tastytrade_accounts` | List linked accounts | Accounts and Customers |

**User flows:**
- "What's in my tastytrade account?" → Show positions and balances
- "Sync my portfolio from tastytrade" → Read positions, format as PORTFOLIO.md table, optionally write to `~/.dexter/PORTFOLIO.md`
- Heartbeat: Compare tastytrade positions to target (SOUL.md) and flag drift

**Non-goals for Phase 1:**
- Order submission
- Streaming (use REST polling)

---

### Phase 2: Market Data & Options

**Goal:** Dexter can fetch option chains, quotes, and Greeks from tastytrade.

| Tool | Description | API Endpoints |
|------|-------------|---------------|
| `tastytrade_option_chain` | Fetch option chain for a symbol | Market Data |
| `tastytrade_quote` | Fetch quote for symbol(s) | Market Data |
| `tastytrade_market_metrics` | IV, Greeks, etc. | Market Metrics |
| `tastytrade_symbol_search` | Search symbols | Symbol Search |

**User flows:**
- "Show me AAPL option chain for next week"
- "What's the IV on NVDA 0DTE?"
- "Compare implied vol vs historical for SPY"

**Relationship to Financial Datasets:**
- FD: fundamentals, filings, historical prices, news
- tastytrade: live quotes, options, Greeks, account-specific data
- Use both; route by query type in `financial_search` or a new `tastytrade_search` meta-tool

---

### Phase 3: Order Flow (Optional)

**Goal:** Dexter can submit, cancel, and dry-run orders. **High risk; requires explicit user opt-in.**

| Tool | Description | API Endpoints |
|------|-------------|---------------|
| `tastytrade_order_dry_run` | Validate order without submitting | Order Management |
| `tastytrade_submit_order` | Submit equity/option order | Order Management |
| `tastytrade_cancel_order` | Cancel open order | Order Management |
| `tastytrade_live_orders` | List open orders | Order Management |

**Safeguards:**
- Feature flag: `TASTYTRADE_ORDER_ENABLED=true` (default false)
- Confirmation prompt for live orders (CLI) or explicit user action (web)
- Dry-run first; show user what would happen before submitting
- Rate limits and idempotency for order submission

---

### Phase 5: Portfolio-Aware Theta Engine (see detailed PRD)

**Goal:** Decision-ready theta workflows — position risk enrichment, opportunity scanning, strategy preview, roll/repair — with a persistent policy layer so options stay subordinate to the Portfolio Builder north star.

| Capability | Description |
|------------|-------------|
| Position intelligence | Enrich live positions (underlying, DTE, risk metrics, concentration). |
| Theta scan | Find setups (covered calls, CSPs, credit spreads, iron condors) that match policy and constraints. |
| Strategy preview | Trade memo + dry-run before any submit. |
| Roll/repair | Suggest and optionally execute roll or repair for challenged short options. |
| THETA-POLICY.md | User-editable policy at `~/.dexter/THETA-POLICY.md` (allowed underlyings, no-call list, delta/DTE caps, event filters). |

**Detailed PRD:** [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md)

---

## 4. Architecture

### 4.1 Directory Structure

```
src/tools/tastytrade/
├── api.ts              # HTTP client, auth, rate limiting
├── auth.ts             # OAuth2 flow, token refresh
├── tastytrade-tool.ts  # Meta-tool: routes to sub-tools
├── positions-tool.ts
├── balances-tool.ts
├── option-chain-tool.ts
├── quote-tool.ts
├── order-tool.ts       # Phase 3
└── descriptions.ts    # Tool descriptions for system prompt
```

### 4.2 API Client (`api.ts`)

- **Base URL:** Configurable (production vs sandbox)
- **Auth:** Bearer token from OAuth2; auto-refresh on 401
- **Concurrency:** Semaphore (e.g. 5) to avoid rate limits
- **Retries:** Exponential backoff, respect `Retry-After`
- **Caching:** Optional for immutable data (e.g. instrument metadata)

Mirror patterns from `src/tools/finance/api.ts`.

### 4.3 OAuth2 Flow (implemented)

1. **User runs:** `bun run tastytrade:login` or `bun run start -- tastytrade login`
2. **Prerequisites:** `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`
3. **Obtain refresh token:** User opens [my.tastytrade.com → API Access → OAuth Applications](https://my.tastytrade.com/app.html#/manage/api-access/oauth-applications) and creates a grant (or uses an existing OAuth app); copies the refresh token
4. **Paste in CLI:** Script prompts for the token; exchanges it for access + refresh via `/oauth/token`; writes `~/.dexter/tastytrade-credentials.json` (gitignored, chmod 0600)
5. **Refresh:** Before each API call, check expiry; refresh if needed (existing logic in `auth.ts`)

**Environment variables:**
- `TASTYTRADE_CLIENT_ID` — OAuth app client ID
- `TASTYTRADE_CLIENT_SECRET` — OAuth app client secret (or use PKCE for public clients)
- `TASTYTRADE_SANDBOX` — `true` to use sandbox API

### 4.4 Tool Registry

```typescript
// src/tools/registry.ts
if (process.env.TASTYTRADE_CLIENT_ID && hasValidTastytradeToken()) {
  tools.push(
    { name: 'tastytrade_positions', tool: positionsTool, description: TASTYTRADE_POSITIONS_DESCRIPTION },
    { name: 'tastytrade_balances', tool: balancesTool, description: TASTYTRADE_BALANCES_DESCRIPTION },
    // Phase 2
    { name: 'tastytrade_option_chain', tool: optionChainTool, description: ... },
    { name: 'tastytrade_quote', tool: quoteTool, description: ... },
    // Phase 3 (if TASTYTRADE_ORDER_ENABLED)
    { name: 'tastytrade_submit_order', tool: submitOrderTool, description: ... },
  );
}
```

---

## 5. Portfolio Sync Workflow

### 5.1 Sync from tastytrade → PORTFOLIO.md

1. User: "Sync my portfolio from tastytrade"
2. Agent calls `tastytrade_positions` and `tastytrade_balances`
3. Map positions to PORTFOLIO.md format:
   - **Equities:** Ticker | Weight | Layer | Tier (Layer/Tier from SOUL.md or user prompt)
   - **Options:** Represent as underlying + strategy, or exclude from main portfolio (options are tactical)
4. Agent calls `portfolio` tool with `action=update` and generated content
5. Response: "Synced 12 positions from tastytrade. Updated ~/.dexter/PORTFOLIO.md."

### 5.2 Heartbeat Integration

- If tastytrade is connected, heartbeat can:
  - Fetch live positions
  - Compare to target (SOUL.md)
  - Flag: "tastytrade positions show 8% in NVDA vs 5% target — consider trimming"
- Optional: `TASTYTRADE_HEARTBEAT_ENABLED` to include in weekly rebalance check

---

## 6. Data Mapping

### 6.1 Position → Portfolio Row

| tastytrade Field | PORTFOLIO.md Column | Notes |
|------------------|---------------------|-------|
| `symbol` | Ticker | Map options to underlying (e.g. AAPL_012624C150 → AAPL) |
| `quantity` × `average_open_price` | Weight | Normalize to % of total equity |
| — | Layer | From SOUL.md or user config |
| — | Tier | From SOUL.md or user config |

### 6.2 Options Handling

- **Main portfolio:** Typically equities + ETFs. Options are derivatives; include only if user wants (e.g. "show options as underlying equivalent").
- **Separate view:** `tastytrade_positions` can return raw options; agent summarizes: "You have 10 AAPL calls, 5 SPY puts, ..."

---

## 7. Environment & Configuration

### 7.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TASTYTRADE_CLIENT_ID` | Yes (for OAuth) | OAuth2 client ID |
| `TASTYTRADE_CLIENT_SECRET` | Yes (for OAuth) | OAuth2 client secret |
| `TASTYTRADE_SANDBOX` | No | `true` = sandbox API |
| `TASTYTRADE_ORDER_ENABLED` | No | `true` = enable order tools (Phase 3) |
| `TASTYTRADE_HEARTBEAT_ENABLED` | No | `true` = include in heartbeat |

### 7.2 Credential Storage

- Path: `~/.dexter/tastytrade-credentials.json`
- Contents: `{ "access_token", "refresh_token", "expires_at" }`
- Permissions: 0600
- Encryption: Optional; consider OS keychain for production

---

## 8. Security & Compliance

### 8.1 Token Handling

- Never log tokens
- Refresh token stored securely; access token in memory only
- Revoke on `dexter tastytrade logout`

### 8.2 Order Safeguards

- Dry-run by default for order tool
- Explicit confirmation for live orders
- Audit log: log order attempts (symbol, side, qty) without full token

### 8.3 Regulatory

- tastytrade is FINRA/SIPC member; users are responsible for compliance
- Dexter does not provide investment advice; tools are execution/read-only utilities

---

## 9. Documentation Deliverables

| Document | Description |
|----------|-------------|
| `docs/DATA-API-TASTYTRADE.md` | API reference (endpoints, params, responses) — like DATA-API-FINANCIAL-DATASETS.md |
| `docs/TASTYTRADE-SYMBOLOGY.md` | Symbol mapping (tastytrade ↔ standard tickers) |
| `env.example` | Add TASTYTRADE_* variables |

---

## 10. Success Criteria

**Tool registration:** Tastytrade tools are registered only when `hasConfiguredClient()` and `hasUsableCredentials()` are true (client id+secret set and `~/.dexter/tastytrade-credentials.json` with access_token or refresh_token). Use `/tastytrade-status` in the CLI to see setup steps and operator state.

**Operator states:** `not_connected` -> `read_only` (accounts, positions, theta scan, strategy preview, order_dry_run) -> `trading_enabled` (also live_orders, submit_order, cancel_order when `TASTYTRADE_ORDER_ENABLED=true`). Dry-run and preview are available in read-only; submit/cancel require explicit enablement and user approval.

### Phase 1 (shipped)
- [x] `tastytrade_positions` returns positions
- [x] `tastytrade_balances` returns balances
- [x] `tastytrade_accounts` lists linked accounts
- [x] "Sync my portfolio from tastytrade" builds PORTFOLIO.md-style table and can write via shared portfolio abstraction
- [x] Heartbeat can optionally compare tastytrade positions to target (`TASTYTRADE_HEARTBEAT_ENABLED`)
- [x] OAuth2 login flow (CLI command) — `bun run tastytrade:login` or `bun run start -- tastytrade login`; paste refresh token from my.tastytrade.com Create Grant

### Phase 2 (shipped)
- [x] `tastytrade_option_chain` returns option chain for symbol
- [x] `tastytrade_quote` returns quotes
- [x] `tastytrade_symbol_search` for symbol resolution
- [ ] `tastytrade_market_metrics` — not implemented; Greeks/IV from quote data where available

### Phase 3 (shipped)
- [x] `tastytrade_order_dry_run` validates orders (available in read-only; no TASTYTRADE_ORDER_ENABLED required)
- [x] `tastytrade_submit_order` / `tastytrade_cancel_order` require explicit user approval (same as Hyperliquid) and only register when `TASTYTRADE_ORDER_ENABLED=true`
- [x] `TASTYTRADE_ORDER_ENABLED` gates only live_orders, submit_order, cancel_order

---

## 11. Non-Goals

- **Streaming:** DXLink market data / account stream — use REST for now
- **Backtesting:** tastytrade backtesting API — future skill
- **Multi-broker:** Only tastytrade; no abstraction over IBKR, Schwab, etc.
- **Tax reporting:** Transactions available but no tax form generation

---

## 12. References

- [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md) — Phase 5: portfolio-aware theta engine (position risk, theta scan, strategy preview, roll/repair, THETA-POLICY.md)
- [tastytrade Developer Portal](https://developer.tastytrade.com/)
- [API Overview](https://developer.tastytrade.com/api-overview/)
- [OAuth2 Guide](https://developer.tastytrade.com/api-guides/oauth/)
- [Balances and Positions](https://developer.tastytrade.com/open-api-spec/balances-and-positions/)
- [Market Data](https://developer.tastytrade.com/open-api-spec/market-data/)
- [Order Management](https://developer.tastytrade.com/order-management/)
- [Sandbox](https://developer.tastytrade.com/sandbox/)
- [tastytrade API Terms of Service](https://developer.tastytrade.com/) — users must agree
