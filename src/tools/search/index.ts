/**
 * Rich description for the web_search tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const WEB_SEARCH_DESCRIPTION = `
Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.

## When to Use

- Market news, breaking developments, central bank announcements
- Factual questions about brokers, regulations, or trading platforms
- Current events affecting forex, indices, or commodity markets
- Forex broker reviews, Fintokei updates, prop trading industry news
- Technology updates, trading tool announcements
- Verifying claims about real-world state

## When NOT to Use

- Market prices, charts, or technical indicators (use get_market_data instead)
- Economic calendar events (use economic_calendar instead)
- Fintokei challenge rules (use get_fintokei_rules instead)
- Pure conceptual/definitional questions ("What is a pip?")

## Usage Notes

- Provide specific, well-formed search queries for best results
- Returns up to 5 results with URLs and content snippets
- Use for supplementary research when structured tools don't cover the topic
`.trim();

export { tavilySearch } from './tavily.js';
export { exaSearch } from './exa.js';
export { perplexitySearch } from './perplexity.js';
export { xSearchTool, X_SEARCH_DESCRIPTION } from './x-search.js';
