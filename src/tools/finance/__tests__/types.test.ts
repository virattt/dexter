/**
 * Types and Schema Tests
 * Tests for Zod validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import {
  StockPriceInputSchema,
  HistoricalDataInputSchema,
  OrderInputSchema,
  type ProviderCapabilities,
  type StockPriceResponse,
  type HistoricalDataResponse,
  type FundamentalsResponse,
} from '../providers/types.js';

describe('StockPriceInputSchema', () => {
  it('should validate correct stock price input', () => {
    const result = StockPriceInputSchema.safeParse({
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      provider: 'yahoo',
    });

    expect(result.success).toBe(true);
  });

  it('should accept minimal valid input', () => {
    const result = StockPriceInputSchema.safeParse({
      ticker: 'RELIANCE',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty ticker', () => {
    const result = StockPriceInputSchema.safeParse({
      ticker: '',
    });

    expect(result.success).toBe(false);
  });

  it('should reject ticker longer than 20 characters', () => {
    const result = StockPriceInputSchema.safeParse({
      ticker: 'VERYLONGTICKERNAMETHATISTOOLONG',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid exchange', () => {
    const result = StockPriceInputSchema.safeParse({
      ticker: 'AAPL',
      exchange: 'INVALID',
    });

    expect(result.success).toBe(false);
  });

  it('should accept valid exchanges', () => {
    const exchanges = ['NSE', 'BSE', 'NASDAQ', 'NYSE'];

    exchanges.forEach(exchange => {
      const result = StockPriceInputSchema.safeParse({
        ticker: 'TEST',
        exchange: exchange as any,
      });
      expect(result.success).toBe(true);
    });
  });

  it('should accept valid providers', () => {
    const providers = ['financial-datasets', 'groww', 'zerodha', 'yahoo', 'auto'];

    providers.forEach(provider => {
      const result = StockPriceInputSchema.safeParse({
        ticker: 'TEST',
        provider: provider as any,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('HistoricalDataInputSchema', () => {
  it('should validate correct historical data input', () => {
    const result = HistoricalDataInputSchema.safeParse({
      ticker: 'AAPL',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      exchange: 'NASDAQ',
    });

    expect(result.success).toBe(true);
  });

  it('should require start and end dates', () => {
    const result = HistoricalDataInputSchema.safeParse({
      ticker: 'AAPL',
    });

    expect(result.success).toBe(false);
  });
});

describe('OrderInputSchema', () => {
  it('should validate correct order input', () => {
    const result = OrderInputSchema.safeParse({
      ticker: 'RELIANCE',
      exchange: 'NSE',
      transactionType: 'BUY',
      quantity: 10,
      orderType: 'MARKET',
      productType: 'DELIVERY',
    });

    expect(result.success).toBe(true);
  });

  it('should require positive quantity', () => {
    const result = OrderInputSchema.safeParse({
      ticker: 'RELIANCE',
      exchange: 'NSE',
      transactionType: 'BUY',
      quantity: 0,
      orderType: 'MARKET',
      productType: 'DELIVERY',
    });

    expect(result.success).toBe(false);
  });

  it('should accept valid order types', () => {
    const orderTypes = ['MARKET', 'LIMIT', 'SL', 'SLM'];

    orderTypes.forEach(orderType => {
      const result = OrderInputSchema.safeParse({
        ticker: 'TEST',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 10,
        orderType: orderType as any,
        productType: 'DELIVERY',
      });
      expect(result.success).toBe(true);
    });
  });

  it('should accept valid product types', () => {
    const productTypes = ['DELIVERY', 'INTRADAY', 'CO', 'BO'];

    productTypes.forEach(productType => {
      const result = OrderInputSchema.safeParse({
        ticker: 'TEST',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        productType: productType as any,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Type System', () => {
  it('should have correct ProviderCapabilities structure', () => {
    const capabilities: ProviderCapabilities = {
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
      markets: ['US'],
    };

    expect(capabilities.livePrices).toBe(true);
    expect(capabilities.markets).toContain('US');
  });

  it('should have correct StockPriceResponse structure', () => {
    const response: StockPriceResponse = {
      ticker: 'AAPL',
      provider: 'yahoo',
      price: 150.0,
      change: 2.5,
      changePercent: 1.67,
      marketCap: 2500000000000,
      sharesOutstanding: 16666666667,
      currency: 'USD',
      marketState: 'open',
      volume: 50000000,
      timestamp: '2024-02-28T10:00:00.000Z',
      sourceUrl: 'https://finance.yahoo.com/quote/AAPL',
    };

    expect(response.ticker).toBe('AAPL');
    expect(response.provider).toBe('yahoo');
    expect(response.price).toBe(150.0);
  });

  it('should accept null values in StockPriceResponse', () => {
    const response: StockPriceResponse = {
      ticker: 'UNKNOWN',
      provider: 'yahoo',
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      sharesOutstanding: null,
      currency: 'USD',
      marketState: 'closed',
      volume: null,
      timestamp: '2024-02-28T10:00:00.000Z',
      sourceUrl: 'https://example.com',
    };

    expect(response.price).toBeNull();
    expect(response.change).toBeNull();
  });

  it('should have correct HistoricalDataResponse structure', () => {
    const response: HistoricalDataResponse = {
      ticker: 'AAPL',
      provider: 'yahoo',
      data: [
        {
          date: '2024-02-27',
          open: 148.0,
          high: 152.0,
          low: 147.0,
          close: 151.0,
          volume: 50000000,
        },
      ],
      sourceUrl: 'https://finance.yahoo.com/quote/AAPL/history',
    };

    expect(response.ticker).toBe('AAPL');
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data[0].date).toBe('2024-02-27');
  });
});
