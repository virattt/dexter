/**
 * Terminal chart rendering for financial data.
 *
 * Detects chartable markdown tables and appends Unicode
 * bar charts or sparklines below them.
 */

import chalk from 'chalk';
import { colors, dimensions } from '../theme.js';
import { parseMarkdownTable } from './markdown-table.js';

// ── Types ──────────────────────────────────────────────────

interface ChartData {
  labels: string[];
  values: number[];
  header: string;
  valueHeader: string;
}

type ChartType = 'bar' | 'sparkline';

interface ChartOpportunity {
  type: ChartType;
  data: ChartData;
}

// ── Number formatting ──────────────────────────────────────

const SUFFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** Format large numbers compactly: 1234567890 → "1.2B" */
export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  for (const [threshold, suffix] of SUFFIXES) {
    if (abs >= threshold) {
      const scaled = value / threshold;
      const formatted = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
      return `$${formatted}${suffix}`;
    }
  }
  return `$${value.toLocaleString('en-US')}`;
}

/** Strip currency symbols, commas, and suffix multipliers to get a raw number. */
export function parseNumericValue(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  // Match optional sign, optional $, digits with commas/dots, optional suffix
  const m = cleaned.match(/^[($-]*\$?\s*([-+]?[\d,]+\.?\d*)\s*([TBMK%]?)[\s)]*$/i);
  if (!m) return null;

  let num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return null;

  const suffix = m[2].toUpperCase();
  if (suffix === 'T') num *= 1e12;
  else if (suffix === 'B') num *= 1e9;
  else if (suffix === 'M') num *= 1e6;
  else if (suffix === 'K') num *= 1e3;

  if (cleaned.startsWith('(') || cleaned.startsWith('-')) {
    num = -Math.abs(num);
  }

  return num;
}

// ── Date detection ─────────────────────────────────────────

const DATE_PATTERNS = [
  /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/, // 2024-01, 2024-01-15
  /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/,  // 01/15/2024
  /^(Q[1-4])\s*\d{4}$/i,               // Q1 2024
  /^(FY|CY)?\s*\d{4}$/i,               // FY2024, 2024
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // Jan 2024
];

function looksLikeDate(value: string): boolean {
  return DATE_PATTERNS.some((p) => p.test(value.trim()));
}

// ── Chart detection ────────────────────────────────────────

/**
 * Analyze a parsed table and determine if it's suitable for charting.
 * Returns null if the table isn't a good chart candidate.
 */
export function detectChartOpportunity(
  headers: string[],
  rows: string[][],
): ChartOpportunity | null {
  if (headers.length < 2 || rows.length < 2) return null;

  // Find the first numeric column (skip first column — likely labels)
  let valueColIdx = -1;
  for (let col = 1; col < headers.length; col++) {
    const numericCount = rows.filter((r) => parseNumericValue(r[col] ?? '') !== null).length;
    if (numericCount >= rows.length * 0.6) {
      valueColIdx = col;
      break;
    }
  }
  if (valueColIdx === -1) return null;

  const labels = rows.map((r) => r[0]?.trim() ?? '');
  const values = rows.map((r) => parseNumericValue(r[valueColIdx] ?? '') ?? 0);

  const data: ChartData = {
    labels,
    values,
    header: headers[0],
    valueHeader: headers[valueColIdx],
  };

  // If labels look like dates → sparkline, otherwise → bar
  const dateCount = labels.filter(looksLikeDate).length;
  const type: ChartType = dateCount >= labels.length * 0.6 ? 'sparkline' : 'bar';

  return { type, data };
}

// ── Bar chart renderer ─────────────────────────────────────

const BAR_BLOCKS = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];

function buildBar(ratio: number, maxWidth: number): string {
  const fullBlocks = Math.floor(ratio * maxWidth);
  const remainder = (ratio * maxWidth) - fullBlocks;
  const partialIdx = Math.round(remainder * (BAR_BLOCKS.length - 1));

  let bar = '█'.repeat(fullBlocks);
  if (partialIdx > 0 && fullBlocks < maxWidth) {
    bar += BAR_BLOCKS[partialIdx];
  }
  return bar || BAR_BLOCKS[0]; // At least one sliver
}

export function renderBarChart(data: ChartData): string {
  const { labels, values, valueHeader } = data;
  if (labels.length === 0) return '';

  const maxVal = Math.max(...values.map(Math.abs));
  if (maxVal === 0) return '';

  const maxLabelLen = Math.min(
    Math.max(...labels.map((l) => l.length)),
    16,
  );
  const formattedValues = values.map(formatCompactNumber);
  const maxValLen = Math.max(...formattedValues.map((v) => v.length));
  const barMaxWidth = Math.max(dimensions.boxWidth - maxLabelLen - maxValLen - 6, 10); // padding, min 10

  const lines: string[] = [];
  lines.push(`  📊 ${valueHeader}`);
  lines.push('');

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].slice(0, 16).padEnd(maxLabelLen);
    const ratio = Math.abs(values[i]) / maxVal;
    const bar = chalk.hex(colors.primary)(buildBar(ratio, barMaxWidth));
    const valStr = formattedValues[i].padStart(maxValLen);
    lines.push(`  ${label}  ${bar}  ${valStr}`);
  }

  return lines.join('\n');
}

// ── Sparkline renderer ─────────────────────────────────────

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function renderSparkline(data: ChartData): string {
  const { labels, values, valueHeader } = data;
  if (values.length < 2) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const spark = values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    })
    .join('');

  const first = values[0];
  const last = values[values.length - 1];
  const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;

  const firstLabel = labels[0] ?? '';
  const lastLabel = labels[labels.length - 1] ?? '';
  const period = firstLabel && lastLabel ? ` (${firstLabel}–${lastLabel})` : '';

  const lines: string[] = [];
  lines.push(`  📈 ${valueHeader}${period}`);
  lines.push(
    `  ${chalk.hex(colors.primary)(spark)}  ${formatCompactNumber(first)} → ${formatCompactNumber(last)} ${change >= 0 ? chalk.green(changeStr) : chalk.red(changeStr)}`,
  );

  return lines.join('\n');
}

// ── Integration ────────────────────────────────────────────

/**
 * Scan content for markdown tables, detect chart opportunities,
 * and append charts below each qualifying table.
 */
export function transformChartsInResponse(content: string): string {
  // Match markdown tables (lines with pipes, including separator)
  const tableRegex = /^(\|[^\n]+\|\n\|[-:| \t]+\|(?:\n\|[^\n]+\|)*)/gm;

  return content.replace(tableRegex, (match) => {
    const parsed = parseMarkdownTable(match);
    if (!parsed || parsed.headers.length < 2 || parsed.rows.length < 2) {
      return match;
    }

    const opportunity = detectChartOpportunity(parsed.headers, parsed.rows);
    if (!opportunity) return match;

    const chart =
      opportunity.type === 'sparkline'
        ? renderSparkline(opportunity.data)
        : renderBarChart(opportunity.data);

    if (!chart) return match;

    return `${match}\n\n${chart}`;
  });
}
