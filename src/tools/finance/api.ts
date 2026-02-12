import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { getSetting } from '../../utils/config.js';
import { resolveFinanceProvider } from './providers.js';

const FINANCIAL_DATASETS_BASE_URL = 'https://api.financialdatasets.ai';
const ALPHAVANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

type ApiParamValue = string | number | string[] | undefined;

function asString(value: ApiParamValue): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function asNumber(value: ApiParamValue, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildDateFilter(date: string | undefined, suffix: '0000' | '2359'): string | undefined {
  if (!date) return undefined;
  return `${date.replace(/-/g, '')}T${suffix}`;
}

function extractDateOnly(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function matchesDateFilter(
  value: string | undefined,
  {
    exact,
    gt,
    gte,
    lt,
    lte,
  }: { exact?: string; gt?: string; gte?: string; lt?: string; lte?: string },
): boolean {
  if (!value) return false;
  const date = extractDateOnly(value);

  if (exact && date !== exact) return false;
  if (gt && !(date > gt)) return false;
  if (gte && !(date >= gte)) return false;
  if (lt && !(date < lt)) return false;
  if (lte && !(date <= lte)) return false;
  return true;
}

async function callFinancialDatasetsApi(
  endpoint: string,
  params: Record<string, ApiParamValue>,
  label: string,
): Promise<ApiResponse> {
  const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;

  if (!apiKey) {
    logger.warn(`[Financial Datasets API] call without key: ${label}`);
  }

  const url = new URL(`${FINANCIAL_DATASETS_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'x-api-key': apiKey || '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Financial Datasets API] network error: ${label} — ${message}`);
    throw new Error(`[Financial Datasets API] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Financial Datasets API] error: ${label} — ${detail}`);
    throw new Error(`[Financial Datasets API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Financial Datasets API] parse error: ${label} — ${detail}`);
    throw new Error(`[Financial Datasets API] request failed: ${detail}`);
  });

  return { data, url: url.toString() };
}

async function callAlphaVantage(
  fn: string,
  params: Record<string, string | number | undefined>,
): Promise<{ raw: Record<string, unknown>; url: string }> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('ALPHAVANTAGE_API_KEY is not set.');
  }

  const url = new URL(ALPHAVANTAGE_BASE_URL);
  url.searchParams.set('function', fn);
  url.searchParams.set('apikey', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;

  const errorMessage = typeof raw['Error Message'] === 'string' ? raw['Error Message'] : null;
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const note = typeof raw.Note === 'string' ? raw.Note : null;
  if (note) {
    throw new Error(note);
  }

  const info = typeof raw.Information === 'string' ? raw.Information : null;
  if (info && !('Global Quote' in raw)) {
    throw new Error(info);
  }

  return { raw, url: url.toString() };
}

function pickAlphaSeries(raw: Record<string, unknown>): Record<string, Record<string, string>> {
  for (const [key, value] of Object.entries(raw)) {
    if (key.includes('Time Series') && value && typeof value === 'object') {
      return value as Record<string, Record<string, string>>;
    }
  }
  return {};
}

function normalizeAlphaPrices(
  series: Record<string, Record<string, string>>,
): Array<Record<string, unknown>> {
  return Object.entries(series)
    .map(([time, row]) => ({
      time,
      open: toNumberOrNull(row['1. open']),
      high: toNumberOrNull(row['2. high']),
      low: toNumberOrNull(row['3. low']),
      close: toNumberOrNull(row['4. close']),
      volume: toNumberOrNull(row['5. volume']),
    }))
    .filter((row) => typeof row.time === 'string')
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function filterPricesByDateRange(
  prices: Array<Record<string, unknown>>,
  startDate: string,
  endDate: string,
): Array<Record<string, unknown>> {
  return prices.filter((row) => {
    const time = typeof row.time === 'string' ? row.time : '';
    const date = extractDateOnly(time);
    return date >= startDate && date <= endDate;
  });
}

function groupPricesByYear(prices: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const byYear = new Map<string, Record<string, unknown>>();

  for (const row of prices) {
    const time = typeof row.time === 'string' ? row.time : '';
    const year = extractDateOnly(time).slice(0, 4);
    if (!year) continue;
    byYear.set(year, row); // sorted asc before call, so this keeps latest row for each year
  }

  return Array.from(byYear.values());
}

function mapOverviewToSnapshot(overview: Record<string, unknown>): Record<string, unknown> {
  return {
    ticker: overview.Symbol,
    market_cap: toNumberOrNull(overview.MarketCapitalization),
    pe_ratio: toNumberOrNull(overview.PERatio),
    peg_ratio: toNumberOrNull(overview.PEGRatio),
    price_to_book: toNumberOrNull(overview.PriceToBookRatio),
    ev_to_ebitda: toNumberOrNull(overview.EVToEBITDA),
    dividend_yield: toNumberOrNull(overview.DividendYield),
    eps: toNumberOrNull(overview.EPS),
    beta: toNumberOrNull(overview.Beta),
    latest_quarter: overview.LatestQuarter,
    profit_margin: toNumberOrNull(overview.ProfitMargin),
    operating_margin_ttm: toNumberOrNull(overview.OperatingMarginTTM),
    return_on_assets_ttm: toNumberOrNull(overview.ReturnOnAssetsTTM),
    return_on_equity_ttm: toNumberOrNull(overview.ReturnOnEquityTTM),
  };
}

function filterAndLimitByReportPeriod(
  rows: Array<Record<string, unknown>>,
  params: Record<string, ApiParamValue>,
): Array<Record<string, unknown>> {
  const limit = asNumber(params.limit, 10);
  const filtered = rows.filter((row) =>
    matchesDateFilter(asString(row.fiscalDateEnding as ApiParamValue), {
      gt: asString(params.report_period_gt),
      gte: asString(params.report_period_gte),
      lt: asString(params.report_period_lt),
      lte: asString(params.report_period_lte),
    }),
  );

  return filtered.slice(0, Math.max(1, limit));
}

async function callAlphaVantageApi(
  endpoint: string,
  params: Record<string, ApiParamValue>,
): Promise<ApiResponse> {
  const ticker = asString(params.ticker)?.toUpperCase();

  switch (endpoint) {
    case '/prices/snapshot/': {
      if (!ticker) throw new Error('ticker is required');
      const { raw, url } = await callAlphaVantage('GLOBAL_QUOTE', { symbol: ticker });
      const quote = (raw['Global Quote'] as Record<string, unknown>) || {};
      const snapshot = {
        ticker,
        price: toNumberOrNull(quote['05. price']),
        open: toNumberOrNull(quote['02. open']),
        high: toNumberOrNull(quote['03. high']),
        low: toNumberOrNull(quote['04. low']),
        previous_close: toNumberOrNull(quote['08. previous close']),
        volume: toNumberOrNull(quote['06. volume']),
        latest_trading_day: quote['07. latest trading day'],
        change: toNumberOrNull(quote['09. change']),
        change_percent: quote['10. change percent'],
      };
      return { data: { snapshot }, url };
    }

    case '/prices/': {
      if (!ticker) throw new Error('ticker is required');

      const interval = asString(params.interval) ?? 'day';
      const intervalMultiplier = asNumber(params.interval_multiplier, 1);
      const startDate = asString(params.start_date);
      const endDate = asString(params.end_date);

      if (!startDate || !endDate) {
        throw new Error('start_date and end_date are required');
      }

      let raw: Record<string, unknown>;
      let url: string;

      if (interval === 'minute') {
        const intradayInterval = `${intervalMultiplier}min`;
        if (!['1min', '5min', '15min', '30min', '60min'].includes(intradayInterval)) {
          throw new Error('Alpha Vantage minute interval supports only 1, 5, 15, 30, 60');
        }
        ({ raw, url } = await callAlphaVantage('TIME_SERIES_INTRADAY', {
          symbol: ticker,
          interval: intradayInterval,
          outputsize: 'full',
          adjusted: 'true',
        }));
      } else if (interval === 'day') {
        ({ raw, url } = await callAlphaVantage('TIME_SERIES_DAILY_ADJUSTED', {
          symbol: ticker,
          outputsize: 'full',
        }));
      } else if (interval === 'week') {
        ({ raw, url } = await callAlphaVantage('TIME_SERIES_WEEKLY_ADJUSTED', {
          symbol: ticker,
        }));
      } else if (interval === 'month' || interval === 'year') {
        ({ raw, url } = await callAlphaVantage('TIME_SERIES_MONTHLY_ADJUSTED', {
          symbol: ticker,
        }));
      } else {
        throw new Error(`Unsupported interval '${interval}' for Alpha Vantage`);
      }

      const series = pickAlphaSeries(raw);
      let prices = normalizeAlphaPrices(series);
      prices = filterPricesByDateRange(prices, startDate, endDate);

      if (interval === 'year') {
        prices = groupPricesByYear(prices);
      }

      return { data: { prices }, url };
    }

    case '/news/': {
      if (!ticker) throw new Error('ticker is required');
      const limit = asNumber(params.limit, 10);
      const { raw, url } = await callAlphaVantage('NEWS_SENTIMENT', {
        tickers: ticker,
        sort: 'LATEST',
        limit,
        time_from: buildDateFilter(asString(params.start_date), '0000'),
        time_to: buildDateFilter(asString(params.end_date), '2359'),
      });

      const feed = Array.isArray(raw.feed) ? (raw.feed as Record<string, unknown>[]) : [];
      const news = feed.map((item) => ({
        title: item.title,
        url: item.url,
        time_published: item.time_published,
        source: item.source,
        summary: item.summary,
        overall_sentiment_score: item.overall_sentiment_score,
        overall_sentiment_label: item.overall_sentiment_label,
      }));

      return { data: { news }, url };
    }

    case '/financials/income-statements/': {
      if (!ticker) throw new Error('ticker is required');
      const period = asString(params.period) ?? 'annual';
      const { raw, url } = await callAlphaVantage('INCOME_STATEMENT', { symbol: ticker });
      const records = period === 'annual'
        ? (raw.annualReports as Array<Record<string, unknown>> | undefined) ?? []
        : (raw.quarterlyReports as Array<Record<string, unknown>> | undefined) ?? [];
      const incomeStatements = filterAndLimitByReportPeriod(records, params);
      return { data: { income_statements: incomeStatements }, url };
    }

    case '/financials/balance-sheets/': {
      if (!ticker) throw new Error('ticker is required');
      const period = asString(params.period) ?? 'annual';
      const { raw, url } = await callAlphaVantage('BALANCE_SHEET', { symbol: ticker });
      const records = period === 'annual'
        ? (raw.annualReports as Array<Record<string, unknown>> | undefined) ?? []
        : (raw.quarterlyReports as Array<Record<string, unknown>> | undefined) ?? [];
      const balanceSheets = filterAndLimitByReportPeriod(records, params);
      return { data: { balance_sheets: balanceSheets }, url };
    }

    case '/financials/cash-flow-statements/': {
      if (!ticker) throw new Error('ticker is required');
      const period = asString(params.period) ?? 'annual';
      const { raw, url } = await callAlphaVantage('CASH_FLOW', { symbol: ticker });
      const records = period === 'annual'
        ? (raw.annualReports as Array<Record<string, unknown>> | undefined) ?? []
        : (raw.quarterlyReports as Array<Record<string, unknown>> | undefined) ?? [];
      const cashFlowStatements = filterAndLimitByReportPeriod(records, params);
      return { data: { cash_flow_statements: cashFlowStatements }, url };
    }

    case '/financials/': {
      if (!ticker) throw new Error('ticker is required');
      const period = asString(params.period) ?? 'annual';

      const [incomeRes, balanceRes, cashRes] = await Promise.all([
        callAlphaVantage('INCOME_STATEMENT', { symbol: ticker }),
        callAlphaVantage('BALANCE_SHEET', { symbol: ticker }),
        callAlphaVantage('CASH_FLOW', { symbol: ticker }),
      ]);

      const incomeRecords = period === 'annual'
        ? (incomeRes.raw.annualReports as Array<Record<string, unknown>> | undefined) ?? []
        : (incomeRes.raw.quarterlyReports as Array<Record<string, unknown>> | undefined) ?? [];
      const balanceRecords = period === 'annual'
        ? (balanceRes.raw.annualReports as Array<Record<string, unknown>> | undefined) ?? []
        : (balanceRes.raw.quarterlyReports as Array<Record<string, unknown>> | undefined) ?? [];
      const cashRecords = period === 'annual'
        ? (cashRes.raw.annualReports as Array<Record<string, unknown>> | undefined) ?? []
        : (cashRes.raw.quarterlyReports as Array<Record<string, unknown>> | undefined) ?? [];

      const financials = {
        income_statements: filterAndLimitByReportPeriod(incomeRecords, params),
        balance_sheets: filterAndLimitByReportPeriod(balanceRecords, params),
        cash_flow_statements: filterAndLimitByReportPeriod(cashRecords, params),
      };

      return { data: { financials }, url: incomeRes.url };
    }

    case '/financial-metrics/snapshot/': {
      if (!ticker) throw new Error('ticker is required');
      const { raw, url } = await callAlphaVantage('OVERVIEW', { symbol: ticker });
      const snapshot = mapOverviewToSnapshot(raw);
      return { data: { snapshot }, url };
    }

    case '/financial-metrics/': {
      if (!ticker) throw new Error('ticker is required');
      const { raw, url } = await callAlphaVantage('OVERVIEW', { symbol: ticker });
      const snapshot = mapOverviewToSnapshot(raw);
      const financialMetrics = [{
        ...snapshot,
        report_period: raw.LatestQuarter,
      }];
      return { data: { financial_metrics: financialMetrics }, url };
    }

    case '/analyst-estimates/': {
      if (!ticker) throw new Error('ticker is required');
      const period = asString(params.period) ?? 'annual';
      const { raw, url } = await callAlphaVantage('EARNINGS', { symbol: ticker });
      const source = period === 'annual'
        ? (raw.annualEarnings as Array<Record<string, unknown>> | undefined) ?? []
        : (raw.quarterlyEarnings as Array<Record<string, unknown>> | undefined) ?? [];

      const analystEstimates = source.map((item) => ({
        fiscal_date_ending: item.fiscalDateEnding,
        reported_eps: toNumberOrNull(item.reportedEPS),
        estimated_eps: toNumberOrNull(item.estimatedEPS),
        surprise: toNumberOrNull(item.surprise),
        surprise_percentage: toNumberOrNull(item.surprisePercentage),
      }));

      return { data: { analyst_estimates: analystEstimates }, url };
    }

    case '/company/facts': {
      if (!ticker) throw new Error('ticker is required');
      const { raw, url } = await callAlphaVantage('OVERVIEW', { symbol: ticker });
      const companyFacts = {
        ticker,
        name: raw.Name,
        exchange: raw.Exchange,
        sector: raw.Sector,
        industry: raw.Industry,
        description: raw.Description,
        country: raw.Country,
        market_cap: toNumberOrNull(raw.MarketCapitalization),
        employees: toNumberOrNull(raw.FullTimeEmployees),
        website: raw.OfficialSite,
      };
      return { data: { company_facts: companyFacts }, url };
    }

    case '/insider-trades/': {
      if (!ticker) throw new Error('ticker is required');
      const { raw, url } = await callAlphaVantage('INSIDER_TRANSACTIONS', { symbol: ticker });
      const limit = asNumber(params.limit, 100);
      const rows = Array.isArray(raw.data) ? (raw.data as Array<Record<string, unknown>>) : [];
      const filtered = rows.filter((row) =>
        matchesDateFilter(asString(row.filingDate as ApiParamValue), {
          exact: asString(params.filing_date),
          gt: asString(params.filing_date_gt),
          gte: asString(params.filing_date_gte),
          lt: asString(params.filing_date_lt),
          lte: asString(params.filing_date_lte),
        }),
      );
      return { data: { insider_trades: filtered.slice(0, Math.max(1, limit)) }, url };
    }

    case '/financials/segmented-revenues/':
    case '/filings/':
    case '/filings/items/':
    case '/crypto/prices/snapshot/':
    case '/crypto/prices/':
    case '/crypto/prices/tickers/':
      throw new Error(`Endpoint '${endpoint}' is not supported by Alpha Vantage in this integration.`);

    default:
      throw new Error(`Unsupported finance endpoint: ${endpoint}`);
  }
}

export async function callApi(
  endpoint: string,
  params: Record<string, ApiParamValue>,
  options?: { cacheable?: boolean }
): Promise<ApiResponse> {
  const label = describeRequest(endpoint, params);

  if (options?.cacheable) {
    const cached = readCache(endpoint, params);
    if (cached) {
      return cached;
    }
  }

  const configuredProvider = getSetting('financeProvider', 'auto');
  const resolvedProvider = resolveFinanceProvider(
    typeof configuredProvider === 'string' ? configuredProvider : 'auto',
  );

  if (!resolvedProvider) {
    throw new Error(
      'No finance provider is configured. Set FINANCIAL_DATASETS_API_KEY or ALPHAVANTAGE_API_KEY, or configure /finance.',
    );
  }

  try {
    const result = resolvedProvider === 'financialdatasets'
      ? await callFinancialDatasetsApi(endpoint, params, label)
      : await callAlphaVantageApi(endpoint, params);

    if (options?.cacheable) {
      writeCache(endpoint, params, result.data, result.url);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Finance API:${resolvedProvider}] error: ${label} — ${message}`);
    throw new Error(`[Finance API:${resolvedProvider}] ${message}`);
  }
}
