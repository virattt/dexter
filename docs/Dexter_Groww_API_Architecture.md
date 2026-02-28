# Dexter + Groww API Integration - Full Architecture Guide

**Research Date:** February 28, 2026  
**Author:** ATHENA (Research & Analysis Agent)  
**Task ID:** jx79r5643jekm6gnptfa98yc6h8211gc

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Dexter Architecture Deep Dive](#2-dexter-architecture-deep-dive)
3. [Groww API Documentation](#3-groww-api-documentation)
4. [Generic Data Provider Adapter Pattern](#4-generic-data-provider-adapter-pattern)
5. [Step-by-Step Integration Guide](#5-step-by-step-integration-guide)
6. [File-by-File Changes Required](#6-file-by-file-changes-required)
7. [Pluggable Multi-Provider Architecture](#7-pluggable-multi-provider-architecture)
8. [Code Examples](#8-code-examples)
9. [Testing & Validation](#9-testing--validation)
10. [Migration Path from Financial Datasets API](#10-migration-path-from-financial-datasets-api)

---

## 1. Executive Summary

### Goal
Replace Dexter's current **Financial Datasets API** dependency with **Groww API** while designing a **pluggable adapter pattern** that supports multiple data providers (Groww, Yahoo Finance, Alpha Vantage, yfinance, etc.).

### Key Findings

| Aspect | Financial Datasets API | Groww API |
|--------|------------------------|-----------|
| **Market** | US Markets (NYSE, NASDAQ) | Indian Markets (NSE, BSE, MCX) |
| **Auth** | API Key (x-api-key header) | Access Token (Bearer) + Checksum/TOTP |
| **Rate Limits** | Not specified | Orders: 10/sec, LiveData: 10/sec, NonTrading: 20/sec |
| **Data Types** | Financials, Prices, Estimates | Orders, Positions, Market Data, Holdings |
| **SDK** | REST API only | Python SDK + REST API |

### Recommendation
Implement a **Provider Abstraction Layer** that:
1. Defines a common interface for all data providers
2. Maps provider-specific responses to Dexter's internal data models
3. Supports provider-specific features through capability flags
4. Enables hot-swapping of providers at runtime

---

## 2. Dexter Architecture Deep Dive

### 2.1 Project Structure

```
dexter/
├── src/
│   ├── agent/                    # Core agent logic
│   │   ├── agent.ts              # Main agent loop
│   │   ├── prompts.ts            # System prompts
│   │   ├── tool-executor.ts      # Tool execution engine
│   │   ├── scratchpad.ts         # Debug logging
│   │   └── types.ts              # Agent types
│   │
│   ├── tools/                    # Tool implementations
│   │   ├── finance/              # ← FINANCIAL DATA (key integration point)
│   │   │   ├── api.ts            # Financial Datasets API client
│   │   │   ├── financial-search.ts   # Meta-tool for routing
│   │   │   ├── financial-metrics.ts  # Fundamental analysis meta-tool
│   │   │   ├── fundamentals.ts    # Income/Balance/Cash flow statements
│   │   │   ├── stock-price.ts     # Current stock prices (Yahoo Finance)
│   │   │   ├── crypto.ts          # Cryptocurrency prices
│   │   │   ├── estimates.ts       # Analyst estimates
│   │   │   ├── filings.ts         # SEC filings
│   │   │   ├── key-ratios.ts      # Financial ratios
│   │   │   └── index.ts           # Exports
│   │   │
│   │   ├── search/               # Web search tools
│   │   ├── fetch/                # Web fetch tools
│   │   ├── browser/              # Browser automation
│   │   ├── filesystem/           # File operations
│   │   ├── registry.ts           # Tool registration
│   │   └── types.ts              # Tool types
│   │
│   ├── providers.ts              # LLM provider registry
│   ├── model/                    # LLM integration
│   ├── skills/                   # Specialized workflows
│   └── utils/                    # Utilities (cache, logger)
│
├── env.example                   # Environment template
└── package.json                  # Dependencies
```

### 2.2 Current Data Provider Architecture

Dexter uses **two data sources** currently:

#### 2.2.1 Financial Datasets API (Primary)
- **File:** `src/tools/finance/api.ts`
- **Base URL:** `https://api.financialdatasets.ai`
- **Auth:** `x-api-key` header
- **Used for:** Income statements, balance sheets, cash flow, estimates, filings

```typescript
// Current implementation (api.ts)
const BASE_URL = 'https://api.financialdatasets.ai';

export async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean }
): Promise<ApiResponse> {
  const FINANCIAL_DATASETS_API_KEY = process.env.FINANCIAL_DATASETS_API_KEY;
  
  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': FINANCIAL_DATASETS_API_KEY || '',
    },
  });
  // ... error handling, caching
}
```

#### 2.2.2 Yahoo Finance (Secondary - Stock Prices Only)
- **File:** `src/tools/finance/stock-price.ts`
- **Library:** `yahoo-finance2` npm package
- **Used for:** Current stock prices, market cap, shares outstanding

### 2.3 Tool Registration Pattern

Dexter uses a **registry pattern** for tools in `src/tools/registry.ts`:

```typescript
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    { name: 'financial_search', tool: createFinancialSearch(model), description: FINANCIAL_SEARCH_DESCRIPTION },
    { name: 'financial_metrics', tool: createFinancialMetrics(model), description: FINANCIAL_METRICS_DESCRIPTION },
    // ... more tools
  ];
  
  // Conditional tools based on env vars
  if (process.env.EXASEARCH_API_KEY) {
    tools.push({ name: 'web_search', tool: exaSearch, ... });
  }
  
  return tools;
}
```

### 2.4 Meta-Tool Routing Pattern

Dexter uses **intelligent routing** via `financial_search` and `financial_metrics`:

```typescript
// src/tools/finance/financial-search.ts
const FINANCE_TOOLS: StructuredToolInterface[] = [
  getStockPrice,
  getCryptoPriceSnapshot,
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getKeyRatios,
  getAnalystEstimates,
  getCompanyNews,
  getInsiderTrades,
  getSegmentedRevenues,
];

// LLM decides which sub-tools to call
const { response } = await callLlm(input.query, {
  model,
  systemPrompt: buildRouterPrompt(),
  tools: FINANCE_TOOLS,
});
```

---

## 3. Groww API Documentation

### 3.1 Overview

Groww is **India's #1 Stock Broker** with 1+ crore active customers. The API enables:
- Real-time market data (NSE, BSE, MCX)
- Order placement & management
- Portfolio tracking (positions, holdings)
- WebSocket streaming feeds

### 3.2 Authentication

Groww supports **three authentication methods**:

#### Method 1: Access Token (Expires Daily at 6:00 AM)
Generate from: https://groww.in/user/profile/trading-apis

#### Method 2: API Key + Secret (Requires Daily Approval)

```bash
# Generate checksum
CHECKSUM = SHA256(SECRET + TIMESTAMP_EPOCH_SECONDS)

# Request
curl -X POST https://api.groww.in/v1/api/trade/token \
  -H "Authorization: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_type": "approval",
    "checksum": "<SHA256_CHECKSUM>",
    "timestamp": "<EPOCH_SECONDS>"
  }'
```

**Checksum Generation (TypeScript):**
```typescript
import crypto from 'crypto';

function generateChecksum(secret: string): { checksum: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const checksum = crypto
    .createHash('sha256')
    .update(secret + timestamp)
    .digest('hex');
  return { checksum, timestamp };
}
```

#### Method 3: TOTP Flow (No Expiry)
Use pyotp library for TOTP code generation.

### 3.3 Request Headers (Required)

```
Authorization: Bearer <ACCESS_TOKEN>
Accept: application/json
X-API-VERSION: 1.0
```

### 3.4 API Endpoints

#### Market Data Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/api/stocks/quote` | GET | Market quote (OHLC, volume) |
| `/v1/api/stocks/ltp` | GET | Last traded price |
| `/v1/api/stocks/ohlc` | GET | OHLC data |
| `/v1/api/stocks/search` | GET | Search stocks by name/symbol |

#### Order Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/api/trade/order/place` | POST | Place new order |
| `/v1/api/trade/order/modify` | PUT | Modify existing order |
| `/v1/api/trade/order/cancel` | DELETE | Cancel order |
| `/v1/api/trade/order/status` | GET | Get order status |
| `/v1/api/trade/orders` | GET | List all orders |
| `/v1/api/trade/trades` | GET | List executed trades |

#### Portfolio Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/api/trade/positions` | GET | Open positions |
| `/v1/api/trade/holdings` | GET | Holdings |
| `/v1/api/trade/margin` | GET | Available margin |

### 3.5 Rate Limits

| Type | APIs Included | Per Second | Per Minute |
|------|---------------|------------|------------|
| **Orders** | Create, Modify, Cancel | 10 | 250 |
| **Live Data** | Market Quote, LTP, OHLC | 10 | 300 |
| **Non Trading** | Order Status, Positions, Holdings, Margin | 20 | 500 |

### 3.6 Response Format

```json
// Success
{
  "status": "SUCCESS",
  "payload": { }
}

// Error
{
  "status": "FAILURE",
  "error": { "code": "GA001", "message": "Bad request" }
}
```

### 3.7 Error Codes

| Code | Message |
|------|---------|
| GA000 | Internal error occurred |
| GA001 | Bad request |
| GA003 | Unable to serve request currently |
| GA004 | Requested entity does not exist |
| GA005 | User not authorised |
| GA006 | Cannot process this request |
| GA007 | Duplicate order reference id |

---

## 4. Generic Data Provider Adapter Pattern

### 4.1 Design Goals

1. **Abstraction:** Common interface for all financial data providers
2. **Type Safety:** Strongly typed request/response models
3. **Capability Discovery:** Query provider capabilities at runtime
4. **Error Normalization:** Consistent error handling across providers
5. **Rate Limiting:** Built-in rate limit management
6. **Fallback:** Automatic failover to secondary providers

### 4.2 Core Interfaces

```typescript
// src/tools/finance/providers/types.ts

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

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKeyEnvVar?: string;
  apiSecretEnvVar?: string;
  capabilities: ProviderCapabilities;
  rateLimits: Record<string, { perSecond: number; perMinute: number }>;
  requiresAuth: boolean;
}

export interface FinancialDataProvider {
  readonly config: ProviderConfig;
  isAvailable(): boolean;
  getCapabilities(): ProviderCapabilities;
  supportsCapability(capability: keyof ProviderCapabilities): boolean;
  getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse>;
}
```

---

## 5. Step-by-Step Integration Guide

### Step 1: Create Provider Directory Structure

```bash
mkdir -p src/tools/finance/providers
touch src/tools/finance/providers/types.ts
touch src/tools/finance/providers/base-provider.ts
touch src/tools/finance/providers/rate-limiter.ts
touch src/tools/finance/providers/groww-provider.ts
touch src/tools/finance/providers/financial-datasets-provider.ts
touch src/tools/finance/providers/yahoo-provider.ts
touch src/tools/finance/providers/provider-registry.ts
```

### Step 2: Implement Rate Limiter

```typescript
// src/tools/finance/providers/rate-limiter.ts

export interface RateLimitConfig {
  perSecond: number;
  perMinute: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitConfig>;
  private lastRequest: Map<string, number[]> = new Map();
  
  constructor(limits: Record<string, RateLimitConfig>) {
    this.limits = new Map(Object.entries(limits));
  }
  
  async waitForToken(endpointType: string): Promise<void> {
    const limit = this.limits.get(endpointType);
    if (!limit) return;
    
    const now = Date.now();
    const timestamps = this.lastRequest.get(endpointType) || [];
    
    // Clean old timestamps
    const recentSecond = timestamps.filter(t => now - t < 1000);
    const recentMinute = timestamps.filter(t => now - t < 60000);
    
    // Check per-second limit
    if (recentSecond.length >= limit.perSecond) {
      const waitTime = 1000 - (now - recentSecond[0]);
      await this.sleep(waitTime);
    }
    
    // Check per-minute limit
    if (recentMinute.length >= limit.perMinute) {
      const waitTime = 60000 - (now - recentMinute[0]);
      await this.sleep(waitTime);
    }
    
    this.lastRequest.set(endpointType, [...timestamps, now]);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Step 3: Implement Groww Provider

```typescript
// src/tools/finance/providers/groww-provider.ts

import {
  BaseFinancialDataProvider,
  ProviderConfig,
  ProviderRequestContext,
  StockPriceResponse,
  ProviderError,
} from './index.js';
import crypto from 'crypto';

export class GrowwProvider extends BaseFinancialDataProvider {
  readonly config: ProviderConfig = {
    id: 'groww',
    displayName: 'Groww (Indian Markets)',
    baseUrl: 'https://api.groww.in',
    apiKeyEnvVar: 'GROWW_API_KEY',
    apiSecretEnvVar: 'GROWW_API_SECRET',
    capabilities: {
      livePrices: true,
      historicalData: true,
      incomeStatements: false, // Groww doesn't provide fundamentals
      balanceSheets: false,
      cashFlowStatements: false,
      keyRatios: false,
      analystEstimates: false,
      filings: false,
      insiderTrades: false,
      companyNews: false,
      orderPlacement: true,    // Groww is a trading broker
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
  };
  
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  async initialize(): Promise<void> {
    await this.ensureAccessToken();
  }
  
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }
    
    const apiKey = process.env.GROWW_API_KEY;
    const apiSecret = process.env.GROWW_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new ProviderError('Groww API credentials not configured', 'groww', 'AUTH_MISSING');
    }
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const checksum = crypto.createHash('sha256').update(apiSecret + timestamp).digest('hex');
    
    const response = await fetch(`${this.config.baseUrl}/v1/api/trade/token`, {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key_type: 'approval', checksum, timestamp }),
    });
    
    if (!response.ok) {
      throw new ProviderError('Failed to obtain Groww access token', 'groww', 'AUTH_FAILED', response.status);
    }
    
    const data = await response.json();
    this.accessToken = data.payload.token;
    this.tokenExpiry = new Date(data.payload.expiry);
  }
  
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    await this.ensureAccessToken();
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'X-API-VERSION': '1.0',
    };
  }
  
  async getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse> {
    await this.checkRateLimit('liveData');
    
    const response = await this.makeRequest<{ status: string; payload: any }>(
      '/v1/api/stocks/quote',
      { params: { trading_symbol: context.ticker, exchange: context.exchange || 'NSE' } }
    );
    
    const quote = response.payload;
    return {
      ticker: context.ticker,
      provider: 'groww',
      price: quote.ltp ?? null,
      change: quote.change ?? null,
      changePercent: quote.changePercent ?? null,
      marketCap: null,
      sharesOutstanding: null,
      currency: 'INR',
      marketState: quote.marketStatus === 'OPEN' ? 'open' : 'closed',
      volume: quote.volume ?? null,
      timestamp: new Date().toISOString(),
      sourceUrl: `https://groww.in/stocks/${context.ticker.toLowerCase()}`,
    };
  }
  
  async getPositions(): Promise<unknown> {
    await this.checkRateLimit('nonTrading');
    return this.makeRequest('/v1/api/trade/positions');
  }
  
  async getHoldings(): Promise<unknown> {
    await this.checkRateLimit('nonTrading');
    return this.makeRequest('/v1/api/trade/holdings');
  }
  
  async placeOrder(order: {
    tradingSymbol: string;
    exchange: string;
    transactionType: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
    product: 'DELIVERY' | 'INTRADAY';
  }): Promise<unknown> {
    await this.checkRateLimit('orders');
    return this.makeRequest('/v1/api/trade/order/place', { method: 'POST', body: order });
  }
}
```

### Step 4: Create Provider Registry

```typescript
// src/tools/finance/providers/provider-registry.ts

import type { FinancialDataProvider } from './types.js';
import { GrowwProvider } from './groww-provider.js';
import { FinancialDatasetsProvider } from './financial-datasets-provider.js';
import { YahooFinanceProvider } from './yahoo-provider.js';

export type ProviderId = 'financial-datasets' | 'groww' | 'yahoo';

const PROVIDER_PRIORITY: ProviderId[] = ['financial-datasets', 'groww', 'yahoo'];

export class ProviderRegistry {
  private providers: Map<ProviderId, FinancialDataProvider> = new Map();
  private initialized = false;
  
  constructor() {
    this.registerProvider(new FinancialDatasetsProvider());
    this.registerProvider(new GrowwProvider());
    this.registerProvider(new YahooFinanceProvider());
  }
  
  private registerProvider(provider: FinancialDataProvider): void {
    this.providers.set(provider.config.id as ProviderId, provider);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    for (const provider of this.providers.values()) {
      if (provider.isAvailable() && provider.initialize) {
        try { await provider.initialize(); }
        catch (error) { console.warn(`Failed to initialize ${provider.config.id}:`, error); }
      }
    }
    this.initialized = true;
  }
  
  getProvider(id: ProviderId): FinancialDataProvider | undefined {
    return this.providers.get(id);
  }
  
  getAvailableProviders(): FinancialDataProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable());
  }
  
  getProviderForCapability(
    capability: keyof FinancialDataProvider['config']['capabilities'],
    preferredProvider?: ProviderId
  ): FinancialDataProvider | null {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider?.isAvailable() && provider.supportsCapability(capability)) return provider;
    }
    for (const id of PROVIDER_PRIORITY) {
      const provider = this.providers.get(id);
      if (provider?.isAvailable() && provider.supportsCapability(capability)) return provider;
    }
    return null;
  }
}

export const providerRegistry = new ProviderRegistry();
```

---

## 6. File-by-File Changes Required

### 6.1 New Files to Create

| File | Purpose |
|------|---------|
| `src/tools/finance/providers/types.ts` | Provider interfaces and types |
| `src/tools/finance/providers/base-provider.ts` | Abstract base class |
| `src/tools/finance/providers/rate-limiter.ts` | Rate limiting utility |
| `src/tools/finance/providers/groww-provider.ts` | Groww implementation |
| `src/tools/finance/providers/financial-datasets-provider.ts` | Current API wrapped |
| `src/tools/finance/providers/yahoo-provider.ts` | Yahoo Finance implementation |
| `src/tools/finance/providers/provider-registry.ts` | Provider management |

### 6.2 Files to Modify

| File | Change |
|------|--------|
| `src/tools/finance/api.ts` | Deprecate - wrap with provider registry |
| `src/tools/finance/fundamentals.ts` | Use provider registry instead of direct API calls |
| `src/tools/finance/stock-price.ts` | Use provider registry with fallback |
| `src/tools/finance/financial-search.ts` | Add provider-aware routing |
| `env.example` | Add GROWW_API_KEY, GROWW_API_SECRET |
| `src/tools/registry.ts` | Add provider initialization |

---

## 7. Pluggable Multi-Provider Architecture

### 7.1 Capability Matrix

| Capability | Financial Datasets | Groww | Yahoo Finance |
|------------|-------------------|-------|---------------|
| **Live Prices** | ❌ | ✅ | ✅ |
| **Historical OHLCV** | ✅ | ✅ | ✅ |
| **Income Statements** | ✅ | ❌ | ❌ |
| **Balance Sheets** | ✅ | ❌ | ❌ |
| **Cash Flow** | ✅ | ❌ | ❌ |
| **Order Placement** | ❌ | ✅ | ❌ |
| **Positions/Holdings** | ❌ | ✅ | ❌ |
| **Markets** | US | IN | Global |

### 7.2 Fallback Strategy

```typescript
export async function executeWithFallback<T>(
  capability: keyof ProviderCapabilities,
  operation: (provider: FinancialDataProvider) => Promise<T>,
  preferredProvider?: ProviderId
): Promise<T> {
  const providers = providerRegistry.getProvidersForCapability(capability);
  if (providers.length === 0) throw new Error(`No providers for: ${capability}`);
  
  const errors: Error[] = [];
  for (const provider of providers) {
    try { return await operation(provider); }
    catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      if (error instanceof ProviderError && !error.retryable) throw error;
    }
  }
  throw new AggregateError(errors, `All providers failed: ${capability}`);
}
```

---

## 8. Code Examples

### 8.1 Complete Groww Provider Implementation

See Section 5.3 for the full implementation.

### 8.2 Updated Tool Using Provider Registry

```typescript
// src/tools/finance/stock-price-v2.ts

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { providerRegistry } from './providers/index.js';
import { formatToolResult } from '../types.js';

const StockPriceInputSchema = z.object({
  ticker: z.string().describe("Stock ticker (e.g., 'RELIANCE' for India, 'AAPL' for US)"),
  exchange: z.string().optional().describe("Exchange (NSE/BSE for India)"),
});

export const getStockPriceV2 = new DynamicStructuredTool({
  name: 'get_stock_price',
  description: `Fetches current stock price. Routes to best provider:
- Indian stocks → Groww
- US stocks → Yahoo Finance`,
  schema: StockPriceInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const isIndianMarket = input.exchange?.toUpperCase() === 'NSE' || input.exchange?.toUpperCase() === 'BSE';
    const preferredProvider = isIndianMarket ? 'groww' : 'yahoo';
    const provider = providerRegistry.getProviderForCapability('livePrices', preferredProvider);
    
    if (!provider) {
      return formatToolResult({ error: 'No provider available', ticker }, []);
    }
    
    try {
      const price = await provider.getStockPrice({ ticker, exchange: input.exchange });
      return formatToolResult(price, [price.sourceUrl]);
    } catch (error) {
      return formatToolResult({ error: error instanceof Error ? error.message : String(error), ticker }, []);
    }
  },
});
```

---

## 9. Testing & Validation

```typescript
// tests/providers/groww-provider.test.ts

import { describe, it, expect, beforeAll } from 'bun:test';
import { GrowwProvider } from '../../src/tools/finance/providers/groww-provider.js';

describe('GrowwProvider', () => {
  let provider: GrowwProvider;
  
  beforeAll(() => {
    provider = new GrowwProvider();
    process.env.GROWW_API_KEY = 'test-key';
    process.env.GROWW_API_SECRET = 'test-secret';
  });
  
  it('should be available with credentials', () => {
    expect(provider.isAvailable()).toBe(true);
  });
  
  it('should support live prices', () => {
    expect(provider.supportsCapability('livePrices')).toBe(true);
  });
  
  it('should not support income statements', () => {
    expect(provider.supportsCapability('incomeStatements')).toBe(false);
  });
});
```

---

## 10. Migration Path

### Phase 1: Parallel Operation (Week 1-2)
1. Implement provider abstraction layer
2. Create Financial Datasets provider wrapper
3. Update tools to use provider registry
4. Run both old and new code in parallel

### Phase 2: Add Groww Provider (Week 3-4)
1. Implement Groww provider
2. Add Indian market support
3. Test with real credentials

### Phase 3: Deprecation (Week 5-6)
1. Remove old api.ts direct calls
2. Clean up unused code
3. Update environment templates

---

## Appendix A: Environment Variables

```bash
# Financial Data Providers
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key
GROWW_API_KEY=your-groww-api-key
GROWW_API_SECRET=your-groww-api-secret
```

---

## Appendix B: Quick Reference

### Groww Endpoints Summary
```
Market Data:  GET /v1/api/stocks/quote, /ltp, /ohlc, /search
Orders:       POST /v1/api/trade/order/place, PUT /modify, DELETE /cancel
Portfolio:    GET /v1/api/trade/positions, /holdings, /margin
```

### Rate Limits
```
Orders:       10/sec, 250/min
Live Data:    10/sec, 300/min  
Non Trading:  20/sec, 500/min
```

---

**Document Version:** 1.0  
**Research Method:** Web fetch from GitHub raw files and Groww API docs (managed browser unavailable)
