/**
 * Rich description for the web_search tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const WEB_SEARCH_DESCRIPTION = `
Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.

## When to Use

- General knowledge questions not covered by financial_search
- Current events, breaking news, recent developments
- Technology updates, product announcements, industry trends
- Information that changes frequently or requires recent data
- Fact-checking or verifying claims
- Research on topics outside of structured financial data

## When NOT to Use

- Financial data queries (use financial_search instead - it has structured, reliable data)
- Questions answerable from general knowledge without needing current information
- Queries about stock prices, company financials, SEC filings, or analyst estimates

## Usage Notes

- Provide specific, well-formed search queries for best results
- Returns up to 5 results with URLs and content snippets
- Use for supplementary research when financial_search doesn't cover the topic
`.trim();
