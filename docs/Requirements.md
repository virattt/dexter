# Dexter Indian API Integration - Requirements Document

**Project:** Dexter Trading Agent  
**Phase:** Research → Implementation  
**Tech Stack:** Node.js, Bun, TypeScript  
**Deliverable Type:** Web Application  
**Database:** Auto (recommend SQLite for local, PostgreSQL for production)  
**Research Date:** February 28, 2026  
**Task ID:** jx73x3svw6sfmehh31s4m0hrrx820ak0

---

## 1. Executive Summary

### 1.1 Project Goal

Transform Dexter from a US-market-focused financial agent into a **provider-agnostic trading platform** supporting Indian stock markets (NSE, BSE, MCX) while maintaining existing US market capabilities.

### 1.2 Key Objectives

1. **Integrate Groww API** as the primary Indian market data and trading provider
2. **Design pluggable adapter pattern** supporting multiple providers (Groww, Zerodha Kite, Yahoo Finance, Financial Datasets)
3. **Make Dexter provider-agnostic** - enable hot-swapping of data sources at runtime
4. **Maintain backward compatibility** with existing US market features

### 1.3 Target Providers

| Provider | Market | Primary Use Case | Status |
|----------|--------|------------------|--------|
| **Groww** | IN (NSE, BSE, MCX) | Primary Indian provider, trading + data | NEW |
| **Zerodha Kite** | IN (NSE, BSE, MCX) | Alternative Indian broker API | NEW |
| **Yahoo Finance** | Global | Free price data, market cap | EXISTING |
| **Financial Datasets** | US | US fundamentals, estimates | EXISTING |

---

## 2. User Stories

### Epic 1: Provider Abstraction Layer

#### US-1.1: Common Provider Interface
**As a** developer  
**I want** a unified interface for all financial data providers  
**So that** I can switch providers without changing application code

**Acceptance Criteria:**
- [ ] Define `FinancialDataProvider` interface with capability flags
- [ ] All providers implement identical method signatures
- [ ] Provider-specific errors are normalized to `ProviderError` class
- [ ] Interface supports capability discovery (`supportsCapability()`)

#### US-1.2: Provider Registry
**As a** developer  
**I want** a central registry to manage all providers  
**So that** I can query available providers and select by capability

**Acceptance Criteria:**
- [ ] `ProviderRegistry` class manages provider lifecycle
- [ ] Registry returns providers by capability (e.g., "get me a provider for live prices")
- [ ] Registry supports fallback chain when primary provider fails
- [ ] Registry auto-initializes providers on first access

#### US-1.3: Rate Limiting
**As a** developer  
**I want** automatic rate limiting for all provider calls  
**So that** I don't exceed API quotas and get blocked

**Acceptance Criteria:**
- [ ] `RateLimiter` class enforces per-second and per-minute limits
- [ ] Each provider defines its rate limits in configuration
- [ ] Rate limiter queues requests when limits are reached
- [ ] Rate limiter exposes wait time metrics for monitoring

---

### Epic 2: Groww Provider Implementation

#### US-2.1: Groww Authentication
**As a** user  
**I want** Dexter to authenticate with Groww using API credentials  
**So that** I can access my Groww account data

**Acceptance Criteria:**
- [ ] Support API Key + Secret authentication with checksum generation
- [ ] Auto-refresh access tokens before expiry (tokens expire daily at 6:00 AM IST)
- [ ] Store credentials securely in environment variables
- [ ] Graceful error handling for invalid/expired credentials

#### US-2.2: Groww Market Data
**As a** trader  
**I want** to fetch real-time stock prices from NSE/BSE  
**So that** I can make informed trading decisions

**Acceptance Criteria:**
- [ ] `getStockPrice(ticker, exchange)` returns normalized price data
- [ ] Support LTP (Last Traded Price), OHLC, and quote data
- [ ] Response includes: price, change, changePercent, volume, timestamp
- [ ] Rate limit: 10 requests/second, 300/minute for live data

#### US-2.3: Groww Order Management
**As a** trader  
**I want** to place, modify, and cancel orders through Dexter  
**So that** I can execute trades programmatically

**Acceptance Criteria:**
- [ ] `placeOrder(params)` supports BUY/SELL, MARKET/LIMIT, DELIVERY/INTRADAY
- [ ] `modifyOrder(orderId, params)` updates quantity, price, order type
- [ ] `cancelOrder(orderId)` cancels pending orders
- [ ] `getOrderStatus(orderId)` returns current order state
- [ ] Rate limit: 10 requests/second, 250/minute for orders

#### US-2.4: Groww Portfolio Data
**As a** trader  
**I want** to view my positions and holdings  
**So that** I can track my portfolio performance

**Acceptance Criteria:**
- [ ] `getPositions()` returns open intraday/delivery positions
- [ ] `getHoldings()` returns long-term holdings with P&L
- [ ] `getMargin()` returns available trading margin
- [ ] Rate limit: 20 requests/second, 500/minute for non-trading APIs

---

### Epic 3: Zerodha Kite Provider Implementation

#### US-3.1: Kite Connect Authentication
**As a** user  
**I want** Dexter to authenticate with Zerodha Kite  
**So that** I can use Zerodha as an alternative to Groww

**Acceptance Criteria:**
- [ ] Support OAuth flow with request token exchange
- [ ] Use official `kiteconnect` npm package (TypeScript SDK)
- [ ] Store access token securely
- [ ] Handle 2FA TOTP requirement for trading accounts

#### US-3.2: Kite Market Data
**As a** trader  
**I want** to fetch market data from Zerodha  
**So that** I have an alternative data source

**Acceptance Criteria:**
- [ ] Quote API returns OHLC, LTP, volume
- [ ] Historical data API for backtesting
- [ ] WebSocket streaming via `KiteTicker` for real-time updates
- [ ] Support instrument token lookup by trading symbol

#### US-3.3: Kite Order Management
**As a** trader  
**I want** to manage orders via Zerodha  
**So that** I can choose my preferred broker

**Acceptance Criteria:**
- [ ] Full order lifecycle: place, modify, cancel, status
- [ ] Support variety order types: regular, AMO, cover, bracket
- [ ] Order updates via WebSocket callbacks
- [ ] GTT (Good Till Triggered) order support

---

### Epic 4: Provider-Agnostic Tool Interface

#### US-4.1: Unified Stock Price Tool
**As a** Dexter agent  
**I want** a single `get_stock_price` tool that works for any market  
**So that** I don't need to know which provider to use

**Acceptance Criteria:**
- [ ] Tool auto-routes to correct provider based on ticker/exchange
- [ ] Indian tickers (RELIANCE, TCS) → Groww/Kite
- [ ] US tickers (AAPL, GOOGL) → Yahoo Finance/Financial Datasets
- [ ] Fallback to secondary provider if primary fails

#### US-4.2: Unified Order Tool
**As a** Dexter agent  
**I want** a single `place_order` tool for all brokers  
**So that** I can execute trades regardless of provider

**Acceptance Criteria:**
- [ ] Tool accepts provider-agnostic order parameters
- [ ] Maps to provider-specific order formats internally
- [ ] Returns normalized order response with provider ID
- [ ] Validates order parameters against provider capabilities

#### US-4.3: Capability-Based Tool Discovery
**As a** Dexter agent  
**I want** to discover which capabilities are available  
**So that** I can adapt my behavior to the configured providers

**Acceptance Criteria:**
- [ ] `get_available_capabilities()` returns list of supported features
- [ ] Tools gracefully degrade when capability unavailable
- [ ] Agent prompts include capability context for better routing

---

### Epic 5: Fallback & Error Handling

#### US-5.1: Automatic Provider Fallback
**As a** user  
**I want** Dexter to automatically try alternative providers on failure  
**So that** I get data even when one provider is down

**Acceptance Criteria:**
- [ ] `executeWithFallback()` tries providers in priority order
- [ ] Non-retryable errors (auth, validation) fail fast
- [ ] Retryable errors (rate limit, timeout) trigger fallback
- [ ] Final error aggregates all provider failures

#### US-5.2: Normalized Error Responses
**As a** developer  
**I want** consistent error formats across all providers  
**So that** error handling is predictable

**Acceptance Criteria:**
- [ ] `ProviderError` class with: code, message, provider, retryable flag
- [ ] Map provider-specific error codes to normalized codes
- [ ] Include original error for debugging
- [ ] Log all errors with correlation IDs

---

### Epic 6: Configuration & Environment

#### US-6.1: Environment Variable Management
**As a** developer  
**I want** clear environment variable naming for all providers  
**So that** configuration is straightforward

**Acceptance Criteria:**
- [ ] `GROWW_API_KEY`, `GROWW_API_SECRET` for Groww
- [ ] `KITE_API_KEY`, `KITE_API_SECRET` for Zerodha
- [ ] `FINANCIAL_DATASETS_API_KEY` (existing)
- [ ] `PROVIDER_PRIORITY` comma-separated list for fallback order

#### US-6.2: Provider Enable/Disable Flags
**As a** developer  
**I want** to enable/disable providers individually  
**So that** I can control which providers are active

**Acceptance Criteria:**
- [ ] `ENABLE_GROWW=true/false`
- [ ] `ENABLE_KITE=true/false`
- [ ] `ENABLE_YAHOO=true/false` (default: true)
- [ ] Disabled providers not included in registry

---

### Epic 7: Testing & Documentation

#### US-7.1: Unit Tests for Providers
**As a** developer  
**I want** comprehensive unit tests for each provider  
**So that** I can verify provider implementations

**Acceptance Criteria:**
- [ ] Test suite for `GrowwProvider`
- [ ] Test suite for `KiteProvider`
- [ ] Test suite for `ProviderRegistry`
- [ ] Mock HTTP responses for API calls
- [ ] >80% code coverage

#### US-7.2: Integration Tests
**As a** developer  
**I want** integration tests with real API sandbox environments  
**So that** I can verify end-to-end functionality

**Acceptance Criteria:**
- [ ] Integration tests use sandbox/test mode APIs
- [ ] Test authentication flows
- [ ] Test order lifecycle (place → modify → cancel)
- [ ] Test fallback behavior

#### US-7.3: API Documentation
**As a** developer  
**I want** clear documentation for the provider system  
**So that** future developers can extend it

**Acceptance Criteria:**
- [ ] README with setup instructions
- [ ] JSDoc comments on all public interfaces
- [ ] Example code for adding new providers
- [ ] Capability matrix documentation

---

## 3. Functional Requirements

### FR-1: Provider Interface Definition
\`\`\`
interface FinancialDataProvider {
  readonly config: ProviderConfig;
  isAvailable(): boolean;
  getCapabilities(): ProviderCapabilities;
  supportsCapability(capability: keyof ProviderCapabilities): boolean;
  initialize?(): Promise<void>;
  getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse>;
  getPositions?(): Promise<Position[]>;
  getHoldings?(): Promise<Holding[]>;
  placeOrder?(order: OrderRequest): Promise<OrderResponse>;
  modifyOrder?(orderId: string, order: OrderRequest): Promise<OrderResponse>;
  cancelOrder?(orderId: string): Promise<void>;
}
\`\`\`

### FR-2: Capability Flags
\`\`\`typescript
interface ProviderCapabilities {
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
\`\`\`

### FR-3: Rate Limiting
- Orders: 10/sec, 250/min (Groww) / 10/sec (Kite)
- Live Data: 10/sec, 300/min (Groww) / varies (Kite)
- Non-Trading: 20/sec, 500/min (Groww)

### FR-4: Error Normalization
\`\`\`typescript
class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: string,
    public httpStatus?: number,
    public retryable: boolean = true
  ) { super(message); }
}
\`\`\`

### FR-5: Provider Priority
Default priority order:
1. `financial-datasets` (US fundamentals)
2. `groww` (Indian markets)
3. `kite` (Indian markets alternative)
4. `yahoo` (Global prices)

---

## 4. Non-Functional Requirements

### NFR-1: Performance
- Provider selection overhead: < 5ms
- Rate limit wait: configurable timeout (default 30s)
- Cache TTL for market data: 5 seconds (live), 1 hour (historical)

### NFR-2: Reliability
- Automatic retry with exponential backoff (max 3 attempts)
- Circuit breaker pattern: disable failing provider for 5 minutes
- Graceful degradation: return partial data when some providers fail

### NFR-3: Security
- API credentials stored in environment variables only
- No credentials logged or exposed in error messages
- Token refresh happens securely without user intervention

### NFR-4: Maintainability
- Each provider in separate file/module
- Shared base class for common functionality
- Clear separation between interface and implementation

---

## 5. Scope

### In Scope

| Item | Priority | Effort |
|------|----------|--------|
| Provider interface types | P0 | 2h |
| Base provider class | P0 | 2h |
| Rate limiter utility | P0 | 2h |
| Groww provider implementation | P0 | 8h |
| Kite provider implementation | P1 | 6h |
| Provider registry | P0 | 3h |
| Fallback mechanism | P0 | 2h |
| Updated stock-price tool | P0 | 2h |
| Unit tests | P0 | 4h |
| Environment configuration | P0 | 1h |
| Documentation | P1 | 2h |

**Total Estimated Effort:** ~34 hours

### Out of Scope (Phase 1)

- WebSocket streaming (Phase 2)
- Upstox provider (Phase 2)
- Angel One provider (Phase 2)
- Frontend UI changes
- Multi-user authentication
- Historical backtesting framework
- Options chain data
- Mutual fund operations

### Future Considerations

- Real-time WebSocket streaming for live tick data
- Additional Indian brokers (Upstox, Angel One, 5paisa)
- Options and derivatives trading
- Algorithmic trading strategies
- Portfolio analytics and reporting

---

## 6. Technical Decisions

### TD-1: Adapter Pattern
Use the **Strategy/Adapter pattern** where each provider implements a common interface. This enables:
- Hot-swapping providers at runtime
- Easy addition of new providers
- Isolated testing of each provider

### TD-2: Official SDKs Where Available
- **Kite:** Use \`kiteconnect\` npm package (official TypeScript SDK)
- **Groww:** No official SDK - implement REST client from scratch
- **Yahoo:** Continue using \`yahoo-finance2\` package

### TD-3: Capability-Based Routing
Instead of hardcoding provider selection, use capability flags:
\`\`\`typescript
const provider = registry.getProviderForCapability('livePrices', { market: 'IN' });
\`\`\`

### TD-4: Environment-Based Configuration
All provider credentials via environment variables. No hardcoded keys.

---

## 7. Dependencies

### NPM Packages
- \`kiteconnect\` - Official Zerodha Kite TypeScript SDK
- \`yahoo-finance2\` - Yahoo Finance data (existing)
- No additional packages for Groww (REST via native fetch)

### Environment Variables
\`\`\`bash
# Groww
GROWW_API_KEY=your-groww-api-key
GROWW_API_SECRET=your-groww-api-secret

# Zerodha Kite
KITE_API_KEY=your-kite-api-key
KITE_API_SECRET=your-kite-api-secret

# Financial Datasets (existing)
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-key

# Provider Configuration
PROVIDER_PRIORITY=financial-datasets,groww,kite,yahoo
ENABLE_GROWW=true
ENABLE_KITE=true
\`\`\`

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Groww API changes without notice | High | Abstract API calls, monitor for breaking changes |
| Rate limit exhaustion during high traffic | Medium | Implement queueing, use multiple providers |
| Token expiry during long sessions | Medium | Auto-refresh tokens with buffer time |
| Different data formats across providers | Medium | Normalization layer in base provider |
| Missing data for certain tickers | Low | Fallback to alternative providers |

---

## 9. Success Criteria

1. ✅ Dexter can fetch stock prices for Indian tickers (RELIANCE, TCS, INFY)
2. ✅ Dexter can place/cancel orders on Groww
3. ✅ Provider can be swapped by changing environment variable
4. ✅ Fallback works when primary provider fails
5. ✅ All existing US market features continue to work
6. ✅ Test coverage >80% for new provider code

---

## 10. References

- [Dexter Groww API Architecture](./Dexter_Groww_API_Architecture.md) - Detailed technical analysis
- [Kite Connect API Docs](https://kite.trade/docs/connect/v3/)
- [Kite Connect TypeScript SDK](https://github.com/zerodha/kiteconnectjs)
- [Upstox API Docs](https://upstox.com/developer/api-documentation/)
- [Groww Trading APIs](https://groww.in/user/profile/trading-apis)

---

**Document Version:** 1.0  
**Author:** ATHENA (Research & Analysis Agent)  
**Status:** Complete - Ready for Implementation Planning
