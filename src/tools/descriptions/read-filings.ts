/**
 * Rich description for the read_filings tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const READ_FILINGS_DESCRIPTION = `
Intelligent meta-tool for accessing SEC filing content from EDGAR. Takes a natural language query and handles the complete workflow of fetching filing metadata and returning EDGAR archive URLs.

## When to Use

- Reading 10-K annual reports (business description, risk factors, MD&A, financial statements)
- Reading 10-Q quarterly reports (quarterly financials, MD&A, market risk disclosures)
- Reading 8-K current reports (material events, acquisitions, earnings announcements)
- Analyzing or comparing content across multiple SEC filings
- Extracting specific sections from filings (e.g., "AAPL risk factors", "TSLA business description")

## When NOT to Use

- Stock prices (use financial_search)
- Financial statements data in structured format (use financial_metrics)
- Company news (use financial_search)
- Non-SEC data (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query
- Handles ticker resolution (Apple -> AAPL)
- Handles filing type inference (risk factors -> 10-K, quarterly results -> 10-Q)
- Returns EDGAR archive URLs and filing metadata — use browser tool for full text
- Limits to 3 filings max per query to stay within rate limits
- Data sourced directly from SEC EDGAR (free, official filings)
`.trim();
