/**
 * Geopolitical event → financial asset correlation map.
 *
 * Pure data / rule-based — no LLM, no API calls.
 * Maps event categories to asset tickers / classes with expected impact direction
 * and a short rationale. Used by geopolitics_search to produce structured
 * asset-implication output.
 */

import type { EventCategory } from './accounts.js';

export type ImpactDirection = 'risk-up' | 'risk-down' | 'volatility';
export type AssetClass = 'equity' | 'commodity' | 'fx' | 'fixed-income' | 'crypto' | 'etf';

export interface AssetCorrelation {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  direction: ImpactDirection;
  rationale: string;
  /** 0–1: how direct / established the correlation is */
  confidence: number;
}

export interface EventMapping {
  category: EventCategory;
  displayName: string;
  description: string;
  /** Keywords that trigger detection of this category in article text */
  detectionKeywords: string[];
  /** GDELT THEME codes relevant to this category */
  gdeltThemes: string[];
  assets: AssetCorrelation[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Event → Asset Map
// ──────────────────────────────────────────────────────────────────────────────

export const EVENT_ASSET_MAP: EventMapping[] = [
  {
    category: 'ukraine-russia',
    displayName: 'Ukraine-Russia Conflict',
    description: 'Military escalation, ceasefire negotiations, territorial changes in Ukraine',
    detectionKeywords: ['ukraine', 'russia', 'moscow', 'kyiv', 'nato', 'zelensky', 'putin', 'donbas', 'crimea', 'kherson'],
    gdeltThemes: ['MILITARY_CONFLICT', 'REBELLION_COUP', 'SANCTION'],
    assets: [
      { ticker: 'XOM', name: 'ExxonMobil', assetClass: 'equity', direction: 'risk-up', rationale: 'Energy supply disruption raises oil/gas prices', confidence: 0.85 },
      { ticker: 'CVX', name: 'Chevron', assetClass: 'equity', direction: 'risk-up', rationale: 'Higher crude benefits integrated majors', confidence: 0.80 },
      { ticker: 'LNG', name: 'Cheniere Energy', assetClass: 'equity', direction: 'risk-up', rationale: 'European LNG demand surge', confidence: 0.90 },
      { ticker: 'LMT', name: 'Lockheed Martin', assetClass: 'equity', direction: 'risk-up', rationale: 'Defense spending increases in NATO', confidence: 0.85 },
      { ticker: 'RTX', name: 'RTX Corp', assetClass: 'equity', direction: 'risk-up', rationale: 'Missile, radar systems demand', confidence: 0.80 },
      { ticker: 'NOC', name: 'Northrop Grumman', assetClass: 'equity', direction: 'risk-up', rationale: 'Defense spending cycle', confidence: 0.75 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Safe-haven demand during conflict', confidence: 0.80 },
      { ticker: 'WEAT', name: 'Wheat ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Ukraine/Russia ~30% of global wheat exports', confidence: 0.85 },
      { ticker: 'EWZ', name: 'Brazil ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Commodity exporter benefits', confidence: 0.60 },
    ],
  },

  {
    category: 'middle-east',
    displayName: 'Middle East Tension',
    description: 'Conflict, blockade, or escalation involving Israel, Gaza, Lebanon, Yemen, or Gulf states',
    detectionKeywords: ['israel', 'hamas', 'hezbollah', 'gaza', 'lebanon', 'houthi', 'strait of hormuz', 'saudi', 'iran', 'yemen', 'red sea', 'suez'],
    gdeltThemes: ['MILITARY_CONFLICT', 'TERROR', 'BLOCKADE_EMBARGO'],
    assets: [
      { ticker: 'USO', name: 'Crude Oil ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Middle East = ~35% of global oil supply', confidence: 0.90 },
      { ticker: 'XOM', name: 'ExxonMobil', assetClass: 'equity', direction: 'risk-up', rationale: 'Higher oil lifts integrated majors', confidence: 0.80 },
      { ticker: 'COP', name: 'ConocoPhillips', assetClass: 'equity', direction: 'risk-up', rationale: 'E&P beneficiary of supply disruption', confidence: 0.75 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Geopolitical safe-haven', confidence: 0.85 },
      { ticker: 'LMT', name: 'Lockheed Martin', assetClass: 'equity', direction: 'risk-up', rationale: 'Arms sales in region', confidence: 0.70 },
      { ticker: 'MAERSK', name: 'A.P. Moller-Maersk', assetClass: 'equity', direction: 'risk-up', rationale: 'Shipping rerouting via Cape of Good Hope', confidence: 0.80 },
      { ticker: 'FDX', name: 'FedEx', assetClass: 'equity', direction: 'risk-down', rationale: 'Higher fuel costs compress margins', confidence: 0.65 },
    ],
  },

  {
    category: 'china-taiwan',
    displayName: 'China-Taiwan Military Tension',
    description: 'PLA military exercises, blockade threats, escalating rhetoric over Taiwan',
    detectionKeywords: ['taiwan', 'pla', 'strait', 'beijing', 'xi jinping', 'tsmc', 'semiconductor', 'chip war', 'reunification', 'military exercises'],
    gdeltThemes: ['MILITARY_CONFLICT', 'THREATEN', 'BLOCKADE_EMBARGO'],
    assets: [
      { ticker: 'TSM', name: 'TSMC', assetClass: 'equity', direction: 'risk-down', rationale: '90% of advanced chips made in Taiwan', confidence: 0.95 },
      { ticker: 'NVDA', name: 'NVIDIA', assetClass: 'equity', direction: 'risk-down', rationale: 'GPU supply chain reliance on TSMC', confidence: 0.90 },
      { ticker: 'AMD', name: 'AMD', assetClass: 'equity', direction: 'risk-down', rationale: 'Fab dependency on TSMC N5/N3', confidence: 0.85 },
      { ticker: 'ASML', name: 'ASML', assetClass: 'equity', direction: 'risk-down', rationale: 'Lithography equipment for Taiwan fabs', confidence: 0.75 },
      { ticker: 'AAPL', name: 'Apple', assetClass: 'equity', direction: 'risk-down', rationale: 'iPhone supply chain concentrated in Taiwan/China', confidence: 0.80 },
      { ticker: 'INTC', name: 'Intel', assetClass: 'equity', direction: 'risk-up', rationale: 'US-based fab could benefit from diversification push', confidence: 0.60 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Safe-haven flight', confidence: 0.80 },
    ],
  },

  {
    category: 'us-china-trade',
    displayName: 'US-China Trade War / Tech Restrictions',
    description: 'Tariff announcements, export controls on chips/AI, diplomatic tensions',
    detectionKeywords: ['tariff', 'trade war', 'export control', 'chip ban', 'entity list', 'huawei', 'tiktok', 'decoupling', 'us-china', 'china tariffs'],
    gdeltThemes: ['SANCTION', 'ECONOMIC_DISPUTE', 'BLOCKADE_EMBARGO'],
    assets: [
      { ticker: 'NVDA', name: 'NVIDIA', assetClass: 'equity', direction: 'risk-down', rationale: 'China = ~20% of revenue, subject to export controls', confidence: 0.90 },
      { ticker: 'ASML', name: 'ASML', assetClass: 'equity', direction: 'risk-down', rationale: 'EUV export restrictions to China', confidence: 0.85 },
      { ticker: 'AAPL', name: 'Apple', assetClass: 'equity', direction: 'risk-down', rationale: 'China manufacturing + consumer market risk', confidence: 0.80 },
      { ticker: 'QCOM', name: 'Qualcomm', assetClass: 'equity', direction: 'risk-down', rationale: 'China handset revenue at risk', confidence: 0.75 },
      { ticker: 'MP', name: 'MP Materials', assetClass: 'equity', direction: 'risk-up', rationale: 'US rare earth alt. to Chinese supply', confidence: 0.70 },
      { ticker: 'SMH', name: 'VanEck Semiconductor ETF', assetClass: 'etf', direction: 'volatility', rationale: 'Mixed: some win (Intel, Micron domestic) some lose', confidence: 0.70 },
    ],
  },

  {
    category: 'iran',
    displayName: 'Iran / Persian Gulf',
    description: 'Iran nuclear talks, sanctions, proxy activity, Strait of Hormuz threats',
    detectionKeywords: ['iran', 'tehran', 'hormuz', 'nuclear deal', 'jcpoa', 'ayatollah', 'irgc', 'persian gulf', 'proxies'],
    gdeltThemes: ['SANCTION', 'MILITARY_CONFLICT', 'THREATEN'],
    assets: [
      { ticker: 'USO', name: 'Crude Oil ETF', assetClass: 'etf', direction: 'risk-up', rationale: '20% of global oil passes through Hormuz', confidence: 0.90 },
      { ticker: 'XOM', name: 'ExxonMobil', assetClass: 'equity', direction: 'risk-up', rationale: 'Supply shock lifts oil prices', confidence: 0.80 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Safe-haven amid Middle East escalation', confidence: 0.80 },
    ],
  },

  {
    category: 'north-korea',
    displayName: 'North Korea Provocation',
    description: 'Missile tests, nuclear threats, Kim Jong-un statements',
    detectionKeywords: ['north korea', 'dprk', 'kim jong', 'missile test', 'icbm', 'nuclear test', 'pyongyang'],
    gdeltThemes: ['MILITARY_CONFLICT', 'THREATEN'],
    assets: [
      { ticker: 'LMT', name: 'Lockheed Martin', assetClass: 'equity', direction: 'risk-up', rationale: 'THAAD, Aegis demand', confidence: 0.75 },
      { ticker: 'RTX', name: 'RTX Corp', assetClass: 'equity', direction: 'risk-up', rationale: 'Missile defense systems', confidence: 0.70 },
      { ticker: 'EWY', name: 'South Korea ETF', assetClass: 'etf', direction: 'risk-down', rationale: 'Seoul market risk premium spikes', confidence: 0.80 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Safe-haven bid', confidence: 0.70 },
    ],
  },

  {
    category: 'cyberattack',
    displayName: 'Cyberattack / Infrastructure Attack',
    description: 'Nation-state cyberattack, ransomware on critical infrastructure, grid attacks',
    detectionKeywords: ['cyberattack', 'ransomware', 'hacking', 'critical infrastructure', 'power grid', 'cyber warfare', 'zero-day', 'nation-state hacker'],
    gdeltThemes: ['CYBER_ATTACK', 'SABOTAGE'],
    assets: [
      { ticker: 'CRWD', name: 'CrowdStrike', assetClass: 'equity', direction: 'risk-up', rationale: 'Endpoint security demand surge', confidence: 0.85 },
      { ticker: 'PANW', name: 'Palo Alto Networks', assetClass: 'equity', direction: 'risk-up', rationale: 'SASE, XDR demand', confidence: 0.85 },
      { ticker: 'ZS', name: 'Zscaler', assetClass: 'equity', direction: 'risk-up', rationale: 'Zero-trust adoption accelerates', confidence: 0.80 },
      { ticker: 'FTNT', name: 'Fortinet', assetClass: 'equity', direction: 'risk-up', rationale: 'OT/industrial security', confidence: 0.75 },
      { ticker: 'HACK', name: 'Cybersecurity ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Sector-wide demand increase', confidence: 0.85 },
      { ticker: 'DUK', name: 'Duke Energy', assetClass: 'equity', direction: 'risk-down', rationale: 'Utility infrastructure vulnerable', confidence: 0.60 },
    ],
  },

  {
    category: 'sanctions',
    displayName: 'Sanctions / Export Controls',
    description: 'New sanction packages, entities added to OFAC/BIS lists, SWIFT disconnections',
    detectionKeywords: ['sanctions', 'ofac', 'entity list', 'export ban', 'asset freeze', 'swift ban', 'secondary sanctions'],
    gdeltThemes: ['SANCTION', 'BLOCKADE_EMBARGO'],
    assets: [
      { ticker: 'GS', name: 'Goldman Sachs', assetClass: 'equity', direction: 'volatility', rationale: 'Compliance costs, EM revenue exposure', confidence: 0.60 },
      { ticker: 'JPM', name: 'JPMorgan', assetClass: 'equity', direction: 'volatility', rationale: 'Correspondent banking restrictions', confidence: 0.60 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Sanctioned entities seek gold', confidence: 0.70 },
    ],
  },

  {
    category: 'energy-supply',
    displayName: 'Energy Supply Disruption',
    description: 'Pipeline sabotage, OPEC+ cuts, LNG export terminal outages',
    detectionKeywords: ['opec', 'pipeline', 'lng terminal', 'energy supply', 'gas cut', 'oil cut', 'production cut', 'natural gas', 'nord stream'],
    gdeltThemes: ['ENERGY', 'SABOTAGE'],
    assets: [
      { ticker: 'XOM', name: 'ExxonMobil', assetClass: 'equity', direction: 'risk-up', rationale: 'Higher commodity prices', confidence: 0.85 },
      { ticker: 'CVX', name: 'Chevron', assetClass: 'equity', direction: 'risk-up', rationale: 'Upstream E&P benefit', confidence: 0.80 },
      { ticker: 'SLB', name: 'SLB (Schlumberger)', assetClass: 'equity', direction: 'risk-up', rationale: 'Oilfield services demand', confidence: 0.75 },
      { ticker: 'LNG', name: 'Cheniere Energy', assetClass: 'equity', direction: 'risk-up', rationale: 'LNG supply crunch lifts spot rates', confidence: 0.90 },
      { ticker: 'AIRL', name: 'Airline ETF (JETS)', assetClass: 'etf', direction: 'risk-down', rationale: 'Jet fuel cost spike', confidence: 0.80 },
    ],
  },

  {
    category: 'election-risk',
    displayName: 'Election / Political Risk',
    description: 'Major election uncertainty, coup, regime change in EM country with commodity exposure',
    detectionKeywords: ['election', 'coup', 'regime change', 'political crisis', 'protest', 'snap election', 'government collapse'],
    gdeltThemes: ['ELECTION', 'POLITICAL_CRISIS', 'REBELLION_COUP'],
    assets: [
      { ticker: 'EEM', name: 'Emerging Markets ETF', assetClass: 'etf', direction: 'volatility', rationale: 'EM political risk premium', confidence: 0.70 },
      { ticker: 'GLD', name: 'Gold ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Safe-haven demand', confidence: 0.70 },
      { ticker: 'VXX', name: 'VIX Short-Term ETF', assetClass: 'etf', direction: 'risk-up', rationale: 'Volatility spike', confidence: 0.65 },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Look up the mapping for a given category. */
export function getMappingForCategory(category: EventCategory): EventMapping | undefined {
  return EVENT_ASSET_MAP.find((m) => m.category === category);
}

/**
 * Detect which event categories are likely referenced in a piece of text.
 * Pure string matching — no LLM.
 */
export function detectCategories(text: string): EventCategory[] {
  const lower = text.toLowerCase();
  const hits: EventCategory[] = [];
  for (const mapping of EVENT_ASSET_MAP) {
    const matched = mapping.detectionKeywords.some((kw) => lower.includes(kw.toLowerCase()));
    if (matched) hits.push(mapping.category);
  }
  return [...new Set(hits)];
}

/**
 * Given a set of event categories, return the deduplicated asset implications.
 * When the same ticker appears in multiple categories, keep the highest-confidence entry.
 */
export function getAssetImplications(categories: EventCategory[]): AssetCorrelation[] {
  const byTicker = new Map<string, AssetCorrelation>();

  for (const cat of categories) {
    const mapping = getMappingForCategory(cat);
    if (!mapping) continue;
    for (const asset of mapping.assets) {
      const existing = byTicker.get(asset.ticker);
      if (!existing || asset.confidence > existing.confidence) {
        byTicker.set(asset.ticker, asset);
      }
    }
  }

  return [...byTicker.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Build GDELT theme query fragment for given categories. */
export function buildGdeltThemeFilter(categories: EventCategory[]): string {
  const themes = new Set<string>();
  for (const cat of categories) {
    const mapping = getMappingForCategory(cat);
    if (mapping) mapping.gdeltThemes.forEach((t) => themes.add(t));
  }
  if (themes.size === 0) return '';
  return [...themes].map((t) => `THEME:${t}`).join(' OR ');
}
