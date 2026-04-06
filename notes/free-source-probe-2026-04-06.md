# Free source probe — 2026-04-06

## Goal

Check whether upstream Dexter's `Financial Datasets` dependency can be partially replaced with free/no-paid-plan sources.

## What was probed

### 1. Price data
- `https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d` -> `200 OK`
- `https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL,MSFT` -> `401 Unauthorized`
- `https://query1.finance.yahoo.com/v10/finance/quoteSummary/AAPL?...` -> `401 Invalid Crumb`

### 2. SEC ticker map / financial facts / filings
- `https://www.sec.gov/files/company_tickers.json` -> `200 OK`
- `https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json` -> `200 OK`
- `https://data.sec.gov/submissions/CIK0000320193.json` -> `200 OK`
- Example filing HTML: `https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm` -> `200 OK`
- Example Form 4 filing page: `https://www.sec.gov/Archives/edgar/data/320193/000114036126013192/xslF345X06/form4.xml` -> `200 OK`

### 3. News
- `https://news.google.com/rss/search?q=%22Apple+Inc.%22+OR+AAPL&hl=en-US&gl=US&ceid=US:en` -> `200 OK`

## Capability-by-capability assessment

### `get_stock_price` / `get_stock_prices`
Feasible with Yahoo Finance `chart` endpoint.

What worked:
- historical OHLCV windows
- recent close/open/high/low/volume
- enough metadata in `meta` + `indicators.quote`

Caveats:
- some Yahoo endpoints are blocked without crumbs/auth
- safer to rely only on `chart`, not `quoteSummary` / `quote`

Verdict:
- Good candidate for a free replacement.

### `get_available_stock_tickers`
Partially feasible with SEC ticker mapping.

What worked:
- `company_tickers.json` gives ticker <-> CIK <-> title

Caveats:
- SEC coverage is basically SEC registrants, not a broad global market universe
- no direct exchange/snapshot metadata like Financial Datasets

Verdict:
- Good enough for a US-only free mode.

### `get_filings`
Feasible with SEC submissions JSON.

What worked:
- recent form lists contain `10-K`, `10-Q`, `8-K`, `4`
- accession number + primary document are available
- archive URLs are deterministic

Verdict:
- Good candidate for a free replacement.

### `get_10K_filing_items` / `get_10Q_filing_items` / `get_8K_filing_items`
Partially feasible.

What worked:
- raw filing HTML/XML is directly accessible from SEC Archives

What is still needed:
- custom parser to split filing text into item sections
- 10-K / 10-Q item extraction is more work than just fetching the filing

Verdict:
- Feasible, but requires custom section extraction logic.

### `get_income_statements` / `get_balance_sheets` / `get_cash_flow_statements` / `get_all_financial_statements`
Partially feasible with SEC `companyfacts`.

What worked:
- AAPL returned usable `RevenueFromContractWithCustomerExcludingAssessedTax`, `NetIncomeLoss`, `Assets`, `CashAndCashEquivalentsAtCarryingValue`, `OperatingIncomeLoss`, `NetCashProvidedByUsedInOperatingActivities`
- annual and quarterly facts are present with `form`, `fy`, `fp`, `filed`, `frame`

What is still needed:
- tag mapping / fallback logic across issuers
- normalization into Dexter's current financial statement shape
- some metrics will be missing or named differently by issuer

Caveats:
- US issuers only
- less normalized than Financial Datasets

Verdict:
- Strong candidate for a reduced US-only free mode.

### `get_insider_trades`
Partially feasible with SEC Form 4.

What worked:
- recent submissions include many form `4` filings
- archive URLs are accessible

What is still needed:
- parser to extract transaction rows, ownership type, insider names, dates, quantities, prices
- normalization into current `insider_trades` response shape

Verdict:
- Feasible, but not a trivial drop-in.

### `get_company_news`
Feasible with Google News RSS.

What worked:
- ticker/company-name searches returned RSS XML without auth

Caveats:
- search relevance/noise is worse than a dedicated financial news API
- article metadata is thinner and feed structure is brittle

Verdict:
- Acceptable fallback for a free mode.

### `stock_screener` / segmented revenues / broad normalized search
No good free drop-in was found in this quick probe.

Caveats:
- can be approximated only by building a local universe + caching many SEC facts
- much heavier engineering than prices/filings/news

Verdict:
- Not a near-term free replacement.

## Overall conclusion

A **partial free replacement is realistic** if the scope is narrowed to **US-listed companies** and if we accept a less normalized feature set.

Best near-term free stack:
- Prices: Yahoo Finance `chart`
- Financial facts/statements: SEC `companyfacts`
- Filings metadata + raw documents: SEC `submissions` + `Archives`
- Insider trades: SEC Form 4 parsing
- News: Google News RSS

What this can replace well:
- price history
- current-ish price snapshot
- filings metadata
- raw filing retrieval
- core financial facts for large US issuers

What remains weak / missing:
- robust screener
- normalized global coverage
- plug-compatible segmented revenue datasets
- polished insider/news schemas without extra parsing work

## Recommended implementation path

1. Add an optional `free-us` mode instead of replacing Financial Datasets entirely.
2. Implement price tools first (`get_stock_price`, `get_stock_prices`, ticker lookup).
3. Implement SEC-backed filings metadata + raw filing fetch.
4. Implement SEC `companyfacts` financial summaries next.
5. Defer screener and advanced dataset features in free mode.

## Notes

- SEC endpoints require a polite `User-Agent` header.
- Yahoo `chart` worked; Yahoo `quote` / `quoteSummary` did not.
- This probe verified live endpoint availability only; it did not yet wire the sources into Dexter tools.
