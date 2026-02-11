import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from '../finance/api.js';
import { formatToolResult } from '../types.js';
import { computeAllIndicators, computeRSI, computeMACD, computeEMA, computeSMA, computeBollingerBands, computeATR, computeStochastic, computeVWAP, summarizeSignals, type Bar, type IndicatorResult } from './indicators.js';

/** Map period shorthand to start_date offset in days. */
const PERIOD_DAYS: Record<string, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

/** Detect crypto ticker format (contains '-', e.g. BTC-USD). */
function isCrypto(ticker: string): boolean {
  return ticker.includes('-');
}

/** Format date as YYYY-MM-DD. */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const TechnicalAnalysisInputSchema = z.object({
  ticker: z
    .string()
    .describe("Stock ticker (e.g. 'AAPL') or crypto ticker (e.g. 'BTC-USD')"),
  period: z
    .enum(['1w', '1m', '3m', '6m', '1y'])
    .default('3m')
    .describe("Analysis period. Defaults to '3m'."),
  indicators: z
    .array(z.enum(['RSI', 'MACD', 'EMA', 'SMA', 'BollingerBands', 'ATR', 'Stochastic', 'VWAP']))
    .optional()
    .describe('Optional: specific indicators to compute. Defaults to all.'),
});

/**
 * Technical analysis tool — fetches OHLCV data and computes TA indicators.
 */
export const technicalAnalysis = new DynamicStructuredTool({
  name: 'technical_analysis',
  description: `Performs technical analysis on a stock or cryptocurrency. Fetches historical OHLCV price data and computes indicators including RSI, MACD, EMA, SMA, Bollinger Bands, ATR, Stochastic, and VWAP. Returns individual indicator signals and an overall bullish/bearish/neutral assessment.`,
  schema: TechnicalAnalysisInputSchema,
  func: async (input) => {
    const { ticker, period, indicators: filterIndicators } = input;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (PERIOD_DAYS[period] ?? 90));

    const start_date = formatDate(startDate);
    const end_date = formatDate(endDate);

    // Fetch OHLCV data from existing financial API
    const endpoint = isCrypto(ticker) ? '/crypto/prices/' : '/prices/';
    const params = {
      ticker,
      interval: 'day' as const,
      interval_multiplier: 1,
      start_date,
      end_date,
    };

    const { data, url } = await callApi(endpoint, params);
    const prices = (data.prices || []) as Array<{
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;

    if (prices.length === 0) {
      return formatToolResult({ error: `No price data found for ${ticker}` }, [url]);
    }

    // Convert to Bar format
    const bars: Bar[] = prices.map(p => ({
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume,
    }));

    const closes = bars.map(b => b.close);

    // Compute indicators (all or filtered)
    let results: IndicatorResult[];

    if (filterIndicators && filterIndicators.length > 0) {
      results = [];
      const indicatorSet = new Set(filterIndicators);

      if (indicatorSet.has('RSI')) results.push(computeRSI(closes));
      if (indicatorSet.has('MACD')) results.push(computeMACD(closes));
      if (indicatorSet.has('EMA')) {
        results.push(computeEMA(closes, 12));
        results.push(computeEMA(closes, 26));
      }
      if (indicatorSet.has('SMA')) {
        results.push(computeSMA(closes, 20));
        results.push(computeSMA(closes, 50));
      }
      if (indicatorSet.has('BollingerBands')) results.push(computeBollingerBands(closes));
      if (indicatorSet.has('ATR')) results.push(computeATR(bars));
      if (indicatorSet.has('Stochastic')) results.push(computeStochastic(bars));
      if (indicatorSet.has('VWAP')) results.push(computeVWAP(bars));
    } else {
      results = computeAllIndicators(bars);
    }

    const signalSummary = summarizeSignals(results);
    const currentPrice = closes[closes.length - 1];

    const output = {
      ticker,
      currentPrice,
      period,
      dataPoints: bars.length,
      indicators: results.map(r => ({
        name: r.name,
        signal: r.signal,
        interpretation: r.interpretation,
        values: r.values,
      })),
      summary: signalSummary,
    };

    return formatToolResult(output, [url]);
  },
});
