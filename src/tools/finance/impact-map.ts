/**
 * Impact Map — lookup table for δ(YES) and δ(NO).
 *
 * Estimated fractional asset return when a Polymarket event resolves YES or NO.
 * Used by polymarket-forecast.ts to convert prediction-market probabilities
 * into conditional asset-return expectations.
 *
 * Two-level structure:
 *   IMPACT_MAP[eventCategory][assetClass] → ImpactEntry
 *
 * eventCategory matches SignalCategory.category from signal-extractor.ts.
 * assetClass is a broad tag produced by inferAssetClass().
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImpactEntry {
  deltaYes: number;  // fractional return if event resolves YES (e.g. 0.06 = +6%)
  deltaNo: number;   // fractional return if event resolves NO
  tier: 'macro' | 'geopolitical' | 'electoral';
}

// ---------------------------------------------------------------------------
// Lookup table
// ---------------------------------------------------------------------------

/**
 * Two-level lookup: eventCategory → assetClass → ImpactEntry
 * eventCategory matches SignalCategory.category from signal-extractor.ts
 * assetClass is a broad tag: 'equity', 'tech', 'semiconductor', 'energy', 'gold',
 *   'bond', 'usd', 'crypto', 'biotech', 'defense', 'consumer', 'airline', 'default'
 */
export const IMPACT_MAP: Record<string, Record<string, ImpactEntry>> = {
  earnings_beat: {
    equity:       { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
    tech:         { deltaYes:  0.07, deltaNo: -0.05, tier: 'macro' },
    semiconductor:{ deltaYes:  0.08, deltaNo: -0.05, tier: 'macro' },
    default:      { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
  },
  earnings_miss: {
    equity:  { deltaYes: -0.06, deltaNo:  0.03, tier: 'macro' },
    tech:    { deltaYes: -0.07, deltaNo:  0.04, tier: 'macro' },
    default: { deltaYes: -0.06, deltaNo:  0.03, tier: 'macro' },
  },
  fed_rate_cut: {
    equity:  { deltaYes:  0.03, deltaNo: -0.02, tier: 'macro' },
    bond:    { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    usd:     { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    default: { deltaYes:  0.03, deltaNo: -0.02, tier: 'macro' },
  },
  fed_rate_hike: {
    equity:  { deltaYes: -0.03, deltaNo:  0.02, tier: 'macro' },
    bond:    { deltaYes: -0.05, deltaNo:  0.03, tier: 'macro' },
    default: { deltaYes: -0.03, deltaNo:  0.02, tier: 'macro' },
  },
  tariff_increase: {
    semiconductor: { deltaYes: -0.07, deltaNo:  0.03, tier: 'geopolitical' },
    consumer:      { deltaYes: -0.04, deltaNo:  0.02, tier: 'geopolitical' },
    energy:        { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    default:       { deltaYes: -0.04, deltaNo:  0.02, tier: 'geopolitical' },
  },
  tariff_relief: {
    semiconductor: { deltaYes:  0.06, deltaNo: -0.02, tier: 'geopolitical' },
    consumer:      { deltaYes:  0.03, deltaNo: -0.01, tier: 'geopolitical' },
    default:       { deltaYes:  0.04, deltaNo: -0.01, tier: 'geopolitical' },
  },
  oil_spike: {
    energy:   { deltaYes:  0.05, deltaNo: -0.02, tier: 'geopolitical' },
    airline:  { deltaYes: -0.06, deltaNo:  0.03, tier: 'geopolitical' },
    consumer: { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    default:  { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
  },
  recession: {
    equity:  { deltaYes: -0.12, deltaNo:  0.02, tier: 'macro' },
    gold:    { deltaYes:  0.06, deltaNo: -0.01, tier: 'macro' },
    bond:    { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    default: { deltaYes: -0.08, deltaNo:  0.01, tier: 'macro' },
  },
  geopolitical_conflict: {
    defense: { deltaYes:  0.04, deltaNo: -0.01, tier: 'geopolitical' },
    energy:  { deltaYes:  0.06, deltaNo: -0.02, tier: 'geopolitical' },
    gold:    { deltaYes:  0.05, deltaNo: -0.01, tier: 'geopolitical' },
    airline: { deltaYes: -0.05, deltaNo:  0.02, tier: 'geopolitical' },
    default: { deltaYes:  0.02, deltaNo: -0.01, tier: 'geopolitical' },
  },
  fda_approval: {
    biotech: { deltaYes:  0.25, deltaNo: -0.20, tier: 'macro' },
    default: { deltaYes:  0.10, deltaNo: -0.08, tier: 'macro' },
  },
  fda_rejection: {
    biotech: { deltaYes: -0.25, deltaNo:  0.15, tier: 'macro' },
    default: { deltaYes: -0.10, deltaNo:  0.06, tier: 'macro' },
  },
  crypto_regulation_positive: {
    crypto:  { deltaYes:  0.10, deltaNo: -0.05, tier: 'electoral' },
    default: { deltaYes:  0.05, deltaNo: -0.02, tier: 'electoral' },
  },
  crypto_regulation_negative: {
    crypto:  { deltaYes: -0.12, deltaNo:  0.05, tier: 'electoral' },
    default: { deltaYes: -0.06, deltaNo:  0.02, tier: 'electoral' },
  },
  btc_price_target: {
    crypto:  { deltaYes:  0.10, deltaNo: -0.08, tier: 'electoral' },
    default: { deltaYes:  0.05, deltaNo: -0.04, tier: 'electoral' },
  },
  election_market_friendly: {
    equity:  { deltaYes:  0.04, deltaNo: -0.02, tier: 'electoral' },
    usd:     { deltaYes:  0.02, deltaNo: -0.01, tier: 'electoral' },
    default: { deltaYes:  0.03, deltaNo: -0.01, tier: 'electoral' },
  },
  macro_data_strong: {
    equity:  { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    default: { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
  },
  macro_data_weak: {
    equity:  { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    default: { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
  },
  // Catch-all for unknown event categories
  default: {
    default: { deltaYes:  0.03, deltaNo: -0.02, tier: 'geopolitical' },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up the impact entry for a given (eventCategory, assetClass) pair.
 * Falls back gracefully:  category-specific → category default → global default.
 */
export function lookupImpact(eventCategory: string, assetClass: string): ImpactEntry {
  const catEntry = IMPACT_MAP[eventCategory] ?? IMPACT_MAP['default'];
  return catEntry[assetClass] ?? catEntry['default'] ?? IMPACT_MAP['default']!['default']!;
}

// Ticker-to-asset-class classification tables
const SEMICONDUCTOR_TICKERS = new Set([
  'NVDA', 'AMD', 'TSM', 'TSMC', 'INTC', 'QCOM', 'AVGO', 'MU', 'AMAT',
  'LRCX', 'KLAC', 'MRVL', 'ARM', 'ASML', 'ON', 'SOXX',
]);
const TECH_TICKERS = new Set([
  'MSFT', 'AAPL', 'GOOGL', 'GOOG', 'META', 'AMZN', 'ORCL', 'CRM', 'NOW',
  'SNOW', 'PLTR', 'ADBE', 'SAP', 'TEAM', 'NET', 'DDOG', 'ZS', 'CRWD', 'DELL', 'HPQ',
]);
const ENERGY_TICKERS = new Set([
  'XLE', 'XOM', 'CVX', 'OXY', 'COP', 'SLB', 'EOG', 'PSX', 'VLO', 'MPC', 'BP', 'SHEL',
]);
const GOLD_TICKERS = new Set(['GLD', 'IAU', 'XAUUSD', 'GOLD']);
const BOND_TICKERS = new Set(['TLT', 'IEF', 'SHY', 'AGG', 'BND', 'LQD', 'HYG']);
const DEFENSE_TICKERS = new Set(['LMT', 'RTX', 'NOC', 'GD', 'ITA', 'BA', 'HII', 'L3H']);
const AIRLINE_TICKERS = new Set(['UAL', 'DAL', 'AAL', 'LUV', 'JETS', 'ALK', 'SAVE']);
const CONSUMER_TICKERS = new Set([
  'XLY', 'WMT', 'TGT', 'COST', 'MCD', 'SBUX', 'NKE', 'DIS', 'NFLX', 'HD', 'LOW',
  'PG', 'KO', 'PEP', 'BABA',
]);
const BIOTECH_TICKERS = new Set([
  'MRNA', 'PFE', 'BIIB', 'REGN', 'XBI', 'IBB', 'LLY', 'JNJ', 'ABBV',
  'BMY', 'MRK', 'GILD', 'AMGN', 'AZN', 'NVO', 'RHHBY', 'SNY',
]);
const USD_TICKERS = new Set(['UUP', 'DXY', 'USD']);
const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'COIN', 'ADA', 'DOGE', 'AVAX']);

/**
 * Infer a broad asset-class tag from a ticker or keyword.
 * Returns one of: 'semiconductor', 'tech', 'energy', 'gold', 'bond', 'defense',
 *   'airline', 'consumer', 'biotech', 'usd', 'crypto', 'equity'
 */
export function inferAssetClass(ticker: string): string {
  const t = ticker.toUpperCase().trim();
  if (SEMICONDUCTOR_TICKERS.has(t)) return 'semiconductor';
  if (TECH_TICKERS.has(t)) return 'tech';
  if (ENERGY_TICKERS.has(t)) return 'energy';
  if (GOLD_TICKERS.has(t)) return 'gold';
  if (BOND_TICKERS.has(t)) return 'bond';
  if (DEFENSE_TICKERS.has(t)) return 'defense';
  if (AIRLINE_TICKERS.has(t)) return 'airline';
  if (CONSUMER_TICKERS.has(t)) return 'consumer';
  if (BIOTECH_TICKERS.has(t)) return 'biotech';
  if (USD_TICKERS.has(t)) return 'usd';
  if (CRYPTO_TICKERS.has(t)) return 'crypto';
  // Broad-market ETFs → equity
  if (['SPY', 'QQQ', 'IVV', 'VOO', 'VTI', 'DIA', 'XLK', 'XLF', 'XLC'].includes(t)) return 'equity';
  return 'equity';
}
