export interface ToolResult {
  data: unknown;
  sourceUrls?: string[];
}

export function formatToolResult(data: unknown, sourceUrls?: string[]): string {
  const result: ToolResult = { data };
  if (sourceUrls?.length) {
    result.sourceUrls = sourceUrls;
  }
  return JSON.stringify(result);
}

/**
 * Parse search results from a search provider response.
 * Handles both string and object responses, extracting URLs from results.
 * Supports multiple response shapes from different providers.
 */
export function parseSearchResults(result: unknown): { parsed: unknown; urls: string[] } {
  // Safely parse JSON strings
  let parsed: unknown;
  if (typeof result === 'string') {
    try {
      parsed = JSON.parse(result);
    } catch {
      // If parsing fails, treat the string as the result itself
      parsed = result;
    }
  } else {
    parsed = result;
  }

  // Extract URLs from multiple possible response shapes
  let urls: string[] = [];

  // Shape 1: { results: [{ url: string }] } (Exa format)
  if (parsed && typeof parsed === 'object' && 'results' in parsed) {
    const results = (parsed as { results?: unknown[] }).results;
    if (Array.isArray(results)) {
      urls = results
        .map((r) => (r && typeof r === 'object' && 'url' in r ? (r as { url?: string }).url : null))
        .filter((url): url is string => Boolean(url));
    }
  }
  // Shape 2: [{ url: string }] (direct array, Tavily format)
  else if (Array.isArray(parsed)) {
    urls = parsed
      .map((r) => (r && typeof r === 'object' && 'url' in r ? (r as { url?: string }).url : null))
      .filter((url): url is string => Boolean(url));
  }

  return { parsed, urls };
}
