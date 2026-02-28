/**
 * Provider Abstraction Layer Types
 * 
 * Core interfaces and types for the provider-agnostic financial data system.
 */

import { z } from 'zod';

// ============================================================================
// Capability Types
// ============================================================================

export interface ProviderCapabilities {
  livePrices: boolean;
  historicalData: boolean;
  incomeStatements: boolean;
  balanceSheets: boolean;
  cashFlowStatements: boolean;
  keyRatios: boolean;
  analystEstimates: boolean;
  filings: boolean;
  insiderTrades: boolean;
  companyNews: boolean;
  orderPlacement: boolean;
  positions: boolean;
  holdings: boolean;
  markets: ('US' | 'IN' | 'GLOBAL')[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface RateLimitConfig {
  perSecond: number;
  perMinute: number;
}

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKeyEnvVar?: string;
  apiSecretEnvVar?: string;
  capabilities: ProviderCapabilities;
  rateLimits: Record<string, RateLimitConfig>;
  requiresAuth: boolean;
  enabled?: boolean;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ProviderRequestContext {
  ticker: string;
  exchange?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
}

export interface StockPriceResponse {
  ticker: string;
  provider: 'financial-datasets' | 'groww' | 'zerodha' | 'yahoo';
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  currency: 'INR' | 'USD';
  marketState: 'open' | 'closed' | 'pre' | 'post';
  volume: number | null;
  timestamp: string; // ISO 8601
  sourceUrl: string;
}

export interface HistoricalDataResponse {
  ticker: string;
  provider: 'financial-datasets' | 'groww' | 'zerodha' | 'yahoo';
  data: HistoricalDataPoint[];
  sourceUrl: string;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FundamentalsResponse {
  ticker: string;
  provider: 'financial-datasets' | 'groww' | 'zerodha' | 'yahoo';
  incomeStatements?: IncomeStatement[];
  balanceSheets?: BalanceSheet[];
  cashFlowStatements?: CashFlowStatement[];
  keyRatios?: KeyRatio[];
  sourceUrl: string;
}

export interface IncomeStatement {
  fiscalDate: string;
  revenue: number;
  netIncome: number;
  grossProfit: number;
  operatingIncome: number;
  eps: number;
}

export interface BalanceSheet {
  fiscalDate: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentAssets: number;
  currentLiabilities: number;
}

export interface CashFlowStatement {
  fiscalDate: string;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  freeCashFlow: number;
}

export interface KeyRatio {
  date: string;
  peRatio: number | null;
  pbRatio: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  dividendYield: number | null;
}

export interface Position {
  ticker: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface Holding {
  ticker: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface Margin {
  availableCash: number;
  availableMargin: number;
  totalMarginUsed: number;
  currency: 'INR' | 'USD';
}

export interface OrderRequest {
  ticker: string;
  exchange: 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE';
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SLM';
  productType: 'DELIVERY' | 'INTRADAY' | 'CO' | 'BO';
  price?: number;
  triggerPrice?: number;
  validity?: 'DAY' | 'IOC' | 'TTL';
}

export interface OrderResponse {
  orderId: string;
  ticker: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  orderType: string;
  productType: string;
  averagePrice: number | null;
  price: number | null;
  createdAt: string;
  updatedAt: string;
  provider: 'groww' | 'zerodha';
}

// ============================================================================
// Error Types
// ============================================================================

export enum ProviderErrorCode {
  AUTH_MISSING = 'AUTH_MISSING',
  AUTH_FAILED = 'AUTH_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: ProviderErrorCode,
    public retryable: boolean,
    public httpStatus?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface IProviderRegistry {
  initialize(): Promise<void>;
  getProvider(id: string): FinancialDataProvider | undefined;
  getAvailableProviders(): FinancialDataProvider[];
  getProvidersForCapability(capability: keyof ProviderCapabilities): FinancialDataProvider[];
  getProviderForCapability(
    capability: keyof ProviderCapabilities,
    preferredProvider?: string
  ): FinancialDataProvider | null;
  executeWithFallback<T>(
    capability: keyof ProviderCapabilities,
    operation: (provider: FinancialDataProvider) => Promise<T>,
    preferredProvider?: string
  ): Promise<T>;
}

export interface IRateLimiter {
  waitForToken(endpointType: string): Promise<void>;
  wouldExceedLimit(endpointType: string): boolean;
  getUsageStats(endpointType: string): { countSecond: number; countMinute: number };
}

export interface FinancialDataProvider {
  readonly config: ProviderConfig;
  isAvailable(): boolean;
  getCapabilities(): ProviderCapabilities;
  supportsCapability(capability: keyof ProviderCapabilities): boolean;
  getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse>;
  initialize?(): Promise<void>;
  getHistoricalData?(context: ProviderRequestContext): Promise<HistoricalDataResponse>;
  getFundamentals?(context: ProviderRequestContext): Promise<FundamentalsResponse>;
  getPositions?(): Promise<Position[]>;
  getHoldings?(): Promise<Holding[]>;
  getMargin?(): Promise<Margin>;
  placeOrder?(order: OrderRequest): Promise<OrderResponse>;
  modifyOrder?(orderId: string, order: Partial<OrderRequest>): Promise<OrderResponse>;
  cancelOrder?(orderId: string): Promise<void>;
  getOrderStatus?(orderId: string): Promise<OrderResponse>;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const StockPriceInputSchema = z.object({
  ticker: z.string().min(1).max(20).describe("Stock ticker symbol"),
  exchange: z.enum(['NSE', 'BSE', 'NASDAQ', 'NYSE']).optional().describe("Exchange"),
  provider: z.enum(['financial-datasets', 'groww', 'zerodha', 'yahoo', 'auto']).optional().describe("Preferred provider"),
});

export const HistoricalDataInputSchema = z.object({
  ticker: z.string().min(1).max(20).describe("Stock ticker symbol"),
  exchange: z.enum(['NSE', 'BSE', 'NASDAQ', 'NYSE']).optional().describe("Exchange"),
  startDate: z.string().describe("Start date (YYYY-MM-DD)"),
  endDate: z.string().describe("End date (YYYY-MM-DD)"),
  provider: z.enum(['financial-datasets', 'groww', 'zerodha', 'yahoo', 'auto']).optional().describe("Preferred provider"),
});

export const OrderInputSchema = z.object({
  ticker: z.string().min(1).max(20).describe("Stock ticker symbol"),
  exchange: z.enum(['NSE', 'BSE']).describe("Exchange (NSE or BSE)"),
  transactionType: z.enum(['BUY', 'SELL']).describe("Transaction type"),
  quantity: z.number().positive().describe("Quantity"),
  orderType: z.enum(['MARKET', 'LIMIT', 'SL', 'SLM']).describe("Order type"),
  productType: z.enum(['DELIVERY', 'INTRADAY', 'CO', 'BO']).describe("Product type"),
  price: z.number().positive().optional().describe("Limit price"),
  triggerPrice: z.number().positive().optional().describe("Trigger price"),
  validity: z.enum(['DAY', 'IOC', 'TTL']).optional().describe("Order validity"),
});
