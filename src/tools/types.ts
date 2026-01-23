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
 */
export function parseSearchResults(result: unknown): { parsed: unknown; urls: string[] } {
  const parsed = typeof result === 'string' ? JSON.parse(result) : result;
  const urls =
    (parsed as { results?: { url?: string }[] }).results
      ?.map((r) => r.url)
      .filter((url): url is string => Boolean(url)) ?? [];
  return { parsed, urls };
}
