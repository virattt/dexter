/**
 * Automatic financial memory persistence.
 *
 * Two entry points:
 *
 *  1. seedWatchlistEntries(entries) — called at CLI startup and on `/watchlist add`.
 *     Creates a basic financial_insights record for every watchlist ticker that
 *     doesn't already have one.  This ensures recall_financial_context() always
 *     returns *something* for tracked tickers even before any LLM analysis runs.
 *
 *  2. autoStoreFromRun(query, toolCalls) — called after each agent run.
 *     If the run used financial tools but the LLM did not call
 *     store_financial_insight itself, this function extracts ticker symbols from
 *     the query, infers routing (which data source worked), and persists a
 *     compact record automatically.  This prevents the database from remaining
 *     empty just because the LLM didn't comply with the "store after analysis"
 *     instruction.
 */

import { MemoryManager } from './index.js';
import type { ToolCallRecord } from '../agent/scratchpad.js';

// ---------------------------------------------------------------------------
// Ticker extraction
// ---------------------------------------------------------------------------

// Matches 1–5 uppercase letters, optionally followed by a dot + 2–3 uppercase
// letters (handles European tickers like VWS.CO, SAP.DE, etc.)
const TICKER_RE = /\b([A-Z]{1,5}(?:\.[A-Z]{2,3})?)\b/g;

/** Words/tokens that look like tickers but aren't. */
const SKIP_TOKENS = new Set([
  'A', 'AN', 'I', 'BE', 'DO', 'GO', 'MY', 'AT', 'BY', 'ME', 'NO', 'OR',
  'SO', 'UP', 'US', 'WE', 'HE', 'IT', 'IN', 'IS', 'IF', 'OF', 'ON', 'TO',
  'AS', 'AND', 'ARE', 'BUT', 'CAN', 'FOR', 'HAS', 'HIM', 'HIS', 'ITS',
  'NOT', 'OUR', 'SHE', 'THE', 'WAS', 'YOU', 'ALL', 'ANY', 'EACH', 'ELSE',
  'FROM', 'HAVE', 'THAT', 'THEM', 'THEN', 'THEY', 'THIS', 'WERE', 'WHAT',
  'WITH', 'YOUR', 'ALSO', 'BEEN', 'BOTH', 'EACH', 'EVEN', 'JUST', 'LESS',
  'LIKE', 'LONG', 'MANY', 'MORE', 'MOST', 'MUCH', 'NEED', 'ONLY', 'OVER',
  'SAME', 'SUCH', 'THAN', 'VERY', 'WELL', 'WILL', 'WHEN', 'YEAR',
  // Financial jargon that looks like tickers
  'DCF', 'EPS', 'ETF', 'FMP', 'FTS', 'GDP', 'INC', 'IPO', 'LLC',
  'LTM', 'NAV', 'NAN', 'OTC', 'P/E', 'PE', 'PEG', 'SEC', 'TTM',
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'CEO', 'CFO', 'COO', 'CTO', 'CFR', 'CWD', 'ENV', 'FAQ',
  'API', 'FMT', 'HTML', 'HTTP', 'JSON', 'URL', 'UTC',
  // Common English words that are all-caps in financial context
  'BUY', 'CALL', 'COME', 'FIND', 'GET', 'GIVE', 'GOOD', 'HELP',
  'HIGH', 'HOLD', 'INTO', 'KEEP', 'KNOW', 'LOOK', 'MAKE', 'NEXT',
  'READ', 'SELL', 'SHOW', 'TAKE', 'TELL', 'THEIR', 'USE', 'WANT',
  'YEAR', 'YOY', 'QOQ', 'FY', 'Q1', 'Q2', 'Q3', 'Q4',
  // Common SQL/tech context
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER', 'NULL',
]);

/**
 * Extract probable ticker symbols from free text.
 * Returns deduped, uppercase ticker strings (e.g. ["AMD", "ORCL", "VWS.CO"]).
 */
export function extractTickers(text: string): string[] {
  const matches = new Set<string>();
  TICKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TICKER_RE.exec(text)) !== null) {
    const t = m[1]!.toUpperCase();
    if (t.length >= 2 && !SKIP_TOKENS.has(t)) {
      matches.add(t);
    }
  }
  return Array.from(matches);
}

// ---------------------------------------------------------------------------
// Routing inference
// ---------------------------------------------------------------------------

type RoutingResult = 'fmp-ok' | 'fmp-premium' | 'yahoo-ok' | 'web-fallback';

/**
 * Infer which data source worked for a ticker by scanning tool call results.
 * Returns null when no financial tools were used or routing cannot be determined.
 */
function inferRouting(ticker: string, toolCalls: ToolCallRecord[]): RoutingResult | null {
  const upper = ticker.toUpperCase();

  // Only look at calls that mention this ticker in their args or result.
  const relevant = toolCalls.filter((tc) => {
    const haystack = (JSON.stringify(tc.args) + tc.result).toUpperCase();
    return haystack.includes(upper);
  });
  if (relevant.length === 0) return null;

  const premiumPattern = /premium|subscription required|not available.*free|upgrade.*plan/i;
  const dataPattern = /price|revenue|earnings|market.*cap|\$[\d,]+|p\/e|roe|eps|income|balance/i;

  for (const tc of relevant) {
    if ((tc.tool === 'get_financials' || tc.tool === 'get_market_data') && premiumPattern.test(tc.result)) {
      return 'fmp-premium';
    }
  }

  for (const tc of relevant) {
    if (
      (tc.tool === 'get_financials' || tc.tool === 'get_market_data') &&
      dataPattern.test(tc.result) &&
      !premiumPattern.test(tc.result)
    ) {
      return 'fmp-ok';
    }
  }

  for (const tc of relevant) {
    if ((tc.tool === 'web_search' || tc.tool === 'browser') && dataPattern.test(tc.result)) {
      return 'web-fallback';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WatchlistEntryLike {
  ticker: string;
  costBasis?: number;
  shares?: number;
}

/**
 * Seed basic memory entries for watchlist tickers that have no existing record.
 *
 * Idempotent: existing records are left untouched.
 * Called at CLI startup and immediately after `/watchlist add TICKER`.
 */
export async function seedWatchlistEntries(entries: WatchlistEntryLike[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const manager = await MemoryManager.get();
    const store = manager.getFinancialStore();
    if (!store) return;

    for (const entry of entries) {
      // Skip if any watchlist-sourced insight already exists for this ticker.
      const existing = store.recallByTicker(entry.ticker);
      const hasWatchlistRecord = existing.some(
        (e) => (e.source === 'watchlist') || (e.tags ?? []).includes('source:watchlist'),
      );
      if (hasWatchlistRecord) continue;

      const posDetails: string[] = [];
      if (entry.costBasis !== undefined) posDetails.push(`cost basis $${entry.costBasis}`);
      if (entry.shares !== undefined) posDetails.push(`${entry.shares} shares`);
      const posStr = posDetails.length > 0 ? ` (${posDetails.join(', ')})` : '';

      await store.storeInsight({
        ticker: entry.ticker,
        content: `User is tracking ${entry.ticker} in their investment watchlist${posStr}.`,
        tags: ['source:watchlist', `ticker:${entry.ticker}`],
        source: 'watchlist',
      });
    }
  } catch {
    // Memory persistence is non-critical — never throw to the caller.
  }
}

/**
 * Auto-persist financial context after an agent run when the LLM did not
 * call store_financial_insight itself.
 *
 * Logic:
 * - Skip if no financial tool was used (pure chat response).
 * - Skip if store_financial_insight was already called (LLM handled it).
 * - Extract tickers from the query.
 * - For each ticker without a recent record (<24 h), infer routing and write
 *   a compact insight row capturing the query context and routing result.
 */
export async function autoStoreFromRun(
  query: string,
  answer: string,
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>,
): Promise<void> {
  // Guard 1: only store when financial research actually happened.
  const FINANCIAL_TOOLS = new Set([
    'get_market_data', 'get_financials', 'read_filings',
    'financial_search', 'web_search', 'browser',
  ]);
  const usedFinancialTool = toolCalls.some((tc) => FINANCIAL_TOOLS.has(tc.tool));
  if (!usedFinancialTool) return;

  // Guard 2: LLM already handled this — don't duplicate.
  if (toolCalls.some((tc) => tc.tool === 'store_financial_insight')) return;

  const tickers = extractTickers(query);
  if (tickers.length === 0) return;

  try {
    const manager = await MemoryManager.get();
    const store = manager.getFinancialStore();
    if (!store) return;

    const recentCutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    for (const ticker of tickers.slice(0, 6)) {
      // Don't over-write very recent entries (prevents churn on repeated queries).
      const existing = store.recallByTicker(ticker);
      const hasRecent = existing.some((e) => (e.updatedAt ?? 0) > recentCutoff);
      if (hasRecent) continue;

      const routing = inferRouting(ticker, toolCalls as ToolCallRecord[]);
      const tags = [`ticker:${ticker}`, 'source:auto-run'];
      if (routing) tags.push(`routing:${routing}`);

      // Build a compact insight: query context + routing + first 200 chars of answer.
      const answerExcerpt = answer.trim().slice(0, 200);
      const content = [
        `Query: "${query.slice(0, 150)}"`,
        routing ? `Data source: ${routing}` : null,
        answerExcerpt ? `Summary: ${answerExcerpt}${answer.length > 200 ? '…' : ''}` : null,
      ]
        .filter(Boolean)
        .join(' — ');

      await store.storeInsight({
        ticker,
        content,
        tags,
        routing: routing ?? undefined,
        source: 'auto-run',
      });
    }
  } catch {
    // Non-critical.
  }
}
