/**
 * Rich description for the financial_search tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FINANCIAL_SEARCH_DESCRIPTION = `
Intelligent meta-tool for financial data research. Takes a natural language query and automatically routes to appropriate data sources: SEC EDGAR for fundamentals, Yahoo Finance for prices, and Finnhub for news.

## When to Use

- Company facts (name, CIK, SIC code, state, fiscal year end, exchanges, addresses)
- Stock prices (current snapshots or historical data, via Yahoo Finance)
- Company financials (income statements, balance sheets, cash flow from SEC EDGAR XBRL)
- Financial metrics (margins, ROE, ROA, current ratio, debt-to-equity, EPS from EDGAR)
- Current P/E ratio and market cap (via Yahoo Finance + EDGAR)
- Company news (via Finnhub, requires FINNHUB_API_KEY)
- Insider trading activity (Form 4 filings from SEC EDGAR)
- Cryptocurrency prices (via Yahoo Finance, e.g., BTC-USD, ETH-USD)
- Multi-company comparisons (pass the full query, it handles routing internally)

## When NOT to Use

- General web searches or non-financial topics (use web_search instead)
- Questions that don't require external financial data (answer directly from knowledge)
- Non-public company information
- Analyst estimates or price targets (not available)
- Revenue segment breakdowns (not available)

## Usage Notes

- Call ONCE with the complete natural language query - the tool handles complexity internally
- For comparisons like "compare AAPL vs MSFT revenue", pass the full query as-is
- Handles ticker resolution automatically (Apple -> AAPL, Microsoft -> MSFT)
- Handles date inference (e.g., "last quarter", "past 5 years", "YTD")
- Returns structured JSON data with source URLs for verification
- Financial statements come from official SEC EDGAR XBRL filings
- Price data comes from Yahoo Finance (no API key required)
- News requires FINNHUB_API_KEY environment variable
`.trim();
