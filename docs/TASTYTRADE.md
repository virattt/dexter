# tastytrade Integration — User Guide

How to set up, configure, and use Dexter's tastytrade integration for live account data, theta scanning, and options workflows.

---

## 1. Setup

### 1.1 Environment variables

Add these to your `.env` (see `env.example`):

```
TASTYTRADE_CLIENT_ID=your-oauth-client-id
TASTYTRADE_CLIENT_SECRET=your-oauth-client-secret
TASTYTRADE_SANDBOX=false
```

- **`TASTYTRADE_SANDBOX=true`** → routes to `api.cert.tastyworks.com` (sandbox). Use for testing with a paper account.
- **`TASTYTRADE_SANDBOX=false`** → routes to `api.tastytrade.com` (production). Use for your real brokerage account.

> Your sandbox and production accounts are separate. A refresh token from production won't work against sandbox, and vice versa.

### 1.2 Authentication

Dexter uses OAuth2 refresh tokens. On first use it will prompt you or you can set up manually:

1. Go to [my.tastytrade.com](https://my.tastytrade.com) → API settings → generate a refresh token.
2. Save it to `~/.dexter/tastytrade-credentials.json`:

```json
{
  "refresh_token": "your-refresh-token-here"
}
```

Dexter automatically exchanges the refresh token for an access token and keeps it current. You should not need to touch this file again unless the token is revoked.

### 1.3 Optional: enable live trading

By default, Dexter operates in **read-only** mode — you can view accounts, positions, balances, scan for trades, and dry-run orders, but nothing is submitted to the market.

To enable live order submission:

```
TASTYTRADE_ORDER_ENABLED=true
```

Even with this enabled, Dexter always shows a dry-run preview before submitting and requires explicit confirmation.

### 1.4 Optional: heartbeat drift check

When the Dexter heartbeat runs (e.g. weekly rebalance), it can compare your live tastytrade positions to the target weights in SOUL.md and PORTFOLIO.md:

```
TASTYTRADE_HEARTBEAT_ENABLED=true
```

With this set, the heartbeat will call `tastytrade_positions` and `tastytrade_balances` (or `tastytrade_sync_portfolio`), then compare actual weights to the Target column in PORTFOLIO.md. It will **flag drift** using these thresholds:

- **Overweight:** Any position more than **5% above** its target weight (e.g. NVDA 8% vs 5% target → consider trimming).
- **Underweight (Core Compounders):** Any Core position more than **3% below** its target (e.g. AAPL 4% vs 7% target → consider adding).

The heartbeat does **not** place or cancel orders; it only produces alerts so you can act in the app or in a later chat.

### 1.5 Venue split (zero overlap with Hyperliquid)

The tastytrade sleeve has **zero overlap** with the Hyperliquid tradable universe. Any symbol that is tradable on Hyperliquid (e.g. AAPL, MSFT, AMZN, META, COIN, BTC, SOL, SUI, NEAR) is **hard-blocked** from:

- `tastytrade_theta_scan` (excluded from candidates; listed in `excluded_by_hl_overlap`)
- `tastytrade_strategy_preview`, `tastytrade_roll_short_option`, `tastytrade_repair_position` (policy violation; no preview/submit)
- `tastytrade_submit_order` (re-check before submit; order rejected if underlying is HL-tradable)
- `tastytrade_sync_portfolio` (HL-tradable positions are excluded from the written PORTFOLIO.md; reported in `excluded_by_hl_overlap`)

PORTFOLIO.md (default portfolio) must not contain HL-tradable tickers; use PORTFOLIO-HYPERLIQUID.md for those. The portfolio tool and `validate-portfolio` enforce this. See [THETA-POLICY.md](THETA-POLICY.md#venue-split-zero-overlap-with-hyperliquid) and [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md).

---

## 2. Tools Reference

All tools are available as natural-language prompts in Dexter's CLI. You don't need to type the tool name — just ask.

### Account & Portfolio

| Tool | What it does | Example prompt |
|------|-------------|----------------|
| `tastytrade_accounts` | Lists all linked brokerage accounts (account numbers, nicknames) | "List my tastytrade accounts" |
| `tastytrade_balances` | Shows equity, buying power, cash, margin for an account | "Show my tastytrade balances" |
| `tastytrade_positions` | Shows all open positions with current mark values | "What positions do I have open?" |
| `tastytrade_live_orders` | Working, filled, and cancelled orders from the last 24 hours | "Show my live orders" |
| `tastytrade_sync_portfolio` | Pulls positions and balances into `~/.dexter/PORTFOLIO.md` | "Sync my tastytrade positions to PORTFOLIO.md" |

### Market Data

| Tool | What it does | Example prompt |
|------|-------------|----------------|
| `tastytrade_quote` | Real-time quote (bid, ask, mark, last) for any symbol | "Quote AAPL" |
| `tastytrade_option_chain` | Nested option chain with expirations, strikes, call/put symbols | "Show the SPY option chain" |
| `tastytrade_symbol_search` | Search symbols by prefix | "Search for symbols starting with TSLA" |

### Theta Engine (Phase 5)

These are the core options workflows. They all respect your `THETA-POLICY.md`.

| Tool | What it does | Example prompt |
|------|-------------|----------------|
| `tastytrade_theta_scan` | Scans for theta setups across your allowed underlyings. Returns ranked candidates with credit, max loss, and policy compliance. | "Scan for the safest theta trade today" |
| `tastytrade_position_risk` | Enriches your live positions with DTE, delta, concentration %, buying power usage, and challenged-position flags | "Show my position risk" |
| `tastytrade_strategy_preview` | Builds a full trade memo (thesis, legs, risk, exit plan) and runs a dry-run | "Preview a 5-wide SPY put credit spread at 650/645 expiring next Friday" |
| `tastytrade_roll_short_option` | Builds a roll candidate for a short option (buy-to-close + sell-to-open) and dry-runs it | "Roll my short SPY 660 put to next week" |
| `tastytrade_repair_position` | Analyzes a challenged short option and recommends hold, roll, close, or assignment | "My short AAPL 200 put is ITM — what should I do?" |

### Order Flow (requires `TASTYTRADE_ORDER_ENABLED=true`)

| Tool | What it does | Example prompt |
|------|-------------|----------------|
| `tastytrade_order_dry_run` | Validates an order and shows buying power / fee impact without submitting | "Dry-run this order" |
| `tastytrade_submit_order` | Submits an order to the market (after dry-run confirmation) | "Submit the order" |
| `tastytrade_cancel_order` | Cancels a working order by ID | "Cancel order 12345" |

---

## 3. THETA-POLICY.md

Your theta policy file lives at `~/.dexter/THETA-POLICY.md`. It controls what the theta engine is allowed to do.

### What each field does

| Field | Purpose | Example |
|-------|---------|---------|
| **Allowed underlyings** | Default scan universe. Align with SOUL.md: thesis names you're willing to sell options on (e.g. TSM, AMAT, MSTR, MSTY) plus indices if desired. Override per-scan with `underlyings_csv`. | `SPX, SPY, QQQ, TSM, AMAT, MSTR, MSTY` |
| **No-call list** | Covered-call suggestions are blocked on these tickers (protects core long-term holdings from being called away) | `NVDA, TSM, ASML` |
| **Short delta range** | Only suggest short options with delta in this range (lower = further OTM = safer) | `0.10-0.20` |
| **DTE range** | Only suggest options expiring within this window (days to expiration) | `0-45` |
| **Max risk per trade** | Candidates whose max loss exceeds this % of total equity are hard-blocked | `30%` |
| **Max buying power usage** | Candidates whose BP requirement exceeds this % of equity are hard-blocked | `50%` |
| **Exclude earnings days** | Skip underlyings with earnings within this many days (avoids vol crush / gap risk) | `2` |

### How policy enforcement works

- **Hard block** — if a candidate violates any policy field, it is excluded from the results entirely. You only see compliant trades.
- **Portfolio fit** — candidates are also checked against SOUL.md and PORTFOLIO.md. Selling calls on a SOUL "Core Compounder" is blocked. Selling puts that would increase concentration beyond target weight triggers a warning.
- **Override per-scan** — you can pass explicit parameters (e.g. `underlyings_csv`, `min_dte`, `short_delta_min`) to override policy defaults for a single scan without editing the file.

### Example policy

**Allowed underlyings must be SOUL.md thesis names with liquid US equity options** — not generic indices. The defaults in code (and this example) are drawn directly from SOUL.md layers. Do not default to SPX/SPY/QQQ; those are the old fallback. Indices are optional — add them only if you want index-specific premium.

```markdown
# THETA POLICY

# SOUL.md thesis names with liquid options on tastytrade:
# Layer 1 (Chip): AAPL, AMD, AVGO
# Layer 2 (Foundry): TSM
# Layer 3 (Equipment): AMAT, ASML, LRCX, KLAC
# Layer 5 (Power): VRT, CEG
# Layer 6 (Memory): MU
# Layer 7 (Networking): ANET
# Cyclical/Adjacent: PLTR, MSFT, AMZN, META, COIN
Allowed underlyings: AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN

# Core Compounders — block covered calls so they can't be called away.
# Puts and spreads remain valid (good for building positions at better prices).
No-call list: TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG

Short delta range: 0.10-0.20
DTE range: 0-45
Max risk per trade: 3%
Max buying power usage: 50%
Exclude earnings days: 2
```

**Why not NVDA, MSTR, SPX/SPY/QQQ?**  
**Why not AAPL, MSFT, AMZN, META, COIN, etc.?**

| Excluded | Reason |
|----------|--------|
| AAPL, AMD, AVGO, PLTR, MSFT, AMZN, META, COIN, BTC, SOL, SUI, NEAR, … | **Hyperliquid-tradable** — zero-overlap policy; tastytrade sleeve is for non-HL assets only. Use PORTFOLIO-HYPERLIQUID.md and HL tools for these. |
| NVDA | SOUL "Avoid/Too Crowded" — thin edge for new positions |
| MSTR | SOUL "Avoid" — financial engineering, no durable bottleneck |
| SPX, SPY, QQQ, IWM | Generic indices — not in the thesis; add manually if you want index theta |
| HYPE, SOL, NEAR, SUI | Crypto-only on tastytrade — no US equity options |
| BESI/BESIY, TEL/TOELY | ADRs with typically thin option markets |

---

## 4. Common Workflows

### "What's the safest trade today?"

Use THETA-POLICY defaults (underlyings should be set from SOUL.md). No need to say "focus on SPX, SPY, QQQ" — the scan uses your policy list.

```
Scan for the safest theta trade in my tastytrade account today. Use THETA-POLICY defaults. Return the top 2 candidates with strategy, strikes, expiration, credit, max loss, and which one fits my current book best.
```

Dexter will: fetch your account → load balances/positions → scan option chains → filter by policy → rank by score → return candidates with strikes, credit, max loss, and policy notes.

### "Check my portfolio risk"

```
Show my position risk.
```

Returns every open position enriched with DTE, delta exposure, theta, concentration %, and flags any challenged shorts (ITM or near-expiry).

### "Preview a specific trade"

```
Preview a SPY 650/645 put credit spread expiring March 21.
```

Builds a trade memo with legs, credit, max loss, breakeven, buying power effect, and runs a tastytrade dry-run to validate the order.

### "Roll a challenged position"

```
Roll my short SPY 660 put to next Friday, same strike.
```

Finds your existing short, builds a buy-to-close + sell-to-open roll, shows the net credit/debit, and dry-runs the order.

### "Sync broker to PORTFOLIO.md"

```
Sync my tastytrade positions to PORTFOLIO.md.
```

Pulls all positions and balances, builds a weight-per-ticker table, and writes it to `~/.dexter/PORTFOLIO.md` so heartbeat and rebalance tools see your actual holdings.

### "Scan individual stocks, not just indices"

```
Scan AAPL, MSFT, AMZN, TSLA for credit spreads.
```

You can scan any ticker — you don't have to stick to the THETA-POLICY defaults. The policy's `Allowed underlyings` is just the default when you don't specify.

---

## 5. What Can I Buy?

tastytrade supports **equities**, **options**, and **crypto**. Dexter uses the same order tools for all of them. You need `TASTYTRADE_ORDER_ENABLED=true` in `.env` for any live submission; **dry-run is always available** in read-only mode so you can validate orders without sending them.

| Asset type | Supported | Example |
|------------|-----------|--------|
| **Equity (shares)** | Yes | MSTY, MSTR, AAPL, SPY — any listed stock or ETF |
| **Options** | Yes | MSTR options, SPY/SPX/QQQ options — full chains |
| **Crypto (spot)** | Yes | BTC, ETH, SOL, etc. (requires crypto trading permissions on your tastytrade account) |

### Example prompts

- **Buy equity:** "Buy 10 shares of MSTR" / "Buy 5 shares of MSTY" — Dexter will build the order and run a dry-run; with trading enabled you can confirm to submit.
- **Buy/sell options:** "Buy 1 MSTR 400 call expiring March 21" or use the strategy preview: "Preview buying 1 MSTR 400 call expiring March 21" then submit if you confirm.
- **Buy BTC:** "Buy $500 of BTC" or "Buy 0.01 BTC" — tastytrade supports spot crypto (symbol typically BTC/USD); enable crypto permissions in your account if you haven’t already.

Order flow is generic: Dexter (and the tastytrade API) accepts equity, option, and crypto orders. There are no separate "crypto-only" tools — use the same dry-run and submit workflow. For keep/close/add analysis on a position (e.g. your MSTY shares), ask in natural language: "Should I keep or close my MSTY position given my thesis?" Dexter uses your positions, balances, and SOUL.md to reason about it.

### SOUL.md tickers and tastytrade symbols

SOUL.md references some tickers that are not US exchange symbols or that need a different symbol on tastytrade. Use this mapping when asking Dexter to quote, scan, or order names from your thesis.

| SOUL ticker | On tastytrade | Notes |
|-------------|---------------|--------|
| **BESI** | Use **BESIY** | BESI is Euronext Amsterdam; the US ADR is BESIY. Use BESIY for quotes, options, and orders. |
| **TEL** | Use **TOELY** (if supported) | Tokyo Electron trades in the US as ADR TOELY (OTC). If tastytrade supports OTC symbols, use TOELY; otherwise the name may be unavailable. |
| **HYPE** | Not a US equity | HYPE is the Hyperliquid crypto token (or a Swiss ETP). On tastytrade it is not a listed stock; check if HYPE is in their crypto list. For "onchain stocks" exposure, use equity names from SOUL that trade onchain (e.g. via HIP-3), not the HYPE ticker as a stock. |
| **SOL, NEAR, SUI, ETH** | As **crypto** only | These are crypto in SOUL (agentic web4). On tastytrade they are traded as crypto, not as equity tickers. Use crypto prompts (e.g. "Buy $X of SOL") if supported. |
| All other US names (e.g. NVDA, TSM, AMAT, MSTY, MSTR) | Use as-is | Standard US equities/ETFs; no mapping needed. |

When in doubt, use `tastytrade_symbol_search` to resolve a name to a symbol before quoting or ordering.

---

## 6. Maximising Dexter as your tastytrade consultant

Dexter can advise **what to buy** (and what to avoid) by combining three things: your **live tastytrade account** (positions, balances), your **thesis** (SOUL.md), and your **target portfolio** (PORTFOLIO.md). Use the prompts below so the model consistently pulls all three and gives concrete, thesis-aligned suggestions.

### One-time: sync broker → portfolio

So that “target vs actual” and “underweight/overweight” make sense, sync first:

```
Sync my tastytrade positions to PORTFOLIO.md.
```

After that, PORTFOLIO.md reflects your tastytrade holdings and heartbeat/rebalance logic can compare to SOUL and targets.

### “What should I buy with my current buying power?”

```
Using my tastytrade positions and balances, SOUL.md, and PORTFOLIO.md: what should I consider buying with my available buying power? Give 1–3 concrete ideas (equity tickers or option strategies). For each: ticker/strategy, why it fits the thesis, rough size or “start small”, and whether to use shares, a put, or a spread. If something is on my Avoid list or would break policy, say so.
```

Dexter will read your account, SOUL (Core/Avoid/watchlist), and targets, then suggest buys that fit.

### “Am I underweight or overweight vs my thesis?”

```
Compare my tastytrade positions to SOUL.md and PORTFOLIO.md. List: (1) where I’m underweight vs target or thesis, (2) where I’m overweight, (3) 1–3 specific buys to move toward the target portfolio, and (4) any ticker I hold that’s on the Avoid list and what to do about it.
```

Surfaces gaps and concrete next buys (equity or options as appropriate).

### “Keep, add, or trim a position?”

```
I hold [e.g. MSTY] in tastytrade. Given SOUL.md and my other positions, should I keep it, add, trim, or close? If add/trim, suggest a size or dollar amount. If options (e.g. sell put on MSTR), say so and I’ll run a strategy preview next.
```

Use for any single position; Dexter reasons over thesis, concentration, and alternatives.

### “Best use of a fixed amount of cash?”

```
I want to deploy $[X] in my tastytrade account. Given SOUL.md and my current positions, what’s the best use: one name, or split across 2–3? Prefer thesis-aligned equity or a defined-risk option (e.g. put spread) if it fits. Then preview one idea with the strategy preview tool.
```

Forces prioritisation and ties the suggestion to a concrete preview.

### Why this works

- **Positions + balances** come from tastytrade tools (accounts, positions, balances).
- **Thesis and targets** come from SOUL.md and PORTFOLIO.md (and optional HEARTBEAT).
- **Options detail** comes from theta scan and strategy preview when the suggestion is a spread or single option.

No new tools are required. Using these prompts regularly makes Dexter your default consultant for “what to buy through tastytrade” in a way that stays aligned with your thesis and risk.

---

## 7. Operator States

| State | What works | How to get there |
|-------|-----------|-----------------|
| **Not connected** | Nothing — Dexter tells you to set up env vars | Missing `TASTYTRADE_CLIENT_ID` / `TASTYTRADE_CLIENT_SECRET` |
| **Read-only** | Accounts, balances, positions, quotes, option chains, theta scan, strategy preview, order dry-run | Set env vars + valid credentials in `~/.dexter/tastytrade-credentials.json` |
| **Trading enabled** | Everything above + live order submission and cancellation | Add `TASTYTRADE_ORDER_ENABLED=true` to `.env` |

---

## 8. Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| "Grant revoked" or "refresh failed" | Refresh token expired or was generated for the wrong environment (sandbox vs production) | Generate a new token from [my.tastytrade.com](https://my.tastytrade.com) and update `~/.dexter/tastytrade-credentials.json`. Make sure `TASTYTRADE_SANDBOX` matches. |
| "No tastytrade account found" | Auth succeeded but account parsing failed, or credentials haven't been loaded yet | Restart Dexter after saving credentials |
| Balances show $0 | API response parsing issue | Make sure you're on the latest code; this was fixed in the balance-parsing update |
| Theta scan returns 0 candidates | Policy is too tight for your account size, or DTE/delta range excludes everything | Check `~/.dexter/THETA-POLICY.md`. Raise `Max risk per trade` or widen DTE/delta range. |
| 404 on market data | Stale code using wrong API endpoint | Pull latest code — the quotes endpoint was corrected to `GET /market-data?symbols=...` |
| Order submission blocked | `TASTYTRADE_ORDER_ENABLED` not set or set to `false` | Add `TASTYTRADE_ORDER_ENABLED=true` to `.env` (only if you want live trading) |

---

## 9. File Locations

| File | Purpose |
|------|---------|
| `.env` | `TASTYTRADE_CLIENT_ID`, `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_SANDBOX`, `TASTYTRADE_ORDER_ENABLED` |
| `~/.dexter/tastytrade-credentials.json` | OAuth refresh token and cached access token |
| `~/.dexter/THETA-POLICY.md` | Theta scan defaults: allowed underlyings, delta/DTE range, risk caps |
| `~/.dexter/PORTFOLIO.md` | Portfolio file updated by `tastytrade_sync_portfolio` |
| `docs/PRD-TASTYTRADE-INTEGRATION.md` | Technical PRD for the integration (Phases 1–4) |
| `docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md` | Technical PRD for the theta engine (Phase 5) |
| `docs/TASTYTRADE-SYMBOLOGY.md` | OCC option symbol format reference |

---

## 10. Related

- [SOUL.md](../SOUL.md) — investment thesis that informs portfolio fit checks
- [EXTERNAL-RESOURCES.md](EXTERNAL-RESOURCES.md) — links to AI Hedge Fund and other research tools
- [ULTIMATE-TEST-QUERIES.md](ULTIMATE-TEST-QUERIES.md) — copy-paste query library including tastytrade prompts
