/**
 * Groww Provider
 * 
 * Implementation of Groww Trading API for Indian market data and trading.
 */

import { BaseProvider } from './base-provider.js';
import { RateLimiter } from './rate-limiter.js';
import {
  ProviderConfig,
  ProviderRequestContext,
  StockPriceResponse,
  HistoricalDataResponse,
  FundamentalsResponse,
  Position,
  Holding,
  Margin,
  OrderRequest,
  OrderResponse,
  ProviderErrorCode,
} from './types.js';
import { createHash } from 'crypto';

/**
 * Groww API provider implementation
 */
export class GrowwProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'groww',
    displayName: 'Groww (Indian Markets)',
    baseUrl: 'https://api.groww.in',
    apiKeyEnvVar: 'GROWW_API_KEY',
    apiSecretEnvVar: 'GROWW_API_SECRET',
    capabilities: {
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
      orderPlacement: true,
      positions: true,
      holdings: true,
      markets: ['IN'],
    },
    rateLimits: {
      orders: { perSecond: 10, perMinute: 250 },
      liveData: { perSecond: 10, perMinute: 300 },
      nonTrading: { perSecond: 20, perMinute: 500 },
    },
    requiresAuth: true,
    enabled: true,
  };

  private rateLimiter: RateLimiter;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    super({
      id: 'groww',
      displayName: 'Groww (Indian Markets)',
      baseUrl: 'https://api.groww.in',
      apiKeyEnvVar: 'GROWW_API_KEY',
      apiSecretEnvVar: 'GROWW_API_SECRET',
      capabilities: {
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
        orderPlacement: true,
        positions: true,
        holdings: true,
        markets: ['IN'],
      },
      rateLimits: {
        orders: { perSecond: 10, perMinute: 250 },
        liveData: { perSecond: 10, perMinute: 300 },
        nonTrading: { perSecond: 20, perMinute: 500 },
      },
      requiresAuth: true,
      enabled: true,
    });
    
    this.rateLimiter = new RateLimiter(this.config.rateLimits);
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    const apiKey = process.env.GROWW_API_KEY;
    const apiSecret = process.env.GROWW_API_SECRET;
    const enabled = process.env.ENABLE_GROWW !== 'false';
    return !!(apiKey && apiSecret && enabled);
  }

  /**
   * Initialize provider (obtain access token)
   */
  async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Groww provider is not available (missing credentials)');
    }
    await this.ensureAccessToken();
  }

  /**
   * Get current stock price
   */
  async getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse> {
    await this.ensureAccessToken();
    await this.rateLimiter.waitForToken('liveData');

    const ticker = this.validateTicker(context.ticker);
    const exchange = context.exchange || 'NSE';

    const response = await this.fetch<{
      status: string;
      payload: any;
    }>(`/v1/api/stocks/quote?trading_symbol=${ticker}&exchange=${exchange}`);

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to fetch stock price from Groww',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    const quote = response.payload;

    return this.normalizeStockPrice(ticker, 'groww', {
      price: quote.ltp ?? null,
      change: quote.dayChange ?? null,
      changePercent: quote.dayChangePercentage ?? null,
      currency: 'INR',
      marketState: quote.marketStatus === 'OPEN' ? 'open' : 'closed',
      volume: quote.totalTradedVolume ?? null,
      sourceUrl: `https://groww.in/stocks/${ticker.toLowerCase()}`,
    });
  }

  /**
   * Get historical data
   */
  async getHistoricalData(context: ProviderRequestContext): Promise<HistoricalDataResponse> {
    await this.ensureAccessToken();
    await this.rateLimiter.waitForToken('liveData');

    const ticker = this.validateTicker(context.ticker);
    const exchange = context.exchange || 'NSE';

    const response = await this.fetch<{
      status: string;
      payload: any[];
    }>(`/v1/api/stocks/ohlc?trading_symbol=${ticker}&exchange=${exchange}`);

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to fetch historical data from Groww',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    const data = response.payload.map((item: any) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    return {
      ticker,
      provider: 'groww',
      data,
      sourceUrl: `https://groww.in/stocks/${ticker.toLowerCase()}`,
    };
  }

  /**
   * Get positions
   */
  async getPositions(): Promise<Position[]> {
    await this.ensureAccessToken();
    await this.rateLimiter.waitForToken('nonTrading');

    const response = await this.fetch<{
      status: string;
      payload: any[];
    }>('/v1/api/trade/positions');

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to fetch positions from Groww',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    return response.payload.map((pos: any) => ({
      ticker: pos.tradingSymbol,
      exchange: pos.exchange,
      quantity: pos.quantity,
      averagePrice: pos.averagePrice,
      currentPrice: pos.ltp,
      pnl: pos.pnl,
      pnlPercent: pos.pnlPercentage,
    }));
  }

  /**
   * Get holdings
   */
  async getHoldings(): Promise<Holding[]> {
    await this.ensureAccessToken();
    await this.rateLimiter.waitForToken('nonTrading');

    const response = await this.fetch<{
      status: string;
      payload: any[];
    }>('/v1/api/trade/holdings');

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to fetch holdings from Groww',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    return response.payload.map((holding: any) => ({
      ticker: holding.tradingSymbol,
      exchange: holding.exchange,
      quantity: holding.quantity,
      averagePrice: holding.averagePrice,
      currentPrice: holding.ltp,
      pnl: holding.pnl,
      pnlPercent: holding.pnlPercentage,
      dayChange: holding.dayChange,
      dayChangePercent: holding.dayChangePercentage,
    }));
  }

  /**
   * Get margin
   */
  async getMargin(): Promise<Margin> {
    await this.ensureAccessToken();
    await this.rateLimiter.waitForToken('nonTrading');

    const response = await this.fetch<{
      status: string;
      payload: any;
    }>('/v1/api/trade/margin');

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to fetch margin from Groww',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    return {
      availableCash: response.payload.availableCash,
      availableMargin: response.payload.availableMargin,
      totalMarginUsed: response.payload.totalMarginUsed,
      currency: 'INR',
    };
  }

  /**
   * Place order
   */
  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    await this.ensureAccessToken();
    await this.rateLimiter.waitForToken('orders');

    const response = await this.fetch<{
      status: string;
      payload: any;
    }>('/v1/api/trade/order/place', {
      method: 'POST',
      body: JSON.stringify({
        tradingSymbol: order.ticker,
        exchange: order.exchange,
        transactionType: order.transactionType,
        quantity: order.quantity,
        orderType: order.orderType,
        productType: order.productType,
        price: order.price,
        triggerPrice: order.triggerPrice,
        validity: order.validity || 'DAY',
      }),
    });

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to place order on Groww',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    return {
      orderId: response.payload.orderId,
      ticker: order.ticker,
      exchange: order.exchange,
      transactionType: order.transactionType,
      quantity: order.quantity,
      filledQuantity: response.payload.filledQuantity || 0,
      status: response.payload.status,
      orderType: order.orderType,
      productType: order.productType,
      averagePrice: response.payload.averagePrice || null,
      price: order.price || null,
      createdAt: response.payload.createdAt,
      updatedAt: response.payload.updatedAt,
      provider: 'groww',
    };
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAccessToken(): Promise<void> {
    const now = new Date();

    // Token exists and not expired (with 5-minute buffer)
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date(now.getTime() + 5 * 60 * 1000)) {
      return;
    }

    // Generate new token
    const apiKey = process.env.GROWW_API_KEY;
    const apiSecret = process.env.GROWW_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw this.createError(
        'Groww API credentials not configured',
        ProviderErrorCode.AUTH_MISSING,
        false
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const checksum = createHash('sha256').update(apiSecret + timestamp).digest('hex');

    const response = await this.fetch<{
      status: string;
      payload: { token: string; expiry: string };
    }>('/v1/api/trade/token', {
      method: 'POST',
      headers: { 'Authorization': apiKey },
      body: JSON.stringify({
        key_type: 'approval',
        checksum,
        timestamp,
      }),
    });

    if (response.status !== 'SUCCESS') {
      throw this.createError(
        'Failed to obtain Groww access token',
        ProviderErrorCode.AUTH_FAILED,
        false
      );
    }

    this.accessToken = response.payload.token;
    this.tokenExpiry = new Date(response.payload.expiry);
  }

  /**
   * Get auth headers for API requests
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    await this.ensureAccessToken();
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'X-API-VERSION': '1.0',
    };
  }

  /**
   * Make HTTP request with auth headers
   */
  protected async fetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getAuthHeaders();
    return super.fetch<T>(endpoint, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  }
}

// Default provider instance
export const growwProvider = new GrowwProvider();
