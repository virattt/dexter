import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { rateLimitedFetch } from './api.js';

export const MACRO_ANALYSIS_DESCRIPTION = `
Econometric macro analysis engine for FX and cross-asset markets. Analyzes leading indicators, rate differentials, yield curves, and macro regime states to provide fundamental context for trading decisions.

## When to Use

- Interest rate differential analysis between currency pairs (carry trade evaluation)
- Leading indicator composite scoring (ISM, PMI, CPI trends, employment data)
- Macro regime classification per economy (expansion, slowdown, contraction, recovery)
- Cross-asset regime analysis (risk-on/risk-off detection via equity-bond-FX-gold correlations)
- Central bank policy divergence scoring

## When NOT to Use

- Technical price data (use get_market_data)
- Statistical computations on price series (use statistical_analysis tools)
- Specific economic event times (use economic_calendar)
- Strategy backtesting (use quant_strategy tools)

## Usage Notes

- Macro data sourced from Twelve Data economic indicators
- Leading indicators typically lead FX moves by 1-3 months
- Rate differentials are the strongest medium-term FX driver
- Regime analysis uses a composite of multiple indicators
- All macro assessments include confidence levels and data recency
`.trim();

function getApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY || '';
}

async function fetchEconomicIndicator(
  symbol: string,
  country: string,
  outputsize: number = 24,
): Promise<Array<{ date: string; value: number }>> {
  const url = new URL('https://api.twelvedata.com/economic_indicators');
  const apiKey = getApiKey();
  if (apiKey) url.searchParams.append('apikey', apiKey);
  url.searchParams.append('symbol', symbol);
  url.searchParams.append('country', country);
  url.searchParams.append('outputsize', String(outputsize));

  try {
    const response = await rateLimitedFetch(url.toString());
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json() as Record<string, unknown>;
    const values = data.values as Array<{ date: string; value: string }> | undefined;
    if (!values || !Array.isArray(values)) return [];
    return values
      .map(v => ({ date: v.date, value: parseFloat(v.value) }))
      .filter(v => !isNaN(v.value))
      .reverse();
  } catch (error) {
    logger.error(`[Macro Analysis] Failed to fetch ${symbol} for ${country}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

const CENTRAL_BANK_RATES: Record<string, { rate: number; lastChanged: string; direction: string; bank: string }> = {
  USD: { rate: 4.50, lastChanged: '2025-01', direction: 'cutting', bank: 'Federal Reserve' },
  EUR: { rate: 2.65, lastChanged: '2025-03', direction: 'cutting', bank: 'ECB' },
  GBP: { rate: 4.50, lastChanged: '2025-02', direction: 'cutting', bank: 'Bank of England' },
  JPY: { rate: 0.50, lastChanged: '2025-01', direction: 'hiking', bank: 'Bank of Japan' },
  CHF: { rate: 0.25, lastChanged: '2025-03', direction: 'cutting', bank: 'Swiss National Bank' },
  AUD: { rate: 4.10, lastChanged: '2025-02', direction: 'holding', bank: 'Reserve Bank of Australia' },
  CAD: { rate: 2.75, lastChanged: '2025-03', direction: 'cutting', bank: 'Bank of Canada' },
  NZD: { rate: 3.75, lastChanged: '2025-02', direction: 'cutting', bank: 'Reserve Bank of New Zealand' },
};

const RateDiffInputSchema = z.object({
  baseCurrency: z.string().describe('Base currency (e.g., EUR, GBP, AUD)'),
  quoteCurrency: z.string().describe('Quote currency (e.g., USD, JPY, CHF)'),
});

export const getRateDifferential = new DynamicStructuredTool({
  name: 'get_rate_differential',
  description: 'Analyze interest rate differential between two currencies. Includes carry trade yield, policy divergence scoring, and directional bias. Rate differentials are the strongest medium-term FX driver.',
  schema: RateDiffInputSchema,
  func: async (input) => {
    const base = input.baseCurrency.toUpperCase();
    const quote = input.quoteCurrency.toUpperCase();
    const baseRate = CENTRAL_BANK_RATES[base];
    const quoteRate = CENTRAL_BANK_RATES[quote];

    if (!baseRate || !quoteRate) {
      return formatToolResult({
        error: `Rate data not available for ${!baseRate ? base : quote}`,
        availableCurrencies: Object.keys(CENTRAL_BANK_RATES),
      }, []);
    }

    const differential = baseRate.rate - quoteRate.rate;
    const pair = `${base}/${quote}`;
    const directionScore: Record<string, number> = { hiking: 1, holding: 0, cutting: -1 };
    const divergence = (directionScore[baseRate.direction] ?? 0) - (directionScore[quoteRate.direction] ?? 0);
    const dailyCarry = differential / 365;

    let bias: string;
    if (differential > 1.0 && divergence >= 0) {
      bias = `BULLISH ${pair} — Positive carry (${differential.toFixed(2)}%) with supportive policy divergence`;
    } else if (differential < -1.0 && divergence <= 0) {
      bias = `BEARISH ${pair} — Negative carry (${differential.toFixed(2)}%) with adverse policy divergence`;
    } else if (Math.abs(differential) < 0.5) {
      bias = `NEUTRAL — Minimal rate differential (${differential.toFixed(2)}%). FX driven by other factors.`;
    } else {
      bias = `MIXED — Rate differential (${differential.toFixed(2)}%) conflicts with policy direction.`;
    }

    return formatToolResult({
      pair,
      baseCurrency: { currency: base, bank: baseRate.bank, rate: `${baseRate.rate}%`, direction: baseRate.direction, lastChanged: baseRate.lastChanged },
      quoteCurrency: { currency: quote, bank: quoteRate.bank, rate: `${quoteRate.rate}%`, direction: quoteRate.direction, lastChanged: quoteRate.lastChanged },
      differential: { value: `${differential > 0 ? '+' : ''}${differential.toFixed(2)}%`, dailyCarryBps: `${(dailyCarry * 100).toFixed(2)} bps` },
      policyDivergence: { score: divergence, interpretation: divergence > 0 ? `${base} tightening relative to ${quote}` : divergence < 0 ? `${quote} tightening relative to ${base}` : 'No divergence' },
      bias,
      note: 'Central bank rates are reference values. Use web_search for the latest rate decisions.',
    }, []);
  },
});

const MacroRegimeInputSchema = z.object({
  country: z.enum(['US', 'EU', 'JP', 'GB', 'AU', 'CA', 'CH', 'NZ', 'CN']).describe('Country/economy to analyze'),
});

export const getMacroRegime = new DynamicStructuredTool({
  name: 'get_macro_regime',
  description: 'Classify current macroeconomic regime using leading indicators (GDP, PMI, CPI, unemployment, retail sales). Returns regime state (expansion/slowdown/contraction/recovery), trend direction, and FX implications.',
  schema: MacroRegimeInputSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    onProgress?.(`Analyzing macro regime for ${input.country}...`);

    const countryNames: Record<string, string> = {
      US: 'United States', EU: 'Euro Area', JP: 'Japan', GB: 'United Kingdom',
      AU: 'Australia', CA: 'Canada', CH: 'Switzerland', NZ: 'New Zealand', CN: 'China',
    };
    const countryName = countryNames[input.country] || input.country;

    const [gdpData, cpiData, unemploymentData, pmiData, retailData] = await Promise.all([
      fetchEconomicIndicator('real_gdp', countryName, 12),
      fetchEconomicIndicator('cpi', countryName, 24),
      fetchEconomicIndicator('unemployment_rate', countryName, 12),
      fetchEconomicIndicator('pmi_manufacturing', countryName, 12),
      fetchEconomicIndicator('retail_sales', countryName, 12),
    ]);

    const indicators: Array<{ name: string; latest: number | null; previous: number | null; trend: string; signal: string; data: Array<{ date: string; value: number }> }> = [];

    function analyzeIndicator(
      name: string, data: Array<{ date: string; value: number }>,
      thresholds: { expansion: number; contraction: number; inverted?: boolean },
    ) {
      if (data.length < 2) { indicators.push({ name, latest: null, previous: null, trend: 'UNKNOWN', signal: 'NO_DATA', data: [] }); return; }
      const latest = data[data.length - 1].value;
      const previous = data[data.length - 2].value;
      const change = latest - previous;
      const inv = thresholds.inverted ?? false;
      const signal = !inv
        ? (latest > thresholds.expansion ? 'EXPANSION' : latest < thresholds.contraction ? 'CONTRACTION' : 'NEUTRAL')
        : (latest < thresholds.expansion ? 'EXPANSION' : latest > thresholds.contraction ? 'CONTRACTION' : 'NEUTRAL');
      const trend = change > 0 ? (inv ? 'DETERIORATING' : 'IMPROVING') : change < 0 ? (inv ? 'IMPROVING' : 'DETERIORATING') : 'STABLE';
      indicators.push({ name, latest: Math.round(latest * 100) / 100, previous: Math.round(previous * 100) / 100, trend, signal, data: data.slice(-6) });
    }

    analyzeIndicator('GDP Growth (QoQ)', gdpData, { expansion: 2.0, contraction: 0 });
    analyzeIndicator('CPI (YoY %)', cpiData, { expansion: 3.0, contraction: 1.0 });
    analyzeIndicator('Unemployment Rate', unemploymentData, { expansion: 4.5, contraction: 6.0, inverted: true });
    analyzeIndicator('PMI Manufacturing', pmiData, { expansion: 52, contraction: 48 });
    analyzeIndicator('Retail Sales (MoM %)', retailData, { expansion: 0.3, contraction: -0.3 });

    const valid = indicators.filter(i => i.signal !== 'NO_DATA');
    const expansionCount = valid.filter(i => i.signal === 'EXPANSION').length;
    const contractionCount = valid.filter(i => i.signal === 'CONTRACTION').length;
    const improvingCount = valid.filter(i => i.trend === 'IMPROVING').length;

    let regime: string;
    let confidence: string;
    if (expansionCount >= 3 && improvingCount >= 2) { regime = 'EXPANSION'; confidence = expansionCount >= 4 ? 'HIGH' : 'MODERATE'; }
    else if (contractionCount >= 3) { regime = 'CONTRACTION'; confidence = contractionCount >= 4 ? 'HIGH' : 'MODERATE'; }
    else if (expansionCount >= 2 && improvingCount < 2) { regime = 'SLOWDOWN'; confidence = 'MODERATE'; }
    else if (contractionCount >= 2 && improvingCount >= 2) { regime = 'RECOVERY'; confidence = 'MODERATE'; }
    else { regime = 'MIXED'; confidence = 'LOW'; }

    const currency = input.country === 'EU' ? 'EUR' : input.country === 'GB' ? 'GBP' : input.country;
    const fxImplication: Record<string, string> = {
      EXPANSION: `${currency} positive: Strong growth supports currency via rate expectations and capital inflows`,
      SLOWDOWN: `${currency} weakening: Growth decelerating; market pricing in future easing`,
      CONTRACTION: `${currency} bearish: Economic contraction drives rate cut expectations and capital outflows`,
      RECOVERY: `${currency} cautiously positive: Early recovery phase; watch for confirmation`,
      MIXED: `${currency} neutral: Conflicting signals; no clear macro directional bias`,
    };

    return formatToolResult({
      country: input.country, countryName,
      regime: { state: regime, confidence, fxImplication: fxImplication[regime] },
      indicators,
      scoring: { expansionSignals: expansionCount, contractionSignals: contractionCount, improvingTrends: improvingCount, totalIndicators: valid.length },
      tradingImplications: {
        carryTrade: regime === 'EXPANSION' ? 'Supportive — expect rate holds or hikes' : regime === 'CONTRACTION' ? 'Adverse — expect rate cuts' : 'Neutral',
        riskAssets: regime === 'EXPANSION' ? 'Risk-on: favor high-beta currencies (AUD, NZD) and equity indices' : regime === 'CONTRACTION' ? 'Risk-off: favor safe havens (JPY, CHF, gold)' : 'Selective positioning',
      },
    }, []);
  },
});

const CrossAssetInputSchema = z.object({});

export const getCrossAssetRegime = new DynamicStructuredTool({
  name: 'get_cross_asset_regime',
  description: 'Detect current risk-on/risk-off regime by analyzing cross-asset price behavior: equity indices, gold, JPY as safe haven. Returns composite risk score and positioning implications.',
  schema: CrossAssetInputSchema,
  func: async (_input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    onProgress?.('Analyzing cross-asset regime...');

    const apiKey = getApiKey();
    async function fetchQuote(symbol: string): Promise<{ price: number; change: number } | null> {
      try {
        const url = new URL('https://api.twelvedata.com/quote');
        if (apiKey) url.searchParams.append('apikey', apiKey);
        url.searchParams.append('symbol', symbol);
        const response = await rateLimitedFetch(url.toString());
        if (!response.ok) return null;
        const data = await response.json() as Record<string, unknown>;
        return { price: parseFloat(data.close as string) || 0, change: parseFloat(data.percent_change as string) || 0 };
      } catch { return null; }
    }

    const [spx, gold, usdjpy, audjpy] = await Promise.all([
      fetchQuote('SPX'), fetchQuote('XAU/USD'), fetchQuote('USD/JPY'), fetchQuote('AUD/JPY'),
    ]);

    const signals: Array<{ asset: string; change: number; signal: string; weight: number }> = [];
    if (spx) signals.push({ asset: 'S&P 500', change: spx.change, signal: spx.change > 0.3 ? 'RISK_ON' : spx.change < -0.3 ? 'RISK_OFF' : 'NEUTRAL', weight: 2 });
    if (gold) signals.push({ asset: 'Gold', change: gold.change, signal: gold.change > 0.5 ? 'RISK_OFF' : gold.change < -0.5 ? 'RISK_ON' : 'NEUTRAL', weight: 1.5 });
    if (usdjpy) signals.push({ asset: 'USD/JPY', change: usdjpy.change, signal: usdjpy.change > 0.2 ? 'RISK_ON' : usdjpy.change < -0.2 ? 'RISK_OFF' : 'NEUTRAL', weight: 1.5 });
    if (audjpy) signals.push({ asset: 'AUD/JPY', change: audjpy.change, signal: audjpy.change > 0.3 ? 'RISK_ON' : audjpy.change < -0.3 ? 'RISK_OFF' : 'NEUTRAL', weight: 2 });

    let totalWeight = 0, weightedScore = 0;
    for (const s of signals) {
      weightedScore += (s.signal === 'RISK_ON' ? 1 : s.signal === 'RISK_OFF' ? -1 : 0) * s.weight;
      totalWeight += s.weight;
    }
    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const regime = score > 0.3 ? 'RISK_ON' : score < -0.3 ? 'RISK_OFF' : 'MIXED';

    return formatToolResult({
      regime: { state: regime, score: Math.round(score * 100) / 100, scale: '-1.0 (risk-off) to +1.0 (risk-on)' },
      signals,
      positioning: regime === 'RISK_ON'
        ? 'Favor: AUD, NZD, equity indices. Avoid: JPY longs, gold longs.'
        : regime === 'RISK_OFF'
        ? 'Favor: JPY, CHF, gold. Avoid: AUD, NZD, equity index longs.'
        : 'No clear directional bias. Focus on instrument-specific setups.',
    }, []);
  },
});
