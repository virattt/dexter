/**
 * Rich description for the web_fetch tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const WEB_FETCH_DESCRIPTION = `
Fetch and extract readable content from a URL (HTML → markdown/text). Returns the page content directly in a single call.

## This is the DEFAULT tool for reading web pages

Use web_fetch as your FIRST choice whenever you need to read the content of a web page. It is faster and simpler than the browser tool.

## When to Use

- Reading earnings reports, press releases, or investor relations pages
- Reading articles from news sites (CNBC, Bloomberg, Reuters, etc.)
- Accessing any URL discovered via web_search
- Reading documentation, blog posts, or any static web content
- When you need the full text content of a known URL

## When NOT to Use

- Interactive pages that require JavaScript rendering, clicking, or form filling (use browser instead)
- Structured financial data like prices, metrics, or estimates (use financial_search instead)
- SEC filings content (use read_filings instead)
- When you need to navigate through multiple pages by clicking links (use browser instead)

## Schema

- **url** (required): The HTTP or HTTPS URL to fetch
- **extractMode** (optional): "markdown" (default) or "text" — controls output format
- **maxChars** (optional): Maximum characters to return (default 50,000)

## Returns

Returns the page content directly as markdown or text. No multi-step workflow needed — one call gets you the full content.

Response includes: url, finalUrl, title, text, extractMode, extractor, truncated, tookMs

## Usage Notes

- Returns content in a single call — no need for navigate/snapshot/read steps
- Results are cached for 15 minutes — repeated fetches of the same URL are instant
- Handles redirects automatically (up to 3 hops)
- Extracts readable content using Mozilla Readability (same as Firefox Reader View)
- Falls back to raw HTML-to-markdown conversion if Readability extraction fails
- Works with HTML pages, JSON responses, and plain text
`.trim();
