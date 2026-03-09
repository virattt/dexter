/**
 * aihf_double_check tool.
 *
 * Sends Dexter's included + excluded tickers to AI Hedge Fund,
 * normalizes the multi-agent response, and returns a structured
 * second-opinion report. Advisory only — never mutates portfolio files.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { callAIHF, AihfError } from './aihf-api.js';
import { comparePortfolioVsAihf, renderDoubleCheckMarkdown } from './aihf-double-check.js';
import { recordRun } from './feedback.js';
import { parsePortfolioMarkdown } from '../../utils/portfolio-parse.js';
import { dexterPath } from '../../utils/paths.js';
import type { TickerEntry, ExcludedEntry, DoubleCheckResult } from './types.js';

const DEXTER_DIR = dexterPath();
const PORTFOLIO_MD_PATH = dexterPath('PORTFOLIO.md');
const PORTFOLIO_HL_PATH = dexterPath('PORTFOLIO-HYPERLIQUID.md');

// ---------------------------------------------------------------------------
// Tool description (injected into system prompt via registry)
// ---------------------------------------------------------------------------

export const AIHF_DOUBLE_CHECK_DESCRIPTION = `
Run AI Hedge Fund's 18 analyst agents as a **second opinion** on Dexter's portfolio.

## When to Use

- User asks for a "double-check", "second opinion", "validate portfolio", or "run AIHF"
- After generating a two-sleeve portfolio suggestion, offer to run the double-check
- User asks "what does the hedge fund think?" or similar

## Actions

- **run**: Send included + excluded tickers to AIHF. Produces a structured report with:
  - Agreement score (% of included names AIHF confirms)
  - High-conviction conflicts (AIHF strongly disagrees with Dexter)
  - Excluded but interesting (names Dexter left out that AIHF likes)
  Saves the report to .dexter/AIHF-DOUBLE-CHECK-YYYY-MM-DD.md

- **view_last**: Read the most recent double-check report from disk.

## Important

- This is **advisory only**. Never auto-modify PORTFOLIO.md or PORTFOLIO-HYPERLIQUID.md based on AIHF output.
- If tickers are not provided, the tool reads current PORTFOLIO.md and PORTFOLIO-HYPERLIQUID.md.
- AIHF runs may take 1-3+ minutes. If it times out, the tool suggests a manual CLI command.
- Requires AIHF backend running and AIHF_API_URL configured.
`.trim();

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const tickerEntrySchema = z.object({
  ticker: z.string(),
  weight: z.number().optional(),
  note: z.string().optional(),
});

const excludedEntrySchema = z.object({
  ticker: z.string(),
  reason: z.string(),
  sleeve: z.enum(['default', 'hyperliquid', 'either']).optional(),
});

const aihfSchema = z.object({
  action: z.enum(['run', 'view_last']).describe('Action to perform'),
  default_included: z
    .array(tickerEntrySchema)
    .optional()
    .describe('Tastytrade sleeve tickers. If omitted, reads from PORTFOLIO.md.'),
  hyperliquid_included: z
    .array(tickerEntrySchema)
    .optional()
    .describe('Hyperliquid sleeve tickers. If omitted, reads from PORTFOLIO-HYPERLIQUID.md.'),
  excluded: z
    .array(excludedEntrySchema)
    .optional()
    .describe('Excluded tickers with reasons. Optional.'),
  start_date: z.string().optional().describe('AIHF analysis start date (YYYY-MM-DD). Optional.'),
  end_date: z.string().optional().describe('AIHF analysis end date (YYYY-MM-DD). Defaults to today.'),
  initial_cash: z.number().optional().describe('AIHF initial cash for sizing. Defaults to 100000.'),
});

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const aihfDoubleCheckTool = new DynamicStructuredTool({
  name: 'aihf_double_check',
  description:
    'Run AI Hedge Fund as a second opinion on portfolio tickers. Returns agreement score, conflicts, and excluded-but-interesting names.',
  schema: aihfSchema,
  func: async (input) => {
    if (input.action === 'view_last') {
      return viewLastReport();
    }

    // --- Resolve tickers ---
    const defaultIncluded = input.default_included ?? readPortfolioTickers(PORTFOLIO_MD_PATH);
    const hlIncluded = input.hyperliquid_included ?? readPortfolioTickers(PORTFOLIO_HL_PATH);
    const excluded: ExcludedEntry[] = input.excluded ?? [];

    const allTickers = [
      ...defaultIncluded.map((t) => t.ticker),
      ...hlIncluded.map((t) => t.ticker),
      ...excluded.map((t) => t.ticker),
    ];

    if (allTickers.length === 0) {
      return 'No tickers to validate. Provide tickers or ensure PORTFOLIO.md / PORTFOLIO-HYPERLIQUID.md exist.';
    }

    const uniqueTickers = [...new Set(allTickers.map((t) => t.toUpperCase()))];

    // --- Call AIHF ---
    let aihfResult;
    try {
      aihfResult = await callAIHF({
        tickers: uniqueTickers,
        startDate: input.start_date ?? null,
        endDate: input.end_date,
        initialCash: input.initial_cash,
      });
    } catch (err) {
      if (err instanceof AihfError) {
        return `AIHF double-check unavailable: ${err.message}`;
      }
      return `AIHF double-check failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // --- Compare ---
    const result = comparePortfolioVsAihf(
      { defaultIncluded, hyperliquidIncluded: hlIncluded, excluded },
      aihfResult,
    );

    // --- Save report + record in feedback history ---
    const date = new Date().toISOString().slice(0, 10);
    const markdown = renderDoubleCheckMarkdown(result, date);
    const filename = `AIHF-DOUBLE-CHECK-${date}.md`;
    saveReport(filename, markdown);
    try { recordRun(result, date); } catch { /* non-critical */ }

    // --- Format tool output ---
    return formatResult(result, filename);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPortfolioTickers(path: string): TickerEntry[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8');
  return parsePortfolioMarkdown(content).map((p) => ({
    ticker: p.ticker,
    weight: p.weight,
  }));
}

function viewLastReport(): string {
  if (!existsSync(DEXTER_DIR)) {
    return 'No double-check reports found. Run a double-check first.';
  }

  const files = readdirSync(DEXTER_DIR)
    .filter((f) => f.startsWith('AIHF-DOUBLE-CHECK-') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return 'No double-check reports found. Run a double-check first.';
  }

  const latest = files[0];
  const content = readFileSync(dexterPath(latest), 'utf-8');
  return `Latest report: .dexter/${latest}\n\n${content}`;
}

function saveReport(filename: string, content: string): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }
  writeFileSync(dexterPath(filename), content, 'utf-8');
}

function formatResult(result: DoubleCheckResult, filename: string): string {
  const lines: string[] = [];

  const pct = Math.round(result.summary.included_agreement_pct * 100);
  lines.push(`## Double-Check Summary`);
  lines.push('');
  lines.push(
    `**${pct}% agreement** on included tickers. ` +
      `**${result.summary.conflict_count} conflict${result.summary.conflict_count === 1 ? '' : 's'}**. ` +
      `**${result.summary.excluded_interesting_count} excluded name${result.summary.excluded_interesting_count === 1 ? '' : 's'}** flagged as interesting.`,
  );

  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push('### High-Conviction Conflicts');
    for (const c of result.conflicts) {
      lines.push(
        `- **${c.ticker}** (${c.sleeve}): Dexter ${c.dexter_stance}, AIHF ${c.aihf_stance} (${Math.round(c.aihf_confidence * 100)}%). ${c.note}`,
      );
    }
  }

  if (result.excluded_interesting.length > 0) {
    lines.push('');
    lines.push('### Excluded But Interesting');
    for (const e of result.excluded_interesting) {
      lines.push(
        `- **${e.ticker}**: Dexter excluded ("${e.dexter_reason}"), but AIHF signals ${e.aihf_signal} (${Math.round(e.aihf_confidence * 100)}%). ${e.suggested_action}`,
      );
    }
  }

  if (result.aihf_raw_meta.partial) {
    lines.push('');
    lines.push(
      `*Note: AIHF validated ${result.aihf_raw_meta.tickers_validated} of ${result.aihf_raw_meta.tickers_requested} tickers.*`,
    );
  }

  lines.push('');
  lines.push(`Full report saved to .dexter/${filename}`);

  return lines.join('\n');
}
