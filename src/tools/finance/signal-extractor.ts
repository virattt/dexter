/**
 * Asset signal extractor.
 *
 * Rule-based (no LLM, no API calls) module that maps a query containing
 * asset identifiers (tickers, keywords) to a prioritised list of signal
 * categories. Each signal carries a Polymarket search phrase and a weight
 * used by the log-odds probability combiner.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetType =
  | 'tech_semiconductor'
  | 'tech_software'
  | 'tech_general'
  | 'healthcare'
  | 'financials'
  | 'energy'
  | 'consumer'
  | 'crypto'
  | 'commodity'
  | 'macro';

export interface SignalCategory {
  name: string;
  searchPhrase: string;
  weight: number;
  category: string;
}

// ---------------------------------------------------------------------------
// Sector map (top ~80 tickers → AssetType)
// ---------------------------------------------------------------------------

const SECTOR_MAP: Record<string, AssetType> = {
  // Tech — Semiconductors
  NVDA: 'tech_semiconductor', AMD: 'tech_semiconductor', TSM: 'tech_semiconductor',
  TSMC: 'tech_semiconductor', INTC: 'tech_semiconductor', QCOM: 'tech_semiconductor',
  AVGO: 'tech_semiconductor', MU: 'tech_semiconductor', AMAT: 'tech_semiconductor',
  LRCX: 'tech_semiconductor', KLAC: 'tech_semiconductor', MRVL: 'tech_semiconductor',
  ARM: 'tech_semiconductor', ASML: 'tech_semiconductor', ON: 'tech_semiconductor',
  // Tech — Software / Cloud
  MSFT: 'tech_software', GOOGL: 'tech_software', GOOG: 'tech_software',
  META: 'tech_software', AMZN: 'tech_software', ORCL: 'tech_software',
  CRM: 'tech_software', NOW: 'tech_software', SNOW: 'tech_software',
  PLTR: 'tech_software', ADBE: 'tech_software', SAP: 'tech_software',
  TEAM: 'tech_software', NET: 'tech_software', DDOG: 'tech_software',
  ZS: 'tech_software', CRWD: 'tech_software',
  // Tech — General (hardware / devices)
  AAPL: 'tech_general', DELL: 'tech_general', HPQ: 'tech_general',
  // Healthcare
  PFE: 'healthcare', MRNA: 'healthcare', LLY: 'healthcare', JNJ: 'healthcare',
  ABBV: 'healthcare', BMY: 'healthcare', MRK: 'healthcare', GILD: 'healthcare',
  REGN: 'healthcare', BIIB: 'healthcare', AMGN: 'healthcare', AZN: 'healthcare',
  NVO: 'healthcare', RHHBY: 'healthcare', SNY: 'healthcare',
  // Financials
  JPM: 'financials', GS: 'financials', BAC: 'financials', WFC: 'financials',
  MS: 'financials', C: 'financials', BLK: 'financials', V: 'financials',
  MA: 'financials', AXP: 'financials', SCHW: 'financials', BRK: 'financials',
  // Energy
  XOM: 'energy', CVX: 'energy', COP: 'energy', SLB: 'energy',
  EOG: 'energy', OXY: 'energy', PSX: 'energy', VLO: 'energy',
  MPC: 'energy', BP: 'energy', SHEL: 'energy',
  // Consumer
  WMT: 'consumer', COST: 'consumer', TGT: 'consumer', MCD: 'consumer',
  SBUX: 'consumer', NKE: 'consumer', DIS: 'consumer', NFLX: 'consumer',
  TSLA: 'consumer', HD: 'consumer', LOW: 'consumer',
  BABA: 'consumer', PG: 'consumer', KO: 'consumer', PEP: 'consumer',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRYPTO_KEYWORDS = [
  'btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'crypto',
  'defi', 'nft', 'bnb', 'xrp', 'ada', 'avax', 'doge',
];

const MACRO_KEYWORDS = [
  'fed', 'fomc', 'rate cut', 'rate hike', 'cpi', 'ppi', 'gdp',
  'recession', 'inflation', 'employment', 'jobs', 'payroll',
  'tariff', 'trade war',
];

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getCurrentQuarter(): string {
  return `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
}

function substituteTemplates(phrase: string, ticker: string): string {
  const year = getCurrentYear();
  const quarter = getCurrentQuarter();
  return phrase
    .replace(/\{year\}/g, String(year))
    .replace(/\{quarter\}/g, quarter)
    .replace(/\{nextYear\}/g, String(year + 1))
    .replace(/\{ticker\}/g, ticker);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export function detectAssetType(query: string): { type: AssetType; ticker: string | null } {
  const lower = query.toLowerCase();

  // 1. Crypto keywords (check before ticker scan to avoid false positives)
  if (CRYPTO_KEYWORDS.some((kw) => lower.includes(kw))) {
    if (lower.includes('btc') || lower.includes('bitcoin')) return { type: 'crypto', ticker: 'BTC' };
    if (lower.includes('eth') || lower.includes('ethereum')) return { type: 'crypto', ticker: 'ETH' };
    if (lower.includes('sol') || lower.includes('solana')) return { type: 'crypto', ticker: 'SOL' };
    return { type: 'crypto', ticker: null };
  }

  // 2. Explicit $TICKER prefix (dollar sign signals intent clearly)
  const dollarMatch = query.match(/\$([A-Z]{1,5})\b/);
  if (dollarMatch) {
    const ticker = dollarMatch[1];
    const type: AssetType = SECTOR_MAP[ticker] ?? 'tech_general';
    return { type, ticker };
  }

  // 3. Known tickers from SECTOR_MAP
  for (const ticker of Object.keys(SECTOR_MAP)) {
    if (new RegExp(`\\b${ticker}\\b`).test(query)) {
      return { type: SECTOR_MAP[ticker], ticker };
    }
  }

  // 4. Macro keywords
  if (MACRO_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { type: 'macro', ticker: null };
  }

  return { type: 'macro', ticker: null };
}

// ---------------------------------------------------------------------------
// Signal maps — weights MUST sum to 1.0 for each asset type
// ---------------------------------------------------------------------------

const SIGNAL_MAPS: Record<AssetType, Array<{ name: string; tpl: string; weight: number; category: string }>> = {
  tech_semiconductor: [
    { name: 'Earnings',        tpl: '{ticker} earnings beat {year}',   weight: 0.35, category: 'earnings' },
    { name: 'Export Controls', tpl: 'chip export controls {year}',      weight: 0.20, category: 'regulatory' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',  weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',    tpl: 'US recession {year}',              weight: 0.15, category: 'macro_growth' },
    { name: 'Supply Chain',    tpl: 'TSMC supply disruption',           weight: 0.10, category: 'supply_chain' },
  ],
  tech_software: [
    { name: 'Earnings',         tpl: '{ticker} earnings beat {year}',   weight: 0.35, category: 'earnings' },
    { name: 'AI Regulation',    tpl: 'AI regulation {year}',            weight: 0.20, category: 'regulatory' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',  weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',     tpl: 'US recession {year}',             weight: 0.15, category: 'macro_growth' },
    { name: 'Antitrust',        tpl: 'tech antitrust {year}',           weight: 0.10, category: 'regulatory' },
  ],
  tech_general: [
    { name: 'Earnings',         tpl: '{ticker} earnings beat {year}',   weight: 0.35, category: 'earnings' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',  weight: 0.25, category: 'macro_rates' },
    { name: 'US Recession',     tpl: 'US recession {year}',             weight: 0.20, category: 'macro_growth' },
    { name: 'Trade / Tariffs',  tpl: 'tariff trade war {year}',         weight: 0.20, category: 'trade_policy' },
  ],
  healthcare: [
    { name: 'FDA Approval',       tpl: '{ticker} FDA approval {year}',         weight: 0.40, category: 'fda_approval' },
    { name: 'Earnings',           tpl: '{ticker} quarterly results {year}',     weight: 0.25, category: 'earnings' },
    { name: 'Drug Pricing Policy', tpl: 'drug pricing regulation {year}',       weight: 0.20, category: 'regulatory' },
    { name: 'Fed Rate Decision',  tpl: 'Fed rate cut {quarter} {year}',         weight: 0.15, category: 'macro_rates' },
  ],
  financials: [
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',         weight: 0.35, category: 'macro_rates' },
    { name: 'Earnings',          tpl: '{ticker} earnings beat {year}',          weight: 0.30, category: 'earnings' },
    { name: 'US Recession',      tpl: 'US recession {year}',                   weight: 0.25, category: 'macro_growth' },
    { name: 'Bank Regulation',   tpl: 'bank capital requirements {year}',      weight: 0.10, category: 'regulatory' },
  ],
  energy: [
    { name: 'Oil Price / OPEC',  tpl: 'OPEC oil production {year}',            weight: 0.35, category: 'commodity' },
    { name: 'Earnings',          tpl: '{ticker} quarterly earnings {year}',    weight: 0.25, category: 'earnings' },
    { name: 'Geopolitical',      tpl: 'Middle East conflict {year}',           weight: 0.25, category: 'geopolitical' },
    { name: 'US Recession',      tpl: 'US recession {year}',                   weight: 0.15, category: 'macro_growth' },
  ],
  consumer: [
    { name: 'Earnings',          tpl: '{ticker} earnings beat {year}',         weight: 0.35, category: 'earnings' },
    { name: 'US Recession',      tpl: 'US recession {year}',                   weight: 0.30, category: 'macro_growth' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',         weight: 0.20, category: 'macro_rates' },
    { name: 'Trade / Tariffs',   tpl: 'tariff trade war {year}',               weight: 0.15, category: 'trade_policy' },
  ],
  crypto: [
    { name: 'SEC / Regulation',  tpl: 'SEC crypto regulation {year}',          weight: 0.35, category: 'regulatory' },
    { name: 'ETF / Product',     tpl: '{ticker} ETF approval {year}',          weight: 0.30, category: 'etf_product' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',         weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession {year}',                   weight: 0.15, category: 'macro_growth' },
  ],
  commodity: [
    { name: 'Supply / Demand',   tpl: 'commodity supply disruption {year}',    weight: 0.40, category: 'commodity' },
    { name: 'Geopolitical',      tpl: 'geopolitical conflict {year}',          weight: 0.30, category: 'geopolitical' },
    { name: 'US Recession',      tpl: 'US recession {year}',                   weight: 0.20, category: 'macro_growth' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',         weight: 0.10, category: 'macro_rates' },
  ],
  macro: [
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut {quarter} {year}',         weight: 0.35, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession {year}',                   weight: 0.35, category: 'macro_growth' },
    { name: 'Trade / Tariffs',   tpl: 'tariff trade war {year}',               weight: 0.20, category: 'trade_policy' },
    { name: 'Geopolitical',      tpl: 'geopolitical conflict {year}',          weight: 0.10, category: 'geopolitical' },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns prioritised signal categories for the asset(s) found in `query`,
 * sorted by weight descending. All template placeholders are substituted with
 * current year/quarter and the detected ticker.
 */
export function extractSignals(query: string): SignalCategory[] {
  const { type, ticker } = detectAssetType(query);
  const templates = SIGNAL_MAPS[type];
  const tickerStr = ticker ?? 'asset';

  return templates.map((t) => ({
    name: t.name,
    searchPhrase: substituteTemplates(t.tpl, tickerStr),
    weight: t.weight,
    category: t.category,
  }));
}
