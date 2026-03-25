/**
 * Rich description for the web_search tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const WEB_SEARCH_DESCRIPTION = `
Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.

## When to Use

- **Fallback when financial tools fail** — if get_financials, get_market_data, or read_filings returns an error, empty data, or "unavailable" for a ticker (especially international/European stocks like VWS.CO, SAP.DE, ASML.AS), ALWAYS use web_search next to find the data from public sources
- Current events, breaking news, recent developments about a company
- Factual questions about entities (companies, people, organizations) where status can change
- Technology updates, product announcements, industry trends
- Verifying claims about real-world state (public/private, active/defunct, current leadership)
- Research on topics outside of structured financial data
- Finding investor relations pages, annual reports, or press releases for any company

## When NOT to Use

- As the first tool for US stocks with working API coverage — prefer get_financials for structured data
- Pure conceptual/definitional questions ("What is a DCF?")

## Usage Notes

- Provide specific, well-formed search queries for best results (e.g., "Vestas Wind Systems revenue 2024 annual report", "VWS.CO analyst price targets")
- Returns up to 5 results with URLs and content snippets
- Follow up with web_fetch on the most relevant URL to extract actual numbers and details
- Try multiple query phrasings if the first search returns insufficient information
`.trim();

export { tavilySearch } from './tavily.js';
export { exaSearch } from './exa.js';
export { perplexitySearch } from './perplexity.js';
export { xSearchTool, X_SEARCH_DESCRIPTION } from './x-search.js';
