/**
 * AIHF feedback tracking.
 *
 * Records each double-check run into .dexter/aihf-history.json.
 * Over time this lets us measure: did AIHF's conflicts turn out to be
 * prophetic or wrong? Foundation for the self-improvement loop.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { DoubleCheckResult } from './types.js';
import { dexterPath } from '../../utils/paths.js';

const DEXTER_DIR = dexterPath();
const HISTORY_PATH = dexterPath('aihf-history.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  date: string;
  summary: {
    included_agreement_pct: number;
    conflict_count: number;
    excluded_interesting_count: number;
  };
  conflicts: Array<{
    ticker: string;
    sleeve: string;
    aihf_stance: string;
    aihf_confidence: number;
    outcome?: 'aihf_right' | 'dexter_right' | 'mixed' | 'pending';
    outcome_date?: string;
    outcome_note?: string;
  }>;
  excluded_interesting: Array<{
    ticker: string;
    aihf_signal: string;
    aihf_confidence: number;
    outcome?: 'aihf_right' | 'dexter_right' | 'mixed' | 'pending';
    outcome_date?: string;
    outcome_note?: string;
  }>;
}

export interface AihfHistory {
  version: 1;
  entries: HistoryEntry[];
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

export function loadHistory(): AihfHistory {
  if (!existsSync(HISTORY_PATH)) {
    return { version: 1, entries: [] };
  }
  try {
    const raw = readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw) as AihfHistory;
  } catch {
    return { version: 1, entries: [] };
  }
}

function saveHistory(history: AihfHistory): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Record a run
// ---------------------------------------------------------------------------

export function recordRun(result: DoubleCheckResult, date: string): void {
  const history = loadHistory();

  const entry: HistoryEntry = {
    date,
    summary: result.summary,
    conflicts: result.conflicts.map((c) => ({
      ticker: c.ticker,
      sleeve: c.sleeve,
      aihf_stance: c.aihf_stance,
      aihf_confidence: c.aihf_confidence,
      outcome: 'pending',
    })),
    excluded_interesting: result.excluded_interesting.map((e) => ({
      ticker: e.ticker,
      aihf_signal: e.aihf_signal,
      aihf_confidence: e.aihf_confidence,
      outcome: 'pending',
    })),
  };

  history.entries.push(entry);
  saveHistory(history);
}

// ---------------------------------------------------------------------------
// Update outcome for a conflict
// ---------------------------------------------------------------------------

export function updateConflictOutcome(
  date: string,
  ticker: string,
  outcome: 'aihf_right' | 'dexter_right' | 'mixed',
  note?: string,
): boolean {
  const history = loadHistory();
  const entry = history.entries.find((e) => e.date === date);
  if (!entry) return false;

  const conflict = entry.conflicts.find((c) => c.ticker === ticker);
  if (!conflict) return false;

  conflict.outcome = outcome;
  conflict.outcome_date = new Date().toISOString().slice(0, 10);
  conflict.outcome_note = note;

  saveHistory(history);
  return true;
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export interface FeedbackStats {
  total_runs: number;
  avg_agreement_pct: number;
  total_conflicts: number;
  conflicts_resolved: number;
  aihf_right_count: number;
  dexter_right_count: number;
  mixed_count: number;
  pending_count: number;
}

export function computeStats(): FeedbackStats {
  const history = loadHistory();
  const entries = history.entries;

  if (entries.length === 0) {
    return {
      total_runs: 0,
      avg_agreement_pct: 0,
      total_conflicts: 0,
      conflicts_resolved: 0,
      aihf_right_count: 0,
      dexter_right_count: 0,
      mixed_count: 0,
      pending_count: 0,
    };
  }

  const allConflicts = entries.flatMap((e) => e.conflicts);

  return {
    total_runs: entries.length,
    avg_agreement_pct:
      Math.round(
        (entries.reduce((sum, e) => sum + e.summary.included_agreement_pct, 0) / entries.length) * 100,
      ) / 100,
    total_conflicts: allConflicts.length,
    conflicts_resolved: allConflicts.filter((c) => c.outcome !== 'pending').length,
    aihf_right_count: allConflicts.filter((c) => c.outcome === 'aihf_right').length,
    dexter_right_count: allConflicts.filter((c) => c.outcome === 'dexter_right').length,
    mixed_count: allConflicts.filter((c) => c.outcome === 'mixed').length,
    pending_count: allConflicts.filter((c) => c.outcome === 'pending').length,
  };
}
