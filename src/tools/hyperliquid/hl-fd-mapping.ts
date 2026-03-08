/**
 * HL → FD symbol mapping for price lookups and performance computation.
 * Mirrors docs/HYPERLIQUID-SYMBOL-MAP.md (stocks 1:1, commodities/indices to ETF proxies).
 */

export const HL_TO_FD: Record<string, string> = {
  // Commodities
  USOIL: 'USO',
  NATGAS: 'UNG',
  OIL: 'USO',
  SILVER: 'SLV',
  GOLD: 'GLD',
  COPPER: 'CPER',
  // Indices
  US500: 'SPY',
  SEMIS: 'SMH',
  SMALL2000: 'IWM',
  MAG7: 'QQQ',
  INFOTECH: 'QQQ',
  ROBOT: 'BOTZ',
  XYZ100: 'SPY',
  // Stocks (1:1)
  AAPL: 'AAPL',
  NVDA: 'NVDA',
  MSFT: 'MSFT',
  PLTR: 'PLTR',
  RIVN: 'RIVN',
  GOOGL: 'GOOGL',
  NFLX: 'NFLX',
  AMZN: 'AMZN',
  TSLA: 'TSLA',
  META: 'META',
  ORCL: 'ORCL',
  COIN: 'COIN',
  HOOD: 'HOOD',
  AMD: 'AMD',
  MSTR: 'MSTR',
  CRCL: 'CRCL',
  MU: 'MU',
  INTC: 'INTC',
  TSM: 'TSM',
  SNDNK: 'SNDK', // SNDK if listed on FD; otherwise may need to skip or use HL only
  EWY: 'EWY',
};

/** Pre-IPO / tokenized symbols with no FD data; use hyperliquid_prices for end price only. */
export const PRE_IPO = new Set<string>(['OPENAI', 'SPACEX', 'ANTHROPIC']);

export function getFDTicker(hlSymbol: string): string | null {
  const normalized = hlSymbol.trim().toUpperCase().replace(/^[a-z]+:/i, '');
  if (PRE_IPO.has(normalized)) return null;
  return HL_TO_FD[normalized] ?? null;
}

/** Symbols known to exist on HIP-3 (for validation). Includes HL_TO_FD, PRE_IPO, and common crypto/L1 names. */
export const KNOWN_HL_SYMBOLS: Set<string> = new Set([
  ...Object.keys(HL_TO_FD),
  ...PRE_IPO,
  'BTC',
  'HYPE',
  'SOL',
  'ETH',
  'NEAR',
  'SUI',
]);

export function isKnownHLSymbol(symbol: string): boolean {
  const n = symbol.trim().toUpperCase().replace(/^[a-z]+:/i, '');
  return KNOWN_HL_SYMBOLS.has(n);
}

/** Fixed equal-weight HL basket (PRD §2.1 top liquid; pre-IPO excluded). Used for hl_basket return. */
export const HL_BASKET_SYMBOLS: string[] = [
  'NVDA',
  'MU',
  'SNDNK',
  'HOOD',
  'CRCL',
  'TSLA',
  'INTC',
  'ORCL',
  'EWY',
  'GOOGL',
  'COIN',
  'MSTR',
  'META',
  'AMZN',
  'MSFT',
];
