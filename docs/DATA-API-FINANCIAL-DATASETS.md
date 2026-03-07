# Financial Datasets API — Dexter Core Data Layer

**Version:** 1.0  
**Last Updated:** 2026-03-07  
**Reference:** [Financial Datasets Documentation](https://docs.financialdatasets.ai/introduction)

---

## 1. Overview

Financial Datasets provides **stock market infrastructure for AI agents**: real-time, structured financial data and direct access to SEC filings via a REST API. Dexter uses it as the primary data layer for fundamental analysis, price data, filings, insider trades, and news.

### Design Principles (from Financial Datasets)

- **Real-time ingestion** — Data typically available within seconds of filing publication
- **Structured JSON responses** — Machine-ready, not human-browsing oriented
- **Section-level access to filings** — Retrieve specific items (e.g. Item 1A, Item 7)
- **Consistent field naming** across endpoints
- **Optimized for LLMs** — Clean, predictable schema

### Coverage

- ~17,000 active and delisted U.S. tickers
- 30+ years of history
- ~30,000+ tickers in full market coverage

---

## 2. Authentication

| Header | Value |
|--------|-------|
| `X-API-KEY` | Your API key from [financialdatasets.ai](https://financialdatasets.ai) |

**Environment variable:** `FINANCIAL_DATASETS_API_KEY`

```bash
# .env
FINANCIAL_DATASETS_API_KEY=your_api_key_here
```

---

## 3. Base URL

```
https://api.financialdatasets.ai
```

---

## 4. Endpoints Used by Dexter

### 4.1 Financial Statements

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/financials/income-statements/` | GET | `get_income_statements` | Income statements (revenue, expenses, net income) |
| `/financials/balance-sheets/` | GET | `get_balance_sheets` | Balance sheets (assets, liabilities, equity) |
| `/financials/cash-flow-statements/` | GET | `get_cash_flow_statements` | Cash flow statements |
| `/financials/` | GET | `get_all_financial_statements` | All three statements in one call |

**Common parameters:**

| Parameter | Type | Values | Description |
|-----------|------|--------|--------------|
| `ticker` | string | e.g. AAPL, NVDA | Stock ticker symbol |
| `period` | string | `annual`, `quarterly`, `ttm` | Reporting period |
| `limit` | number | default 4 | Max report periods to return |
| `report_period_gt`, `report_period_gte`, `report_period_lt`, `report_period_lte` | string | YYYY-MM-DD | Filter by report period |

**Response keys:** `income_statements`, `balance_sheets`, `cash_flow_statements`, `financials`

---

### 4.2 Financial Metrics (Key Ratios)

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/financial-metrics/snapshot/` | GET | `get_key_ratios` | Real-time metrics snapshot |
| `/financial-metrics/` | GET | `get_historical_key_ratios` | Historical metrics over time |

**Snapshot metrics include:** P/E, P/B, P/S, EV/EBITDA, PEG, margins, ROE, ROA, ROIC, liquidity ratios, leverage, per-share metrics (EPS, book value, FCF), growth rates.

**Historical parameters:** `ticker`, `period`, `limit`, `report_period`, `report_period_gt`, etc.

---

### 4.3 Stock Prices

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/prices/snapshot/` | GET | `get_stock_price` | Real-time price snapshot |
| `/prices/` | GET | `get_stock_prices` | Historical OHLCV data |
| `/prices/snapshot/tickers/` | GET | `get_available_stock_tickers` | List available tickers |

**Snapshot:** `ticker`  
**Historical:** `ticker`, `interval` (day/week/month/year), `start_date`, `end_date` (YYYY-MM-DD)

---

### 4.4 Cryptocurrency Prices

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/crypto/prices/snapshot/` | GET | `get_crypto_price_snapshot` | Real-time crypto snapshot |
| `/crypto/prices/` | GET | `get_crypto_prices` | Historical crypto OHLCV |
| `/crypto/prices/tickers/` | GET | `get_available_crypto_tickers` | List available crypto tickers |

**Ticker format:** `CRYPTO-USD` (e.g. BTC-USD) or `CRYPTO-CRYPTO` (e.g. BTC-ETH)

**Historical parameters:** `ticker`, `interval`, `interval_multiplier`, `start_date`, `end_date`

---

### 4.5 SEC Filings

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/filings/` | GET | `get_filings` | Filing metadata (accession numbers, types, URLs) |
| `/filings/items/` | GET | `get_10K_filing_items`, `get_10Q_filing_items`, `get_8K_filing_items` | Raw text of filing sections |
| `/filings/items/types/` | GET | (internal) | Canonical item names for 10-K/10-Q |

**Filings parameters:** `ticker`, `filing_type` (10-K, 10-Q, 8-K), `limit`

**Items parameters:** `ticker`, `filing_type`, `accession_number`, `item` (array of item names)

**10-K items:** Item-1 (Business), Item-1A (Risk Factors), Item-7 (MD&A), Item-8 (Financial Statements)  
**10-Q items:** Part-1,Item-1, Part-1,Item-2 (MD&A), Part-1,Item-3 (Market Risk), Part-2,Item-1A (Risk Factors)

---

### 4.6 Analyst Estimates

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/analyst-estimates/` | GET | `get_analyst_estimates` | Consensus estimates (EPS, etc.) |

**Parameters:** `ticker`, `period` (annual, quarterly)

---

### 4.7 Segmented Revenues

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/financials/segmented-revenues/` | GET | `get_segmented_revenues` | Revenue by segment (product, geography) |

**Parameters:** `ticker`, `period`, `limit`

---

### 4.8 Insider Trades

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/insider-trades/` | GET | `get_insider_trades` | Form 4 insider buys/sells |

**Parameters:** `ticker`, `limit`, `filing_date`, `filing_date_gte`, `filing_date_lte`, `filing_date_gt`, `filing_date_lt`

---

### 4.9 Company News

| Endpoint | Method | Dexter Tool | Description |
|----------|--------|-------------|-------------|
| `/news` | GET | `get_company_news` | Recent news headlines for a ticker |

**Parameters:** `ticker`, `limit` (default 5, max 10)

**Sources:** The Motley Fool, Investing.com, Reuters, and others via RSS feeds.

---

## 5. Endpoints Available but Not Yet Used by Dexter

| Endpoint | Description |
|----------|--------------|
| `/company/facts` | Company facts (sector, industry, market cap, employees, etc.) by ticker or CIK |
| `/earnings` | Earnings snapshot with estimates/surprise flags |
| `/earnings/press-releases` | Earnings press releases |
| `/institutional-ownership` | Form 13F institutional holdings by investor or ticker |
| `/financials/search/line-items` | Search specific metrics across tickers |
| `/financials/search/screener` | Stock screener by financial metrics |
| `/macro/interest-rates` | Historical central bank interest rates |
| `/macro/interest-rates/snapshot` | Current interest rates |

---

## 6. Dexter Implementation Details

### API Client (`src/tools/finance/api.ts`)

- **Concurrency:** Semaphore limits to 5 concurrent requests to avoid rate limits
- **Retries:** Up to 3 retries with exponential backoff
- **429 handling:** Respects `Retry-After` header when rate limited
- **Caching:** Optional `cacheable` flag for immutable data (filings, closed-date OHLCV)

### Field Stripping

Redundant fields are stripped before returning to the LLM to reduce token usage:

- Financial statements: `accession_number`, `currency`, `period`
- Insider trades: `issuer`

### Meta-Tools

- **`financial_search`** — Routes natural language queries to appropriate finance tools (prices, fundamentals, news, insider trades, crypto, etc.)
- **`financial_metrics`** — Routes to financial statements and key ratios only
- **`read_filings`** — Two-step workflow: plan ticker + filing types, then fetch metadata and item content

---

## 7. Rate Limits and Best Practices

- Use the smallest `limit` that answers the question
- Prefer specific tools over general ones (e.g. `get_income_statements` over `get_all_financial_statements` when only income is needed)
- For comparisons, call the same tool for each ticker; batching is handled internally
- Historical price/financial data for closed periods is cacheable

---

## 8. References

- [Financial Datasets Introduction](https://docs.financialdatasets.ai/introduction)
- [Documentation Index (llms.txt)](https://docs.financialdatasets.ai/llms.txt)
- [OpenAPI Spec](https://docs.financialdatasets.ai/api/openapi.json)
- [Dashboard & Pricing](https://financialdatasets.ai)
- [Support](mailto:support@financialdatasets.ai)
