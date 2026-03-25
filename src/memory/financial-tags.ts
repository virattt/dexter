export const RoutingResults = {
  FMP_OK: 'fmp-ok',
  FMP_PREMIUM: 'fmp-premium',
  YAHOO_OK: 'yahoo-ok',
  WEB_FALLBACK: 'web-fallback',
} as const;

export type RoutingResult = (typeof RoutingResults)[keyof typeof RoutingResults];

export const AnalysisTypes = {
  VALUATION: 'valuation',
  THESIS: 'thesis',
  RISK: 'risk',
  CONSENSUS: 'consensus',
  PATTERN: 'pattern',
} as const;

export type AnalysisType = (typeof AnalysisTypes)[keyof typeof AnalysisTypes];

export const EdgeRelations = {
  CAUSES: 'causes',
  CONTRADICTS: 'contradicts',
  CORRELATES: 'correlates',
  UPDATES: 'updates',
} as const;

export type EdgeRelation = (typeof EdgeRelations)[keyof typeof EdgeRelations];

export const Tags = {
  routing: (result: RoutingResult): string => `routing:${result}`,
  ticker: (symbol: string): string => `ticker:${symbol.toUpperCase()}`,
  exchange: (mic: string): string => `exchange:${mic.toUpperCase()}`,
  sector: (name: string): string => `sector:${name.toLowerCase()}`,
  analysis: (type: AnalysisType): string => `analysis:${type}`,
} as const;
