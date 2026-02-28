/**
 * Base Provider Class
 * 
 * Abstract base class providing common functionality for all financial data providers.
 */

import {
  ProviderConfig,
  ProviderCapabilities,
  ProviderRequestContext,
  StockPriceResponse,
  ProviderError,
  ProviderErrorCode,
  HistoricalDataResponse,
  FundamentalsResponse,
} from './types.js';
import { ProviderError as ProviderErrorClass } from './types.js';

/**
 * Base provider with common HTTP client and error handling
 */
export abstract class BaseProvider {
  public readonly config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Check if provider is available (credentials configured)
   */
  abstract isAvailable(): boolean;

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return this.config.capabilities;
  }

  /**
   * Check if provider supports a specific capability
   */
  supportsCapability(capability: keyof ProviderCapabilities): boolean {
    return this.config.capabilities[capability] as boolean ?? false;
  }

  /**
   * Get stock price - must be implemented by each provider
   */
  abstract getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse>;

  /**
   * Optional initialization (for auth, setup)
   */
  async initialize?(): Promise<void> {
    // Default no-op
  }

  /**
   * Get historical data (optional)
   */
  async getHistoricalData?(_context: ProviderRequestContext): Promise<HistoricalDataResponse> {
    throw new ProviderErrorClass(
      'Historical data not supported by this provider',
      this.config.id,
      ProviderErrorCode.INVALID_INPUT,
      false
    );
  }

  /**
   * Get fundamentals (optional)
   */
  async getFundamentals?(_context: ProviderRequestContext): Promise<FundamentalsResponse> {
    throw new ProviderErrorClass(
      'Fundamentals not supported by this provider',
      this.config.id,
      ProviderErrorCode.INVALID_INPUT,
      false
    );
  }

  // ========================================================================
  // Protected helper methods
  // ========================================================================

  /**
   * Make HTTP request with error handling
   */
  protected async fetch<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 429;
        throw new ProviderErrorClass(
          `HTTP ${response.status}: ${response.statusText}`,
          this.config.id,
          isRetryable ? ProviderErrorCode.PROVIDER_ERROR : ProviderErrorCode.PROVIDER_ERROR,
          isRetryable,
          response.status,
          await this.getErrorBody(response)
        );
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof ProviderErrorClass) {
        throw error;
      }
      
      // Network errors
      if (error instanceof TypeError || (error as Error).message.includes('fetch')) {
        throw new ProviderErrorClass(
          'Network error: Unable to reach provider',
          this.config.id,
          ProviderErrorCode.NETWORK_ERROR,
          true,
          undefined,
          error
        );
      }
      
      throw error;
    }
  }

  /**
   * Build query string from params
   */
  protected buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    return searchParams.toString();
  }

  /**
   * Validate ticker input
   */
  protected validateTicker(ticker: string): string {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || normalized.length > 20) {
      throw new ProviderErrorClass(
        'Invalid ticker symbol',
        this.config.id,
        ProviderErrorCode.INVALID_INPUT,
        false
      );
    }
    return normalized;
  }

  /**
   * Get error body for logging
   */
  private async getErrorBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      return text.slice(0, 500); // Limit length
    } catch {
      return '(unable to read error body)';
    }
  }

  /**
   * Create a provider error with standardized formatting
   */
  protected createError(
    message: string,
    code: ProviderErrorCode,
    retryable: boolean,
    httpStatus?: number,
    originalError?: unknown
  ): ProviderError {
    return new ProviderErrorClass(message, this.config.id, code, retryable, httpStatus, originalError);
  }

  /**
   * Normalize stock price response - to be used by providers
   */
  protected normalizeStockPrice(
    ticker: string,
    provider: StockPriceResponse['provider'],
    data: {
      price: number | null;
      change?: number | null;
      changePercent?: number | null;
      currency?: 'INR' | 'USD';
      marketState?: StockPriceResponse['marketState'];
      volume?: number | null;
      marketCap?: number | null;
      sharesOutstanding?: number | null;
      sourceUrl: string;
    }
  ): StockPriceResponse {
    return {
      ticker: this.validateTicker(ticker),
      provider,
      price: data.price,
      change: data.change ?? null,
      changePercent: data.changePercent ?? null,
      marketCap: data.marketCap ?? null,
      sharesOutstanding: data.sharesOutstanding ?? null,
      currency: data.currency ?? 'USD',
      marketState: data.marketState ?? 'closed',
      volume: data.volume ?? null,
      timestamp: new Date().toISOString(),
      sourceUrl: data.sourceUrl,
    };
  }
}
