/**
 * Rich description for the financial_metrics tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FINANCIAL_METRICS_DESCRIPTION = `
Intelligent meta-tool for fundamental analysis and financial metrics. Takes a natural language query and routes to financial statements and key ratios tools.

## When to Use

- Income statement data (revenue, gross profit, operating income, net income, EPS)
- Balance sheet data (assets, liabilities, equity, debt, cash)
- Cash flow data (operating cash flow, investing cash flow, financing cash flow, free cash flow)
- Financial metrics (P/E ratio, EV/EBITDA, ROE, ROA, margins, dividend yield)
- Trend analysis across multiple periods
- Multi-company fundamental comparisons

## When NOT to Use

- Stock prices (use financial_search)
- SEC filings content (use financial_search)
- Company news (use financial_search)
- Analyst estimates (use financial_search)
- Non-financial data (use web_search)

## Usage Notes

- Call ONCE with full natural language query
- Handles ticker resolution (Apple -> AAPL)
- Handles date inference ("last 5 years", "Q3 2024")
- For "current" metrics, uses snapshot tools; for "historical", uses time-series tools
`.trim();
