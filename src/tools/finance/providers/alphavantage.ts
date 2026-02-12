import { MissingApiKeyError } from './types.js';

const BASE_URL = 'https://www.alphavantage.co/query';

function requireAlphaVantageApiKey(): string {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key || !key.trim() || key.trim().startsWith('your-')) {
    throw new MissingApiKeyError('ALPHAVANTAGE_API_KEY');
  }
  return key.trim();
}

function redactApiKey(url: URL): string {
  const copy = new URL(url.toString());
  copy.searchParams.delete('apikey');
  return copy.toString();
}

function parseAlphaVantageError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const fields = ['Error Message', 'Information', 'Note'];
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

async function callAlphaVantage<T = unknown>(
  params: Record<string, string | number | undefined>
): Promise<{ data: T; url: string }> {
  const apiKey = requireAlphaVantageApiKey();
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as T;
  const err = parseAlphaVantageError(data);
  if (err) throw new Error(`Alpha Vantage error: ${err}`);

  return { data, url: redactApiKey(url) };
}

function toDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export async function avPriceSnapshot(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'GLOBAL_QUOTE',
    symbol: ticker.toUpperCase(),
  });
  const quote = (data['Global Quote'] as Record<string, unknown> | undefined) ?? {};
  const parsed = {
    symbol: quote['01. symbol'],
    open: quote['02. open'],
    high: quote['03. high'],
    low: quote['04. low'],
    price: quote['05. price'],
    volume: quote['06. volume'],
    latestTradingDay: quote['07. latest trading day'],
    previousClose: quote['08. previous close'],
    change: quote['09. change'],
    changePercent: quote['10. change percent'],
  };
  return { data: parsed, url };
}

type SeriesRow = { date: string; open: string; high: string; low: string; close: string; volume: string } & Record<
  string,
  unknown
>;

function extractTimeSeries(payload: Record<string, unknown>): Record<string, Record<string, unknown>> | null {
  for (const [k, v] of Object.entries(payload)) {
    if (k.toLowerCase().includes('time series') && v && typeof v === 'object') {
      return v as Record<string, Record<string, unknown>>;
    }
  }
  return null;
}

function mapSeriesRows(
  series: Record<string, Record<string, unknown>>,
  datePredicate: (date: string) => boolean
): SeriesRow[] {
  const rows: SeriesRow[] = [];
  for (const [timestamp, values] of Object.entries(series)) {
    const date = toDateOnly(timestamp);
    if (!date) continue;
    if (!datePredicate(date)) continue;
    const v = values as Record<string, unknown>;
    rows.push({
      date: timestamp,
      open: String(v['1. open'] ?? ''),
      high: String(v['2. high'] ?? ''),
      low: String(v['3. low'] ?? ''),
      close: String(v['4. close'] ?? ''),
      volume: String(v['5. volume'] ?? ''),
      ...v,
    });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return rows;
}

export async function avPrices(params: {
  ticker: string;
  interval: 'minute' | 'day' | 'week' | 'month' | 'year';
  interval_multiplier: number;
  start_date: string;
  end_date: string;
}): Promise<{ data: unknown; url: string }> {
  const symbol = params.ticker.toUpperCase();
  const inRange = (date: string) => date >= params.start_date && date <= params.end_date;

  if (params.interval === 'minute') {
    const allowed = new Set([1, 5, 15, 30, 60]);
    if (!allowed.has(params.interval_multiplier)) {
      throw new Error(`Alpha Vantage intraday supports interval_multiplier one of: ${Array.from(allowed).join(', ')}`);
    }
    const { data, url } = await callAlphaVantage<Record<string, unknown>>({
      function: 'TIME_SERIES_INTRADAY',
      symbol,
      interval: `${params.interval_multiplier}min`,
      outputsize: 'full',
    });
    const series = extractTimeSeries(data);
    if (!series) return { data: [], url };
    const rows = mapSeriesRows(series, inRange);
    return { data: rows, url };
  }

  if (params.interval === 'day') {
    const { data, url } = await callAlphaVantage<Record<string, unknown>>({
      function: 'TIME_SERIES_DAILY_ADJUSTED',
      symbol,
      outputsize: 'full',
    });
    const series = extractTimeSeries(data);
    if (!series) return { data: [], url };
    const rows = mapSeriesRows(series, inRange);
    return { data: rows, url };
  }

  if (params.interval === 'week') {
    const { data, url } = await callAlphaVantage<Record<string, unknown>>({
      function: 'TIME_SERIES_WEEKLY_ADJUSTED',
      symbol,
    });
    const series = extractTimeSeries(data);
    if (!series) return { data: [], url };
    const rows = mapSeriesRows(series, inRange);
    return { data: rows, url };
  }

  if (params.interval === 'month') {
    const { data, url } = await callAlphaVantage<Record<string, unknown>>({
      function: 'TIME_SERIES_MONTHLY_ADJUSTED',
      symbol,
    });
    const series = extractTimeSeries(data);
    if (!series) return { data: [], url };
    const rows = mapSeriesRows(series, inRange);
    return { data: rows, url };
  }

  // year: derive from monthly
  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'TIME_SERIES_MONTHLY_ADJUSTED',
    symbol,
  });
  const series = extractTimeSeries(data);
  if (!series) return { data: [], url };
  const monthly = mapSeriesRows(series, () => true);

  const byYear = new Map<string, SeriesRow[]>();
  for (const row of monthly) {
    const dateOnly = toDateOnly(row.date);
    if (!dateOnly) continue;
    const year = dateOnly.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(row);
  }

  const years: SeriesRow[] = [];
  for (const [year, rows] of byYear.entries()) {
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const r of rows) {
      const h = Number(r.high);
      const l = Number(r.low);
      const vol = Number(r.volume);
      if (Number.isFinite(h)) high = Math.max(high, h);
      if (Number.isFinite(l)) low = Math.min(low, l);
      if (Number.isFinite(vol)) volume += vol;
    }
    const date = `${year}-12-31`;
    if (!inRange(date)) continue;
    years.push({
      date,
      open: first.open,
      high: Number.isFinite(high) ? String(high) : '',
      low: Number.isFinite(low) ? String(low) : '',
      close: last.close,
      volume: String(volume),
    } as SeriesRow);
  }
  years.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { data: years, url };
}

export async function avCompanyFacts(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'OVERVIEW',
    symbol: ticker.toUpperCase(),
  });
  return { data, url };
}

export async function avNews(params: {
  ticker: string;
  limit?: number;
  start_date?: string;
  end_date?: string;
}): Promise<{ data: unknown; url: string }> {
  const toAlphaTime = (date: string, endOfDay: boolean) =>
    `${date.replace(/-/g, '')}T${endOfDay ? '2359' : '0000'}`;

  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'NEWS_SENTIMENT',
    tickers: params.ticker.toUpperCase(),
    time_from: params.start_date ? toAlphaTime(params.start_date, false) : undefined,
    time_to: params.end_date ? toAlphaTime(params.end_date, true) : undefined,
    limit: params.limit,
  });
  return { data, url };
}

type StatementPeriod = 'annual' | 'quarterly' | 'ttm';

function selectReports(payload: Record<string, unknown>, period: StatementPeriod): unknown[] {
  const annual = Array.isArray(payload.annualReports) ? (payload.annualReports as unknown[]) : [];
  const quarterly = Array.isArray(payload.quarterlyReports) ? (payload.quarterlyReports as unknown[]) : [];
  if (period === 'annual') return annual;
  if (period === 'quarterly') return quarterly;
  return quarterly.slice(0, 4);
}

function filterByFiscalDateEnding(rows: unknown[], filters: { gt?: string; gte?: string; lt?: string; lte?: string }): unknown[] {
  const toDate = (row: unknown) =>
    row && typeof row === 'object' ? toDateOnly((row as Record<string, unknown>).fiscalDateEnding) : null;
  return rows.filter((row) => {
    const date = toDate(row);
    if (!date) return true;
    if (filters.gt && !(date > filters.gt)) return false;
    if (filters.gte && !(date >= filters.gte)) return false;
    if (filters.lt && !(date < filters.lt)) return false;
    if (filters.lte && !(date <= filters.lte)) return false;
    return true;
  });
}

export async function avIncomeStatements(params: {
  ticker: string;
  period: StatementPeriod;
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'INCOME_STATEMENT',
    symbol: params.ticker.toUpperCase(),
  });
  const rows = selectReports(data, params.period);
  const filtered = filterByFiscalDateEnding(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered.slice(0, params.limit), url };
}

export async function avBalanceSheets(params: {
  ticker: string;
  period: StatementPeriod;
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'BALANCE_SHEET',
    symbol: params.ticker.toUpperCase(),
  });
  const rows = selectReports(data, params.period);
  const filtered = filterByFiscalDateEnding(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered.slice(0, params.limit), url };
}

export async function avCashFlowStatements(params: {
  ticker: string;
  period: StatementPeriod;
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callAlphaVantage<Record<string, unknown>>({
    function: 'CASH_FLOW',
    symbol: params.ticker.toUpperCase(),
  });
  const rows = selectReports(data, params.period);
  const filtered = filterByFiscalDateEnding(rows, {
    gt: params.report_period_gt,
    gte: params.report_period_gte,
    lt: params.report_period_lt,
    lte: params.report_period_lte,
  });
  return { data: filtered.slice(0, params.limit), url };
}

export async function avKeyRatiosSnapshot(ticker: string): Promise<{ data: unknown; url: string }> {
  // Alpha Vantage doesn't expose a dedicated ratios snapshot; OVERVIEW is the closest.
  const { data, url } = await avCompanyFacts(ticker);
  return { data, url };
}

