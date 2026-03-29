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
 * The map must include BOTH the generic signal-extractor category names
 * (e.g. 'macro_rates', 'macro_growth', 'trade_policy', 'geopolitical') AND
 * the specific event names (e.g. 'fed_rate_cut', 'recession', 'tariff_increase').
 * If only specific names are present, every generic-category market falls to
 * the default entry, producing identical forecasts for all assets.
 *
 * assetClass is a broad tag produced by inferAssetClass().
 * Asset classes: 'semiconductor', 'tech', 'energy', 'gold', 'bond', 'defense',
 *   'airline', 'consumer', 'biotech', 'usd', 'crypto', 'materials', 'industrial',
 *   'financial', 'small_cap', 'equity' (catch-all)
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
 *
 * Keys must match the `category` field values from signal-extractor.ts SIGNAL_MAPS
 * (e.g. 'macro_rates', 'macro_growth', 'trade_policy', 'geopolitical') plus any
 * specific event names used elsewhere (e.g. 'fed_rate_cut', 'recession').
 *
 * Asset class columns: 'semiconductor', 'tech', 'energy', 'gold', 'bond', 'defense',
 *   'airline', 'consumer', 'biotech', 'usd', 'crypto', 'materials', 'industrial',
 *   'financial', 'small_cap', 'equity', 'default'
 */
export const IMPACT_MAP: Record<string, Record<string, ImpactEntry>> = {

  // ── Generic signal-extractor category names (MUST match SIGNAL_MAPS.category) ──

  // "macro_rates": Fed/FOMC rate decisions — net ambiguous (covers both cut & hike markets),
  // but the Fed cycle is more often queried as "rate cut?" so slight positive bias for equity.
  // EXCEPTION: financial sector — higher rates expand NIM → rising-rate expectations are bullish.
  macro_rates: {
    equity:       { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    tech:         { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    semiconductor:{ deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    financial:    { deltaYes: -0.03, deltaNo:  0.02, tier: 'macro' },  // rate cut = NIM compression
    small_cap:    { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },  // small caps more rate-sensitive
    materials:    { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    industrial:   { deltaYes:  0.03, deltaNo: -0.01, tier: 'macro' },
    bond:         { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    usd:          { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    crypto:       { deltaYes:  0.03, deltaNo: -0.01, tier: 'macro' },
    gold:         { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    default:      { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
  },

  // "macro_growth": recession / GDP contraction risk — YES = recession scenario
  macro_growth: {
    equity:       { deltaYes: -0.12, deltaNo:  0.02, tier: 'macro' },
    tech:         { deltaYes: -0.10, deltaNo:  0.02, tier: 'macro' },
    semiconductor:{ deltaYes: -0.11, deltaNo:  0.02, tier: 'macro' },
    materials:    { deltaYes: -0.15, deltaNo:  0.02, tier: 'macro' },  // highly cyclical
    industrial:   { deltaYes: -0.14, deltaNo:  0.02, tier: 'macro' },  // highly cyclical
    financial:    { deltaYes: -0.16, deltaNo:  0.02, tier: 'macro' },  // loan defaults
    small_cap:    { deltaYes: -0.16, deltaNo:  0.03, tier: 'macro' },  // higher leverage
    energy:       { deltaYes: -0.08, deltaNo:  0.01, tier: 'macro' },
    consumer:     { deltaYes: -0.10, deltaNo:  0.02, tier: 'macro' },
    gold:         { deltaYes:  0.06, deltaNo: -0.01, tier: 'macro' },  // safe haven
    bond:         { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },  // flight to quality
    defense:      { deltaYes: -0.04, deltaNo:  0.01, tier: 'macro' },  // govt contracts stable
    biotech:      { deltaYes: -0.06, deltaNo:  0.01, tier: 'macro' },
    airline:      { deltaYes: -0.12, deltaNo:  0.02, tier: 'macro' },
    crypto:       { deltaYes: -0.10, deltaNo:  0.01, tier: 'macro' },
    default:      { deltaYes: -0.08, deltaNo:  0.01, tier: 'macro' },
  },

  // "trade_policy": tariffs, trade wars — YES = trade restriction scenario
  // KEY: US tariffs on steel/metals PROTECT domestic producers → POSITIVE for materials ETFs!
  trade_policy: {
    semiconductor:{ deltaYes: -0.06, deltaNo:  0.03, tier: 'geopolitical' },
    tech:         { deltaYes: -0.04, deltaNo:  0.02, tier: 'geopolitical' },
    materials:    { deltaYes:  0.07, deltaNo: -0.03, tier: 'geopolitical' },  // tariffs protect domestic steel
    industrial:   { deltaYes: -0.05, deltaNo:  0.02, tier: 'geopolitical' },  // supply chains disrupted
    consumer:     { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    energy:       { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    financial:    { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    small_cap:    { deltaYes: -0.01, deltaNo:  0.005, tier: 'geopolitical' }, // domestic focus, less exposed
    equity:       { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    defense:      { deltaYes:  0.01, deltaNo: -0.005, tier: 'geopolitical' }, // neutral / slight positive
    default:      { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
  },

  // "geopolitical": wars, conflicts, sanctions — YES = escalation scenario
  geopolitical: {
    defense:      { deltaYes:  0.05, deltaNo: -0.01, tier: 'geopolitical' },
    energy:       { deltaYes:  0.06, deltaNo: -0.02, tier: 'geopolitical' },
    gold:         { deltaYes:  0.05, deltaNo: -0.01, tier: 'geopolitical' },
    materials:    { deltaYes:  0.03, deltaNo: -0.01, tier: 'geopolitical' },  // supply disruption → higher prices
    airline:      { deltaYes: -0.06, deltaNo:  0.02, tier: 'geopolitical' },
    equity:       { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    tech:         { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    semiconductor:{ deltaYes: -0.04, deltaNo:  0.02, tier: 'geopolitical' },  // export control risk
    financial:    { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    consumer:     { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    industrial:   { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    crypto:       { deltaYes: -0.04, deltaNo:  0.01, tier: 'geopolitical' },
    default:      { deltaYes:  0.01, deltaNo: -0.005, tier: 'geopolitical' },
  },

  // "earnings": company earnings beat signal (ETFs have no earnings → expect 0 relevant markets)
  earnings: {
    equity:       { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
    tech:         { deltaYes:  0.07, deltaNo: -0.05, tier: 'macro' },
    semiconductor:{ deltaYes:  0.08, deltaNo: -0.05, tier: 'macro' },
    biotech:      { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
    financial:    { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    energy:       { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    consumer:     { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    defense:      { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    default:      { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
  },

  // "commodity": commodity price events (oil, metals, agricultural) — YES = price rise
  commodity: {
    energy:       { deltaYes:  0.05, deltaNo: -0.02, tier: 'macro' },
    materials:    { deltaYes:  0.05, deltaNo: -0.02, tier: 'macro' },
    gold:         { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    airline:      { deltaYes: -0.06, deltaNo:  0.03, tier: 'macro' },
    consumer:     { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    industrial:   { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    equity:       { deltaYes: -0.01, deltaNo:  0.005, tier: 'macro' },
    default:      { deltaYes:  0.01, deltaNo: -0.005, tier: 'macro' },
  },

  // "government_budget": defense spending / government budget
  government_budget: {
    defense:      { deltaYes:  0.07, deltaNo: -0.03, tier: 'geopolitical' },
    industrial:   { deltaYes:  0.03, deltaNo: -0.01, tier: 'geopolitical' },
    default:      { deltaYes:  0.02, deltaNo: -0.01, tier: 'geopolitical' },
  },

  // "regulatory": general regulatory / antitrust events
  regulatory: {
    tech:         { deltaYes: -0.04, deltaNo:  0.02, tier: 'macro' },
    semiconductor:{ deltaYes: -0.04, deltaNo:  0.02, tier: 'macro' },
    crypto:       { deltaYes: -0.08, deltaNo:  0.03, tier: 'electoral' },
    biotech:      { deltaYes: -0.06, deltaNo:  0.04, tier: 'macro' },
    financial:    { deltaYes: -0.03, deltaNo:  0.02, tier: 'macro' },
    default:      { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
  },

  // "supply_chain": supply disruptions, chip/TSMC availability — YES = disruption
  supply_chain: {
    semiconductor:{ deltaYes: -0.06, deltaNo:  0.03, tier: 'macro' },
    tech:         { deltaYes: -0.04, deltaNo:  0.02, tier: 'macro' },
    industrial:   { deltaYes: -0.03, deltaNo:  0.01, tier: 'macro' },
    consumer:     { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    default:      { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
  },

  // "etf_product": ETF launches / Bitcoin spot ETF — YES = launch approved
  etf_product: {
    crypto:  { deltaYes:  0.12, deltaNo: -0.06, tier: 'electoral' },
    default: { deltaYes:  0.04, deltaNo: -0.02, tier: 'electoral' },
  },

  // ── Specific event keys (used when caller knows the exact event type) ─────

  earnings_beat: {
    equity:       { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
    tech:         { deltaYes:  0.07, deltaNo: -0.05, tier: 'macro' },
    semiconductor:{ deltaYes:  0.08, deltaNo: -0.05, tier: 'macro' },
    financial:    { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },  // banks beat → modest gain
    materials:    { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },  // materials not premium-growth
    industrial:   { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    small_cap:    { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
    defense:      { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    default:      { deltaYes:  0.06, deltaNo: -0.04, tier: 'macro' },
  },
  earnings_miss: {
    equity:    { deltaYes: -0.06, deltaNo:  0.03, tier: 'macro' },
    tech:      { deltaYes: -0.07, deltaNo:  0.04, tier: 'macro' },
    financial: { deltaYes: -0.05, deltaNo:  0.03, tier: 'macro' },
    materials: { deltaYes: -0.05, deltaNo:  0.03, tier: 'macro' },
    default:   { deltaYes: -0.06, deltaNo:  0.03, tier: 'macro' },
  },
  fed_rate_cut: {
    equity:     { deltaYes:  0.03, deltaNo: -0.02, tier: 'macro' },
    bond:       { deltaYes:  0.05, deltaNo: -0.03, tier: 'macro' },
    usd:        { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    financial:  { deltaYes: -0.04, deltaNo:  0.02, tier: 'macro' },  // NIM compression
    small_cap:  { deltaYes:  0.05, deltaNo: -0.02, tier: 'macro' },
    materials:  { deltaYes:  0.03, deltaNo: -0.02, tier: 'macro' },
    industrial: { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    defense:    { deltaYes:  0.01, deltaNo: -0.005, tier: 'macro' },
    default:    { deltaYes:  0.03, deltaNo: -0.02, tier: 'macro' },
  },
  fed_rate_hike: {
    equity:     { deltaYes: -0.03, deltaNo:  0.02, tier: 'macro' },
    bond:       { deltaYes: -0.05, deltaNo:  0.03, tier: 'macro' },
    financial:  { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },  // NIM expansion
    small_cap:  { deltaYes: -0.05, deltaNo:  0.02, tier: 'macro' },
    materials:  { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    industrial: { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    defense:    { deltaYes: -0.01, deltaNo:  0.005, tier: 'macro' },
    default:    { deltaYes: -0.03, deltaNo:  0.02, tier: 'macro' },
  },
  tariff_increase: {
    semiconductor: { deltaYes: -0.07, deltaNo:  0.03, tier: 'geopolitical' },
    consumer:      { deltaYes: -0.04, deltaNo:  0.02, tier: 'geopolitical' },
    energy:        { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    materials:     { deltaYes:  0.08, deltaNo: -0.03, tier: 'geopolitical' }, // protects domestic steel
    industrial:    { deltaYes: -0.05, deltaNo:  0.02, tier: 'geopolitical' },
    financial:     { deltaYes: -0.02, deltaNo:  0.01, tier: 'geopolitical' },
    small_cap:     { deltaYes: -0.01, deltaNo:  0.005, tier: 'geopolitical' },
    default:       { deltaYes: -0.04, deltaNo:  0.02, tier: 'geopolitical' },
  },
  tariff_relief: {
    semiconductor: { deltaYes:  0.06, deltaNo: -0.02, tier: 'geopolitical' },
    consumer:      { deltaYes:  0.03, deltaNo: -0.01, tier: 'geopolitical' },
    materials:     { deltaYes: -0.06, deltaNo:  0.02, tier: 'geopolitical' }, // more competition
    industrial:    { deltaYes:  0.04, deltaNo: -0.02, tier: 'geopolitical' },
    financial:     { deltaYes:  0.02, deltaNo: -0.01, tier: 'geopolitical' },
    default:       { deltaYes:  0.04, deltaNo: -0.01, tier: 'geopolitical' },
  },
  oil_spike: {
    energy:    { deltaYes:  0.05,  deltaNo: -0.02,  tier: 'geopolitical' },
    airline:   { deltaYes: -0.06,  deltaNo:  0.03,  tier: 'geopolitical' },
    consumer:  { deltaYes: -0.03,  deltaNo:  0.01,  tier: 'geopolitical' },
    materials: { deltaYes: -0.02,  deltaNo:  0.01,  tier: 'geopolitical' },  // energy input cost
    default:   { deltaYes: -0.02,  deltaNo:  0.01,  tier: 'geopolitical' },
  },
  recession: {
    equity:     { deltaYes: -0.12, deltaNo:  0.02, tier: 'macro' },
    materials:  { deltaYes: -0.15, deltaNo:  0.02, tier: 'macro' },
    industrial: { deltaYes: -0.14, deltaNo:  0.02, tier: 'macro' },
    financial:  { deltaYes: -0.16, deltaNo:  0.02, tier: 'macro' },
    small_cap:  { deltaYes: -0.16, deltaNo:  0.03, tier: 'macro' },
    gold:       { deltaYes:  0.06, deltaNo: -0.01, tier: 'macro' },
    bond:       { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    defense:    { deltaYes: -0.04, deltaNo:  0.01, tier: 'macro' },
    default:    { deltaYes: -0.08, deltaNo:  0.01, tier: 'macro' },
  },
  geopolitical_conflict: {
    defense:    { deltaYes:  0.04, deltaNo: -0.01, tier: 'geopolitical' },
    energy:     { deltaYes:  0.06, deltaNo: -0.02, tier: 'geopolitical' },
    gold:       { deltaYes:  0.05, deltaNo: -0.01, tier: 'geopolitical' },
    materials:  { deltaYes:  0.03, deltaNo: -0.01, tier: 'geopolitical' },
    airline:    { deltaYes: -0.05, deltaNo:  0.02, tier: 'geopolitical' },
    financial:  { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    industrial: { deltaYes: -0.03, deltaNo:  0.01, tier: 'geopolitical' },
    default:    { deltaYes:  0.02, deltaNo: -0.01, tier: 'geopolitical' },
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
    equity:     { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
    materials:  { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    industrial: { deltaYes:  0.04, deltaNo: -0.02, tier: 'macro' },
    financial:  { deltaYes:  0.03, deltaNo: -0.01, tier: 'macro' },
    default:    { deltaYes:  0.02, deltaNo: -0.01, tier: 'macro' },
  },
  macro_data_weak: {
    equity:  { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
    default: { deltaYes: -0.02, deltaNo:  0.01, tier: 'macro' },
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
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
  'XLK',  // Technology Select SPDR
]);
const ENERGY_TICKERS = new Set([
  'XLE', 'XOM', 'CVX', 'OXY', 'COP', 'SLB', 'EOG', 'PSX', 'VLO', 'MPC', 'BP', 'SHEL',
  'USO', 'UCO',  // oil ETFs
]);
const GOLD_TICKERS = new Set(['GLD', 'IAU', 'XAUUSD', 'GOLD']);
const BOND_TICKERS = new Set(['TLT', 'IEF', 'SHY', 'AGG', 'BND', 'LQD', 'HYG', 'JNK', 'BNDX']);
const DEFENSE_TICKERS = new Set(['LMT', 'RTX', 'NOC', 'GD', 'ITA', 'BA', 'HII', 'L3H', 'LHX', 'LDOS', 'HEI', 'KTOS']);
const AIRLINE_TICKERS = new Set(['UAL', 'DAL', 'AAL', 'LUV', 'JETS', 'ALK', 'SAVE', 'RYAAY', 'HA']);
const CONSUMER_TICKERS = new Set([
  'XLY', 'XLP', 'WMT', 'TGT', 'COST', 'MCD', 'SBUX', 'NKE', 'DIS', 'NFLX', 'HD', 'LOW',
  'PG', 'KO', 'PEP', 'BABA', 'TSLA',
]);
const BIOTECH_TICKERS = new Set([
  'MRNA', 'PFE', 'BIIB', 'REGN', 'XBI', 'IBB', 'LLY', 'JNJ', 'ABBV',
  'BMY', 'MRK', 'GILD', 'AMGN', 'AZN', 'NVO', 'RHHBY', 'SNY',
]);
const USD_TICKERS = new Set(['UUP', 'DXY', 'USD', 'USDU']);
const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'COIN', 'ADA', 'DOGE', 'AVAX', 'IBIT', 'FBTC']);

// New sector-specific classification sets
const MATERIALS_TICKERS = new Set([
  // Steel & metals ETFs
  'SLX',   // VanEck Steel ETF
  'XME',   // SPDR Metals & Mining
  'XLB',   // Materials Select SPDR
  'PICK',  // iShares MSCI Global Metals & Mining
  'REMX',  // VanEck Rare Earth/Strategic Metals
  // Gold miners (different from physical gold)
  'GDX',   // VanEck Gold Miners
  'GDXJ',  // VanEck Junior Gold Miners
  // Individual materials/steel stocks
  'NUE', 'STLD', 'CLF', 'X',   // US steel producers
  'FCX', 'AA', 'VALE', 'RIO',   // metals/mining
  'BHP', 'SCCO', 'MP',          // global miners
]);
const INDUSTRIAL_TICKERS = new Set([
  'XLI',   // Industrials Select SPDR
  'VIS',   // Vanguard Industrials
  'PAVE',  // Global X U.S. Infrastructure Development
  'GWX',   // SPDR MSCI World Industrials
  // Individual industrial stocks
  'CAT', 'DE', 'MMM', 'HON', 'GE', 'EMR', 'ETN', 'PH',
  'ROK', 'FTV', 'CARR', 'OTIS', 'IR',
]);
const FINANCIAL_TICKERS = new Set([
  // Regional / community bank ETFs — very Fed-sensitive
  'KRE',   // SPDR S&P Regional Banking
  'KBE',   // SPDR S&P Bank
  'IAI',   // iShares U.S. Broker-Dealers & Securities Exchanges
  'KBWB',  // Invesco KBW Bank
  'FAS',   // Direxion Daily Financial Bull 3X
  'FAZ',   // Direxion Daily Financial Bear 3X
  // Broad financial ETF
  'XLF',   // Financial Select SPDR
  // Individual financial stocks
  'JPM', 'GS', 'BAC', 'WFC', 'MS', 'C', 'BLK',
  'V', 'MA', 'AXP', 'SCHW', 'BRK',
]);
const SMALL_CAP_TICKERS = new Set([
  'IWM',   // iShares Russell 2000
  'VBK',   // Vanguard Small-Cap Growth
  'IJR',   // iShares Core S&P Small-Cap
  'SLY',   // SPDR S&P 600 Small Cap
  'VB',    // Vanguard Small-Cap
  'SCHA',  // Schwab U.S. Small-Cap
]);

/**
 * Infer a broad asset-class tag from a ticker or keyword.
 * Returns one of: 'semiconductor', 'tech', 'energy', 'gold', 'bond', 'defense',
 *   'airline', 'consumer', 'biotech', 'usd', 'crypto', 'materials', 'industrial',
 *   'financial', 'small_cap', 'equity'
 *
 * Order matters — more specific classes are checked before broad 'equity' fallback.
 */
export function inferAssetClass(ticker: string): string {
  const t = ticker.toUpperCase().trim();
  if (SEMICONDUCTOR_TICKERS.has(t)) return 'semiconductor';
  if (TECH_TICKERS.has(t)) return 'tech';
  if (MATERIALS_TICKERS.has(t)) return 'materials';
  if (INDUSTRIAL_TICKERS.has(t)) return 'industrial';
  if (FINANCIAL_TICKERS.has(t)) return 'financial';
  if (SMALL_CAP_TICKERS.has(t)) return 'small_cap';
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
  if (['SPY', 'QQQ', 'IVV', 'VOO', 'VTI', 'DIA', 'XLC', 'SCHB', 'VTI'].includes(t)) return 'equity';
  return 'equity';
}
