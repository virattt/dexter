/**
 * Types for AI Hedge Fund (AIHF) integration.
 *
 * AIHF exposes POST /hedge-fund/run as an SSE endpoint.
 * Dexter sends tickers + a bundled graph template and parses
 * the SSE stream until the `complete` event delivers
 * decisions, analyst_signals, and current_prices.
 */

// ---------------------------------------------------------------------------
// Graph template
// ---------------------------------------------------------------------------

export interface AihfGraphNode {
  id: string;
  type: string;
}

export interface AihfGraphEdge {
  from: string;
  to: string;
}

export interface AihfGraph {
  nodes: AihfGraphNode[];
  edges: AihfGraphEdge[];
}

// ---------------------------------------------------------------------------
// Request to POST /hedge-fund/run
// ---------------------------------------------------------------------------

export interface AihfRunRequest {
  tickers: string[];
  graph_nodes: AihfGraphNode[];
  graph_edges: AihfGraphEdge[];
  initial_cash: number;
  margin_requirement: number;
  start_date: string | null;
  end_date: string;
}

// ---------------------------------------------------------------------------
// SSE event shapes
// ---------------------------------------------------------------------------

export type AihfSseEventType = 'start' | 'progress' | 'complete' | 'error';

export interface AihfSseEvent {
  event: AihfSseEventType;
  data: unknown;
}

// ---------------------------------------------------------------------------
// AIHF response (from the `complete` SSE event)
// ---------------------------------------------------------------------------

export type AihfAction = 'buy' | 'sell' | 'short' | 'cover' | 'hold';

export interface AihfDecision {
  action: AihfAction;
  quantity: number;
  confidence: number;
  reasoning: string;
}

export interface AihfAnalystSignal {
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reasoning: string;
}

/** Per-ticker analyst signals keyed by analyst ID. */
export type AihfTickerSignals = Record<string, AihfAnalystSignal>;

export interface AihfRunResult {
  decisions: Record<string, AihfDecision>;
  analyst_signals: Record<string, AihfTickerSignals>;
  current_prices: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Tool input
// ---------------------------------------------------------------------------

export interface TickerEntry {
  ticker: string;
  weight?: number;
  note?: string;
}

export interface ExcludedEntry {
  ticker: string;
  reason: string;
  sleeve?: 'default' | 'hyperliquid' | 'either';
}

export interface AihfToolInput {
  action: 'run' | 'view_last';
  default_included?: TickerEntry[];
  hyperliquid_included?: TickerEntry[];
  excluded?: ExcludedEntry[];
  start_date?: string;
  end_date?: string;
  initial_cash?: number;
}

// ---------------------------------------------------------------------------
// Normalized comparison output
// ---------------------------------------------------------------------------

export interface ConflictEntry {
  ticker: string;
  sleeve: 'default' | 'hyperliquid';
  dexter_stance: string;
  aihf_stance: string;
  aihf_confidence: number;
  note: string;
}

export interface ExcludedInterestingEntry {
  ticker: string;
  dexter_reason: string;
  aihf_signal: string;
  aihf_confidence: number;
  suggested_action: string;
}

export interface DoubleCheckSummary {
  included_agreement_pct: number;
  conflict_count: number;
  excluded_interesting_count: number;
}

export interface DoubleCheckResult {
  summary: DoubleCheckSummary;
  conflicts: ConflictEntry[];
  excluded_interesting: ExcludedInterestingEntry[];
  aihf_raw_meta: {
    tickers_validated: number;
    tickers_requested: number;
    timeout: boolean;
    partial: boolean;
  };
}
