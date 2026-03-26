#!/usr/bin/env bun
/**
 * Integration test for all finance API providers.
 *
 * Tests every endpoint against the live APIs and logs results with latency.
 * Requires API keys in .env — skips providers whose keys are missing.
 *
 * Usage:
 *   bun run src/tools/finance/test-integration.ts
 *   bun run src/tools/finance/test-integration.ts --verbose
 */
import 'dotenv/config';

// ── Helpers ────────────────────────────────────────────────────────────────

const VERBOSE = process.argv.includes('--verbose');
const TICKER = 'AAPL';

interface TestResult {
  provider: string;
  endpoint: string;
  status: 'pass' | 'fail' | 'skip';
  latencyMs: number;
  detail: string;
  data?: unknown;
}

const results: TestResult[] = [];

function keyPresent(envVar: string): boolean {
  const val = process.env[envVar]?.trim();
  return !!val && !val.startsWith('your-');
}

async function runTest(
  provider: string,
  endpoint: string,
  fn: () => Promise<{ data: unknown; url: string }>,
): Promise<void> {
  const start = Date.now();
  try {
    const { data, url } = await fn();
    const ms = Date.now() - start;

    // Determine if data looks valid
    const isEmpty =
      data === null ||
      data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && data !== null && Object.keys(data as object).length === 0);

    const recordCount = Array.isArray(data) ? data.length : typeof data === 'object' && data ? Object.keys(data as object).length : 0;

    results.push({
      provider,
      endpoint,
      status: isEmpty ? 'fail' : 'pass',
      latencyMs: ms,
      detail: isEmpty ? `Empty response` : `${recordCount} ${Array.isArray(data) ? 'records' : 'fields'}`,
      data: VERBOSE ? data : undefined,
    });

    if (VERBOSE) {
      console.log(`\n  [VERBOSE] ${provider} ${endpoint}`);
      console.log(`  URL: ${url}`);
      console.log(`  Response (first 500 chars): ${JSON.stringify(data).slice(0, 500)}`);
    }
  } catch (error) {
    const ms = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    results.push({
      provider,
      endpoint,
      status: 'fail',
      latencyMs: ms,
      detail: msg,
    });
  }
}

// ── Polygon Tests ──────────────────────────────────────────────────────────

async function testPolygon(): Promise<void> {
  if (!keyPresent('POLYGON_API_KEY')) {
    results.push({ provider: 'Polygon', endpoint: '*', status: 'skip', latencyMs: 0, detail: 'POLYGON_API_KEY not set' });
    return;
  }

  const { api } = await import('./api.js');

  console.log('\n  Testing Polygon.io...');

  // Stock price snapshot
  await runTest('Polygon', 'Stock Snapshot', async () => {
    const { data, url } = await api.get(`/v2/snapshot/locale/us/markets/stocks/tickers/${TICKER}`);
    return { data: data.ticker, url };
  });

  // Historical stock prices
  await runTest('Polygon', 'Stock Prices (historical)', async () => {
    const { data, url } = await api.get(`/v2/aggs/ticker/${TICKER}/range/1/day/2025-01-01/2025-01-10`, {
      adjusted: 'true',
      sort: 'asc',
    });
    return { data: data.results, url };
  });

  // Stock tickers search
  await runTest('Polygon', 'Stock Tickers Search', async () => {
    const { data, url } = await api.get('/v3/reference/tickers', {
      market: 'stocks',
      active: 'true',
      limit: 5,
      search: 'Apple',
    });
    return { data: data.results, url };
  });

  // Crypto snapshot
  await runTest('Polygon', 'Crypto Snapshot', async () => {
    const { data, url } = await api.get('/v2/snapshot/locale/global/markets/crypto/tickers/X:BTCUSD');
    return { data: data.ticker, url };
  });

  // Crypto historical
  await runTest('Polygon', 'Crypto Prices (historical)', async () => {
    const { data, url } = await api.get('/v2/aggs/ticker/X:BTCUSD/range/1/day/2025-01-01/2025-01-10', {
      adjusted: 'true',
      sort: 'asc',
    });
    return { data: data.results, url };
  });

  // Financials (income/balance/cash flow)
  await runTest('Polygon', 'Financials (all statements)', async () => {
    const { data, url } = await api.get('/vX/reference/financials', {
      ticker: TICKER,
      timeframe: 'annual',
      limit: 2,
    });
    return { data: data.results, url };
  });

  // News
  await runTest('Polygon', 'Company News', async () => {
    const { data, url } = await api.get('/v2/reference/news', {
      ticker: TICKER,
      limit: 3,
      order: 'desc',
      sort: 'published_utc',
    });
    return { data: data.results, url };
  });

  // Filings
  await runTest('Polygon', 'SEC Filings', async () => {
    const { data, url } = await api.get('/vX/reference/filings', {
      ticker: TICKER,
      limit: 3,
      type: '10-K',
    });
    return { data: data.results, url };
  });
}

// ── FMP Tests ──────────────────────────────────────────────────────────────

async function testFmp(): Promise<void> {
  if (!keyPresent('FMP_API_KEY')) {
    results.push({ provider: 'FMP', endpoint: '*', status: 'skip', latencyMs: 0, detail: 'FMP_API_KEY not set' });
    return;
  }

  const { fmp } = await import('./api.js');

  console.log('\n  Testing FMP...');

  // Key metrics TTM (snapshot)
  await runTest('FMP', 'Key Metrics TTM', async () => {
    const { data, url } = await fmp.get(`/key-metrics-ttm/${TICKER}`);
    const metrics = Array.isArray(data) ? data[0] : data;
    return { data: metrics, url };
  });

  // Key metrics (historical)
  await runTest('FMP', 'Key Metrics (historical)', async () => {
    const { data, url } = await fmp.get(`/key-metrics/${TICKER}`, {
      period: 'annual',
      limit: 3,
    });
    return { data, url };
  });

  // Earnings surprises
  await runTest('FMP', 'Earnings Surprises', async () => {
    const { data, url } = await fmp.get(`/earnings-surprises/${TICKER}`);
    return { data, url };
  });

  // Analyst estimates
  await runTest('FMP', 'Analyst Estimates', async () => {
    const { data, url } = await fmp.get(`/analyst-estimates/${TICKER}`, {
      period: 'annual',
      limit: 3,
    });
    return { data, url };
  });

  // Revenue segmentation (product)
  await runTest('FMP', 'Revenue Segmentation (product)', async () => {
    const { data, url } = await fmp.get(`/revenue-product-segmentation/${TICKER}`, {
      structure: 'flat',
    });
    return { data, url };
  });

  // Revenue segmentation (geographic)
  await runTest('FMP', 'Revenue Segmentation (geographic)', async () => {
    const { data, url } = await fmp.get(`/revenue-geographic-segmentation/${TICKER}`, {
      structure: 'flat',
    });
    return { data, url };
  });

  // Stock screener
  await runTest('FMP', 'Stock Screener', async () => {
    const { data, url } = await fmp.get('/stock-screener', {
      marketCapMoreThan: 100000000000,
      sector: 'Technology',
      limit: 5,
    });
    return { data, url };
  });
}

// ── Finnhub Tests ──────────────────────────────────────────────────────────

async function testFinnhub(): Promise<void> {
  if (!keyPresent('FINNHUB_API_KEY')) {
    results.push({ provider: 'Finnhub', endpoint: '*', status: 'skip', latencyMs: 0, detail: 'FINNHUB_API_KEY not set' });
    return;
  }

  const { finnhub } = await import('./api.js');

  console.log('\n  Testing Finnhub...');

  // Insider transactions
  await runTest('Finnhub', 'Insider Transactions', async () => {
    const { data, url } = await finnhub.get('/stock/insider-transactions', {
      symbol: TICKER,
    });
    return { data: data.data, url };
  });
}

// ── SEC EDGAR Tests ────────────────────────────────────────────────────────

async function testEdgar(): Promise<void> {
  const { edgar } = await import('./api.js');

  console.log('\n  Testing SEC EDGAR...');

  // Pre-flight connectivity check
  const userAgent = process.env.SEC_EDGAR_USER_AGENT || 'Dexter support@dexter.ai';
  try {
    const probe = await fetch('https://data.sec.gov/', {
      method: 'HEAD',
      headers: { 'User-Agent': userAgent },
    });
    if (!probe.ok && probe.headers.get('x-deny-reason') === 'host_not_allowed') {
      results.push({ provider: 'EDGAR', endpoint: '*', status: 'skip', latencyMs: 0, detail: 'data.sec.gov not reachable from this network' });
      return;
    }
  } catch {
    results.push({ provider: 'EDGAR', endpoint: '*', status: 'skip', latencyMs: 0, detail: 'data.sec.gov not reachable' });
    return;
  }

  // Company facts (XBRL)
  await runTest('EDGAR', 'Company Facts (XBRL)', async () => {
    // AAPL CIK = 0000320193
    const { data, url } = await edgar.get('/api/xbrl/companyfacts/CIK0000320193.json', 'AAPL company facts');
    // Just check that it has some data, don't return the full payload
    const factCount = data.facts ? Object.keys(data.facts as object).length : 0;
    return { data: { entityName: data.entityName, factNamespaces: factCount }, url };
  });
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n  ══════════════════════════════════════════════════════');
  console.log('  Dexter Finance Integration Test');
  console.log(`  Ticker: ${TICKER}  |  Verbose: ${VERBOSE}`);
  console.log('  ══════════════════════════════════════════════════════');

  // Run all provider tests
  await testPolygon();
  await testFmp();
  await testFinnhub();
  await testEdgar();

  // ── Summary ────────────────────────────────────────────────────────────

  console.log('\n  ── Results ────────────────────────────────────────────\n');

  const maxProvider = Math.max(...results.map((r) => r.provider.length));
  const maxEndpoint = Math.max(...results.map((r) => r.endpoint.length));
  const icons: Record<string, string> = { pass: '+', fail: 'x', skip: '-' };

  for (const r of results) {
    const icon = icons[r.status];
    const provPad = ' '.repeat(maxProvider - r.provider.length);
    const endPad = ' '.repeat(maxEndpoint - r.endpoint.length);
    const latency = r.latencyMs > 0 ? `${String(r.latencyMs).padStart(5)}ms` : '     -';
    console.log(`  [${icon}] ${r.provider}${provPad}  ${r.endpoint}${endPad}  ${latency}  ${r.detail}`);
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const total = results.length;

  console.log('\n  ── Summary ───────────────────────────────────────────\n');
  console.log(`  Total:   ${total}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n  ── Failures ──────────────────────────────────────────\n');
    for (const r of results.filter((r) => r.status === 'fail')) {
      console.log(`  [x] ${r.provider} — ${r.endpoint}: ${r.detail}`);
    }
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
