/**
 * Prompts and descriptions for the web_fetch tool.
 */

export const WEB_FETCH_TOOL_NAME = 'web_fetch';

/**
 * Rich description for the web_fetch tool, injected into the system prompt.
 */
export const WEB_FETCH_DESCRIPTION = `
Fetch and analyze content from a URL.

- Fetches content from a specified URL and processes it using a fast AI model
- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt using a small, fast model
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

## This is the DEFAULT tool for reading web pages

Use web_fetch as your FIRST choice whenever you need to read the content of a web page. It is faster and simpler than the browser tool.

## When to Use

- Reading earnings reports, press releases, or investor relations pages
- Reading articles from news sites (CNBC, Bloomberg, Reuters, etc.)
- Accessing any URL discovered via web_search
- Reading documentation, blog posts, or any static web content
- When you need specific information extracted from a known URL

## When NOT to Use

- Interactive pages that require JavaScript rendering, clicking, or form filling (use browser instead)
- Structured financial data like metrics or estimates (use get_financials instead)
- Stock or crypto prices (use get_market_data instead)
- SEC filings content (use read_filings instead)

## Usage Notes

- The URL must be a fully-formed valid URL
- HTTP URLs will be automatically upgraded to HTTPS
- The prompt should describe what information you want to extract from the page
- This tool is read-only and does not modify any files
- Results may be summarized if the content is very large
- Includes a self-cleaning 15-minute cache for faster responses when repeatedly accessing the same URL
- When a URL redirects to a different host, the tool will inform you and provide the redirect URL. You should then make a new web_fetch request with the redirect URL to fetch the content.
`.trim();

/**
 * Build the prompt handed to the fast secondary model that applies the user's
 * request to the fetched page content.
 */
export function makeSecondaryModelPrompt(markdownContent: string, prompt: string): string {
  const guidelines = `Provide a concise response based only on the content above. In your response:
 - Enforce a strict 125-character maximum for quotes from any source document. Open Source Software is ok as long as we respect the license.
 - Use quotation marks for exact language from articles; any language outside of the quotation should never be word-for-word the same.
 - You are not a lawyer and never comment on the legality of your own prompts and responses.
 - Never produce or reproduce exact song lyrics.`;

  return `
Web page content:
---
${markdownContent}
---

${prompt}

${guidelines}
`;
}
