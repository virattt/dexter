/**
 * Tool Diagnostics — validates API keys and connectivity for all integrations.
 *
 * Usage:
 *   bun run src/tools/diagnostics.ts
 */
import 'dotenv/config';
import { PROVIDERS } from '../providers.js';
import { getSearchConfig, loadConfig } from '../utils/config.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
  latencyMs?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function keyPresent(envVar: string): boolean {
  const val = process.env[envVar]?.trim();
  return !!val && !val.startsWith('your-');
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

// ── Individual checks ──────────────────────────────────────────────────────

async function checkLlmProvider(): Promise<CheckResult> {
  const config = loadConfig();
  const providerId = config.provider ?? 'openai';
  const modelId = config.modelId ?? 'gpt-5.4';
  const provider = PROVIDERS.find((p) => p.id === providerId);

  if (!provider) {
    return { name: 'LLM Provider', status: 'fail', detail: `Unknown provider "${providerId}"` };
  }

  const envVar = provider.apiKeyEnvVar;
  if (!envVar) {
    // Local provider (Ollama) — just check connectivity
    const url = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    try {
      const { ms } = await timed(() => fetch(`${url}/api/tags`));
      return { name: 'LLM Provider (Ollama)', status: 'pass', detail: `${url} reachable`, latencyMs: ms };
    } catch {
      return { name: 'LLM Provider (Ollama)', status: 'fail', detail: `Cannot reach ${url}` };
    }
  }

  if (!keyPresent(envVar)) {
    return {
      name: `LLM Provider (${provider.displayName})`,
      status: 'fail',
      detail: `${envVar} not set or is placeholder — model "${modelId}" will fail`,
    };
  }

  return {
    name: `LLM Provider (${provider.displayName})`,
    status: 'pass',
    detail: `${envVar} set, model "${modelId}"`,
  };
}

async function checkPolygon(): Promise<CheckResult> {
  const envVar = 'POLYGON_API_KEY';
  if (!keyPresent(envVar)) {
    return {
      name: 'Polygon.io (prices, financials, news, filings)',
      status: 'fail',
      detail: `${envVar} not set — get a free key at https://polygon.io`,
    };
  }

  try {
    const { ms } = await timed(() =>
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/AAPL?apiKey=${process.env[envVar]}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r;
      }),
    );
    return { name: 'Polygon.io', status: 'pass', detail: 'Key valid, AAPL snapshot OK', latencyMs: ms };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { name: 'Polygon.io', status: 'fail', detail: `Key set but request failed: ${msg}` };
  }
}

async function checkFinnhub(): Promise<CheckResult> {
  const envVar = 'FINNHUB_API_KEY';
  if (!keyPresent(envVar)) {
    return {
      name: 'Finnhub (insider trades)',
      status: 'skip',
      detail: `${envVar} not set — get a free key at https://finnhub.io (optional)`,
    };
  }

  try {
    const { ms } = await timed(() =>
      fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=AAPL&token=${process.env[envVar]}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r;
      }),
    );
    return { name: 'Finnhub', status: 'pass', detail: 'Key valid, insider trades OK', latencyMs: ms };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { name: 'Finnhub', status: 'fail', detail: `Key set but request failed: ${msg}` };
  }
}

async function checkFmp(): Promise<CheckResult> {
  const envVar = 'FMP_API_KEY';
  if (!keyPresent(envVar)) {
    return {
      name: 'FMP (ratios, earnings, screener)',
      status: 'skip',
      detail: `${envVar} not set — get a free key at https://financialmodelingprep.com (optional)`,
    };
  }

  try {
    const { ms } = await timed(() =>
      fetch(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/AAPL?apikey=${process.env[envVar]}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r;
      }),
    );
    return { name: 'FMP', status: 'pass', detail: 'Key valid, AAPL metrics OK', latencyMs: ms };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { name: 'FMP', status: 'fail', detail: `Key set but request failed: ${msg}` };
  }
}

async function checkSecEdgar(): Promise<CheckResult> {
  // SEC EDGAR is free, no key needed — just check connectivity
  try {
    const { ms } = await timed(() =>
      fetch('https://efts.sec.gov/LATEST/search-index?q=%22AAPL%22&dateRange=custom&startdt=2024-01-01&enddt=2024-01-02&forms=10-K', {
        headers: { 'User-Agent': process.env.SEC_EDGAR_USER_AGENT || 'Dexter support@dexter.ai' },
      }).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r;
      }),
    );
    return { name: 'SEC EDGAR', status: 'pass', detail: 'Reachable', latencyMs: ms };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { name: 'SEC EDGAR', status: 'fail', detail: msg };
  }
}

async function checkSearchProvider(): Promise<CheckResult> {
  const searchConfig = getSearchConfig();
  const providerOrder = searchConfig.provider === 'auto'
    ? (['exa', 'perplexity', 'tavily'] as const)
    : ([searchConfig.provider] as const);

  const envVars: Record<string, string> = {
    exa: 'EXASEARCH_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    tavily: 'TAVILY_API_KEY',
  };

  for (const p of providerOrder) {
    const envVar = envVars[p];
    if (keyPresent(envVar)) {
      return {
        name: 'Web Search',
        status: 'pass',
        detail: `Using ${p} (${envVar} set)`,
      };
    }
  }

  return {
    name: 'Web Search',
    status: 'fail',
    detail: `No search key found. Set one of: ${providerOrder.map((p) => envVars[p]).join(', ')}`,
  };
}

async function checkXSearch(): Promise<CheckResult> {
  if (!keyPresent('X_BEARER_TOKEN')) {
    return { name: 'X/Twitter Search', status: 'skip', detail: 'X_BEARER_TOKEN not set (optional)' };
  }
  return { name: 'X/Twitter Search', status: 'pass', detail: 'X_BEARER_TOKEN set' };
}

async function checkEmbeddings(): Promise<CheckResult> {
  const config = loadConfig();
  const embProv = config.memory?.embeddingProvider ?? 'auto';

  const checks: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_API_KEY',
  };

  if (embProv === 'auto') {
    for (const [name, envVar] of Object.entries(checks)) {
      if (keyPresent(envVar)) {
        return { name: 'Embeddings (memory)', status: 'pass', detail: `Auto-resolved to ${name} via ${envVar}` };
      }
    }
    if (process.env.OLLAMA_BASE_URL) {
      return { name: 'Embeddings (memory)', status: 'pass', detail: 'Auto-resolved to Ollama' };
    }
    return { name: 'Embeddings (memory)', status: 'fail', detail: 'No embedding provider available' };
  }

  if (embProv === 'ollama') {
    return { name: 'Embeddings (memory)', status: 'pass', detail: 'Using Ollama' };
  }

  const envVar = checks[embProv];
  if (envVar && keyPresent(envVar)) {
    return { name: 'Embeddings (memory)', status: 'pass', detail: `Using ${embProv} (${envVar} set)` };
  }

  return { name: 'Embeddings (memory)', status: 'fail', detail: `${embProv} selected but ${envVar} not set` };
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  Dexter Tool Diagnostics\n');

  const checks = await Promise.all([
    checkLlmProvider(),
    checkPolygon(),
    checkFinnhub(),
    checkFmp(),
    checkSecEdgar(),
    checkSearchProvider(),
    checkXSearch(),
    checkEmbeddings(),
  ]);

  const icons: Record<string, string> = { pass: '+', fail: 'x', skip: '-' };
  const maxName = Math.max(...checks.map((c) => c.name.length));

  for (const check of checks) {
    const icon = icons[check.status];
    const latency = check.latencyMs ? ` (${check.latencyMs}ms)` : '';
    const pad = ' '.repeat(maxName - check.name.length);
    console.log(`  [${icon}] ${check.name}${pad}  ${check.detail}${latency}`);
  }

  const failures = checks.filter((c) => c.status === 'fail');
  console.log('');
  if (failures.length === 0) {
    console.log('  All checks passed.\n');
  } else {
    console.log(`  ${failures.length} check(s) failed — fix the issues above.\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
