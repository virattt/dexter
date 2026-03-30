// Market Data
export { getPrice, getPriceHistory, listInstruments, GET_MARKET_DATA_DESCRIPTION } from './market-data.js';

// Technical Analysis
export { getTechnicalIndicator, getMultiIndicators, TECHNICAL_ANALYSIS_DESCRIPTION } from './technical-analysis.js';

// Statistical Analysis (Quantitative)
export { getZScore, getCorrelationMatrix, getReturnDistribution, getVolatilityRegime, STATISTICAL_ANALYSIS_DESCRIPTION } from './statistical-analysis.js';

// Macro / Econometric Analysis
export { getRateDifferential, getMacroRegime, getCrossAssetRegime, MACRO_ANALYSIS_DESCRIPTION } from './macro-analysis.js';

// Quant Strategy Engine
export { backtestStrategy, monteCarloSimulation, calculateExpectedValue, QUANT_STRATEGY_DESCRIPTION } from './quant-strategy.js';

// Economic Calendar
export { getEconomicCalendar, ECONOMIC_CALENDAR_DESCRIPTION } from './economic-calendar.js';

// Fintokei Rules & Risk Management
export { getFintokeiRules, calculatePositionSize, checkAccountHealth, FINTOKEI_RULES_DESCRIPTION } from './fintokei-rules.js';

// Trade Journal
export { recordTrade, closeTrade, getTradeStats, getTradeHistory, TRADE_JOURNAL_DESCRIPTION } from './trade-journal.js';

// Meta-tool (routes queries to sub-tools)
export { createGetMarketData, GET_MARKET_DATA_META_DESCRIPTION } from './get-market-data.js';

// API & Instruments
export { api, FINTOKEI_INSTRUMENTS, resolveSymbol } from './api.js';
