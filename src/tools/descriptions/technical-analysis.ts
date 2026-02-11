/**
 * Rich description for the technical_analysis tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TECHNICAL_ANALYSIS_DESCRIPTION = `
Performs technical analysis on stocks and cryptocurrencies. Fetches historical OHLCV data and computes indicators: RSI, MACD, EMA (12/26), SMA (20/50), Bollinger Bands, ATR, Stochastic Oscillator, and VWAP. Returns individual signals and an overall bullish/bearish/neutral assessment.

## When to Use

- Technical analysis on a stock or crypto ("analyze AAPL technicals", "RSI for TSLA")
- Trading signal generation (overbought/oversold, trend direction, momentum)
- Support/resistance analysis via Bollinger Bands
- Volatility assessment via ATR
- Volume analysis via VWAP
- Comparing current price to moving averages

## When NOT to Use

- Fundamental analysis (use financial_search or financial_metrics)
- Company news or SEC filings (use financial_search or read_filings)
- Placing trades or managing orders (use trading tool)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with the ticker and desired period — computes all indicators by default
- Supports stocks (AAPL, MSFT) and crypto (BTC-USD, ETH-USD)
- Available periods: 1w, 1m, 3m (default), 6m, 1y
- Can filter to specific indicators via the indicators parameter
- Returns structured signals with interpretations for each indicator
- Overall summary aggregates all signals into bullish/bearish/neutral
`.trim();
