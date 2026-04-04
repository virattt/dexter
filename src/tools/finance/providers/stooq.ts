/**
 * Stooq.com 株価プロバイダー
 * 無料・APIキー不要・日本株対応（4桁コード + .jp）
 * URL例: https://stooq.com/q/d/l/?s=7203.jp&d1=20240101&d2=20260101&i=d
 */

export interface QuoteRecord {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjustmentClose: number | null;
}

/** 4桁証券コード → stooq シンボル */
function toStooqSymbol(code: string): string {
  return `${code.padStart(4, '0')}.jp`;
}

/** YYYY-MM-DD → YYYYMMDD */
function formatDate(date: string): string {
  return date.replace(/-/g, '');
}

/** CSV 文字列をパース */
function parseCsv(csv: string): QuoteRecord[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  // Header: Date,Open,High,Low,Close,Volume
  const records: QuoteRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    const close = parseFloat(cols[4]);
    if (isNaN(close)) continue; // stooq returns "No data" rows sometimes
    records.push({
      date: cols[0],
      open: parseFloat(cols[1]) || null,
      high: parseFloat(cols[2]) || null,
      low: parseFloat(cols[3]) || null,
      close,
      volume: cols[5] ? (parseFloat(cols[5]) || null) : null,
      adjustmentClose: close, // stooq returns adjusted prices by default
    });
  }
  return records;
}

export async function fetchStooqPrices(
  code: string,
  from: string,
  to: string,
): Promise<{ records: QuoteRecord[]; url: string }> {
  const symbol = toStooqSymbol(code);
  const d1 = formatDate(from);
  const d2 = formatDate(to);
  const url = `https://stooq.com/q/d/l/?s=${symbol}&d1=${d1}&d2=${d2}&i=d`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response.ok) {
    throw new Error(`[Stooq] request failed: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  if (csv.includes('No data') || !csv.includes(',')) {
    return { records: [], url };
  }

  const records = parseCsv(csv);
  return { records, url };
}
