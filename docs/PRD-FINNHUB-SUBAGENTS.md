# PRD: Finnhub Free Tier for Subagents

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07

---

## 1. Executive Summary

Add **Finnhub** (free tier) as a **secondary data provider** for Dexter's finance subagents. Financial Datasets remains primary. Finnhub serves as:

- **Fallback** when Financial Datasets is unavailable, rate-limited, or returns errors
- **Cost relief** for high-volume, low-complexity queries (e.g. simple price lookups)
- **Supplement** for data FD doesn't cover (e.g. global exchanges, forex, sentiment)

The subagents are the tools that `financial_search` routes to: `get_stock_price`, `get_company_news`, `get_key_ratios`, etc. Each subagent can optionally call Finnhub when FD fails or when the query is a good fit for Finnhub's free tier.

---

## 2. Motivation

| Driver | Benefit |
|--------|---------|
| **Resilience** | FD outage or rate limit → Finnhub answers instead of failing |
| **Cost** | FD has usage limits; Finnhub free tier (60 calls/min) absorbs overflow for simple queries |
| **Broader coverage** | Finnhub: global exchanges, forex, crypto; FD: US equities focus |
| **Zero marginal cost** | Finnhub free tier is $0; no new API spend for fallback path |

---

## 3. Finnhub Free Tier — Constraints

| Constraint | Value |
|------------|-------|
| **Rate limit** | 60 API calls per minute |
| **Request weighting** | Some endpoints cost more (e.g. dividend = 10× weight → ~6 calls/min) |
| **Auth** | `token` query param (API key) |
| **Base URL** | `https://finnhub.io/api/v1` |

**Endpoints suitable for free tier (low weight):**

| Endpoint | Use | Weight (approx) |
|----------|-----|------------------|
| `GET /quote?symbol=...` | Stock quote (price, change) | 1 |
| `GET /stock/profile2?symbol=...` | Company profile (name, industry, market cap) | 1 |
| `GET /company-news?symbol=...&from=...&to=...` | Company news | 1 |
| `GET /stock/candle?symbol=...&resolution=...&from=...&to=...` | OHLCV candles | 1 |

**Endpoints to avoid on free tier (high weight or premium):**

- `GET /stock/dividend` — weight 10
- `GET /stock/recommendation` — weight 5
- Premium endpoints — 403 on free tier

---

## 4. Subagent Mapping Strategy

| Subagent (FD Tool) | Finnhub Fallback | Finnhub Endpoint |
|--------------------|------------------|------------------|
| `get_stock_price` | ✓ | `/quote` |
| `get_stock_prices` | ✓ | `/stock/candle` |
| `get_company_news` | ✓ | `/company-news` |
| `get_key_ratios` | Partial | `/stock/profile2` (market cap only; no P/E, margins) |
| `get_income_statements` | ✗ | FD only — Finnhub has different structure; FD superior |
| `get_balance_sheets` | ✗ | FD only |
| `get_cash_flow_statements` | ✗ | FD only |
| `get_filings` / `get_*_filing_items` | ✗ | FD only — Finnhub has metadata, not section-level text |
| `get_analyst_estimates` | ✗ | FD only — Finnhub has different schema |
| `get_insider_trades` | ✗ | FD only |
| `get_segmented_revenues` | ✗ | FD only |
| `get_crypto_price_snapshot` | ✓ | `/crypto/exchange` + `/crypto/candle` (if available) |
| `get_crypto_prices` | ✓ | `/crypto/candle` |

**Phase 1 (MVP):** Implement fallback only for `get_stock_price`, `get_stock_prices`, `get_company_news`. These are high-volume, simple, and map cleanly.

**Phase 2:** Add `get_key_ratios` partial fallback (market cap from profile2) and crypto if Finnhub crypto endpoints are free-tier compatible.

---

## 5. Provider Selection Logic

```
For each subagent call:
  1. Try Financial Datasets first (primary)
  2. If FD returns 4xx/5xx, 429, or network error:
     → Retry with Finnhub (if subagent has Finnhub fallback)
  3. If Finnhub also fails:
     → Return error to user
  4. If FD succeeds:
     → Return FD result (never mix FD + Finnhub in same response)
```

**Optional:** Config flag `FINNHUB_AS_PRIMARY_FOR_SIMPLE` — when true, route simple price/news queries to Finnhub first to conserve FD quota. Default: false (FD always primary).

---

## 6. Implementation Approach

### 6.1 New Module: `src/tools/finance/finnhub.ts`

- `callFinnhubApi(endpoint, params): Promise<ApiResponse>`
- Same `ApiResponse` shape as FD for consistency
- Finnhub-specific semaphore (e.g. 2 concurrent, 60/min cap)
- Rate limit handling (429 → backoff, respect Finnhub headers)

### 6.2 Adapter Pattern

Each fallback-enabled subagent gets a wrapper:

```ts
async function getStockPriceWithFallback(input) {
  try {
    return await getStockPriceFD(input);  // primary
  } catch (e) {
    if (isRetryable(e) && hasFinnhubKey()) {
      return await getStockPriceFinnhub(input);  // fallback
    }
    throw e;
  }
}
```

### 6.3 Response Normalization

Finnhub returns different field names. Normalize to match FD shape before returning to LLM:

| Finnhub | Normalized (FD-like) |
|---------|----------------------|
| `c` (current price) | `price` or `close` |
| `pc` (previous close) | `previous_close` |
| `d` (change) | `change` |
| `dp` (change percent) | `change_percent` |

### 6.4 Environment

```bash
# .env
FINNHUB_API_KEY=your_api_key   # optional; if absent, no Finnhub fallback
```

---

## 7. Success Criteria

- [ ] `FINNHUB_API_KEY` optional; when set, fallback is active
- [ ] `get_stock_price` falls back to Finnhub on FD failure
- [ ] `get_stock_prices` falls back to Finnhub on FD failure
- [ ] `get_company_news` falls back to Finnhub on FD failure
- [ ] Finnhub responses normalized to FD-like schema for LLM
- [ ] Finnhub rate limit respected (60/min, semaphore)
- [ ] No FD + Finnhub mixing in same tool response
- [ ] `env.example` documents `FINNHUB_API_KEY`

---

## 8. Non-Goals (for this PRD)

- Replacing Financial Datasets for primary data
- Finnhub for SEC filings, financial statements, or insider trades (FD only)
- Finnhub as primary for any subagent (FD remains primary)
- Paid Finnhub tier integration

---

## 9. References

- [Finnhub API Docs](https://finnhub.io/docs/api)
- [Finnhub Rate Limits](https://finnhub.io/docs/api/rate-limit)
- [Finnhub Free Tier](https://finnhub.io/) — register for API key
- [DATA-API-FINANCIAL-DATASETS.md](./DATA-API-FINANCIAL-DATASETS.md) — primary FD docs
