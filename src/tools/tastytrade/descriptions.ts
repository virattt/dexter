export const TASTYTRADE_ACCOUNTS_DESCRIPTION = `
List linked tastytrade accounts (account numbers and nicknames). Use when the user asks about their tastytrade accounts, which account to use, or before fetching balances/positions for a specific account. Requires tastytrade OAuth (see docs/PRD-TASTYTRADE-INTEGRATION.md).
`.trim();

export const TASTYTRADE_BALANCES_DESCRIPTION = `
Fetch account balances for a tastytrade account (equity, cash, margin, buying power). Use when the user asks "what's my balance?", "how much buying power?", or "account equity" for tastytrade. Provide account_number from tastytrade_accounts if the user has multiple accounts.
`.trim();

export const TASTYTRADE_POSITIONS_DESCRIPTION = `
Fetch current positions (stocks, options, futures) for a tastytrade account. Use when the user asks "what are my positions?", "what do I own?", "show my tastytrade holdings", or to sync portfolio from tastytrade. Provide account_number from tastytrade_accounts if the user has multiple accounts.
`.trim();

export const TASTYTRADE_OPTION_CHAIN_DESCRIPTION = `
Fetch nested option chain for an underlying symbol (e.g. SPY, AAPL, NVDA). Returns expirations and strikes with call/put symbols and streamer symbols. Use for "show me AAPL option chain", "0DTE SPX strikes", "next week's SPY options", or when analyzing IV, strikes, or building spreads.
`.trim();

export const TASTYTRADE_QUOTE_DESCRIPTION = `
Fetch live quote (bid, ask, mark, last, volume) for one or more symbols. Use for "what's SPY trading at?", "quote for NVDA", or when you need current price for equities or indices from tastytrade. For options use tastytrade_option_chain or pass option symbols with instrument_type.
`.trim();

export const TASTYTRADE_SYMBOL_SEARCH_DESCRIPTION = `
Search tastytrade symbols by prefix or phrase. Use to resolve ticker names to symbols, find option symbols, or discover symbols before calling quote or option_chain. Returns symbol and description.
`.trim();

export const TASTYTRADE_LIVE_ORDERS_DESCRIPTION = `
List live and recent orders for a tastytrade account (working, filled, cancelled in last 24h). Use when the user asks "what are my open orders?", "show my orders", or before cancelling a specific order. Requires TASTYTRADE_ORDER_ENABLED=true.
`.trim();

export const TASTYTRADE_ORDER_DRY_RUN_DESCRIPTION = `
Validate an order without submitting. Returns buying power effect, fees, and order summary. Available in read-only mode (no live trading required). Always use before submit_order when the user intends to place an order. Order must be valid JSON matching tastytrade order schema (time-in-force, order-type, legs, price/value). See developer.tastytrade.com order submission.
`.trim();

export const TASTYTRADE_SUBMIT_ORDER_DESCRIPTION = `
Submit an order to the market. REQUIRES EXPLICIT USER APPROVAL: call only after the user has confirmed they want to place the order (e.g. after seeing tastytrade_order_dry_run or tastytrade_strategy_preview). Default path: always use tastytrade_order_dry_run or tastytrade_strategy_preview first; never auto-submit. Order must be valid JSON matching tastytrade order schema. Requires TASTYTRADE_ORDER_ENABLED=true.
`.trim();

export const TASTYTRADE_CANCEL_ORDER_DESCRIPTION = `
Cancel an open order by order id. REQUIRES EXPLICIT USER APPROVAL: call only when the user has asked to cancel a specific order and confirmed. Use after tastytrade_live_orders to get the order id. Only cancels working/pending orders. Requires TASTYTRADE_ORDER_ENABLED=true.
`.trim();

export const TASTYTRADE_SYNC_PORTFOLIO_DESCRIPTION = `
Sync portfolio from tastytrade: fetch positions and balances, build a PORTFOLIO.md-style table (Ticker | Weight | Layer | Tier), and optionally write to ~/.dexter/PORTFOLIO.md. Use when the user says "sync my portfolio from tastytrade" or "update PORTFOLIO from broker". Weights are derived from position value / total equity; Layer and Tier are left as — (user or SOUL.md can fill). Set write_to_portfolio=true to overwrite PORTFOLIO.md; otherwise returns markdown for the user to review.
`.trim();

export const TASTYTRADE_POSITION_RISK_DESCRIPTION = `
Enrich live tastytrade positions into a decision-ready risk view. Use when the user asks about portfolio theta, option DTE, assignment risk, concentration, or which short positions are challenged. Returns normalized positions, concentration by underlying, portfolio theta/delta (when available), buying power usage, and flagged challenged shorts.
`.trim();

export const TASTYTRADE_THETA_SCAN_DESCRIPTION = `
Scan theta setups on tastytrade for covered calls, cash-secured puts, credit spreads, or iron condors. Use when the user asks "what theta trade should I do?", "best 0DTE setup", "safest income trade", or "scan for theta". For execution on tastytrade: focus on SOUL.md non-crypto underlyings only (equities from THETA-POLICY — equipment, foundry, chip, power, memory, networking); do not default to SPX/SPY/QQQ or crypto/IBIT unless the user explicitly asks for BTC advice. Prefer underlyings from SOUL.md when set in THETA-POLICY (Allowed underlyings). Policy is enforced as a hard block: only THETA-POLICY-compliant candidates with portfolio_fit pass are returned. Output includes policy_mode: "hard_block", excluded_by_policy (with reason buckets), excluded_by_earnings, and when earnings exclusion is requested but FINANCIAL_DATASETS_API_KEY is missing, earnings_exclusion_degraded. When no candidates pass, returns no_candidates with next_steps. Respects THETA-POLICY defaults when present; returns ranked candidates with legs, credit, max loss, table_summary (strike, APR-like, prob), and order_json for preview/dry-run. For BTC options (advisory for Hypersurface — secured puts/covered calls you execute on Hypersurface, not tastytrade): use underlyings_csv=IBIT (or BITO), min_dte=1, max_dte=7 when user asks for "BTC strike advice" or "optimal strike for BTC next week"; ensure IBIT is in THETA-POLICY for the scan (see /theta-btc-weekly).
`.trim();

export const TASTYTRADE_STRATEGY_PREVIEW_DESCRIPTION = `
Build a trade memo for a candidate or manual order and run tastytrade dry-run (always in read-only mode). Use after tastytrade_theta_scan and before submit_order. The proposed order is validated against THETA-POLICY before dry-run; if it violates (e.g. disallowed underlying, no-call list, DTE bounds), returns policy_blocked: true and a violations list—do not recommend. When compliant, returns policy_blocked: false, trade thesis, legs, premium type, estimated max loss, breakevens, portfolio_fit, exit/roll plan, and dry-run result. Use tastytrade_submit_order only after the user explicitly confirms (and only when TASTYTRADE_ORDER_ENABLED=true).
`.trim();

export const TASTYTRADE_ROLL_SHORT_OPTION_DESCRIPTION = `
Build a later-dated roll candidate for a short option and run dry-run (always in read-only mode). The roll is validated against THETA-POLICY (allowed underlyings, no-call list, DTE range); if violated returns policy_blocked: true and violations. Use when the user says "roll this short put/call", "move this position out a week", or after a short option becomes challenged. Returns current position, target contract, net credit/debit, dry_run_result, order_json, and policy_blocked when applicable. Use tastytrade_submit_order only after the user explicitly confirms (and only when TASTYTRADE_ORDER_ENABLED=true).
`.trim();

export const TASTYTRADE_REPAIR_POSITION_DESCRIPTION = `
Analyze a challenged short option and recommend hold, roll, close now, or possible assignment. When a roll candidate exists, it is checked against THETA-POLICY; alternatives.roll includes policy_blocked, policy_violations, and policy_note. Use when the user asks "how should I repair this position?", "should I roll or take assignment?", or "this short option is in trouble". Returns a recommendation, alternatives (with roll order_json and policy status when applicable).
`.trim();

export const TASTYTRADE_TRANSACTIONS_DESCRIPTION = `
Fetch transaction history for a tastytrade account. Use when the user asks "what did I trade", "transaction history", "realized P&L", "win rate on my theta trades", or "closed trades this month". Optional start_date and end_date (YYYY-MM-DD) and type (e.g. Trade, Money Movement). Returns list of transactions with date, type, symbol, action, quantity, value, fees.
`.trim();

export const TASTYTRADE_EARNINGS_CALENDAR_DESCRIPTION = `
Show upcoming earnings dates for tickers. Use when the user asks "when is AAPL earnings", "earnings calendar", "which holdings have earnings soon", or to avoid theta trades before earnings. Optional tickers_csv; defaults to THETA-POLICY allowed underlyings. Set include_positions=true to add current tastytrade position underlyings. within_days limits how far ahead to show (default 14). Returns next_earnings date and days_until; flags within_7_days.
`.trim();

export const TASTYTRADE_WATCHLIST_DESCRIPTION = `
List, create, update, or delete tastytrade watchlists; or scan a watchlist for quotes. Actions: list (all watchlists), create (name + optional symbols_csv), add_symbols (name + symbols_csv), remove_symbols (name + symbols_csv), delete (name), scan (name — fetches quotes for all symbols and marks theta-policy alignment).
`.trim();

export const TASTYTRADE_RISK_METRICS_DESCRIPTION = `
Portfolio risk scorecard: concentration (Herfindahl index, top-5 weight %), aggregate theta and delta exposure, buying power utilization %. Use when the user asks "portfolio risk", "concentration", "how much theta/delta", "buying power used", or "risk metrics". Beta and max drawdown require financial_search and transaction history respectively.
`.trim();
