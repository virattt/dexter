/**
 * Yahoo Finance API wrapper using yahoo-finance2.
 * Provides quote and historical price data without API keys.
 */
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface YahooQuoteResult {
  ticker: string;
  price: number | null;
  currency: string | null;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  avgVolume: number | null;
  dividendYield: number | null;
  beta: number | null;
  sharesOutstanding: number | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  shortName: string | null;
  longName: string | null;
}

/**
 * Get a comprehensive real-time quote for a ticker from Yahoo Finance.
 * Uses quoteSummary to get price, fundamentals, company info, and key stats.
 */
export async function yahooQuote(ticker: string): Promise<YahooQuoteResult> {
  const result: any = await yahooFinance.quoteSummary(ticker, {
    modules: ['price', 'summaryProfile', 'defaultKeyStatistics', 'financialData'],
  });

  const priceData = result?.price || {};
  const profileData = result?.summaryProfile || {};
  const keyStats = result?.defaultKeyStatistics || {};
  const finData = result?.financialData || {};

  return {
    ticker: priceData?.symbol ?? ticker,
    price: priceData?.regularMarketPrice ?? null,
    currency: priceData?.currency ?? null,
    marketCap: priceData?.marketCap ?? null,
    peRatio: finData?.trailingPE ?? null,
    eps: keyStats?.epsTrailingTwelveMonths ?? null,
    week52High: finData?.fiftyTwoWeekHigh ?? null,
    week52Low: finData?.fiftyTwoWeekLow ?? null,
    volume: priceData?.regularMarketVolume ?? null,
    avgVolume: keyStats?.averageDailyVolume10Day ?? null,
    dividendYield: keyStats?.dividendYield ?? null,
    beta: keyStats?.beta ?? null,
    sharesOutstanding: keyStats?.sharesOutstanding ?? null,
    sector: profileData?.sector ?? null,
    industry: profileData?.industry ?? null,
    website: profileData?.website ?? null,
    shortName: priceData?.shortName ?? null,
    longName: priceData?.longName ?? null,
  };
}

export interface YahooHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number | null;
}

export interface YahooHistoricalResult {
  ticker: string;
  prices: YahooHistoricalPrice[];
  period: string;
}

function getDateForPeriod(period: string): string {
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case '1d':
    case '5d':
      d.setDate(d.getDate() - 5);
      break;
    case '1mo':
      d.setMonth(d.getMonth() - 1);
      break;
    case '3mo':
      d.setMonth(d.getMonth() - 3);
      break;
    case '6mo':
      d.setMonth(d.getMonth() - 6);
      break;
    case '1y':
      d.setFullYear(d.getFullYear() - 1);
      break;
    case '2y':
      d.setFullYear(d.getFullYear() - 2);
      break;
    case '5y':
      d.setFullYear(d.getFullYear() - 5);
      break;
    case 'max':
      d.setFullYear(1970);
      break;
    default: {
      // YTD
      d.setMonth(0);
      d.setDate(1);
      break;
    }
  }
  return d.toISOString().split('T')[0];
}

/**
 * Get historical OHLCV data for a ticker.
 */
export async function yahooHistorical(
  ticker: string,
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<YahooHistoricalResult> {
  const actualStart = startDate ?? getDateForPeriod(period);
  const actualEnd = endDate ?? new Date().toISOString().split('T')[0];

  const query: any = {
    period1: new Date(actualStart).toISOString(),
    period2: new Date(actualEnd).toISOString(),
    interval: period === '1d' ? '5m' : '1d',
  };

  const result = await yahooFinance.historical(ticker, query);

  return {
    ticker,
    period,
    prices: (result as any[]).map((p: any) => ({
      date: p.date instanceof Date ? p.date.toISOString().split('T')[0] : p.date,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume,
      adjClose: p.adjClose ?? null,
    })),
  };
}
