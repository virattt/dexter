/**
 * Zerodha Provider
 * 
 * Implementation for Zerodha Kite Connect API.
 * Supports: Indian stocks (NSE, BSE), live prices, historical data, orders.
 */

import { BaseProvider } from './base-provider.js';
import { RateLimiter } from './rate-limiter.js';
import {
  ProviderCapabilities,
  ProviderRequestContext,
  StockPriceResponse,
  HistoricalDataResponse,
  HistoricalDataPoint,
  Position,
  Holding,
  Margin,
  OrderRequest,
  OrderResponse,
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
  orderPlacement: true,
  positions: true,
  holdings: true,
  markets: ['IN'],
};

const CONFIG = {
  id: 'zerodha' as const,
  displayName: 'Zerodha Kite',
  baseUrl: 'https://api.kite.trade',
  apiKeyEnvVar: 'ZERODHA_API_KEY',
  apiSecretEnvVar: 'ZERODHA_API_SECRET',
  capabilities: CAPABILITIES,
  rateLimits: {
    orders: { perSecond: 10, perMinute: 200 },
    historical: { perSecond: 3, perMinute: 60 },
    quote: { perSecond: 10, perMinute: 200 },
  },
  requiresAuth: true,
  enabled: process.env.ENABLE_ZERODHA !== 'false',
};

// Instrument token mapping (NSE)
const NSE_INSTRUMENT_TOKENS: Record<string, string> = {
  'RELIANCE': '2885',
  'TCS': '11536',
  'INFY': '15956',
  'HDFCBANK': '1330',
  'ICICIBANK': '1190',
  'SBIN': '3045',
  'BHARTIARTL': '10604',
  'WIPRO': '3787',
  'HCLTECH': '7229',
  'MARUTI': '10999',
};

export class ZerodhaProvider extends BaseProvider {
  private apiKey: string | undefined;
  private accessToken: string | undefined;
  private readonly rateLimiter: RateLimiter;

  constructor() {
    super(CONFIG);
    this.apiKey = process.env.ZERODHA_API_KEY;
    this.accessToken = process.env.ZERODHA_ACCESS_TOKEN;
    this.rateLimiter = new RateLimiter({
      orders: { perSecond: 10, perMinute: 200 },
      historical: { perSecond: 3, perMinute: 60 },
      quote: { perSecond: 10, perMinute: 200 },
    });
  }

  /**
   * Check if provider is available (credentials configured)
   */
  isAvailable(): boolean {
    return !!(this.apiKey && this.accessToken);
  }

  /**
   * Initialize provider
   */
  async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('Zerodha provider not available: credentials not configured');
    }
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): Record<string, string> {
    if (!this.apiKey || !this.accessToken) {
      throw this.createError(
        'Zerodha credentials not configured',
        ProviderErrorCode.AUTH_MISSING,
        false
      );
    }
    return {
      'Authorization': `token ${this.apiKey}:${this.accessToken}`,
      'Content-Type': 'application/json',
      'X-Kite-Version': '3',
    };
  }

  /**
   * Get instrument token for ticker
   */
  private getInstrumentToken(ticker: string, exchange: string): string | null {
    const normalizedTicker = ticker.toUpperCase();
    
    if (exchange === 'NSE') {
      return NSE_INSTRUMENT_TOKENS[normalizedTicker] || null;
    }
    
    // For BSE, would need BSE token mapping
    return null;
  }

  /**
   * Get stock quote (live price)
   */
  async getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse> {
    const normalizedTicker = this.validateTicker(context.ticker);
    const exchange = context.exchange || 'NSE';
    
    await this.rateLimiter.waitForToken('quote');

    const instrumentToken = this.getInstrumentToken(normalizedTicker, exchange);
    if (!instrumentToken) {
      throw this.createError(
        `Instrument token not found for ${normalizedTicker}`,
        ProviderErrorCode.NOT_FOUND,
        false
      );
    }

    const response = await this.fetch<Record<string, Array<{
      last_price: number;
      change: number;
      oi: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      last_trade_time: string;
    }>>>(`/quote?i=${instrumentToken}`, {
      headers: this.getHeaders(),
    });

    const quoteData = response[instrumentToken];
    if (!quoteData || !quoteData[0]) {
      throw this.createError(
        `Failed to get quote for ${normalizedTicker}`,
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    const data = quoteData[0];
    return this.normalizeStockPrice(normalizedTicker, 'zerodha', {
      price: data.last_price,
      change: data.change,
      changePercent: data.close ? (data.change / data.close) * 100 : null,
      currency: 'INR',
      marketState: 'open',
      volume: data.volume,
      sourceUrl: `${this.config.baseUrl}/quote`,
    });
  }

  /**
   * Get historical data
   */
  async getHistoricalData(context: ProviderRequestContext): Promise<HistoricalDataResponse> {
    const normalizedTicker = this.validateTicker(context.ticker);
    const exchange = context.exchange || 'NSE';
    const startDate = context.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = context.endDate || new Date().toISOString().split('T')[0];
    
    await this.rateLimiter.waitForToken('historical');

    const instrumentToken = this.getInstrumentToken(normalizedTicker, exchange);
    if (!instrumentToken) {
      throw this.createError(
        `Instrument token not found for ${normalizedTicker}`,
        ProviderErrorCode.NOT_FOUND,
        false
      );
    }

    const response = await this.fetch<{
      data: Array<{
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }>;
    }>(`/historical/${instrumentToken}?from=${startDate}&to=${endDate}&interval=day`, {
      headers: this.getHeaders(),
    });

    if (!response.data) {
      throw this.createError(
        `Failed to get historical data for ${normalizedTicker}`,
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    const dataPoints: HistoricalDataPoint[] = response.data.map(item => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    return {
      ticker: normalizedTicker,
      provider: 'zerodha',
      data: dataPoints,
      sourceUrl: `${this.config.baseUrl}/historical/${instrumentToken}`,
    };
  }

  /**
   * Get positions
   */
  async getPositions(): Promise<Position[]> {
    await this.rateLimiter.waitForToken('quote');

    const response = await this.fetch<{
      data: Array<{
        trading_symbol: string;
        exchange: string;
        quantity: number;
        average_price: number;
        last_price: number;
        pnl: number;
        pnl_percent: number;
      }>;
    }>('/portfolio/positions', {
      headers: this.getHeaders(),
    });

    if (!response.data) {
      throw this.createError(
        'Failed to get positions',
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    return response.data.map(pos => ({
      ticker: pos.trading_symbol,
      exchange: pos.exchange,
      quantity: pos.quantity,
      averagePrice: pos.average_price,
      currentPrice: pos.last_price,
      pnl: pos.pnl,
      pnlPercent: pos.pnl_percent,
    }));
  }

  /**
   * Get holdings
   */
  async getHoldings(): Promise<Holding[]> {
    await this.rateLimiter.waitForToken('quote');

    const response = await this.fetch<{
      data: Array<{
        trading_symbol: string;
        exchange: string;
        quantity: number;
        average_price: number;
        last_price: number;
        pnl: number;
        pnl_percent: number;
        day_change: number;
        day_change_percent: number;
      }>;
    }>('/portfolio/holdings', {
      headers: this.getHeaders(),
    });

    if (!response.data) {
      throw this.createError(
        'Failed to get holdings',
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    return response.data.map(hold => ({
      ticker: hold.trading_symbol,
      exchange: hold.exchange,
      quantity: hold.quantity,
      averagePrice: hold.average_price,
      currentPrice: hold.last_price,
      pnl: hold.pnl,
      pnlPercent: hold.pnl_percent,
      dayChange: hold.day_change,
      dayChangePercent: hold.day_change_percent,
    }));
  }

  /**
   * Get margin
   */
  async getMargin(): Promise<Margin> {
    await this.rateLimiter.waitForToken('quote');

    const response = await this.fetch<{
      data: {
        equity: { available_cash: number; margin_used: number; net: number };
        commodity: { available_cash: number; margin_used: number; net: number };
      };
    }>('/margin', {
      headers: this.getHeaders(),
    });

    if (!response.data) {
      throw this.createError(
        'Failed to get margin',
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    const equity = response.data.equity;
    return {
      availableCash: equity.available_cash,
      availableMargin: equity.net,
      totalMarginUsed: equity.margin_used,
      currency: 'INR',
    };
  }

  /**
   * Place order
   */
  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    await this.rateLimiter.waitForToken('orders');

    const exchangePrefix = order.exchange === 'NSE' ? 'NSE' : 'BSE';
    
    const response = await this.fetch<{
      data: {
        order_id: string;
        status: string;
        average_price: number;
        filled_quantity: number;
      };
      error?: string;
    }>('/orders/regular', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        exchange: exchangePrefix,
        trading_symbol: order.ticker,
        transaction_type: order.transactionType,
        quantity: order.quantity,
        order_type: order.orderType,
        product: order.productType === 'DELIVERY' ? 'CNC' : order.productType === 'INTRADAY' ? 'MIS' : order.productType,
        price: order.price,
        trigger_price: order.triggerPrice,
        validity: order.validity || 'DAY',
      }),
    });

    if (response.error) {
      throw this.createError(
        response.error,
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    if (!response.data) {
      throw this.createError(
        'Failed to place order',
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    const data = response.data;
    return {
      orderId: data.order_id,
      ticker: order.ticker,
      exchange: order.exchange,
      transactionType: order.transactionType,
      quantity: order.quantity,
      filledQuantity: data.filled_quantity,
      status: data.status === 'COMPLETE' ? 'FILLED' : 'OPEN',
      orderType: order.orderType,
      productType: order.productType,
      averagePrice: data.average_price,
      price: order.price || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'zerodha',
    };
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<OrderResponse> {
    await this.rateLimiter.waitForToken('orders');

    const response = await this.fetch<{
      data: Array<{
        order_id: string;
        trading_symbol: string;
        exchange: string;
        transaction_type: string;
        quantity: number;
        filled_quantity: number;
        order_type: string;
        product: string;
        average_price: number;
        price: number;
        status: string;
        order_timestamp: string;
      }>;
    }>(`/orders/${orderId}`, {
      headers: this.getHeaders(),
    });

    if (!response.data || !response.data[0]) {
      throw this.createError(
        'Order not found',
        ProviderErrorCode.NOT_FOUND,
        false
      );
    }

    const data = response.data[0];
    return {
      orderId: data.order_id,
      ticker: data.trading_symbol,
      exchange: data.exchange,
      transactionType: data.transaction_type as 'BUY' | 'SELL',
      quantity: data.quantity,
      filledQuantity: data.filled_quantity,
      status: data.status === 'COMPLETE' ? 'FILLED' : data.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
      orderType: data.order_type,
      productType: data.product === 'CNC' ? 'DELIVERY' : data.product === 'MIS' ? 'INTRADAY' : data.product,
      averagePrice: data.average_price,
      price: data.price,
      createdAt: data.order_timestamp,
      updatedAt: data.order_timestamp,
      provider: 'zerodha',
    };
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.rateLimiter.waitForToken('orders');

    const response = await this.fetch<{
      data?: { status: string };
      error?: string;
    }>(`/orders/${orderId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (response.error) {
      throw this.createError(
        response.error,
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }
  }

  /**
   * Modify order
   */
  async modifyOrder(orderId: string, order: Partial<OrderRequest>): Promise<OrderResponse> {
    await this.rateLimiter.waitForToken('orders');

    const response = await this.fetch<{
      data?: { order_id: string };
      error?: string;
    }>(`/orders/${orderId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        quantity: order.quantity,
        price: order.price,
        order_type: order.orderType,
        trigger_price: order.triggerPrice,
      }),
    });

    if (response.error) {
      throw this.createError(
        response.error,
        ProviderErrorCode.PROVIDER_ERROR,
        true
      );
    }

    return this.getOrderStatus(orderId);
  }
}

// Export singleton
export const zerodhaProvider = new ZerodhaProvider();
