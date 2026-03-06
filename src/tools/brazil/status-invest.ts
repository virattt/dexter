/**
 * StatusInvest integration.
 * Fetches fundamental data, historical DRE, and dividends via StatusInvest JSON endpoints.
 * No official API key required; these are open endpoints used by their web app.
 */

const SI_BASE = 'https://statusinvest.com.br';

export interface StatusInvestIndicators {
  pl?: number;
  pvp?: number;
  roe?: number;
  roic?: number;
  dividendYield?: number;
  margemLiquida?: number;
  margemEbit?: number;
  ebitda?: number;
  lucroLiquido?: number;
  receitaLiquida?: number;
  dividaLiquida?: number;
  source: 'StatusInvest';
}

export interface StatusInvestDreEntry {
  year: number;
  receitaLiquida?: number;
  lucroLiquido?: number;
  ebit?: number;
  ebitda?: number;
}

export interface StatusInvestDividend {
  type: string;
  value: number;
  payDate: string;
  dateCom: string;
}

export interface StatusInvestData {
  indicators?: StatusInvestIndicators;
  dreHistory?: StatusInvestDreEntry[];
  dividends?: StatusInvestDividend[];
  source: 'StatusInvest';
}

const SI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Referer': 'https://statusinvest.com.br/',
};

function safeGet(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Fetch key indicators from StatusInvest search endpoint. */
async function fetchIndicators(ticker: string): Promise<StatusInvestIndicators | null> {
  try {
    // StatusInvest exposes a search endpoint that returns basic fundamentals
    const url = `${SI_BASE}/acoes/${ticker.toLowerCase()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: SI_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();

    // StatusInvest embeds fundamental data in JSON within the page
    // Look for the __STORE__ or window.fundamentus pattern
    const match = html.match(/\"pl"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/);
    const dyMatch = html.match(/\"dy"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/);
    const roeMatch = html.match(/\"roe"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/);
    const pvpMatch = html.match(/\"p_vp"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/);
    const margemLiqMatch = html.match(/\"margemliquida"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/i);
    const dividaLiqMatch = html.match(/\"dividaliquida"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/i);
    const roicMatch = html.match(/\"roic"\s*:\s*\{[^}]*"value"\s*:\s*([\d.,-]+)/i);

    const parseHtmlNum = (m: RegExpMatchArray | null) =>
      m ? parseFloat(m[1].replace(',', '.')) || undefined : undefined;

    const result: StatusInvestIndicators = {
      pl: parseHtmlNum(match),
      pvp: parseHtmlNum(pvpMatch),
      dividendYield: parseHtmlNum(dyMatch),
      roe: parseHtmlNum(roeMatch),
      margemLiquida: parseHtmlNum(margemLiqMatch),
      dividaLiquida: parseHtmlNum(dividaLiqMatch),
      roic: parseHtmlNum(roicMatch),
      source: 'StatusInvest',
    };

    // Only return if we got at least some data
    const hasData = Object.entries(result).some(([k, v]) => k !== 'source' && v !== undefined);
    return hasData ? result : null;
  } catch {
    return null;
  }
}

/** Fetch historical DRE data (annual) from StatusInvest. */
async function fetchDreHistory(ticker: string): Promise<StatusInvestDreEntry[] | null> {
  try {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 5;
    const url = `${SI_BASE}/acao/getdre?code=${ticker.toUpperCase()}&type=0&range.min=${minYear}&range.max=${currentYear}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: SI_HEADERS });
    if (!res.ok) return null;

    const json = await res.json() as Record<string, unknown>;
    // StatusInvest DRE response structure: { grid: [ { columns: [...] } ], ... }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (json as any)?.data?.grid as Array<{ title: string; columns: Array<{ value: string | number; year: number }> }>;
    if (!grid || !Array.isArray(grid)) return null;

    // Build a year-indexed map
    const yearMap: Record<number, StatusInvestDreEntry> = {};

    for (const row of grid) {
      const title = (row.title || '').toLowerCase();
      let key: keyof StatusInvestDreEntry | null = null;

      if (title.includes('receita líquida') || title.includes('receita de venda')) key = 'receitaLiquida';
      else if (title.includes('lucro líquido')) key = 'lucroLiquido';
      else if (title.includes('ebit')) key = 'ebit';
      else if (title.includes('ebitda')) key = 'ebitda';

      if (!key) continue;

      for (const col of row.columns || []) {
        if (!col.year) continue;
        if (!yearMap[col.year]) yearMap[col.year] = { year: col.year };
        const val = typeof col.value === 'number' ? col.value : parseFloat(String(col.value).replace(',', '.'));
        if (!isNaN(val)) (yearMap[col.year] as unknown as Record<string, unknown>)[key] = val;
      }
    }

    const entries = Object.values(yearMap).sort((a, b) => b.year - a.year);
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

/** Fetch dividend history from StatusInvest. */
async function fetchDividends(ticker: string): Promise<StatusInvestDividend[] | null> {
  try {
    const url = `${SI_BASE}/acao/companytickerprovents?ticker=${ticker.toUpperCase()}&chartProventsType=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: SI_HEADERS });
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as { assetEarningsModels?: any[] };
    const models = json?.assetEarningsModels;
    if (!Array.isArray(models)) return null;

    return models.slice(0, 20).map(m => ({
      type: m.etlTypeName || m.typeName || 'Dividendo',
      value: parseFloat(String(m.value).replace(',', '.')) || 0,
      payDate: m.paymentDate || '',
      dateCom: m.lastDatePrior || '',
    }));
  } catch {
    return null;
  }
}

/** Fetch all available data from StatusInvest for a ticker. */
export async function fetchStatusInvestData(ticker: string): Promise<StatusInvestData | null> {
  const normalized = ticker.replace(/\.SA$/i, '').toUpperCase();

  const [indicators, dreHistory, dividends] = await Promise.all([
    fetchIndicators(normalized),
    fetchDreHistory(normalized),
    fetchDividends(normalized),
  ]);

  if (!indicators && !dreHistory && !dividends) return null;

  return {
    indicators: indicators ?? undefined,
    dreHistory: dreHistory ?? undefined,
    dividends: dividends ?? undefined,
    source: 'StatusInvest',
  };
}
