/**
 * Extracts stock ticker symbols from free-form financial text.
 *
 * Two recognition strategies:
 *  1. Explicit `$TICKER` pattern — high-confidence, always extracted.
 *  2. Bare uppercase tokens (2–5 letters, optional exchange suffix like .B or .CO)
 *     that are NOT in the financial/common-English stop-word list.
 */

// Uppercase tokens that look like tickers but are not — sorted for readability.
export const TICKER_STOP_WORDS = new Set([
  // Common English
  'AM', 'AN', 'ANY', 'ARE', 'AS', 'AT',
  'BE', 'BOT', 'BUT', 'BY',
  'CAN', 'CUT',
  'DID', 'DO',
  'END', 'EST', 'EU',
  'FOR',
  'GET', 'GO', 'GOT',
  'HAD', 'HAS', 'HIT', 'HOW',
  'IF', 'IN', 'IS', 'IT', 'ITS',
  'LET', 'LOW',
  'NEW', 'NO', 'NOR', 'NOT', 'NOW',
  'OF', 'OLD', 'ON', 'OR',
  'PUT',
  'RUN',
  'SAY', 'SEE', 'SET', 'SO',
  'THE', 'TO', 'TOP',
  'UP', 'USE',
  'WAS', 'WHO', 'WHY',
  'YET',
  // Countries / currencies / regions
  'AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'JPY', 'UK', 'US', 'USA', 'USD',
  // Executive / corporate titles
  'CEO', 'CFO', 'COO', 'CTO', 'EVP', 'SVP', 'VP',
  // Common financial abbreviations (not tickers)
  'AI', 'API', 'ATH', 'ATL',
  'CAPEX',
  'DCF', 'DPS',
  'EBITDA', 'EPS', 'ETF', 'EV',
  'FASB', 'FCF', 'FED', 'FDA',
  'GAAP', 'GPU',
  'HR',
  'IFRS', 'IMF', 'IPO', 'IR', 'IRS',
  'KPI',
  'LONG', 'LTM',
  'ML', 'MTD',
  'NET', 'NYSE',
  'OPEX', 'OTC',
  'PE', 'PB', 'PEG', 'PR',
  'QOQ',
  'REIT', 'REV', 'ROA', 'ROE', 'ROIC',
  'SEC', 'SELL', 'SHORT', 'SPAC', 'SLA', 'SUM',
  'TAX', 'TTL', 'TTM',
  'VC', 'VIX', 'VWAP',
  'WACC',
  'YOY', 'YTD',
  // Common trade direction words
  'BUY', 'HOLD',
]);

// $TICKER — dollar sign prefix is an unambiguous ticker marker (exchange convention)
const DOLLAR_TICKER_RE = /\$([A-Z]{1,5}(?:\.[A-Z]{1,2})?)/g;
// Bare uppercase ticker: 2–5 letters, optionally followed by .1-2 uppercase letters.
// Negative look-behind/ahead prevents matching inside longer uppercase runs.
const BARE_TICKER_RE = /(?<![A-Z.])([A-Z]{2,5}(?:\.[A-Z]{1,2})?)(?![A-Z.])/g;

/**
 * Returns a sorted, deduplicated array of ticker symbols found in `text`.
 * Returns an empty array if no tickers are detected.
 */
export function extractTickers(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(DOLLAR_TICKER_RE)) {
    const ticker = match[1];
    if (ticker && !TICKER_STOP_WORDS.has(ticker)) {
      found.add(ticker);
    }
  }

  for (const match of text.matchAll(BARE_TICKER_RE)) {
    const ticker = match[1];
    if (ticker && !TICKER_STOP_WORDS.has(ticker)) {
      found.add(ticker);
    }
  }

  return Array.from(found).sort();
}
