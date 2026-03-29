/**
 * GDELT DOC 2.0 API client.
 *
 * Fetches geopolitical news articles from GDELT — free, no API key required.
 * API docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

export interface GdeltArticle {
  url: string;
  title: string;
  /** YYYYMMDDHHMMSS format, UTC */
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
  /** Tone: negative = bad sentiment, positive = positive. Range roughly -100 to +100. */
  tone?: number;
}

export interface GdeltOptions {
  timespan?: '1d' | '3d' | '7d' | '14d' | '30d';
  maxRecords?: number;
  /** GDELT domain whitelist — e.g. ["reuters.com", "bbc.com"] */
  domains?: string[];
  sourceLanguage?: string;
}

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const DEFAULT_MAX_RECORDS = 25;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Convert our timespan string to GDELT TIMESPAN param value.
 * GDELT accepts values like "1440" (minutes), "10080" (7 days in minutes), etc.
 */
function timespanToMinutes(ts: GdeltOptions['timespan'] = '1d'): string {
  const map: Record<NonNullable<GdeltOptions['timespan']>, number> = {
    '1d': 1440,
    '3d': 4320,
    '7d': 10080,
    '14d': 20160,
    '30d': 43200,
  };
  return String(map[ts]);
}

/**
 * Fetch articles from GDELT matching `query`.
 *
 * @param query - Free-form keywords; can include THEME: tokens (e.g. "ukraine THEME:MILITARY_CONFLICT")
 */
export async function fetchGdeltArticles(query: string, options: GdeltOptions = {}): Promise<GdeltArticle[]> {
  const { timespan = '1d', maxRecords = DEFAULT_MAX_RECORDS, domains, sourceLanguage = 'english' } = options;

  let q = query;
  if (domains && domains.length > 0) {
    const domainFilter = domains.slice(0, 10).map((d) => `domain:${d}`).join(' OR ');
    q = `${q} (${domainFilter})`;
  }
  if (sourceLanguage) {
    q = `${q} sourcelang:${sourceLanguage}`;
  }

  const params = new URLSearchParams({
    query: q,
    mode: 'artlist',
    maxrecords: String(Math.min(maxRecords, 250)),
    format: 'json',
    timespan: timespanToMinutes(timespan),
    sort: 'DateDesc',
  });

  const url = `${GDELT_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`GDELT HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data = await resp.json() as { articles?: GdeltRawArticle[] };
    return (data.articles ?? []).map(normalizeArticle);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`GDELT request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal normalization
// ──────────────────────────────────────────────────────────────────────────────

interface GdeltRawArticle {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  tone?: string | number;
}

function normalizeArticle(raw: GdeltRawArticle): GdeltArticle {
  return {
    url: raw.url ?? '',
    title: raw.title ?? '',
    seendate: raw.seendate ?? '',
    socialimage: raw.socialimage,
    domain: raw.domain ?? '',
    language: raw.language ?? '',
    sourcecountry: raw.sourcecountry ?? '',
    tone: raw.tone !== undefined ? parseFloat(String(raw.tone)) : undefined,
  };
}

/** Parse GDELT seendate (YYYYMMDDHHMMSS) into a JS Date. */
export function parseGdeltDate(seendate: string): Date {
  // GDELT format: 20240115143022 → 2024-01-15T14:30:22Z
  if (seendate.length !== 14) return new Date(0);
  const y = seendate.slice(0, 4);
  const mo = seendate.slice(4, 6);
  const d = seendate.slice(6, 8);
  const h = seendate.slice(8, 10);
  const mi = seendate.slice(10, 12);
  const s = seendate.slice(12, 14);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}

/** Deduplicate articles by URL. */
export function deduplicateArticles(articles: GdeltArticle[]): GdeltArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}
