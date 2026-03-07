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
Validate an order without submitting. Returns buying power effect, fees, and order summary. Always use before submit_order so the user can confirm. Order must be valid JSON matching tastytrade order schema (time-in-force, order-type, legs, price/value). See developer.tastytrade.com order submission. Requires TASTYTRADE_ORDER_ENABLED=true.
`.trim();

export const TASTYTRADE_SUBMIT_ORDER_DESCRIPTION = `
Submit an order to the market. High risk: only when the user has explicitly asked to place the order and has confirmed (e.g. after seeing dry_run results). Order must be valid JSON matching tastytrade order schema. Prefer order_dry_run first. Requires TASTYTRADE_ORDER_ENABLED=true.
`.trim();

export const TASTYTRADE_CANCEL_ORDER_DESCRIPTION = `
Cancel an open order by order id. Use after tastytrade_live_orders to get the order id. Only cancels working/pending orders. Requires TASTYTRADE_ORDER_ENABLED=true.
`.trim();

export const TASTYTRADE_SYNC_PORTFOLIO_DESCRIPTION = `
Sync portfolio from tastytrade: fetch positions and balances, build a PORTFOLIO.md-style table (Ticker | Weight | Layer | Tier), and optionally write to ~/.dexter/PORTFOLIO.md. Use when the user says "sync my portfolio from tastytrade" or "update PORTFOLIO from broker". Weights are derived from position value / total equity; Layer and Tier are left as — (user or SOUL.md can fill). Set write_to_portfolio=true to overwrite PORTFOLIO.md; otherwise returns markdown for the user to review.
`.trim();

export const TASTYTRADE_POSITION_RISK_DESCRIPTION = `
Enrich live tastytrade positions into a decision-ready risk view. Use when the user asks about portfolio theta, option DTE, assignment risk, concentration, or which short positions are challenged. Returns normalized positions, concentration by underlying, portfolio theta/delta (when available), buying power usage, and flagged challenged shorts.
`.trim();

export const TASTYTRADE_THETA_SCAN_DESCRIPTION = `
Scan theta setups on tastytrade for covered calls, cash-secured puts, credit spreads, or iron condors. Use when the user asks "what theta trade should I do?", "best 0DTE setup", "scan SPX/SPY/QQQ income trades", or "show safest income trade". Respects THETA-POLICY defaults when present and returns ranked candidates with legs, credit, max loss, policy notes, and order_json for preview/dry-run.
`.trim();

export const TASTYTRADE_STRATEGY_PREVIEW_DESCRIPTION = `
Build a trade memo for a candidate or manual order, and run tastytrade dry-run when order flow is enabled. Use after tastytrade_theta_scan and before submit_order. Returns trade thesis, legs, premium type, estimated max loss, breakevens, exit / roll plan, and dry-run result if available.
`.trim();

export const TASTYTRADE_ROLL_SHORT_OPTION_DESCRIPTION = `
Build a later-dated roll candidate for a short option and optionally dry-run it. Use when the user says "roll this short put/call", "move this position out a week", or after a short option becomes challenged. Returns current position, target contract, net credit/debit, and order_json for explicit confirmation before submit.
`.trim();

export const TASTYTRADE_REPAIR_POSITION_DESCRIPTION = `
Analyze a challenged short option and recommend hold, roll, close now, or possible assignment. Use when the user asks "how should I repair this position?", "should I roll or take assignment?", or "this short option is in trouble". Returns a recommendation, alternatives, and roll order_json when applicable.
`.trim();
