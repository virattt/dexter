/**
 * Result formatters — convert raw financial API JSON into compact
 * markdown tables for efficient model consumption.
 *
 * Each formatter takes the raw `data` field from a sub-tool result
 * and returns a human-readable string that's 5-10x smaller.
 */

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function fmtNum(n: unknown): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function fmtPct(n: unknown): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return `${(num * 100).toFixed(1)}%`;
}

function fmtPrice(n: unknown): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return `$${num.toFixed(2)}`;
}

function fmtDate(d: unknown): string {
  if (!d) return '—';
  const str = String(d);
  // "2024-12-31" → "Q4 24" for quarterly, "2024" for annual
  if (str.length >= 10) {
    const month = parseInt(str.slice(5, 7), 10);
    const year = str.slice(2, 4);
    const quarter = Math.ceil(month / 3);
    return `Q${quarter} ${year}`;
  }
  return str;
}

type Rec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Financial statement formatters
// ---------------------------------------------------------------------------

export function formatIncomeStatements(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No income statement data available.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Income Statement`, ''];
  lines.push('| Period | Revenue | Op Inc | Net Inc | EPS |');
  lines.push('|--------|---------|--------|---------|-----|');
  for (const row of items as Rec[]) {
    lines.push(`| ${fmtDate(row.report_period)} | ${fmtNum(row.revenue)} | ${fmtNum(row.operating_income)} | ${fmtNum(row.net_income)} | ${fmtPrice(row.earnings_per_share ?? row.basic_earnings_per_share)} |`);
  }
  return lines.join('\n');
}

export function formatBalanceSheets(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No balance sheet data available.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Balance Sheet`, ''];
  lines.push('| Period | Total Assets | Total Liab | Equity | Cash |');
  lines.push('|--------|-------------|------------|--------|------|');
  for (const row of items as Rec[]) {
    lines.push(`| ${fmtDate(row.report_period)} | ${fmtNum(row.total_assets)} | ${fmtNum(row.total_liabilities)} | ${fmtNum(row.shareholders_equity ?? row.total_equity)} | ${fmtNum(row.cash_and_equivalents)} |`);
  }
  return lines.join('\n');
}

export function formatCashFlowStatements(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No cash flow data available.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Cash Flow`, ''];
  lines.push('| Period | Op CF | CapEx | FCF |');
  lines.push('|--------|-------|-------|-----|');
  for (const row of items as Rec[]) {
    const opCF = Number(row.operating_cash_flow ?? row.net_cash_flow_from_operations ?? 0);
    const capex = Math.abs(Number(row.capital_expenditure ?? row.capital_expenditures ?? 0));
    const fcf = opCF - capex;
    lines.push(`| ${fmtDate(row.report_period)} | ${fmtNum(opCF)} | ${fmtNum(capex)} | ${fmtNum(fcf)} |`);
  }
  return lines.join('\n');
}

export function formatAllFinancials(data: unknown, args?: Rec): string {
  const rec = (data && typeof data === 'object') ? data as Rec : {};
  const parts: string[] = [];
  if (rec.income_statements) parts.push(formatIncomeStatements(rec.income_statements, args));
  if (rec.balance_sheets) parts.push(formatBalanceSheets(rec.balance_sheets, args));
  if (rec.cash_flow_statements) parts.push(formatCashFlowStatements(rec.cash_flow_statements, args));
  return parts.length > 0 ? parts.join('\n\n') : 'No financial data available.';
}

// ---------------------------------------------------------------------------
// Key ratios / metrics
// ---------------------------------------------------------------------------

export function formatKeyRatios(data: unknown, args?: Rec): string {
  const d = (data && typeof data === 'object') ? data as Rec : {};
  if (Object.keys(d).length === 0) return 'No key metrics available.';
  const ticker = ((d.ticker ?? args?.ticker) as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Key Metrics`];
  lines.push(`- Market Cap: ${fmtNum(d.market_cap)}`);
  lines.push(`- P/E: ${d.pe_ratio ?? '—'} | EPS: ${fmtPrice(d.eps)}`);
  lines.push(`- Revenue Growth: ${fmtPct(d.revenue_growth_rate)} | Earnings Growth: ${fmtPct(d.earnings_growth_rate)}`);
  if (d.gross_margin !== undefined || d.operating_margin !== undefined || d.net_margin !== undefined) {
    lines.push(`- Gross Margin: ${fmtPct(d.gross_margin)} | Op Margin: ${fmtPct(d.operating_margin)} | Net Margin: ${fmtPct(d.net_margin)}`);
  }
  if (d.roe !== undefined) lines.push(`- ROE: ${fmtPct(d.roe)} | ROIC: ${fmtPct(d.roic)}`);
  if (d.dividend_yield !== undefined) lines.push(`- Dividend Yield: ${fmtPct(d.dividend_yield)}`);
  if (d.debt_to_equity !== undefined) lines.push(`- D/E: ${Number(d.debt_to_equity)?.toFixed(2) ?? '—'}`);
  return lines.join('\n');
}

export function formatHistoricalKeyRatios(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No historical metrics available.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Historical Metrics`, ''];
  lines.push('| Period | P/E | EPS | Rev Growth | Op Margin | ROE |');
  lines.push('|--------|-----|-----|------------|-----------|-----|');
  for (const row of items as Rec[]) {
    lines.push(`| ${fmtDate(row.report_period ?? row.date)} | ${row.pe_ratio ?? '—'} | ${fmtPrice(row.eps)} | ${fmtPct(row.revenue_growth_rate)} | ${fmtPct(row.operating_margin)} | ${fmtPct(row.roe)} |`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Market data formatters
// ---------------------------------------------------------------------------

export function formatStockPrice(data: unknown): string {
  const d = (data && typeof data === 'object') ? data as Rec : {};
  const ticker = (d.ticker as string)?.toUpperCase() ?? '';
  return `${ticker}: ${fmtPrice(d.close ?? d.price)} (H: ${fmtPrice(d.high)} L: ${fmtPrice(d.low)}) Vol: ${fmtNum(d.volume)}`;
}

export function formatStockPrices(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No price history available.';
  const lines = ['Price History', ''];
  lines.push('| Date | Open | Close | Volume |');
  lines.push('|------|------|-------|--------|');
  for (const row of items.slice(0, 20) as Rec[]) {
    lines.push(`| ${row.date ?? '—'} | ${fmtPrice(row.open)} | ${fmtPrice(row.close)} | ${fmtNum(row.volume)} |`);
  }
  if (items.length > 20) lines.push(`... and ${items.length - 20} more rows`);
  return lines.join('\n');
}

export function formatNews(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No news articles found.';
  return items.map((item, i) => {
    const d = item as Rec;
    const date = d.date ? String(d.date).slice(0, 10) : '';
    const source = d.source ?? '';
    return `${i + 1}. ${d.title}${source ? ` — ${source}` : ''}${date ? `, ${date}` : ''}`;
  }).join('\n');
}

export function formatInsiderTrades(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No insider trades found.';
  const lines = ['Insider Trades', ''];
  lines.push('| Name | Title | Type | Shares | Price | Date |');
  lines.push('|------|-------|------|--------|-------|------|');
  for (const row of items.slice(0, 15) as Rec[]) {
    lines.push(`| ${row.full_name ?? row.owner ?? '—'} | ${row.officer_title ?? '—'} | ${row.transaction_type ?? '—'} | ${fmtNum(row.shares ?? row.securities_transacted)} | ${fmtPrice(row.price_per_share)} | ${String(row.filing_date ?? row.transaction_date ?? '').slice(0, 10)} |`);
  }
  return lines.join('\n');
}

export function formatAnalystEstimates(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No analyst estimates available.';
  const lines = ['Analyst Estimates', ''];
  lines.push('| Period | Est. Revenue | Est. EPS | # Analysts |');
  lines.push('|--------|-------------|----------|------------|');
  for (const row of items as Rec[]) {
    lines.push(`| ${fmtDate(row.report_period ?? row.date)} | ${fmtNum(row.estimated_revenue_avg ?? row.revenue_estimate)} | ${fmtPrice(row.estimated_eps_avg ?? row.eps_estimate)} | ${row.number_of_analysts ?? '—'} |`);
  }
  return lines.join('\n');
}

export function formatEarnings(data: unknown): string {
  const d = (data && typeof data === 'object') ? data as Rec : {};
  if (Object.keys(d).length === 0) return 'No earnings data available.';
  const lines: string[] = [];
  if (d.revenue !== undefined) lines.push(`Revenue: ${fmtNum(d.revenue)}`);
  if (d.eps !== undefined) lines.push(`EPS: ${fmtPrice(d.eps)}`);
  if (d.revenue_surprise !== undefined) lines.push(`Revenue Surprise: ${fmtPct(d.revenue_surprise)}`);
  if (d.eps_surprise !== undefined) lines.push(`EPS Surprise: ${fmtPct(d.eps_surprise)}`);
  return lines.length > 0 ? lines.join('\n') : JSON.stringify(d);
}

export function formatCryptoPrice(data: unknown): string {
  const d = (data && typeof data === 'object') ? data as Rec : {};
  const ticker = (d.ticker as string)?.toUpperCase() ?? '';
  return `${ticker}: ${fmtPrice(d.close ?? d.price)} (H: ${fmtPrice(d.high)} L: ${fmtPrice(d.low)}) Vol: ${fmtNum(d.volume)}`;
}

export function formatSegmentedRevenues(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No segment data available.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Revenue Segments`, ''];
  for (const period of items as Rec[]) {
    lines.push(`**${fmtDate(period.report_period)}**`);
    const segments = (period.segments ?? period.revenue_segments) as Rec[] | undefined;
    if (Array.isArray(segments)) {
      for (const seg of segments) {
        lines.push(`- ${seg.label ?? seg.name ?? 'Unknown'}: ${fmtNum(seg.value ?? seg.revenue)}`);
      }
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Formatter registry — maps sub-tool names to formatters
// ---------------------------------------------------------------------------

export const FINANCIAL_FORMATTERS: Record<string, (data: unknown, args?: Rec) => string> = {
  get_income_statements: formatIncomeStatements,
  get_balance_sheets: formatBalanceSheets,
  get_cash_flow_statements: formatCashFlowStatements,
  get_all_financial_statements: formatAllFinancials,
  get_key_ratios: formatKeyRatios,
  get_historical_key_ratios: formatHistoricalKeyRatios,
  get_analyst_estimates: formatAnalystEstimates,
  get_earnings: formatEarnings,
  get_segmented_revenues: formatSegmentedRevenues,
};

export const MARKET_DATA_FORMATTERS: Record<string, (data: unknown, args?: Rec) => string> = {
  get_stock_price_snapshot: formatStockPrice,
  get_stock_prices: formatStockPrices,
  get_crypto_price_snapshot: formatCryptoPrice,
  get_crypto_prices: formatStockPrices,
  get_company_news: formatNews,
  get_insider_trades: formatInsiderTrades,
};
