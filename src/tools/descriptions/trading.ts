/**
 * Rich description for the trading meta-tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TRADING_DESCRIPTION = `
Intelligent trading assistant powered by Alpaca. Takes a natural language query and routes to appropriate trading tools for account management, order execution, position tracking, and technical analysis.

## When to Use

- Checking account status (equity, buying power, cash balance)
- Viewing open positions and P&L
- Placing buy/sell orders (market, limit, stop, stop_limit)
- Canceling pending orders
- Viewing order history
- Technical analysis (RSI, MACD, Bollinger Bands, EMA/SMA, ATR, Stochastic, VWAP)
- Combined analysis + trading workflows

## When NOT to Use

- Fundamental analysis (use financial_search or financial_metrics)
- Company news or SEC filings (use financial_search or read_filings)
- General web searches (use web_search)
- Questions that don't involve trading or technical analysis

## CRITICAL SAFETY RULES

- **Never execute trades without explicit user confirmation** — always show order details and ask "confirm?" first
- **Analysis ≠ execution** — "should I buy X?" means analyze, NOT place an order
- **Always indicate mode** — every response must show PAPER or LIVE mode
- **Position limits** — warns at >5% of equity, refuses at >20%

## Usage Notes

- Call ONCE with the full natural language query — routing is handled internally
- Handles both stocks (AAPL) and crypto (BTC/USD) on Alpaca
- Default mode is PAPER (simulated) — safe for testing
- For "buy X" queries: shows account + order preview, requires confirmation before executing
- For "analyze X" queries: runs technical analysis without placing orders
`.trim();
