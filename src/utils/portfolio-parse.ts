/**
 * Parse portfolio markdown table to positions (ticker, weight).
 * Used by validate-portfolio script and hyperliquid_performance tool.
 */

export interface PortfolioPosition {
  ticker: string;
  weight: number;
}

const HEADER_KEYS = /^(ticker|weight|layer|tier|category|notes)$/i;

export function parsePortfolioMarkdown(content: string): PortfolioPosition[] {
  const positions: PortfolioPosition[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|--')) continue;
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const ticker = parts[0].toUpperCase();
      const weightStr = parts[1].replace('%', '');
      const weight = parseFloat(weightStr);
      if (!Number.isNaN(weight) && ticker && !HEADER_KEYS.test(ticker)) {
        positions.push({ ticker, weight });
      }
    }
  }
  return positions;
}

/**
 * Validate that all portfolio tickers are in the allowed HL symbol set.
 * Returns list of error messages for unknown symbols.
 */
export function validateHLPortfolioSymbols(
  positions: PortfolioPosition[],
  allowedSymbols: Set<string>,
): string[] {
  const errors: string[] = [];
  for (const p of positions) {
    const n = p.ticker.trim().toUpperCase().replace(/^[a-z]+:/i, '');
    if (!allowedSymbols.has(n)) {
      errors.push(`Unknown HL symbol: ${p.ticker}`);
    }
  }
  return errors;
}
