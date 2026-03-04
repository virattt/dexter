/**
 * web_fetch tool — lightweight one-shot page reader with caching.
 *
 * Core extraction logic ported from OpenClaw's src/agents/tools/web-fetch.ts (MIT license).
 * Adapted for Dexter's LangChain DynamicStructuredTool + Zod framework.
 *
 * Differences from OpenClaw:
 * - fetchWithSsrFGuard replaced with plain fetch + manual redirect handling
 * - Firecrawl fallback removed (falls back to htmlToMarkdown instead)
 * - Config resolution replaced with hardcoded defaults
 * - Tool wrapper uses LangChain DynamicStructuredTool + Zod (not AnyAgentTool + TypeBox)
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { wrapExternalContent, wrapWebContent } from './external-content.js';
import {
  extractReadableContent,
  htmlToMarkdown,
  markdownToText,
  truncateText,
  type ExtractMode,
} from './web-fetch-utils.js';
import {
  type CacheEntry,
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  withTimeout,
  writeCache,
} from './cache.js';

/**
 * Rich description for the web_fetch tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const WEB_FETCH_DESCRIPTION = `
Fetch and extract readable content from a URL (HTML -> markdown/text). Returns the page content directly in a single call.

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
- **extractMode** (optional): "markdown" (default) or "text" - controls output format
- **maxChars** (optional): Maximum characters to return (default 20,000)

## Returns

Returns the page content directly as markdown or text. No multi-step workflow needed - one call gets you the full content.

Response includes: url, finalUrl, title, text, extractMode, extractor, truncated, tookMs

## Usage Notes

- Returns content in a single call - no need for navigate/snapshot/read steps
- Results are cached for 15 minutes - repeated fetches of the same URL are instant
- Handles redirects automatically (up to 3 hops)
- Extracts readable content using Mozilla Readability (same as Firefox Reader View)
- Falls back to raw HTML-to-markdown conversion if Readability extraction fails
- Works with HTML pages, JSON responses, and plain text
`.trim();

// ============================================================================
// Constants (identical to OpenClaw)
// ============================================================================

const DEFAULT_FETCH_MAX_CHARS = 20_000;
const DEFAULT_FETCH_MAX_REDIRECTS = 3;
const DEFAULT_ERROR_MAX_CHARS = 4_000;
const DEFAULT_FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// ============================================================================
// Cache (identical to OpenClaw)
// ============================================================================

const FETCH_CACHE = new Map<string, CacheEntry<Record<string, unknown>>>();

// ============================================================================
// Content wrapping (identical to OpenClaw)
// ============================================================================

const WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD = wrapWebContent("", "web_fetch").length;
const WEB_FETCH_WRAPPER_NO_WARNING_OVERHEAD = wrapExternalContent("", {
  source: "web_fetch",
  includeWarning: false,
}).length;

function wrapWebFetchContent(
  value: string,
  maxChars: number,
): {
  text: string;
  truncated: boolean;
  rawLength: number;
  wrappedLength: number;
} {
  if (maxChars <= 0) {
    return { text: "", truncated: true, rawLength: 0, wrappedLength: 0 };
  }
  const includeWarning = maxChars >= WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD;
  const wrapperOverhead = includeWarning
    ? WEB_FETCH_WRAPPER_WITH_WARNING_OVERHEAD
    : WEB_FETCH_WRAPPER_NO_WARNING_OVERHEAD;
  if (wrapperOverhead > maxChars) {
    const minimal = includeWarning
      ? wrapWebContent("", "web_fetch")
      : wrapExternalContent("", { source: "web_fetch", includeWarning: false });
    const truncatedWrapper = truncateText(minimal, maxChars);
    return {
      text: truncatedWrapper.text,
      truncated: true,
      rawLength: 0,
      wrappedLength: truncatedWrapper.text.length,
    };
  }
  const maxInner = Math.max(0, maxChars - wrapperOverhead);
  let truncated = truncateText(value, maxInner);
  let wrappedText = includeWarning
    ? wrapWebContent(truncated.text, "web_fetch")
    : wrapExternalContent(truncated.text, { source: "web_fetch", includeWarning: false });

  if (wrappedText.length > maxChars) {
    const excess = wrappedText.length - maxChars;
    const adjustedMaxInner = Math.max(0, maxInner - excess);
    truncated = truncateText(value, adjustedMaxInner);
    wrappedText = includeWarning
      ? wrapWebContent(truncated.text, "web_fetch")
      : wrapExternalContent(truncated.text, { source: "web_fetch", includeWarning: false });
  }

  return {
    text: wrappedText,
    truncated: truncated.truncated,
    rawLength: truncated.text.length,
    wrappedLength: wrappedText.length,
  };
}

function wrapWebFetchField(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  return wrapExternalContent(value, { source: "web_fetch", includeWarning: false });
}

// ============================================================================
// Helpers (identical to OpenClaw)
// ============================================================================

function normalizeContentType(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const [raw] = value.split(";");
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trimStart();
  if (!trimmed) {
    return false;
  }
  const head = trimmed.slice(0, 256).toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function formatWebFetchErrorDetail(params: {
  detail: string;
  contentType?: string | null;
  maxChars: number;
}): string {
  const { detail, contentType, maxChars } = params;
  if (!detail) {
    return "";
  }
  let text = detail;
  const contentTypeLower = contentType?.toLowerCase();
  if (contentTypeLower?.includes("text/html") || looksLikeHtml(detail)) {
    const rendered = htmlToMarkdown(detail);
    const withTitle = rendered.title ? `${rendered.title}\n${rendered.text}` : rendered.text;
    text = markdownToText(withTitle);
  }
  const truncatedResult = truncateText(text.trim(), maxChars);
  return truncatedResult.text;
}

function resolveMaxChars(value: unknown, fallback: number, cap: number): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const clamped = Math.max(100, Math.floor(parsed));
  return Math.min(clamped, cap);
}

// ============================================================================
// HTTP fetch with manual redirect handling (replaces OpenClaw's fetchWithSsrFGuard)
// ============================================================================

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchWithRedirects(params: {
  url: string;
  maxRedirects: number;
  timeoutMs: number;
  headers: Record<string, string>;
}): Promise<{ response: Response; finalUrl: string }> {
  const signal = withTimeout(undefined, params.timeoutMs);
  const visited = new Set<string>();
  let currentUrl = params.url;
  let redirectCount = 0;

  while (true) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      throw new Error("[Web Fetch] Invalid URL: must be http or https");
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("[Web Fetch] Invalid URL: must be http or https");
    }

    const response = await fetch(parsedUrl.toString(), {
      redirect: "manual",
      headers: params.headers,
      signal,
    });

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`[Web Fetch] Redirect missing location header (${response.status})`);
      }
      redirectCount += 1;
      if (redirectCount > params.maxRedirects) {
        throw new Error(`[Web Fetch] Too many redirects (limit: ${params.maxRedirects})`);
      }
      const nextUrl = new URL(location, parsedUrl).toString();
      if (visited.has(nextUrl)) {
        throw new Error("[Web Fetch] Redirect loop detected");
      }
      visited.add(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }
}

// ============================================================================
// Core fetch logic (ported from OpenClaw's runWebFetch, Firecrawl branches removed)
// ============================================================================

async function runWebFetch(params: {
  url: string;
  extractMode: ExtractMode;
  maxChars: number;
  maxRedirects: number;
  timeoutSeconds: number;
  cacheTtlMs: number;
  userAgent: string;
}): Promise<Record<string, unknown>> {
  const cacheKey = normalizeCacheKey(
    `fetch:${params.url}:${params.extractMode}:${params.maxChars}`,
  );
  const cached = readCache(FETCH_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(params.url);
  } catch {
    throw new Error("[Web Fetch] Invalid URL: must be http or https");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("[Web Fetch] Invalid URL: must be http or https");
  }

  const start = Date.now();
  const { response: res, finalUrl } = await fetchWithRedirects({
    url: params.url,
    maxRedirects: params.maxRedirects,
    timeoutMs: params.timeoutSeconds * 1000,
    headers: {
      Accept: "*/*",
      "User-Agent": params.userAgent,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    const rawDetail = await readResponseText(res);
    const detail = formatWebFetchErrorDetail({
      detail: rawDetail,
      contentType: res.headers.get("content-type"),
      maxChars: DEFAULT_ERROR_MAX_CHARS,
    });
    const wrappedDetail = wrapWebFetchContent(detail || res.statusText, DEFAULT_ERROR_MAX_CHARS);
    throw new Error(`[Web Fetch] failed (${res.status}): ${wrappedDetail.text}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const normalizedContentType = normalizeContentType(contentType) ?? "application/octet-stream";
  const body = await readResponseText(res);

  let title: string | undefined;
  let extractor = "raw";
  let text = body;
  if (contentType.includes("text/html")) {
    const readable = await extractReadableContent({
      html: body,
      url: finalUrl,
      extractMode: params.extractMode,
    });
    if (readable?.text) {
      text = readable.text;
      title = readable.title;
      extractor = "readability";
    } else {
      // Fallback to htmlToMarkdown (OpenClaw falls to Firecrawl here)
      const rendered = htmlToMarkdown(body);
      text = params.extractMode === "text" ? markdownToText(rendered.text) : rendered.text;
      title = rendered.title;
      extractor = "htmlToMarkdown";
    }
  } else if (contentType.includes("application/json")) {
    try {
      text = JSON.stringify(JSON.parse(body), null, 2);
      extractor = "json";
    } catch {
      text = body;
      extractor = "raw";
    }
  }

  const wrapped = wrapWebFetchContent(text, params.maxChars);
  const wrappedTitle = title ? wrapWebFetchField(title) : undefined;
  const payload = {
    url: params.url,
    finalUrl,
    status: res.status,
    contentType: normalizedContentType,
    title: wrappedTitle,
    extractMode: params.extractMode,
    extractor,
    truncated: wrapped.truncated,
    length: wrapped.wrappedLength,
    rawLength: wrapped.rawLength,
    wrappedLength: wrapped.wrappedLength,
    fetchedAt: new Date().toISOString(),
    tookMs: Date.now() - start,
    text: wrapped.text,
  };
  writeCache(FETCH_CACHE, cacheKey, payload, params.cacheTtlMs);
  return payload;
}

// ============================================================================
// Tool definition (adapted for Dexter's LangChain + Zod framework)
// ============================================================================

export const webFetchTool = new DynamicStructuredTool({
  name: 'web_fetch',
  description:
    'Fetch and extract readable content from a URL (HTML → markdown/text). Use for lightweight page access without browser automation.',
  schema: z.object({
    url: z.string().describe('HTTP or HTTPS URL to fetch.'),
    extractMode: z
      .enum(['markdown', 'text'])
      .optional()
      .describe('Extraction mode ("markdown" or "text"). Defaults to "markdown".'),
    maxChars: z
      .number()
      .min(100)
      .optional()
      .describe('Maximum characters to return (truncates when exceeded).'),
  }),
  func: async (input) => {
    const extractMode: ExtractMode = input.extractMode === 'text' ? 'text' : 'markdown';
    const maxChars = resolveMaxChars(input.maxChars, DEFAULT_FETCH_MAX_CHARS, DEFAULT_FETCH_MAX_CHARS);
    const result = await runWebFetch({
      url: input.url,
      extractMode,
      maxChars,
      maxRedirects: DEFAULT_FETCH_MAX_REDIRECTS,
      timeoutSeconds: resolveTimeoutSeconds(undefined, DEFAULT_TIMEOUT_SECONDS),
      cacheTtlMs: resolveCacheTtlMs(undefined, DEFAULT_CACHE_TTL_MINUTES),
      userAgent: DEFAULT_FETCH_USER_AGENT,
    });
    return formatToolResult(result, [input.url]);
  },
});
