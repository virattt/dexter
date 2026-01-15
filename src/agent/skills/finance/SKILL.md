---
name: finance
description: Financial data retrieval and analysis. Use for stock prices, company financials, SEC filings, market metrics, analyst estimates, and cryptocurrency data.
tools:
  - get_price_snapshot
  - get_prices
  - get_income_statements
  - get_balance_sheets
  - get_cash_flow_statements
  - get_all_financial_statements
  - get_financial_metrics_snapshot
  - get_financial_metrics
  - get_filings
  - get_10k_filing_items
  - get_10q_filing_items
  - get_8k_filing_items
  - get_analyst_estimates
  - get_segmented_revenues
  - get_insider_trades
  - get_news
  - get_crypto_price_snapshot
  - get_crypto_prices
  - get_crypto_tickers
---

# Finance Skill

## When to Use

Use this skill for queries about:
- Stock prices (current or historical)
- Company financials (income statements, balance sheets, cash flow)
- Financial metrics (P/E ratio, market cap, EPS, etc.)
- SEC filings (10-K, 10-Q, 8-K)
- Analyst estimates and price targets
- Revenue breakdown by segment
- Insider trading activity
- Company news
- Cryptocurrency prices

## Workflow Patterns

### Quick Price Check
Use `get_price_snapshot` for the current stock price of a single ticker.

### Historical Price Analysis
Use `get_prices` with a date range for historical price data. Supports daily, weekly, monthly intervals.

### Company Financial Overview
1. `get_financial_metrics_snapshot` for key metrics (P/E, market cap, etc.)
2. `get_income_statements` for revenue and earnings
3. `get_balance_sheets` for assets and liabilities

### Deep Financial Analysis
Use `get_all_financial_statements` to get income statement, balance sheet, and cash flow in one call.

### SEC Filings Research
1. `get_filings` to list available filings
2. `get_10k_filing_items` or `get_10q_filing_items` for specific sections

### Valuation Analysis
1. `get_financial_metrics` for historical metrics
2. `get_analyst_estimates` for forward-looking estimates

### Cryptocurrency
- `get_crypto_tickers` to find available crypto symbols
- `get_crypto_price_snapshot` for current price
- `get_crypto_prices` for historical data

## Tool Reference

| Tool | Use Case |
|------|----------|
| get_price_snapshot | Current stock price |
| get_prices | Historical price data |
| get_income_statements | Revenue, expenses, net income |
| get_balance_sheets | Assets, liabilities, equity |
| get_cash_flow_statements | Operating, investing, financing cash flows |
| get_all_financial_statements | Complete financial statements |
| get_financial_metrics_snapshot | Current key metrics |
| get_financial_metrics | Historical metrics |
| get_filings | List SEC filings |
| get_10k_filing_items | Annual report sections |
| get_10q_filing_items | Quarterly report sections |
| get_8k_filing_items | Material event disclosures |
| get_analyst_estimates | Wall Street estimates |
| get_segmented_revenues | Revenue by business segment |
| get_insider_trades | Insider buying/selling activity |
| get_news | Recent company news |
