import { MissingApiKeyError } from './types.js';

const BASE_URL = 'https://financialmodelingprep.com/stable';

function requireFmpApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key || !key.trim() || key.trim().startsWith('your-')) {
    throw new MissingApiKeyError('FMP_API_KEY');
  }
  return key.trim();
}

function toDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Common FMP formats: "2025-01-31" or "2025-01-31 16:00:00"
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function withinRange(date: string, start?: string, end?: string): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function callFmp<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<{ data: T; url: string }> {
  const apiKey = requireFmpApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  const response = await fetch(url.toString(), { headers: { apikey: apiKey } });
  if (!response.ok) {
    throw new Error(`FMP request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as T;
  return { data, url: url.toString() };
}

export async function fmpPriceSnapshot(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callFmp<unknown[]>('/quote', { symbol: ticker.toUpperCase() });
  const first = Array.isArray(data) ? data[0] : null;
  return { data: first ?? {}, url };
}

export async function fmpPricesDaily(params: {
  ticker: string;
  start_date: string;
  end_date: string;
}): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callFmp<unknown[]>('/historical-price-eod/full', {
    symbol: params.ticker.toUpperCase(),
  });

  const filtered = Array.isArray(data)
    ? data
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const r = row as Record<string, unknown>;
          const date = toDateOnly(r.date);
          if (!date) return null;
          if (!withinRange(date, params.start_date, params.end_date)) return null;
          return { ...r, date };
        })
        .filter(Boolean)
    : [];

  // Sort ascending by date for consistency with other providers
  (filtered as Array<Record<string, unknown>>).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return { data: filtered, url };
}

type PriceInterval = 'minute' | 'day' | 'week' | 'month' | 'year';

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getIsoWeekKey(dateStr: string): string {
  // ISO week date algorithm using UTC to avoid timezone shifts.
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay() || 7; // 1..7 (Mon..Sun)
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function aggregateBars(rows: Array<Record<string, unknown>>): Record<string, unknown> {
  const first = rows[0] ?? {};
  const last = rows[rows.length - 1] ?? {};

  let high: number | null = null;
  let low: number | null = null;
  let volume = 0;

  for (const r of rows) {
    const h = parseNumber(r.high);
    const l = parseNumber(r.low);
    const v = parseNumber(r.volume);
    if (h !== null) high = high === null ? h : Math.max(high, h);
    if (l !== null) low = low === null ? l : Math.min(low, l);
    if (v !== null) volume += v;
  }

  return {
    date: last.date ?? first.date,
    open: first.open,
    high: high ?? undefined,
    low: low ?? undefined,
    close: last.close,
    volume: volume || undefined,
  };
}

function groupConsecutive<T>(items: T[], size: number): T[][] {
  if (size <= 1) return items.map((i) => [i]);
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

function resampleDaily(
  daily: Array<Record<string, unknown>>,
  interval: Exclude<PriceInterval, 'minute'>,
  intervalMultiplier: number
): Array<Record<string, unknown>> {
  if (interval === 'day') {
    return groupConsecutive(daily, Math.max(1, intervalMultiplier)).map((g) => aggregateBars(g));
  }

  const buckets = new Map<string, Array<Record<string, unknown>>>();
  const bucketOrder: string[] = [];

  const getBucketKey = (date: string): string => {
    if (interval === 'week') return getIsoWeekKey(date);
    if (interval === 'month') return date.slice(0, 7); // YYYY-MM
    return date.slice(0, 4); // YYYY
  };

  for (const row of daily) {
    const date = typeof row.date === 'string' ? row.date : null;
    if (!date) continue;
    const key = getBucketKey(date);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      bucketOrder.push(key);
    }
    buckets.get(key)!.push(row);
  }

  const bucketBars = bucketOrder
    .map((k) => buckets.get(k)!)
    .filter((rows) => rows.length > 0)
    .map((rows) => aggregateBars(rows));

  // Apply multiplier by grouping consecutive bucket bars.
  return groupConsecutive(bucketBars, Math.max(1, intervalMultiplier)).map((g) => aggregateBars(g));
}

export async function fmpPrices(params: {
  ticker: string;
  interval: PriceInterval;
  interval_multiplier: number;
  start_date: string;
  end_date: string;
}): Promise<{ data: unknown; url: string }> {
  if (params.interval === 'minute') {
    throw new Error('FMP provider currently supports daily-or-higher intervals only');
  }

  const { data: dailyData, url } = await fmpPricesDaily({
    ticker: params.ticker,
    start_date: params.start_date,
    end_date: params.end_date,
  });

  const daily = Array.isArray(dailyData)
    ? (dailyData.filter((r) => r && typeof r === 'object') as Array<Record<string, unknown>>)
    : [];

  const resampled = resampleDaily(daily, params.interval, params.interval_multiplier);
  return { data: resampled, url };
}

export async function fmpCompanyFacts(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callFmp<unknown[]>('/profile', { symbol: ticker.toUpperCase() });
  const first = Array.isArray(data) ? data[0] : null;
  return { data: first ?? {}, url };
}

export async function fmpNews(params: {
  ticker: string;
  limit?: number;
  start_date?: string;
  end_date?: string;
}): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callFmp<unknown[]>('/news/stock', {
    symbols: params.ticker.toUpperCase(),
    limit: params.limit,
  });

  const filtered = Array.isArray(data)
    ? data.filter((row) => {
        if (!row || typeof row !== 'object') return false;
        const r = row as Record<string, unknown>;
        const date = toDateOnly(r.publishedDate);
        if (!date) return true;
        return withinRange(date, params.start_date, params.end_date);
      })
    : [];

  return { data: filtered, url };
}

type StatementPeriod = 'annual' | 'quarterly' | 'ttm';

function fmpPeriodParam(period: StatementPeriod): { pathSuffix: string; period?: string } {
  if (period === 'ttm') return { pathSuffix: '-ttm' };
  return { pathSuffix: '', period: period === 'quarterly' ? 'quarter' : 'annual' };
}

function filterByReportPeriod<T extends Record<string, unknown>>(
  rows: T[],
  filters: { gt?: string; gte?: string; lt?: string; lte?: string }
): T[] {
  const { gt, gte, lt, lte } = filters;
  return rows.filter((row) => {
    const date = toDateOnly(row.date);
    if (!date) return true;
    if (gt && !(date > gt)) return false;
    if (gte && !(date >= gte)) return false;
    if (lt && !(date < lt)) return false;
    if (lte && !(date <= lte)) return false;
    return true;
  });
}

export async function fmpIncomeStatements(params: {
  ticker: string;
  period: StatementPeriod;
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  const { pathSuffix, period } = fmpPeriodParam(params.period);
  const { data, url } = await callFmp<unknown[]>(`/income-statement${pathSuffix}`, {
    symbol: params.ticker.toUpperCase(),
    period,
    limit: params.limit,
  });

  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  const filtered = filterByReportPeriod(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered, url };
}

export async function fmpBalanceSheets(params: {
  ticker: string;
  period: StatementPeriod;
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  const { pathSuffix, period } = fmpPeriodParam(params.period);
  const { data, url } = await callFmp<unknown[]>(`/balance-sheet-statement${pathSuffix}`, {
    symbol: params.ticker.toUpperCase(),
    period,
    limit: params.limit,
  });

  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  const filtered = filterByReportPeriod(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered, url };
}

export async function fmpCashFlowStatements(params: {
  ticker: string;
  period: StatementPeriod;
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  const { pathSuffix, period } = fmpPeriodParam(params.period);
  const { data, url } = await callFmp<unknown[]>(`/cash-flow-statement${pathSuffix}`, {
    symbol: params.ticker.toUpperCase(),
    period,
    limit: params.limit,
  });

  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  const filtered = filterByReportPeriod(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered, url };
}

export async function fmpKeyMetricsSnapshot(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callFmp<unknown[]>('/key-metrics-ttm', { symbol: ticker.toUpperCase() });
  const first = Array.isArray(data) ? data[0] : null;
  return { data: first ?? {}, url };
}

export async function fmpKeyMetrics(params: {
  ticker: string;
  period: 'annual' | 'quarterly' | 'ttm';
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  if (params.period === 'ttm') {
    const { data, url } = await callFmp<unknown[]>('/key-metrics-ttm', { symbol: params.ticker.toUpperCase() });
    const first = Array.isArray(data) ? data[0] : null;
    return { data: first ? [first] : [], url };
  }

  const { data, url } = await callFmp<unknown[]>('/key-metrics', {
    symbol: params.ticker.toUpperCase(),
    period: params.period === 'quarterly' ? 'quarter' : 'annual',
    limit: params.limit,
  });

  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  const filtered = filterByReportPeriod(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered, url };
}
