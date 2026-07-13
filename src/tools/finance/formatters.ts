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

function fmtRatio(n: unknown): string {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return num.toFixed(1);
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

// Period label for statement/metric rows. Prefers the API's authoritative
// fiscal_period ("FY2026", "2027-Q1") — deriving a calendar quarter from
// report_period mislabels annual rows as "Q1 26" and misassigns quarters for
// non-calendar fiscal years (e.g. NVDA's late-January year-end).
function fmtPeriod(row: Rec): string {
  if (row.fiscal_period) return String(row.fiscal_period);
  return fmtDate(row.report_period ?? row.date);
}

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
    lines.push(`| ${fmtPeriod(row)} | ${fmtNum(row.revenue)} | ${fmtNum(row.operating_income)} | ${fmtNum(row.net_income)} | ${fmtPrice(row.earnings_per_share ?? row.basic_earnings_per_share)} |`);
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
    lines.push(`| ${fmtPeriod(row)} | ${fmtNum(row.total_assets)} | ${fmtNum(row.total_liabilities)} | ${fmtNum(row.shareholders_equity ?? row.total_equity)} | ${fmtNum(row.cash_and_equivalents)} |`);
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
    // capital_expenditure is often null; the capex outflow lands in
    // property_plant_and_equipment. Prefer the API's own free_cash_flow.
    const capex = Math.abs(Number(row.capital_expenditure ?? row.property_plant_and_equipment ?? 0));
    const fcf = row.free_cash_flow != null ? Number(row.free_cash_flow) : opCF - capex;
    lines.push(`| ${fmtPeriod(row)} | ${fmtNum(opCF)} | ${fmtNum(capex)} | ${fmtNum(fcf)} |`);
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
  lines.push(`- P/E: ${fmtRatio(d.price_to_earnings_ratio)} | P/S: ${fmtRatio(d.price_to_sales_ratio)} | P/B: ${fmtRatio(d.price_to_book_ratio)} | EPS: ${fmtPrice(d.earnings_per_share)}`);
  lines.push(`- Revenue Growth: ${fmtPct(d.revenue_growth)} | Earnings Growth: ${fmtPct(d.earnings_growth)}`);
  if (d.gross_margin !== undefined || d.operating_margin !== undefined || d.net_margin !== undefined) {
    lines.push(`- Gross Margin: ${fmtPct(d.gross_margin)} | Op Margin: ${fmtPct(d.operating_margin)} | Net Margin: ${fmtPct(d.net_margin)}`);
  }
  if (d.return_on_equity !== undefined) lines.push(`- ROE: ${fmtPct(d.return_on_equity)} | ROIC: ${fmtPct(d.return_on_invested_capital)}`);
  if (d.debt_to_equity !== undefined) lines.push(`- D/E: ${fmtRatio(d.debt_to_equity)}`);
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
    lines.push(`| ${fmtPeriod(row)} | ${fmtRatio(row.price_to_earnings_ratio)} | ${fmtPrice(row.earnings_per_share)} | ${fmtPct(row.revenue_growth)} | ${fmtPct(row.operating_margin)} | ${fmtPct(row.return_on_equity)} |`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Market data formatters
// ---------------------------------------------------------------------------

export function formatStockPrice(data: unknown): string {
  const d = (data && typeof data === 'object') ? data as Rec : {};
  const ticker = (d.ticker as string)?.toUpperCase() ?? '';
  // The /prices/snapshot/ endpoint is a last-trade snapshot: price + day change,
  // no OHLC/volume. Show the day move instead of blank H/L/Vol columns.
  const chg = d.day_change_percent != null
    ? ` (${Number(d.day_change_percent) >= 0 ? '+' : ''}${Number(d.day_change_percent).toFixed(2)}% today)`
    : '';
  return `${ticker}: ${fmtPrice(d.price ?? d.close)}${chg}`;
}

export function formatStockPrices(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No price history available.';
  const lines = ['Price History', ''];
  lines.push('| Date | Open | Close | Volume |');
  lines.push('|------|------|-------|--------|');
  for (const row of items.slice(0, 20) as Rec[]) {
    lines.push(`| ${row.time ?? row.date ?? '—'} | ${fmtPrice(row.open)} | ${fmtPrice(row.close)} | ${fmtNum(row.volume)} |`);
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
  // Totals cover ALL rows so aggregate questions ("how much did X sell?")
  // are answerable even though the table below is truncated.
  const totals = new Map<string, { count: number; shares: number; value: number }>();
  for (const row of items as Rec[]) {
    const type = String(row.transaction_type ?? 'Other');
    const t = totals.get(type) ?? { count: 0, shares: 0, value: 0 };
    t.count += 1;
    t.shares += Number(row.transaction_shares) || 0;
    t.value += Number(row.transaction_value) || 0;
    totals.set(type, t);
  }
  const lines = [`Insider Trades — ${items.length} transactions`, ''];
  lines.push('Totals by type (all rows):');
  for (const [type, t] of totals) {
    lines.push(`- ${type}: ${t.count} txns, ${fmtNum(t.shares)} shares, $${fmtNum(t.value)}`);
  }
  lines.push('');
  lines.push('| Name | Title | Type | Shares | Price | Value | Owned After | Date |');
  lines.push('|------|-------|------|--------|-------|-------|-------------|------|');
  for (const row of items.slice(0, 15) as Rec[]) {
    const title = row.title ?? (row.is_board_director ? 'Director' : '—');
    lines.push(`| ${row.name ?? '—'} | ${title} | ${row.transaction_type ?? '—'} | ${fmtNum(row.transaction_shares)} | ${fmtPrice(row.transaction_price_per_share)} | ${fmtNum(row.transaction_value)} | ${fmtNum(row.shares_owned_after_transaction)} | ${String(row.filing_date ?? row.transaction_date ?? '').slice(0, 10)} |`);
  }
  if (items.length > 15) lines.push(`... and ${items.length - 15} more rows (totals above cover all rows)`);
  return lines.join('\n');
}

export function formatInsiderNames(data: unknown, args?: Rec): string {
  const names = Array.isArray(data) ? data : [];
  if (names.length === 0) return 'No insider names found.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  return `Insider names${ticker ? ` — ${ticker}` : ''} (exact SEC filing spellings, use verbatim as the name filter):\n${names.join('; ')}`;
}

export function formatInsiderOwnership(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No Form 3/5 ownership statements on file for this ticker. This is normal — many insiders report via Form 4 transactions instead (see get_insider_trades). Absence here does not imply missing coverage.';
  const lines = ['Insider Ownership', ''];
  lines.push('| Name | Title | Form | Holding | Security | Shares | D/I | As of |');
  lines.push('|------|-------|------|---------|----------|--------|-----|-------|');
  for (const row of items.slice(0, 15) as Rec[]) {
    // Derivative rows (options, RSUs) report their size as underlying shares.
    const shares = row.shares_owned ?? row.underlying_security_shares;
    lines.push(`| ${row.name ?? '—'} | ${row.title ?? '—'} | ${row.form_type ?? '—'} | ${row.holding_type ?? '—'} | ${row.security_title ?? '—'} | ${fmtNum(shares)} | ${row.direct_or_indirect ?? '—'} | ${String(row.as_of_date ?? row.filing_date ?? '').slice(0, 10)} |`);
  }
  return lines.join('\n');
}

export function formatBeneficialOwnership(data: unknown): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No beneficial ownership stakes found.';
  const lines = ['Beneficial Ownership (5%+ stakes)', ''];
  lines.push('| Owner | Ticker | Type | Form | % of Class | Shares | Filed |');
  lines.push('|-------|--------|------|------|------------|--------|-------|');
  for (const row of items.slice(0, 15) as Rec[]) {
    const pct = row.percent_of_class != null ? `${row.percent_of_class}%` : '—';
    lines.push(`| ${row.reporting_person_name ?? '—'} | ${row.ticker ?? '—'} | ${row.type ?? '—'} | ${row.form_type ?? '—'} | ${pct} | ${fmtNum(row.aggregate_amount_beneficially_owned)} | ${String(row.filing_date ?? '').slice(0, 10)} |`);
  }
  return lines.join('\n');
}

export function formatInstitutionalHoldings(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No institutional holdings found.';
  const byTicker = Boolean(args?.ticker);
  const lines: string[] = [];
  if (byTicker) {
    const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
    lines.push(`Institutional Holders — ${ticker}`, '');
    lines.push('| Filer | Shares | Value (USD) | Report |');
    lines.push('|-------|--------|-------------|--------|');
    for (const row of items.slice(0, 15) as Rec[]) {
      lines.push(`| ${row.filer_name ?? row.filer_cik ?? '—'} | ${fmtNum(row.shares)} | ${fmtNum(row.value_usd)} | ${fmtDate(row.report_period)} |`);
    }
  } else {
    const filer = ((items[0] as Rec)?.filer_name as string)
      ?? (args?.filer_name as string)
      ?? (args?.filer_cik as string)
      ?? '';
    lines.push(`13F Holdings — ${filer}`, '');
    lines.push('| Issuer | Ticker | Shares | Value (USD) | Report |');
    lines.push('|--------|--------|--------|-------------|--------|');
    for (const row of items.slice(0, 15) as Rec[]) {
      lines.push(`| ${row.name_of_issuer ?? '—'} | ${row.ticker ?? '—'} | ${fmtNum(row.shares)} | ${fmtNum(row.value_usd)} | ${fmtDate(row.report_period)} |`);
    }
  }
  if (items.length > 15) lines.push('', `(showing 15 of ${items.length})`);
  return lines.join('\n');
}

export function formatEarnings(data: unknown, args?: Rec): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return 'No earnings data available.';

    const rows = data as Rec[];
    const ticker = (args?.ticker as string | undefined)?.toUpperCase();
    const cell = (value: unknown) => String(value ?? '—').replace(/\|/g, '\\|');
    const title = ticker
      ? `${ticker} Earnings`
      : (rows.length === 1
        ? `${String(rows[0].ticker ?? '').toUpperCase()} Earnings`
        : 'Latest Earnings Feed');
    const lines = [title, ''];
    lines.push('| Ticker | Period | Fiscal | Source | Filed | Revenue | EPS | Signals |');
    lines.push('|--------|--------|--------|--------|-------|---------|-----|---------|');

    for (const row of rows.slice(0, 15)) {
      const figures = ((row.quarterly ?? row.annual) && typeof (row.quarterly ?? row.annual) === 'object')
        ? (row.quarterly ?? row.annual) as Rec
        : {};
      const eps = figures.earnings_per_share ?? figures.eps;
      const signals = Array.isArray(row.signals)
        ? row.signals
          .slice(0, 2)
          .map((signal) => signal && typeof signal === 'object' ? (signal as Rec).headline : null)
          .filter(Boolean)
          .join('; ')
        : '';

      lines.push(`| ${cell(String(row.ticker ?? '—').toUpperCase())} | ${cell(fmtPeriod(row))} | ${cell(row.fiscal_period)} | ${cell(row.source_type)} | ${cell(String(row.filing_date ?? '—').slice(0, 10))} | ${cell(fmtNum(figures.revenue))} | ${cell(fmtPrice(eps))} | ${cell(signals || '—')} |`);
    }

    if (rows.length > 15) lines.push('', `(showing 15 of ${rows.length})`);
    return lines.join('\n');
  }

  const d = (data && typeof data === 'object') ? data as Rec : {};
  if (Object.keys(d).length === 0) return 'No earnings data available.';
  // Flat shape: each entry IS one filing. data.earnings[0] (already unwrapped upstream)
  // lands on the most recent period's 8-K when present (sorted report_period DESC, filing_date ASC).
  const figures = ((d.quarterly ?? d.annual) && typeof (d.quarterly ?? d.annual) === 'object')
    ? (d.quarterly ?? d.annual) as Rec
    : {};
  const ticker = (d.ticker as string)?.toUpperCase() ?? '';
  const lines: string[] = [];
  const header = `${ticker} Earnings — ${fmtDate(d.report_period)}${d.fiscal_period ? ` (${d.fiscal_period})` : ''}${d.currency ? ` [${d.currency}]` : ''}`;
  lines.push(header.trim());
  lines.push('');
  lines.push(`Source: ${d.source_type ?? '—'} | Filed: ${String(d.filing_date ?? '—').slice(0, 10)} | Accession: ${d.accession_number ?? '—'}`);
  if (figures.revenue !== undefined) lines.push(`Revenue: ${fmtNum(figures.revenue)}`);
  if (figures.net_income !== undefined) lines.push(`Net Income: ${fmtNum(figures.net_income)}`);
  const eps = figures.earnings_per_share ?? figures.eps;
  if (eps !== undefined) lines.push(`EPS: ${fmtPrice(eps)}`);
  // *_surprise holds the BEAT/MISS/MEET label; the magnitude is in *_surprise_pct.
  if (figures.revenue_surprise !== undefined) lines.push(`Revenue Surprise: ${figures.revenue_surprise}${figures.revenue_surprise_pct != null ? ` (${fmtPct(figures.revenue_surprise_pct)})` : ''}`);
  if (figures.eps_surprise !== undefined) lines.push(`EPS Surprise: ${figures.eps_surprise}${figures.eps_surprise_pct != null ? ` (${fmtPct(figures.eps_surprise_pct)})` : ''}`);
  return lines.join('\n');
}

export function formatCryptoPrice(data: unknown): string {
  const d = (data && typeof data === 'object') ? data as Rec : {};
  const ticker = (d.ticker as string)?.toUpperCase() ?? '';
  // Only surface OHLC/volume when the snapshot actually carries them; the
  // last-trade snapshot has just price + day change.
  const extras: string[] = [];
  if (d.high != null || d.low != null) extras.push(`H: ${fmtPrice(d.high)} L: ${fmtPrice(d.low)}`);
  if (d.volume != null) extras.push(`Vol: ${fmtNum(d.volume)}`);
  if (d.day_change_percent != null) extras.push(`${Number(d.day_change_percent) >= 0 ? '+' : ''}${Number(d.day_change_percent).toFixed(2)}% today`);
  return `${ticker}: ${fmtPrice(d.price ?? d.close)}${extras.length ? ` (${extras.join(' ')})` : ''}`;
}

export function formatFinancialSegments(data: unknown, args?: Rec): string {
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'No segment data available.';
  const ticker = (args?.ticker as string)?.toUpperCase() ?? '';
  const lines = [`${ticker} Financial Segments`, ''];

  const STATEMENTS = ['income_statement', 'balance_sheet', 'cash_flow_statement'] as const;

  for (const period of items as Rec[]) {
    const header = period.fiscal_period
      ? `${fmtDate(period.report_period)} (${period.fiscal_period})`
      : fmtDate(period.report_period);
    lines.push(`**${header}**`);

    let wroteAny = false;
    for (const statementKey of STATEMENTS) {
      const statement = period[statementKey] as Rec | null | undefined;
      if (!statement || typeof statement !== 'object') continue;

      for (const [metricName, metricValue] of Object.entries(statement)) {
        if (!metricValue || typeof metricValue !== 'object') continue;
        const breakdowns = metricValue as Rec;

        for (const [axisName, axisValue] of Object.entries(breakdowns)) {
          if (!Array.isArray(axisValue) || axisValue.length === 0) continue;
          const metricLabel = formatLabel(metricName);
          const axisLabel = formatLabel(axisName);
          lines.push(`${metricLabel} · ${axisLabel}:`);
          for (const entry of axisValue as Rec[]) {
            const label = entry.label ?? entry.name ?? 'Unknown';
            lines.push(`- ${label}: ${fmtNum(entry.value ?? entry.revenue)}`);
          }
          wroteAny = true;
        }
      }
    }
    if (!wroteAny) {
      lines.push('No segment breakdowns reported.');
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function formatLabel(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
  get_earnings: formatEarnings,
  get_financial_segments: formatFinancialSegments,
};

export const MARKET_DATA_FORMATTERS: Record<string, (data: unknown, args?: Rec) => string> = {
  get_stock_price: formatStockPrice,
  get_stock_prices: formatStockPrices,
  get_crypto_price_snapshot: formatCryptoPrice,
  get_crypto_prices: formatStockPrices,
  get_company_news: formatNews,
  get_insider_trades: formatInsiderTrades,
  get_insider_names: formatInsiderNames,
  get_insider_ownership: formatInsiderOwnership,
  get_institutional_holdings: formatInstitutionalHoldings,
  get_beneficial_ownership: formatBeneficialOwnership,
};
