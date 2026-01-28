/**
 * Rich description for the financial_search tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FINANCIAL_SEARCH_DESCRIPTION = `
Intelligent meta-tool for financial data research. Takes a natural language query and automatically routes to appropriate financial data sources including stock prices, company financials, SEC filings, analyst estimates, and more.

## When to Use

- Company facts (sector, industry, market cap, number of employees, listing date, exchange, location, weighted average shares, website)
- Stock prices (current snapshots or historical data)
- Company financials (income statements, balance sheets, cash flow statements)
- Financial metrics (P/E ratio, market cap, EPS, dividend yield, enterprise value)
- SEC filings (10-K annual reports, 10-Q quarterly reports, 8-K current reports)
- Analyst estimates and price targets
- Company news and announcements
- Insider trading activity
- Cryptocurrency prices
- Revenue segment breakdowns
- Multi-company comparisons (pass the full query, it handles routing internally)

## When NOT to Use

- General web searches or non-financial topics (use web_search instead)
- Questions that don't require external financial data (answer directly from knowledge)
- Non-public company information
- Real-time trading or order execution

## Usage Notes

- Call ONCE with the complete natural language query - the tool handles complexity internally
- For comparisons like "compare AAPL vs MSFT revenue", pass the full query as-is
- Handles ticker resolution automatically (Apple -> AAPL, Microsoft -> MSFT)
- Handles date inference (e.g., "last quarter", "past 5 years", "YTD")
- Returns structured JSON data with source URLs for verification
`.trim();
