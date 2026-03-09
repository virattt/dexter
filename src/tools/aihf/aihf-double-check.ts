/**
 * Pure comparison helpers for the AIHF double-check.
 *
 * No HTTP, no file I/O — just normalization and comparison logic.
 * Takes Dexter's sleeve/excluded input + raw AIHF result and produces
 * agreement scores, conflicts, and excluded-but-interesting entries.
 */

import type {
  AihfAction,
  AihfDecision,
  AihfRunResult,
  AihfTickerSignals,
  ConflictEntry,
  DoubleCheckResult,
  DoubleCheckSummary,
  ExcludedEntry,
  ExcludedInterestingEntry,
  TickerEntry,
} from './types.js';

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** AIHF normalized score below this for an included ticker triggers a conflict. */
const CONFLICT_THRESHOLD = -0.3;

/** AIHF normalized score above this for an excluded ticker flags it as interesting. */
const EXCLUDED_INTERESTING_THRESHOLD = 0.5;

/** Minimum raw AIHF confidence (0-100) to surface a conflict or interesting entry. */
const MIN_CONFIDENCE_RAW = 70;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CompareInput {
  defaultIncluded: TickerEntry[];
  hyperliquidIncluded: TickerEntry[];
  excluded: ExcludedEntry[];
}

export function comparePortfolioVsAihf(
  input: CompareInput,
  aihf: AihfRunResult,
): DoubleCheckResult {
  const allIncluded = [
    ...input.defaultIncluded.map((t) => ({ ...t, sleeve: 'default' as const })),
    ...input.hyperliquidIncluded.map((t) => ({ ...t, sleeve: 'hyperliquid' as const })),
  ];

  const tickersRequested =
    allIncluded.length + input.excluded.length;

  const tickersValidated = Object.keys(aihf.decisions).length;

  // --- Included ticker analysis ---
  let agreements = 0;
  const conflicts: ConflictEntry[] = [];

  for (const entry of allIncluded) {
    const ticker = entry.ticker.toUpperCase();
    const decision = aihf.decisions[ticker];
    if (!decision) continue;

    const score = normalizeDecision(decision, aihf.analyst_signals[ticker]);

    if (score >= 0) {
      agreements++;
    } else if (score <= CONFLICT_THRESHOLD && decision.confidence >= MIN_CONFIDENCE_RAW) {
      conflicts.push({
        ticker,
        sleeve: entry.sleeve,
        dexter_stance: `in @ ${entry.weight ?? '?'}%`,
        aihf_stance: decision.action.toUpperCase(),
        aihf_confidence: round2(decision.confidence / 100),
        note: buildConflictNote(decision),
      });
    } else {
      agreements++;
    }
  }

  const includedWithDecisions = allIncluded.filter(
    (e) => aihf.decisions[e.ticker.toUpperCase()],
  ).length;

  const agreementPct = includedWithDecisions > 0
    ? round2(agreements / includedWithDecisions)
    : 1;

  // --- Excluded ticker analysis ---
  const excludedInteresting: ExcludedInterestingEntry[] = [];

  for (const entry of input.excluded) {
    const ticker = entry.ticker.toUpperCase();
    const decision = aihf.decisions[ticker];
    if (!decision) continue;

    const score = normalizeDecision(decision, aihf.analyst_signals[ticker]);

    if (score >= EXCLUDED_INTERESTING_THRESHOLD && decision.confidence >= MIN_CONFIDENCE_RAW) {
      excludedInteresting.push({
        ticker,
        dexter_reason: entry.reason,
        aihf_signal: decision.action.toUpperCase(),
        aihf_confidence: round2(decision.confidence / 100),
        suggested_action: buildExcludedNote(entry, decision),
      });
    }
  }

  const summary: DoubleCheckSummary = {
    included_agreement_pct: agreementPct,
    conflict_count: conflicts.length,
    excluded_interesting_count: excludedInteresting.length,
  };

  return {
    summary,
    conflicts,
    excluded_interesting: excludedInteresting,
    aihf_raw_meta: {
      tickers_validated: tickersValidated,
      tickers_requested: tickersRequested,
      timeout: false,
      partial: tickersValidated < tickersRequested,
    },
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Produce a normalized score in [-1, 1] for a ticker.
 *
 * Weighting:
 *   60% portfolio manager confidence (signed by action direction)
 *   40% analyst consensus (fraction bullish - fraction bearish)
 */
export function normalizeDecision(
  decision: AihfDecision,
  analystSignals?: AihfTickerSignals,
): number {
  const direction = actionDirection(decision.action);
  const pmScore = direction * (decision.confidence / 100);

  let analystScore = 0;
  if (analystSignals) {
    const signals = Object.values(analystSignals);
    if (signals.length > 0) {
      const bullish = signals.filter((s) => s.signal === 'bullish').length;
      const bearish = signals.filter((s) => s.signal === 'bearish').length;
      analystScore = (bullish - bearish) / signals.length;
    }
  }

  return 0.6 * pmScore + 0.4 * analystScore;
}

function actionDirection(action: AihfAction): number {
  switch (action) {
    case 'buy':
    case 'hold':
    case 'cover':
      return 1;
    case 'sell':
    case 'short':
      return -1;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Report rendering (markdown)
// ---------------------------------------------------------------------------

export function renderDoubleCheckMarkdown(result: DoubleCheckResult, date: string): string {
  const lines: string[] = [];

  lines.push(`# AIHF Double-Check Report — ${date}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  const pct = Math.round(result.summary.included_agreement_pct * 100);
  lines.push(
    `${pct}% of included tickers confirmed by AIHF. ` +
      `${result.summary.conflict_count} high-conviction conflict${result.summary.conflict_count === 1 ? '' : 's'} detected. ` +
      `${result.summary.excluded_interesting_count} excluded name${result.summary.excluded_interesting_count === 1 ? '' : 's'} flagged as interesting.`,
  );
  if (result.aihf_raw_meta.partial) {
    lines.push('');
    lines.push(
      `*Note: AIHF validated ${result.aihf_raw_meta.tickers_validated} of ${result.aihf_raw_meta.tickers_requested} tickers. Some may not be supported.*`,
    );
  }
  lines.push('');

  // Conflicts
  lines.push('## High-Conviction Conflicts');
  lines.push('');
  if (result.conflicts.length === 0) {
    lines.push('None. AIHF broadly agrees with Dexter on included names.');
  } else {
    lines.push('| Ticker | Sleeve | Dexter | AIHF | Confidence | Note |');
    lines.push('|--------|--------|--------|------|------------|------|');
    for (const c of result.conflicts) {
      lines.push(
        `| ${c.ticker} | ${c.sleeve} | ${c.dexter_stance} | ${c.aihf_stance} | ${Math.round(c.aihf_confidence * 100)}% | ${c.note} |`,
      );
    }
  }
  lines.push('');

  // Excluded but interesting
  lines.push('## Excluded But Interesting');
  lines.push('');
  if (result.excluded_interesting.length === 0) {
    lines.push('None. AIHF does not strongly favor any excluded names.');
  } else {
    lines.push('| Ticker | Dexter Reason | AIHF Signal | Confidence | Suggested Action |');
    lines.push('|--------|---------------|-------------|------------|------------------|');
    for (const e of result.excluded_interesting) {
      lines.push(
        `| ${e.ticker} | ${e.dexter_reason} | ${e.aihf_signal} | ${Math.round(e.aihf_confidence * 100)}% | ${e.suggested_action} |`,
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConflictNote(decision: AihfDecision): string {
  const verb = decision.action === 'sell' ? 'bearish' : 'strongly negative';
  const short = decision.reasoning.length > 120
    ? decision.reasoning.slice(0, 117) + '...'
    : decision.reasoning;
  return `AIHF ${verb}; ${short}`;
}

function buildExcludedNote(entry: ExcludedEntry, decision: AihfDecision): string {
  const sleeve = entry.sleeve && entry.sleeve !== 'either' ? ` to ${entry.sleeve} sleeve` : '';
  return `Consider revisiting${sleeve}; AIHF signals ${decision.action.toUpperCase()} with ${decision.confidence}% confidence.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
