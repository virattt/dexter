# Setup Guide: Dexter Provider Abstraction Layer

**Project:** dexter-indian-api-integration  
**Phase:** Setup  
**Created:** February 28, 2026  
**Author:** ARES (Software Architect)

---

## Prerequisites

- **Bun** 1.x installed
- **Node.js** 18+ (for compatibility)
- **Git** for version control
- API credentials for desired providers (see below)

---

## Quick Start

### Option 1: Local Development

#### 1. Clone and Install

```bash
# Navigate to Dexter project
cd ~/Projects/dexter

# Install dependencies
bun install
```

#### 2. Configure Environment Variables

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# Required for Financial Datasets (existing)
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

# Required for Groww (Indian market)
GROWW_API_KEY=your-groww-api-key
GROWW_API_SECRET=your-groww-api-secret

# Optional: Zerodha (Indian market)
ZERODHA_API_KEY=your-zerodha-api-key
ZERODHA_API_SECRET=your-zerodha-api-secret

# Optional: Enable provider routing (default: true)
ENABLE_PROVIDER_ROUTING=true
DEFAULT_PROVIDER_INDIAN=groww
DEFAULT_PROVIDER_US=yahoo
```

#### 3. Get API Credentials

**Groww API:**
1. Visit https://groww.in/user/profile/trading-apis
2. Generate API Key and Secret
3. Note: Requires daily approval for production access

**Zerodha Kite Connect:**
1. Visit https://kite.trade
2. Create API app
3. Note: Requires login flow for access token

**Financial Datasets:**
1. Visit https://financialdatasets.ai
2. Sign up for API key

#### 4. Run Development Server

```bash
# Start Dexter with provider layer
bun run dev
```

#### 5. Test Provider Integration

```bash
# Test stock price with automatic routing
bun run tools:test:stock-price --ticker RELIANCE --exchange NSE

# Test with specific provider
bun run tools:test:stock-price --ticker AAPL --provider groww

# Test provider registry
bun run tools:test:providers
```

### Option 2: Docker Compose

#### 1. Create docker-compose.yml (if not exists)

The Provider Abstraction Layer runs within the existing Dexter container. No additional services required.

#### 2. Configure Environment

```bash
# Create .env file with credentials (see Option 1)
cp .env.example .env
```

#### 3. Run with Docker

```bash
# Build and start container
docker-compose up -d

# View logs
docker-compose logs -f dexter

# Test inside container
docker-compose exec dexter bun run tools:test:stock-price --ticker RELIANCE
```

---

## Project Structure

After implementation, the provider layer will have this structure:

```
dexter/
├── src/
│   └── tools/
│       └── finance/
│           ├── providers/          # NEW: Provider abstraction layer
│           │   ├── types.ts       # Interfaces and types
│           │   ├── base-provider.ts       # Abstract base class
│           │   ├── rate-limiter.ts        # Rate limiting
│           │   ├── provider-registry.ts   # Provider management
│           │   ├── groww-provider.ts      # Groww implementation
│           │   ├── zerodha-provider.ts    # Zerodha implementation
│           │   ├── yahoo-provider.ts      # Yahoo Finance
│           │   ├── financial-datasets-provider.ts  # Existing API wrapper
│           │   └── index.ts       # Public exports
│           │
│           ├── api.ts             # MODIFIED: Wrap with provider
│           ├── stock-price.ts    # MODIFIED: Use registry
│           ├── fundamentals.ts   # MODIFIED: Use registry
│           └── financial-search.ts  # MODIFIED: Provider routing
│
├── .env                         # Your credentials
├── .env.example                 # Template (commit to repo)
└── docker-compose.yml           # Existing (no changes needed)
```

---

## Testing

### Unit Tests

```bash
# Run all provider tests
bun test src/tools/finance/providers/

# Run specific provider tests
bun test src/tools/finance/providers/groww-provider.test.ts

# Run with coverage
bun test --coverage src/tools/finance/providers/
```

### Integration Tests

```bash
# Test with real API calls (requires credentials)
bun test:integration src/tools/finance/providers/

# Test specific provider
GROWW_API_KEY=test_key bun test:integration src/tools/finance/providers/groww-provider.test.ts
```

### Manual Testing

```bash
# Test provider availability
bun run scripts/test-providers.ts

# Test stock price routing
bun run scripts/test-routing.ts --ticker TCS --exchange NSE

# Test rate limiting
bun run scripts/test-rate-limiter.ts
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `FINANCIAL_DATASETS_API_KEY` | Yes* | API key for Financial Datasets | - |
| `GROWW_API_KEY` | Yes* | API key for Groww | - |
| `GROWW_API_SECRET` | Yes* | API secret for Groww | - |
| `ZERODHA_API_KEY` | No | API key for Zerodha | - |
| `ZERODHA_API_SECRET` | No | API secret for Zerodha | - |
| `ZERODHA_ACCESS_TOKEN` | No | Access token (from login) | - |
| `ENABLE_PROVIDER_ROUTING` | No | Enable provider routing | `true` |
| `DEFAULT_PROVIDER_INDIAN` | No | Default for Indian stocks | `groww` |
| `DEFAULT_PROVIDER_US` | No | Default for US stocks | `yahoo` |
| `LOG_PROVIDER_DEBUG` | No | Enable debug logging | `false` |

*At least one provider's credentials must be configured

### Provider Capability Matrix

| Capability | Groww | Zerodha | Yahoo | Financial Datasets |
|-----------|-------|---------|-------|-------------------|
| Live Prices | ✅ | ✅ | ✅ | ❌ |
| Historical Data | ✅ | ✅ | ✅ | ✅ |
| Income Statements | ❌ | ❌ | ❌ | ✅ |
| Balance Sheets | ❌ | ❌ | ❌ | ✅ |
| Cash Flow | ❌ | ❌ | ❌ | ✅ |
| Order Placement | ✅ | ✅ | ❌ | ❌ |
| Positions | ✅ | ✅ | ❌ | ❌ |
| Holdings | ✅ | ✅ | ❌ | ❌ |
| Markets | IN | IN | Global | US |

---

## Troubleshooting

### Common Issues

**1. "No provider available"**
- Check that at least one provider's credentials are configured in `.env`
- Verify environment variables are loaded correctly

**2. Rate limit errors**
- This is expected under heavy load
- The rate limiter will automatically throttle and retry
- Check logs for rate limit wait times

**3. Token expired errors (Groww)**
- Groww tokens expire daily at 6:00 AM
- The provider automatically refreshes tokens
- If persistent, check API key approval status

**4. Provider fallback not working**
- Check logs for provider selection
- Verify fallback providers are configured
- Ensure capability requirements are met

### Debug Mode

Enable detailed logging:

```bash
# Set debug flag
LOG_PROVIDER_DEBUG=true

# Or when running
LOG_PROVIDER_DEBUG=true bun run dev
```

Debug logs will show:
- Provider selection decisions
- Rate limit checks
- Request/response details (sanitized)
- Fallback attempts

---

## Migration from Existing Implementation

If you're upgrading from the existing Financial Datasets integration:

1. **Backup your environment:**
   ```bash
   cp .env .env.backup
   ```

2. **Add new provider credentials:**
   ```bash
   # Edit .env and add GROWW_* variables
   nano .env
   ```

3. **Test in parallel:**
   - The new implementation runs alongside the old one
   - Feature flag `ENABLE_PROVIDER_ROUTING=true` enables new routing

4. **Validate results:**
   ```bash
   # Compare old and new results
   bun run scripts/compare-results.ts --ticker AAPL
   ```

5. **Switch over:**
   ```bash
   # When confident, remove old implementation
   # (This will be automated in future release)
   ```

---

## Security Notes

- **Never commit `.env`** to version control
- **Use `.env.example`** as a template with placeholder values
- **Rotate API keys** periodically
- **Monitor usage** to detect anomalies
- **No credentials in logs** - all sensitive data is redacted

---

## Next Steps

After setup, see:
- **Architecture.md** - Full system design
- **Technical-Design.md** - Implementation details
- **Migration Plan** - Phased rollout strategy

---

*Document Version: 1.0*
