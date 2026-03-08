/**
 * Parse HIP-3 target allocation from HEARTBEAT.md or SOUL-HL.md.
 * Canonical format: Ticker | TargetMin | TargetMax | Category | Notes (one row per ticker, numbers as %).
 */

export interface HIP3TargetRow {
  ticker: string;
  targetMin: number;
  targetMax: number;
  category: string;
  notes: string;
}

const SECTION_HEADERS = /^##\s+(HIP-3 Target|Target Allocation)(\s|$)/im;

function parseNum(s: string): number {
  const v = parseFloat(String(s).replace('%', '').trim());
  return Number.isNaN(v) ? 0 : v;
}

/**
 * Extract the first table after a HIP-3 Target / Target Allocation section.
 * Expected columns: Ticker | TargetMin | TargetMax | Category | Notes (order matters).
 */
export function parseHIP3TargetMarkdown(content: string): HIP3TargetRow[] {
  const rows: HIP3TargetRow[] = [];
  const lines = content.split('\n');
  let inSection = false;
  let tableStarted = false;
  const headerKeys = /^(ticker|targetmin|targetmax|category|notes)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (SECTION_HEADERS.test(trimmed)) {
      inSection = true;
      tableStarted = false;
      continue;
    }
    if (inSection && trimmed.startsWith('##')) {
      break;
    }
    if (!inSection) continue;

    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;

    const ticker = (parts[0] ?? '').toUpperCase();
    if (!ticker || headerKeys.test(ticker) || /^[-—]+$/.test(ticker)) continue;

    const targetMin = parseNum(parts[1] ?? '0');
    const targetMax = parseNum(parts[2] ?? '0');
    const category = (parts[3] ?? '').trim();
    const notes = (parts[4] ?? '').trim();
    rows.push({ ticker, targetMin, targetMax, category, notes });
    tableStarted = true;
  }

  return rows;
}

/**
 * Get midpoint target for a row (average of targetMin and targetMax).
 */
export function targetMidpoint(row: HIP3TargetRow): number {
  return (row.targetMin + row.targetMax) / 2;
}
