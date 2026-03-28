/**
 * Asset signal extractor.
 *
 * Rule-based (no LLM, no API calls) module that maps a query containing
 * asset identifiers (tickers, keywords) to a prioritised list of signal
 * categories. Each signal carries a normalised Polymarket search phrase,
 * fallback query variants, and a weight for the log-odds probability combiner.
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
  /** Primary Polymarket search phrase (normalised: company name, no year/quarter tokens). */
  searchPhrase: string;
  /** Fallback phrases tried in order when searchPhrase returns 0 results. */
  queryVariants?: string[];
  weight: number;
  category: string;
}

// ---------------------------------------------------------------------------
// Ticker → company name (Polymarket uses full names, not exchange symbols)
// ---------------------------------------------------------------------------

/** Maps exchange ticker to the name used in Polymarket question titles. */
export const TICKER_TO_COMPANY_NAME: Record<string, string> = {
  // Semiconductors
  NVDA: 'NVIDIA', AMD: 'AMD', TSM: 'TSMC', TSMC: 'TSMC',
  INTC: 'Intel', QCOM: 'Qualcomm', AVGO: 'Broadcom',
  MU: 'Micron', AMAT: 'Applied Materials', LRCX: 'Lam Research',
  KLAC: 'KLA', MRVL: 'Marvell', ARM: 'Arm', ASML: 'ASML', ON: 'ON Semiconductor',
  // Software / Cloud
  MSFT: 'Microsoft', GOOGL: 'Google', GOOG: 'Google', META: 'Meta',
  AMZN: 'Amazon', ORCL: 'Oracle', CRM: 'Salesforce', NOW: 'ServiceNow',
  SNOW: 'Snowflake', PLTR: 'Palantir', ADBE: 'Adobe', SAP: 'SAP',
  TEAM: 'Atlassian', NET: 'Cloudflare', DDOG: 'Datadog',
  ZS: 'Zscaler', CRWD: 'CrowdStrike',
  // Tech general
  AAPL: 'Apple', DELL: 'Dell', HPQ: 'HP',
  // Healthcare
  PFE: 'Pfizer', MRNA: 'Moderna', LLY: 'Eli Lilly', JNJ: 'Johnson & Johnson',
  ABBV: 'AbbVie', BMY: 'Bristol Myers Squibb', MRK: 'Merck', GILD: 'Gilead',
  REGN: 'Regeneron', BIIB: 'Biogen', AMGN: 'Amgen', AZN: 'AstraZeneca',
  NVO: 'Novo Nordisk', RHHBY: 'Roche', SNY: 'Sanofi',
  // Financials
  JPM: 'JPMorgan', GS: 'Goldman Sachs', BAC: 'Bank of America', WFC: 'Wells Fargo',
  MS: 'Morgan Stanley', C: 'Citigroup', BLK: 'BlackRock', V: 'Visa',
  MA: 'Mastercard', AXP: 'American Express', SCHW: 'Charles Schwab', BRK: 'Berkshire Hathaway',
  // Energy
  XOM: 'ExxonMobil', CVX: 'Chevron', COP: 'ConocoPhillips', SLB: 'SLB',
  EOG: 'EOG Resources', OXY: 'Occidental', PSX: 'Phillips 66', VLO: 'Valero',
  MPC: 'Marathon Petroleum', BP: 'BP', SHEL: 'Shell',
  // Consumer
  WMT: 'Walmart', COST: 'Costco', TGT: 'Target', MCD: "McDonald's",
  SBUX: 'Starbucks', NKE: 'Nike', DIS: 'Disney', NFLX: 'Netflix',
  TSLA: 'Tesla', HD: 'Home Depot', LOW: "Lowe's",
  BABA: 'Alibaba', PG: 'Procter & Gamble', KO: 'Coca-Cola', PEP: 'PepsiCo',
  // Crypto
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana',
  // Commodities — use lowercase common name for Polymarket text matching
  GOLD: 'gold', SILVER: 'silver', COPPER: 'copper', PLATINUM: 'platinum',
  PALLADIUM: 'palladium', OIL: 'oil', CRUDE: 'oil', NATGAS: 'natural gas',
  WHEAT: 'wheat', CORN: 'corn', SOYBEAN: 'soybeans', COFFEE: 'coffee', SUGAR: 'sugar',
};

// ---------------------------------------------------------------------------
// Signal keywords — used by scoreMarketRelevance to filter irrelevant results
// ---------------------------------------------------------------------------

/** Keywords expected in relevant Polymarket market titles per signal category. */
export const SIGNAL_KEYWORDS: Record<string, string[]> = {
  earnings:     ['earnings', 'EPS', 'revenue', 'quarterly', 'results', 'beat', 'miss', 'profit', 'guidance'],
  macro_rates:  ['Fed', 'FOMC', 'rate', 'interest', 'Federal Reserve', 'cut', 'hike'],
  macro_growth: ['recession', 'GDP', 'growth', 'downturn', 'economic', 'contraction'],
  regulatory:   ['regulation', 'ban', 'law', 'policy', 'SEC', 'antitrust', 'fine', 'penalty'],
  fda_approval: ['FDA', 'approval', 'drug', 'trial', 'phase', 'clearance'],
  commodity:    ['oil', 'OPEC', 'price', 'barrel', 'energy', 'supply', 'crude', 'production',
                 'gold', 'silver', 'copper', 'metal', 'ounce', 'commodity', 'natural gas', 'wheat', 'corn'],
  geopolitical: ['war', 'conflict', 'sanction', 'Middle East', 'Russia', 'China', 'Ukraine'],
  trade_policy: ['tariff', 'trade', 'import', 'export', 'duty'],
  etf_product:  ['ETF', 'fund', 'approval', 'launch', 'spot'],
  supply_chain: ['supply', 'disruption', 'shortage', 'TSMC', 'chip', 'wafer'],
};

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

/**
 * Maps commodity keyword (lowercase) → internal ticker symbol used in
 * signal templates and TICKER_TO_COMPANY_NAME. Ordered longest-first so
 * "natural gas" is matched before "gas".
 */
const COMMODITY_KEYWORD_MAP: Array<[keyword: string, ticker: string]> = [
  ['natural gas', 'NATGAS'],
  ['gold',        'GOLD'],
  ['silver',      'SILVER'],
  ['copper',      'COPPER'],
  ['platinum',    'PLATINUM'],
  ['palladium',   'PALLADIUM'],
  ['crude oil',   'OIL'],
  ['crude',       'OIL'],
  ['oil price',   'OIL'],
  ['wheat',       'WHEAT'],
  ['corn',        'CORN'],
  ['soybean',     'SOYBEAN'],
  ['coffee',      'COFFEE'],
  ['sugar',       'SUGAR'],
];

function substituteTemplates(phrase: string, ticker: string): string {
  return phrase.replace(/\{ticker\}/g, ticker);
}

/**
 * Converts a raw signal phrase into a Polymarket-friendly query string by:
 * 1. Replacing the ticker symbol with the company's common name
 * 2. Stripping year (2020–2035) and quarter (Q1–Q4) tokens
 * 3. Collapsing whitespace and truncating to ≤ 4 words
 *
 * Short phrases with company names perform far better against the Gamma API's
 * keyword text-matching than long ticker+year compound strings.
 */
export function normalizeForPolymarket(phrase: string, ticker: string | null): string {
  let result = phrase;

  // Replace ticker symbol with company name
  if (ticker) {
    const name = TICKER_TO_COMPANY_NAME[ticker.toUpperCase()];
    if (name) {
      result = result.replace(new RegExp(`\\b${ticker}\\b`, 'gi'), name);
    }
  }

  // Strip 4-digit year tokens (2020–2035)
  result = result.replace(/\b20[2-3]\d\b/g, '');

  // Strip quarter tokens Q1–Q4
  result = result.replace(/\bQ[1-4]\b/gi, '');

  // Collapse multiple spaces and trim
  result = result.replace(/\s+/g, ' ').trim();

  // Truncate to 4 words max (Gamma API keyword search works best with short phrases)
  const words = result.split(' ').filter(Boolean);
  return words.length > 4 ? words.slice(0, 4).join(' ') : result;
}

/**
 * Scores how relevant a Polymarket market question is to a signal category.
 * Returns a value 0–1 (fraction of category keywords present in the question).
 * Score 0 means no category keywords matched — the market should be filtered out.
 * Unknown categories return 1 (no filtering applied).
 */
export function scoreMarketRelevance(question: string, category: string): number {
  const keywords = SIGNAL_KEYWORDS[category];
  if (!keywords || keywords.length === 0) return 1;
  const lower = question.toLowerCase();
  const matches = keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
  return matches / keywords.length;
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

  // 4. Commodity keywords (check before macro to avoid "oil price" → macro)
  for (const [keyword, commodityTicker] of COMMODITY_KEYWORD_MAP) {
    if (lower.includes(keyword)) {
      return { type: 'commodity', ticker: commodityTicker };
    }
  }

  // 5. Macro keywords
  if (MACRO_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { type: 'macro', ticker: null };
  }

  return { type: 'macro', ticker: null };
}

// ---------------------------------------------------------------------------
// Signal maps — weights MUST sum to 1.0 for each asset type
// variantTpls: fallback templates tried in order when the primary returns 0 results
// ---------------------------------------------------------------------------

const SIGNAL_MAPS: Record<AssetType, Array<{
  name: string;
  tpl: string;
  variantTpls: string[];
  weight: number;
  category: string;
}>> = {
  tech_semiconductor: [
    { name: 'Earnings',          tpl: '{ticker} earnings',    variantTpls: ['{ticker}', 'semiconductor earnings'], weight: 0.35, category: 'earnings' },
    { name: 'Export Controls',   tpl: 'chip export controls', variantTpls: ['semiconductor export', 'chip export'], weight: 0.20, category: 'regulatory' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',         variantTpls: ['Federal Reserve rate', 'FOMC'],       weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession',         variantTpls: ['recession', 'economic recession'],    weight: 0.15, category: 'macro_growth' },
    { name: 'Supply Chain',      tpl: 'TSMC supply',          variantTpls: ['chip supply', 'semiconductor supply'], weight: 0.10, category: 'supply_chain' },
  ],
  tech_software: [
    { name: 'Earnings',          tpl: '{ticker} earnings',    variantTpls: ['{ticker}', 'tech earnings'],           weight: 0.35, category: 'earnings' },
    { name: 'AI Regulation',     tpl: 'AI regulation',        variantTpls: ['artificial intelligence regulation', 'AI policy'], weight: 0.20, category: 'regulatory' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',         variantTpls: ['Federal Reserve rate', 'FOMC'],        weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession',         variantTpls: ['recession', 'economic recession'],     weight: 0.15, category: 'macro_growth' },
    { name: 'Antitrust',         tpl: 'tech antitrust',       variantTpls: ['antitrust', '{ticker} antitrust'],     weight: 0.10, category: 'regulatory' },
  ],
  tech_general: [
    { name: 'Earnings',          tpl: '{ticker} earnings',    variantTpls: ['{ticker}', 'tech earnings'],          weight: 0.35, category: 'earnings' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',         variantTpls: ['Federal Reserve rate', 'FOMC'],       weight: 0.25, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession',         variantTpls: ['recession', 'economic recession'],    weight: 0.20, category: 'macro_growth' },
    { name: 'Trade / Tariffs',   tpl: 'tariff trade war',     variantTpls: ['tariff', 'trade war'],                weight: 0.20, category: 'trade_policy' },
  ],
  healthcare: [
    { name: 'FDA Approval',        tpl: '{ticker} FDA approval', variantTpls: ['{ticker} drug', 'FDA approval'],          weight: 0.40, category: 'fda_approval' },
    { name: 'Earnings',            tpl: '{ticker} earnings',     variantTpls: ['{ticker}', 'pharma earnings'],             weight: 0.25, category: 'earnings' },
    { name: 'Drug Pricing Policy', tpl: 'drug pricing',          variantTpls: ['drug price regulation', 'Medicare drug'],  weight: 0.20, category: 'regulatory' },
    { name: 'Fed Rate Decision',   tpl: 'Fed rate cut',          variantTpls: ['Federal Reserve rate', 'FOMC'],            weight: 0.15, category: 'macro_rates' },
  ],
  financials: [
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',         variantTpls: ['Federal Reserve rate', 'FOMC'],       weight: 0.35, category: 'macro_rates' },
    { name: 'Earnings',          tpl: '{ticker} earnings',    variantTpls: ['{ticker}', 'bank earnings'],           weight: 0.30, category: 'earnings' },
    { name: 'US Recession',      tpl: 'US recession',         variantTpls: ['recession', 'economic recession'],    weight: 0.25, category: 'macro_growth' },
    { name: 'Bank Regulation',   tpl: 'bank regulation',      variantTpls: ['banking regulation', 'bank capital'], weight: 0.10, category: 'regulatory' },
  ],
  energy: [
    { name: 'Oil Price / OPEC',  tpl: 'OPEC oil production',  variantTpls: ['oil price', 'OPEC'],                  weight: 0.35, category: 'commodity' },
    { name: 'Earnings',          tpl: '{ticker} earnings',    variantTpls: ['{ticker}', 'oil earnings'],            weight: 0.25, category: 'earnings' },
    { name: 'Geopolitical',      tpl: 'Middle East conflict', variantTpls: ['oil geopolitical', 'Middle East'],    weight: 0.25, category: 'geopolitical' },
    { name: 'US Recession',      tpl: 'US recession',         variantTpls: ['recession', 'economic recession'],    weight: 0.15, category: 'macro_growth' },
  ],
  consumer: [
    { name: 'Earnings',          tpl: '{ticker} earnings',    variantTpls: ['{ticker}', 'consumer earnings'],      weight: 0.35, category: 'earnings' },
    { name: 'US Recession',      tpl: 'US recession',         variantTpls: ['recession', 'economic recession'],    weight: 0.30, category: 'macro_growth' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',         variantTpls: ['Federal Reserve rate', 'FOMC'],       weight: 0.20, category: 'macro_rates' },
    { name: 'Trade / Tariffs',   tpl: 'tariff trade war',     variantTpls: ['tariff', 'trade war'],                weight: 0.15, category: 'trade_policy' },
  ],
  crypto: [
    { name: 'SEC / Regulation',  tpl: 'crypto regulation',   variantTpls: ['SEC crypto', 'cryptocurrency regulation'], weight: 0.35, category: 'regulatory' },
    { name: 'ETF / Product',     tpl: '{ticker} ETF',        variantTpls: ['Bitcoin ETF', 'crypto ETF'],               weight: 0.30, category: 'etf_product' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',        variantTpls: ['Federal Reserve rate', 'FOMC'],            weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession',        variantTpls: ['recession', 'economic recession'],         weight: 0.15, category: 'macro_growth' },
  ],
  commodity: [
    { name: 'Price Level',       tpl: '{ticker} price',        variantTpls: ['{ticker}', 'commodity price'],           weight: 0.45, category: 'commodity' },
    { name: 'Geopolitical',      tpl: 'geopolitical conflict', variantTpls: ['geopolitical', 'Middle East conflict'],   weight: 0.25, category: 'geopolitical' },
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',          variantTpls: ['Federal Reserve rate', 'FOMC'],           weight: 0.20, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession',          variantTpls: ['recession', 'economic recession'],        weight: 0.10, category: 'macro_growth' },
  ],
  macro: [
    { name: 'Fed Rate Decision', tpl: 'Fed rate cut',          variantTpls: ['Federal Reserve rate', 'FOMC'],         weight: 0.35, category: 'macro_rates' },
    { name: 'US Recession',      tpl: 'US recession',          variantTpls: ['recession', 'economic recession'],      weight: 0.35, category: 'macro_growth' },
    { name: 'Trade / Tariffs',   tpl: 'tariff trade war',      variantTpls: ['tariff', 'trade war'],                  weight: 0.20, category: 'trade_policy' },
    { name: 'Geopolitical',      tpl: 'geopolitical conflict', variantTpls: ['geopolitical', 'conflict war'],         weight: 0.10, category: 'geopolitical' },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns prioritised signal categories for the asset(s) found in `query`.
 * Template placeholders are substituted with the detected ticker, then each
 * phrase is normalised for Polymarket's keyword search API (company name,
 * no year/quarter tokens, max 4 words).
 */
export function extractSignals(query: string): SignalCategory[] {
  const { type, ticker } = detectAssetType(query);
  const templates = SIGNAL_MAPS[type];
  const tickerStr = ticker ?? 'asset';

  return templates.map((t) => {
    const rawPhrase = substituteTemplates(t.tpl, tickerStr);
    const searchPhrase = normalizeForPolymarket(rawPhrase, ticker);
    const queryVariants = t.variantTpls.map((vTpl) =>
      normalizeForPolymarket(substituteTemplates(vTpl, tickerStr), ticker),
    );
    return { name: t.name, searchPhrase, queryVariants, weight: t.weight, category: t.category };
  });
}
