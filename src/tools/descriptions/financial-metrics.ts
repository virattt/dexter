/**
 * Rich description for the financial_metrics tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FINANCIAL_METRICS_DESCRIPTION = `
Intelligent meta-tool for fundamental analysis and financial metrics. Data sourced from SEC EDGAR XBRL filings (free) and Yahoo Finance for market-based metrics.

## When to Use

- Income statement data (revenue, gross profit, operating income, net income, EPS)
- Balance sheet data (assets, liabilities, equity, debt, cash)
- Cash flow data (operating cash flow, investing cash flow, financing cash flow, free cash flow)
- Profitability ratios (gross margin, operating margin, net margin, ROE, ROA)
- Leverage/liquidity ratios (debt-to-equity, current ratio)
- Current P/E ratio and market cap (via Yahoo Finance + EDGAR)
- Trend analysis across multiple periods
- Multi-company fundamental comparisons

## When NOT to Use

- Stock prices (use financial_search)
- SEC filings content (use read_filings)
- Company news (use financial_search)
- Analyst estimates (not available)
- Revenue segments (not available)
- Historical P/E or EV/EBITDA over time (only current snapshot available)
- Non-financial data (use web_search)

## Usage Notes

- Call ONCE with full natural language query
- Handles ticker resolution (Apple -> AAPL)
- Handles date inference ("last 5 years", "Q3 2024")
- For "current" metrics with P/E, uses snapshot (EDGAR + Yahoo Finance)
- For "historical" ratios, computes from EDGAR XBRL data only
`.trim();
