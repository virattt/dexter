/**
 * Log-odds probability combination utility.
 *
 * Combines multiple independent probability signals (e.g. Polymarket crowd
 * odds, analyst consensus, historical base rate) into a single calibrated
 * estimate using the weighted log-odds method. All functions are pure.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogOddsSignal {
  name: string;
  probability: number; // [0, 1] — will be clamped to [0.001, 0.999]
  weight: number;      // unnormalised; re-normalised before use
  category: string;
  description?: string;
}

export interface ProbabilityResult {
  /** Combined probability [0, 1] */
  probability: number;
  /** Lower uncertainty bound (−1σ in log-odds space, converted back) */
  lower: number;
  /** Upper uncertainty bound (+1σ in log-odds space, converted back) */
  upper: number;
  /** True when signals disagree significantly (weighted σ > 0.3 log-odds) */
  divergence: boolean;
  /** Input signals annotated with normalised weights and their log-odds values */
  signals: Array<LogOddsSignal & { normalisedWeight: number; logOdds: number }>;
}

// ---------------------------------------------------------------------------
// Core math
// ---------------------------------------------------------------------------

const CLAMP_MIN = 0.001;
const CLAMP_MAX = 0.999;
const DIVERGENCE_THRESHOLD = 0.3; // log-odds standard deviation

function clamp(p: number): number {
  return Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, p));
}

function toLogOdds(p: number): number {
  const cp = clamp(p);
  return Math.log(cp / (1 - cp));
}

function fromLogOdds(lo: number): number {
  return 1 / (1 + Math.exp(-lo));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Re-normalises signal weights so they sum to 1.0.
 * Throws when all weights are zero.
 */
export function normaliseWeights(
  signals: LogOddsSignal[],
): Array<LogOddsSignal & { normalisedWeight: number }> {
  const total = signals.reduce((s, sig) => s + sig.weight, 0);
  if (total === 0) throw new Error('All signal weights are zero — cannot normalise.');
  return signals.map((sig) => ({ ...sig, normalisedWeight: sig.weight / total }));
}

/**
 * Combines signals using the weighted log-odds method.
 *
 * Returns the combined probability, a ±1σ uncertainty band, a divergence
 * flag, and annotated signal details.
 *
 * Throws on empty input.
 */
export function combineLogOdds(signals: LogOddsSignal[]): ProbabilityResult {
  if (signals.length === 0) throw new Error('combineLogOdds requires at least one signal.');

  // Single-signal passthrough — uncertainty band is ±0.3 log-odds
  if (signals.length === 1) {
    const p = clamp(signals[0].probability);
    const lo = toLogOdds(p);
    return {
      probability: p,
      lower: fromLogOdds(lo - 0.3),
      upper: fromLogOdds(lo + 0.3),
      divergence: false,
      signals: [{ ...signals[0], normalisedWeight: 1, logOdds: lo }],
    };
  }

  const normalised = normaliseWeights(signals);

  // Weighted mean of log-odds
  const combinedLO = normalised.reduce(
    (sum, sig) => sum + sig.normalisedWeight * toLogOdds(sig.probability),
    0,
  );

  // Weighted variance → standard deviation
  const variance = normalised.reduce((sum, sig) => {
    const diff = toLogOdds(sig.probability) - combinedLO;
    return sum + sig.normalisedWeight * diff * diff;
  }, 0);
  const sigma = Math.sqrt(variance);

  return {
    probability: fromLogOdds(combinedLO),
    lower: fromLogOdds(combinedLO - sigma),
    upper: fromLogOdds(combinedLO + sigma),
    divergence: sigma > DIVERGENCE_THRESHOLD,
    signals: normalised.map((sig) => ({ ...sig, logOdds: toLogOdds(sig.probability) })),
  };
}

/**
 * Formats a ProbabilityResult as a markdown table suitable for embedding in
 * agent output or a `📊 Probability Assessment` block.
 */
export function formatProbabilityTable(result: ProbabilityResult, title: string): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const halfBand = Math.round((result.upper - result.lower) * 50);

  const header = [
    `📊 **Probability Assessment: ${title}**`,
    '',
    '| Signal                    | Probability | Weight |',
    '|---------------------------|-------------|--------|',
  ];

  const rows = result.signals.map(
    (sig) =>
      `| ${sig.name.padEnd(25)} | ${pct(sig.probability).padStart(11)} | ${pct(sig.normalisedWeight).padStart(6)} |`,
  );

  const divider = '|---------------------------|-------------|--------|';
  const combined = `| ${'**Combined (log-odds)**'.padEnd(25)} | ${`**${pct(result.probability)} ±${halfBand}pp**`.padStart(11)} |        |`;

  const divergenceNote = result.divergence
    ? '\n⚠️  Signals diverge significantly — treat combined estimate with caution.'
    : '';

  return [...header, ...rows, divider, combined, '', `*Source: weighted log-odds combination.*${divergenceNote}`]
    .join('\n')
    .trim();
}
