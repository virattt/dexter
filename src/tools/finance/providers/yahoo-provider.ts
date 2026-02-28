/**
 * Yahoo Finance Provider
 * 
 * Implementation using yahoo-finance2 package.
 * Supports: Global stocks, live prices, historical data.
 */

import yahooFinance from 'yahoo-finance2';
import { BaseProvider } from './base-provider.js';
import {
  ProviderCapabilities,
  ProviderRequestContext,
  StockPriceResponse,
  HistoricalDataResponse,
  HistoricalDataPoint,
} from './types.js';
import { ProviderErrorCode } from './types.js';

const CAPABILITIES: ProviderCapabilities = {
  livePrices: true,
  historicalData: true,
  incomeStatements: false,
  balanceSheets: false,
  cashFlowStatements: false,
  keyRatios: false,
  analystEstimates: false,
  filings: false,
  insiderTrades: false,
  companyNews: false,
  orderPlacement: false,
  positions: false,
  holdings: false,
  markets: ['US', 'IN', 'GLOBAL'],
};

const CONFIG = {
  id: 'yahoo' as const,
  displayName: 'Yahoo Finance',
  baseUrl: 'https://query1.finance.yahoo.com',
  capabilities: CAPABILITIES,
  rateLimits: {
    default: { perSecond: 10, perMinute: 2000 },
  },
  requiresAuth: false,
  enabled: process.env.ENABLE_YAHOO !== 'false',
};

export class YahooProvider extends BaseProvider {
  constructor() {
    super(CONFIG);
  }

  /**
   * Yahoo Finance doesn't require auth for basic queries
   */
  isAvailable(): boolean {
    return true; // Always available
  }

  /**
   * Get stock price
   */
  async getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse> {
    const normalizedTicker = this.validateTicker(context.ticker);
    
    try {
      const quote = await yahooFinance.quote(normalizedTicker) as any;
      
      if (!quote || quote.regularMarketPrice === null) {
        throw this.createError(
          `Ticker ${normalizedTicker} not found`,
          ProviderErrorCode.NOT_FOUND,
          false
        );
      }

      const currency = this.getCurrencyFromCurrencyCode(quote.currency);
      const marketState = this.getMarketState(quote.marketState);

      return this.normalizeStockPrice(normalizedTicker, 'yahoo', {
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        currency,
        marketState,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        sharesOutstanding: quote.sharesOutstanding,
        sourceUrl: `https://finance.yahoo.com/quote/${normalizedTicker}`,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not Found')) {
        throw this.createError(
          `Ticker ${normalizedTicker} not found`,
          ProviderErrorCode.NOT_FOUND,
          false,
          undefined,
          error
        );
      }
      throw this.createError(
        error instanceof Error ? error.message : 'Failed to get quote',
        ProviderErrorCode.NETWORK_ERROR,
        true,
        undefined,
        error
      );
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(context: ProviderRequestContext): Promise<HistoricalDataResponse> {
    const normalizedTicker = this.validateTicker(context.ticker);
    
    const startDate = context.startDate 
      ? new Date(context.startDate) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = context.endDate 
      ? new Date(context.endDate) 
      : new Date();

    try {
      const history = (await yahooFinance.historical(normalizedTicker, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      })) as any;

      if (!history || history.length === 0) {
        throw this.createError(
          `No historical data for ${normalizedTicker}`,
          ProviderErrorCode.NOT_FOUND,
          false
        );
      }

      const dataPoints: HistoricalDataPoint[] = history.map((item: any) => ({
        date: item.date.toISOString().split('T')[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      return {
        ticker: normalizedTicker,
        provider: 'yahoo',
        data: dataPoints,
        sourceUrl: `https://finance.yahoo.com/quote/${normalizedTicker}/history`,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not Found')) {
        throw this.createError(
          `Ticker ${normalizedTicker} not found`,
          ProviderErrorCode.NOT_FOUND,
          false,
          undefined,
          error
        );
      }
      throw this.createError(
        error instanceof Error ? error.message : 'Failed to get historical data',
        ProviderErrorCode.NETWORK_ERROR,
        true,
        undefined,
        error
      );
    }
  }

  /**
   * Convert Yahoo currency code to our format
   */
  private getCurrencyFromCurrencyCode(currency?: string): 'USD' | 'INR' {
    if (currency === 'INR') return 'INR';
    return 'USD'; // Default to USD
  }

  /**
   * Convert Yahoo market state to our format
   */
  private getMarketState(marketState?: string): StockPriceResponse['marketState'] {
    switch (marketState?.toUpperCase()) {
      case 'PRE':
        return 'pre';
      case 'POST':
      case 'POSTMARKET':
        return 'post';
      case 'CLOSED':
        return 'closed';
      case 'OPEN':
      default:
        return 'open';
    }
  }
}

// Export singleton
export const yahooProvider = new YahooProvider();
