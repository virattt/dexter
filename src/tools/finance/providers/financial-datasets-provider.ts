/**
 * Financial Datasets Provider
 * 
 * Wrapper for the existing Financial Datasets API implementation.
 */

import { BaseProvider } from './base-provider.js';
import { RateLimiter } from './rate-limiter.js';
import {
  ProviderConfig,
  ProviderRequestContext,
  StockPriceResponse,
  HistoricalDataResponse,
  FundamentalsResponse,
  ProviderErrorCode,
} from './types.js';

/**
 * Financial Datasets API provider implementation
 */
export class FinancialDatasetsProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'financial-datasets',
    displayName: 'Financial Datasets (US Markets)',
    baseUrl: 'https://api.financialdatasets.ai',
    apiKeyEnvVar: 'FINANCIAL_DATASETS_API_KEY',
    apiSecretEnvVar: undefined,
    capabilities: {
      livePrices: false,
      historicalData: true,
      incomeStatements: true,
      balanceSheets: true,
      cashFlowStatements: true,
      keyRatios: true,
      analystEstimates: true,
      filings: true,
      insiderTrades: true,
      companyNews: false,
      orderPlacement: false,
      positions: false,
      holdings: false,
      markets: ['US'],
    },
    rateLimits: {
      default: { perSecond: 10, perMinute: 1000 },
    },
    requiresAuth: true,
    enabled: true,
  };

  private rateLimiter: RateLimiter;

  constructor() {
    super({
      id: 'financial-datasets',
      displayName: 'Financial Datasets (US Markets)',
      baseUrl: 'https://api.financialdatasets.ai',
      apiKeyEnvVar: 'FINANCIAL_DATASETS_API_KEY',
      capabilities: {
        livePrices: false,
        historicalData: true,
        incomeStatements: true,
        balanceSheets: true,
        cashFlowStatements: true,
        keyRatios: true,
        analystEstimates: true,
        filings: true,
        insiderTrades: true,
        companyNews: false,
        orderPlacement: false,
        positions: false,
        holdings: false,
        markets: ['US'],
      },
      rateLimits: {
        default: { perSecond: 10, perMinute: 1000 },
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
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;
    const enabled = process.env.ENABLE_FINANCIAL_DATASETS !== 'false';
    return !!(apiKey && enabled);
  }

  /**
   * Get current stock price (not supported by Financial Datasets)
   */
  async getStockPrice(_context: ProviderRequestContext): Promise<StockPriceResponse> {
    throw this.createError(
      'Financial Datasets does not support live prices',
      ProviderErrorCode.INVALID_INPUT,
      false
    );
  }

  /**
   * Get historical data
   */
  async getHistoricalData(context: ProviderRequestContext): Promise<HistoricalDataResponse> {
    if (!this.isAvailable()) {
      throw this.createError(
        'Financial Datasets provider not available',
        ProviderErrorCode.AUTH_MISSING,
        false
      );
    }

    await this.rateLimiter.waitForToken('default');

    const ticker = this.validateTicker(context.ticker);
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;

    const response = await this.fetch<{
      status: string;
      data: any[];
    }>(`/historical_prices?ticker=${ticker}&api_key=${apiKey}`);

    if (response.status !== 'success') {
      throw this.createError(
        'Failed to fetch historical data from Financial Datasets',
        ProviderErrorCode.PROVIDER_ERROR,
        false
      );
    }

    const data = response.data.map((item: any) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    return {
      ticker,
      provider: 'financial-datasets',
      data,
      sourceUrl: 'https://financialdatasets.ai',
    };
  }

  /**
   * Get fundamentals (income statements, balance sheets, cash flow)
   */
  async getFundamentals(context: ProviderRequestContext): Promise<FundamentalsResponse> {
    if (!this.isAvailable()) {
      throw this.createError(
        'Financial Datasets provider not available',
        ProviderErrorCode.AUTH_MISSING,
        false
      );
    }

    await this.rateLimiter.waitForToken('default');

    const ticker = this.validateTicker(context.ticker);
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;

    if (!apiKey) {
      throw this.createError(
        'Financial Datasets API key not configured',
        ProviderErrorCode.AUTH_MISSING,
        false
      );
    }

    // Fetch all fundamentals in parallel
    const [incomeStmts, balanceSheets, cashFlowStmts, keyRatios] = await Promise.all([
      this.fetchIncomeStatements(ticker, apiKey),
      this.fetchBalanceSheets(ticker, apiKey),
      this.fetchCashFlowStatements(ticker, apiKey),
      this.fetchKeyRatios(ticker, apiKey),
    ]);

    return {
      ticker,
      provider: 'financial-datasets',
      incomeStatements: incomeStmts,
      balanceSheets: balanceSheets,
      cashFlowStatements: cashFlowStmts,
      keyRatios: keyRatios,
      sourceUrl: 'https://financialdatasets.ai',
    };
  }

  /**
   * Fetch income statements
   */
  private async fetchIncomeStatements(ticker: string, apiKey: string) {
    const response = await this.fetch<{ data: any[] }>(
      `/income_statements?ticker=${ticker}&api_key=${apiKey}`
    );
    return response.data.map((item: any) => ({
      fiscalDate: item.fiscal_date,
      revenue: item.revenue,
      netIncome: item.net_income,
      grossProfit: item.gross_profit,
      operatingIncome: item.operating_income,
      eps: item.eps,
    }));
  }

  /**
   * Fetch balance sheets
   */
  private async fetchBalanceSheets(ticker: string, apiKey: string) {
    const response = await this.fetch<{ data: any[] }>(
      `/balance_sheets?ticker=${ticker}&api_key=${apiKey}`
    );
    return response.data.map((item: any) => ({
      fiscalDate: item.fiscal_date,
      totalAssets: item.total_assets,
      totalLiabilities: item.total_liabilities,
      totalEquity: item.total_equity,
      currentAssets: item.current_assets,
      currentLiabilities: item.current_liabilities,
    }));
  }

  /**
   * Fetch cash flow statements
   */
  private async fetchCashFlowStatements(ticker: string, apiKey: string) {
    const response = await this.fetch<{ data: any[] }>(
      `/cash_flow_statements?ticker=${ticker}&api_key=${apiKey}`
    );
    return response.data.map((item: any) => ({
      fiscalDate: item.fiscal_date,
      operatingCashFlow: item.operating_cash_flow,
      investingCashFlow: item.investing_cash_flow,
      financingCashFlow: item.financing_cash_flow,
      freeCashFlow: item.free_cash_flow,
    }));
  }

  /**
   * Fetch key ratios
   */
  private async fetchKeyRatios(ticker: string, apiKey: string) {
    const response = await this.fetch<{ data: any[] }>(
      `/key_ratios?ticker=${ticker}&api_key=${apiKey}`
    );
    return response.data.map((item: any) => ({
      date: item.date,
      peRatio: item.pe_ratio ?? null,
      pbRatio: item.pb_ratio ?? null,
      debtToEquity: item.debt_to_equity ?? null,
      returnOnEquity: item.return_on_equity ?? null,
      dividendYield: item.dividend_yield ?? null,
    }));
  }

  /**
   * Get auth headers for API requests
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;
    return {
      'x-api-key': apiKey || '',
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
export const financialDatasetsProvider = new FinancialDatasetsProvider();
