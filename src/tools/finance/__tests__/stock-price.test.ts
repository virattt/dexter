/**
 * Stock Price Tool Tests
 * Tests for the stock-price tool using provider abstraction
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { getStockPrice } from '../stock-price.js';
import { providerRegistry } from '../providers/index.js';

// Mock the provider registry
let mockGetProvider: any;
let mockExecuteFallback: any;

describe('getStockPrice Tool', () => {
  beforeEach(() => {
    mockGetProvider = spyOn(providerRegistry, 'getProviderForCapability');
    mockExecuteFallback = spyOn(providerRegistry, 'executeWithFallback');
  });

  afterEach(() => {
    if (mockGetProvider?.mockRestore) {
      mockGetProvider.mockRestore();
    }
    if (mockExecuteFallback?.mockRestore) {
      mockExecuteFallback.mockRestore();
    }
  });

  describe('Input Validation', () => {
    it('should accept ticker symbol', () => {
      const schema = getStockPrice.schema;
      const result = schema.safeParse({ ticker: 'AAPL' });

      expect(result.success).toBe(true);
    });

    it('should accept ticker with exchange', () => {
      const schema = getStockPrice.schema;
      const result = schema.safeParse({
        ticker: 'RELIANCE',
        exchange: 'NSE',
      });

      expect(result.success).toBe(true);
    });

    it('should accept ticker with provider', () => {
      const schema = getStockPrice.schema;
      const result = schema.safeParse({
        ticker: 'AAPL',
        provider: 'yahoo',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty ticker', () => {
      const schema = getStockPrice.schema;
      const result = schema.safeParse({ ticker: '' });

      expect(result.success).toBe(false);
    });
  });

  describe('Provider Selection', () => {
    it('should use provider registry for livePrices', async () => {
      let callCount = 0;
      const mockProvider = {
        config: { id: 'yahoo' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: () => {
          callCount++;
          return Promise.resolve({
            ticker: 'AAPL',
            provider: 'yahoo',
            price: 150.0,
            change: 2.5,
            changePercent: 1.67,
            currency: 'USD',
            marketState: 'open',
            volume: 50000000,
            timestamp: '2024-02-28T10:00:00.000Z',
            sourceUrl: 'https://finance.yahoo.com/quote/AAPL',
          });
        },
      };

      mockGetProvider.mockReturnValue(mockProvider);

      const result = await getStockPrice.func({ ticker: 'AAPL' });

      expect(callCount).toBeGreaterThan(0);
    });

    it('should use preferred provider when specified', async () => {
      const mockProvider = {
        config: { id: 'yahoo' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: () => Promise.resolve({
          ticker: 'AAPL',
          provider: 'yahoo',
          price: 150.0,
          change: 2.5,
          changePercent: 1.67,
          currency: 'USD',
          marketState: 'open',
          volume: 50000000,
          timestamp: '2024-02-28T10:00:00.000Z',
          sourceUrl: 'https://finance.yahoo.com/quote/AAPL',
        }),
      };

      mockGetProvider.mockReturnValue(mockProvider);

      const result = await getStockPrice.func({ ticker: 'AAPL', provider: 'yahoo' });
    });

    it('should auto-select provider based on exchange (NSE)', async () => {
      const mockProvider = {
        config: { id: 'groww' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: () => Promise.resolve({
          ticker: 'RELIANCE',
          provider: 'groww',
          price: 2500.0,
          change: 50.0,
          changePercent: 2.04,
          currency: 'INR',
          marketState: 'open',
          volume: 10000000,
          timestamp: '2024-02-28T10:00:00.000Z',
          sourceUrl: 'https://groww.in/stocks/reliance',
        }),
      };

      mockGetProvider.mockReturnValue(mockProvider);

      const result = await getStockPrice.func({ ticker: 'RELIANCE', exchange: 'NSE' });
    });
  });

  describe('Error Handling', () => {
    it('should return error when no provider available', async () => {
      mockGetProvider.mockReturnValue(null);

      const result = await getStockPrice.func({ ticker: 'TEST' });

      expect(result).toContain('No provider available');
    });

    it('should use fallback when primary provider fails', async () => {
      const mockProvider = {
        config: { id: 'yahoo' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: () => Promise.reject(new Error('Primary failed')),
      };

      mockGetProvider.mockReturnValue(mockProvider);

      mockExecuteFallback.mockResolvedValue({
        ticker: 'AAPL',
        provider: 'fallback',
        price: 150.0,
        change: 2.5,
        changePercent: 1.67,
        currency: 'USD',
        marketState: 'open',
        volume: 50000000,
        timestamp: '2024-02-28T10:00:00.000Z',
        sourceUrl: 'https://example.com',
      });

      const result = await getStockPrice.func({ ticker: 'AAPL' });

      // Should have tried fallback
      expect(mockExecuteFallback).toHaveBeenCalled();
    });

    it('should handle provider errors gracefully', async () => {
      const mockProvider = {
        config: { id: 'yahoo' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: () => Promise.reject(new Error('Primary failed hard')),
      };

      mockGetProvider.mockReturnValue(mockProvider);

      mockExecuteFallback.mockRejectedValue(new Error('All providers failed'));

      const result = await getStockPrice.func({ ticker: 'TEST' });

      expect(result).toContain('Failed to fetch stock price');
    });
  });

  describe('Response Format', () => {
    it('should return formatted tool result', async () => {
      const mockProvider = {
        config: { id: 'yahoo' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: () => Promise.resolve({
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
        }),
      };

      mockGetProvider.mockReturnValue(mockProvider);

      const result = await getStockPrice.func({ ticker: 'AAPL' });

      // Should be a JSON string
      const parsed = JSON.parse(result);
      expect(parsed.data.ticker).toBe('AAPL');
      expect(parsed.data.provider).toBe('yahoo');
      expect(parsed.data.price).toBe(150.0);
      expect(parsed.sourceUrls).toContain('https://finance.yahoo.com/quote/AAPL');
    });

    it('should normalize ticker to uppercase', async () => {
      let capturedTicker: string | undefined;
      const mockProvider = {
        config: { id: 'yahoo' },
        isAvailable: () => true,
        getCapabilities: () => ({ livePrices: true }),
        supportsCapability: () => true,
        getStockPrice: (ctx: any) => {
          capturedTicker = ctx.ticker;
          return Promise.resolve({
            ticker: 'AAPL',
            provider: 'yahoo',
            price: 150.0,
            change: 2.5,
            changePercent: 1.67,
            currency: 'USD',
            marketState: 'open',
            volume: 50000000,
            timestamp: '2024-02-28T10:00:00.000Z',
            sourceUrl: 'https://finance.yahoo.com/quote/AAPL',
          });
        },
      };

      mockGetProvider.mockReturnValue(mockProvider);

      await getStockPrice.func({ ticker: 'aapl' });

      expect(capturedTicker).toBe('AAPL');
    });
  });
});
