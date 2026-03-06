/**
 * Historical financial series for the Brazilian market.
 * Sources:
 *  - Yahoo Finance v8 API (free, no key) — for stock prices, Brent, USD/BRL
 *  - BCB (Banco Central do Brasil) OpenData API (official) — for USD/BRL FX rate
 */

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const BCB_BASE   = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'application/json',
};

export interface PricePoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  adjClose?: number;
  volume?: number;
}

export interface HistoricalSeries {
  symbol: string;
  currency?: string;
  interval: string;
  range: string;
  data: PricePoint[];
  source: 'YahooFinance' | 'BCB';
}

/** Translate user-facing range strings to Yahoo Finance range/interval params. */
function resolveRange(range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y') {
  const map: Record<string, { range: string; interval: string }> = {
    '1m':  { range: '1mo',  interval: '1d'  },
    '3m':  { range: '3mo',  interval: '1d'  },
    '6m':  { range: '6mo',  interval: '1d'  },
    '1y':  { range: '1y',   interval: '1wk' },
    '3y':  { range: '3y',   interval: '1wk' },
    '5y':  { range: '5y',   interval: '1mo' },
    '10y': { range: '10y',  interval: '1mo' },
  };
  return map[range] ?? { range: '1y', interval: '1wk' };
}

/** Fetch OHLCV series from Yahoo Finance for any symbol. */
async function fetchYahooSeries(
  symbol: string,
  range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y' = '1y',
): Promise<HistoricalSeries | null> {
  try {
    const { range: r, interval } = resolveRange(range);
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${r}&interval=${interval}&events=history`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: YAHOO_HEADERS });
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const ohlcv = result.indicators?.quote?.[0] ?? {};
    const adjClose: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];
    const currency: string = result.meta?.currency ?? 'USD';

    const data: PricePoint[] = timestamps.map((ts, i) => {
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      return {
        date,
        open:     ohlcv.open?.[i]  != null ? Math.round(ohlcv.open[i] * 100) / 100 : undefined,
        high:     ohlcv.high?.[i]  != null ? Math.round(ohlcv.high[i] * 100) / 100 : undefined,
        low:      ohlcv.low?.[i]   != null ? Math.round(ohlcv.low[i]  * 100) / 100 : undefined,
        close:    Math.round((ohlcv.close?.[i] ?? 0) * 100) / 100,
        adjClose: adjClose[i]      != null ? Math.round(adjClose[i]   * 100) / 100 : undefined,
        volume:   ohlcv.volume?.[i] ?? undefined,
      };
    }).filter(p => p.close > 0);

    return {
      symbol,
      currency,
      interval,
      range: r,
      data,
      source: 'YahooFinance',
    };
  } catch {
    return null;
  }
}

/** Fetch historical USD/BRL from BCB (Banco Central do Brasil) — authoritative official source. */
async function fetchBcbUsdBrl(range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y' = '1y'): Promise<HistoricalSeries | null> {
  try {
    // BCB SGS series 1 = PTAX Venda USD/BRL daily
    const daysMap: Record<string, number> = {
      '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095, '5y': 1825, '10y': 3650,
    };
    const days = daysMap[range] ?? 365;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const url = `${BCB_BASE}/1/dados?formato=json&dataInicial=${fmt(startDate)}&dataFinal=${fmt(endDate)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as Array<{ data: string; valor: string }>;
    if (!Array.isArray(json) || json.length === 0) return null;

    // BCB date format: DD/MM/YYYY
    const data: PricePoint[] = json.map(row => {
      const [d, m, y] = row.data.split('/');
      return {
        date:  `${y}-${m}-${d}`,
        close: parseFloat(row.valor.replace(',', '.')),
      };
    }).filter(p => !isNaN(p.close));

    return {
      symbol: 'USD/BRL',
      currency: 'BRL',
      interval: '1d',
      range,
      data,
      source: 'BCB',
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch historical series for a Brazilian stock (e.g. PETR4 → PETR4.SA). */
export async function fetchStockHistory(
  ticker: string,
  range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y' = '1y',
): Promise<HistoricalSeries | null> {
  const symbol = ticker.endsWith('.SA') ? ticker : `${ticker.replace(/\.SA$/i, '').toUpperCase()}.SA`;
  return fetchYahooSeries(symbol, range);
}

/** Fetch historical Brent crude oil prices (USD/barrel). Symbol: BZ=F */
export async function fetchBrentHistory(
  range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y' = '1y',
): Promise<HistoricalSeries | null> {
  // BZ=F = Brent Crude Oil Future (front month)
  return fetchYahooSeries('BZ=F', range);
}

/** Fetch historical WTI crude oil prices (USD/barrel). Symbol: CL=F */
export async function fetchWtiHistory(
  range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y' = '1y',
): Promise<HistoricalSeries | null> {
  return fetchYahooSeries('CL=F', range);
}

/** Fetch USD/BRL exchange rate history. Prefers BCB (official), falls back to Yahoo. */
export async function fetchUsdBrlHistory(
  range: '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y' = '1y',
): Promise<HistoricalSeries | null> {
  const bcb = await fetchBcbUsdBrl(range);
  if (bcb && bcb.data.length > 0) return bcb;
  // Fallback to Yahoo Finance if BCB is unavailable
  return fetchYahooSeries('USDBRL=X', range);
}
