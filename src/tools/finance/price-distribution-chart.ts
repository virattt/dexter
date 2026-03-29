/**
 * Price Distribution Chart Tool
 *
 * Converts Polymarket binary upper-tail threshold markets into an implied
 * probability distribution and renders it as a terminal ASCII bar chart.
 *
 * Math: Upper-tail markets give P(X > threshold_i). Subtracting adjacent
 * thresholds gives the probability mass in each price bucket:
 *   P(bucket_i) = P(X > lower_i) - P(X > upper_i)
 *
 * Requires at least 2 distinct price thresholds to produce a chart.
 * Falls back to a CI range notation when fewer thresholds are available.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const BAR_WIDTH = 20; // total bar character width
const FILLED = '█';
const EMPTY  = '░';

export interface ThresholdPoint {
  /** Price level (e.g. 70000 for $70K) */
  price: number;
  /** Upper-tail probability: P(asset_price > this.price) at expiry, 0–1 */
  probability: number;
}

/**
 * Build an implied price distribution from binary threshold markets and
 * render it as a terminal-safe ASCII bar chart string.
 *
 * @param thresholds  - Array of {price, probability} upper-tail points.
 *                      At least 2 required for a chart; fewer → CI fallback.
 * @param currentPrice - Optional current asset price for ◄ marker.
 * @param label        - Asset label shown in the header (e.g. "BTC").
 */
export function buildPriceDistributionChart(
  thresholds: ThresholdPoint[],
  currentPrice?: number,
  label = 'Asset',
): string {
  // Deduplicate and sort ascending by price
  const pts = [...thresholds]
    .filter(p => p.price > 0 && p.probability >= 0 && p.probability <= 1)
    .sort((a, b) => a.price - b.price);

  if (pts.length < 2) {
    // Not enough thresholds — emit a simple CI notation
    if (pts.length === 1) {
      const p = pts[0]!;
      const abovePct = (p.probability * 100).toFixed(1);
      const belowPct = ((1 - p.probability) * 100).toFixed(1);
      return (
        `${label} Price Distribution (single threshold)\n` +
        `  ${belowPct}% probability below $${formatPrice(p.price)}\n` +
        `  ${abovePct}% probability above $${formatPrice(p.price)}`
      );
    }
    return '';
  }

  // Build buckets: [−∞, pts[0]], [pts[0], pts[1]], …, [pts[n-1], +∞]
  // P(X > pts[i]) = pts[i].probability  →  P(X ≤ pts[i]) = 1 − pts[i].probability
  // P(bucket below first threshold) = 1 − pts[0].probability
  // P(bucket above last threshold)  = pts[n-1].probability
  // P(bucket between pts[i] and pts[i+1]) = pts[i].probability − pts[i+1].probability
  type Bucket = { label: string; prob: number; containsCurrent: boolean };
  const buckets: Bucket[] = [];

  const below = 1 - pts[0]!.probability;
  const belowLabel = `< $${formatPrice(pts[0]!.price)}`;
  buckets.push({
    label: belowLabel,
    prob: Math.max(0, below),
    containsCurrent: currentPrice !== undefined && currentPrice < pts[0]!.price,
  });

  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i]!;
    const hi = pts[i + 1]!;
    const mass = Math.max(0, lo.probability - hi.probability);
    const bLabel = `$${formatPrice(lo.price)}–$${formatPrice(hi.price)}`;
    buckets.push({
      label: bLabel,
      prob: mass,
      containsCurrent:
        currentPrice !== undefined &&
        currentPrice >= lo.price &&
        currentPrice < hi.price,
    });
  }

  const above = pts[pts.length - 1]!.probability;
  const aboveLabel = `> $${formatPrice(pts[pts.length - 1]!.price)}`;
  buckets.push({
    label: aboveLabel,
    prob: Math.max(0, above),
    containsCurrent: currentPrice !== undefined && currentPrice >= pts[pts.length - 1]!.price,
  });

  // Pad labels to equal width for alignment
  const maxLabelLen = Math.max(...buckets.map(b => b.label.length));

  const header = currentPrice !== undefined
    ? `${label} Price Distribution (Polymarket-implied)  current: $${formatPrice(currentPrice)}`
    : `${label} Price Distribution (Polymarket-implied)`;

  const rows = buckets.map(b => {
    const filledCount = Math.round(b.prob * BAR_WIDTH);
    const bar = FILLED.repeat(filledCount) + EMPTY.repeat(BAR_WIDTH - filledCount);
    const pctStr = (b.prob * 100).toFixed(1).padStart(5) + '%';
    const marker = b.containsCurrent ? '  ◄ current' : '';
    return `  ${b.label.padStart(maxLabelLen)}  ${bar}  ${pctStr}${marker}`;
  });

  return [header, '', ...rows].join('\n');
}

/**
 * Format a price number to a compact string (e.g. 70000 → "70K", 1500 → "1,500").
 */
function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 10_000)    return `${(price / 1_000).toFixed(0)}K`;
  if (price >= 1_000)     return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return price.toFixed(2);
}

/**
 * Parse price thresholds from a list of Polymarket market questions.
 * Recognises patterns like "Will X exceed $70K?", "Will X stay above $62,000?",
 * "Will X settle at >$6,200?", "reach $3,400", etc.
 *
 * Returns an array of ThresholdPoint sorted ascending by price, or [] if none found.
 */
export function extractPriceThresholds(
  markets: { question: string; probability: number }[],
): ThresholdPoint[] {
  // Match dollar amounts including K/M suffixes (e.g. $70K, $3,400, $1.5M)
  const PRICE_RE = /\$\s*([\d,]+(?:\.\d+)?)\s*([KkMm]?)/g;

  const seen = new Map<number, number[]>();

  for (const { question, probability } of markets) {
    PRICE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PRICE_RE.exec(question)) !== null) {
      const raw = parseFloat(match[1]!.replace(/,/g, ''));
      const suffix = (match[2] ?? '').toLowerCase();
      const price = suffix === 'k' ? raw * 1_000
                  : suffix === 'm' ? raw * 1_000_000
                  : raw;

      if (!isFinite(price) || price <= 0) continue;
      const bucket = seen.get(price) ?? [];
      bucket.push(probability);
      seen.set(price, bucket);
    }
  }

  // For each price level, take the mean probability across all markets mentioning it
  // Then interpret as upper-tail (higher YES = price more likely to be exceeded)
  const pts: ThresholdPoint[] = [];
  for (const [price, probs] of seen.entries()) {
    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    pts.push({ price, probability: mean });
  }

  // Sort ascending and return only if we have ≥2 distinct levels
  pts.sort((a, b) => a.price - b.price);
  return pts;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const PRICE_DISTRIBUTION_CHART_DESCRIPTION = `
Generate a terminal ASCII bar chart showing the implied probability distribution
of an asset's price across ranges, derived from Polymarket binary threshold markets.

**Use when**: You have gathered multiple Polymarket markets of the form
"Will [asset] exceed/reach/stay above $X?" for the same asset and want to
visualise the crowd-implied price distribution.

**Do NOT use when**: You have fewer than 2 distinct price thresholds, or the
markets are not price-level events (e.g. "Will Fed cut rates?" — these are
binary events, not price thresholds).

**Input**: A JSON array of threshold objects with \`price\` (number) and
\`probability\` (number 0–1, upper-tail: P(asset > price)):
  [{"price": 60000, "probability": 0.997}, {"price": 62000, "probability": 0.987}, ...]

Pass \`current_price\` to mark the current price level in the chart.

**Output**: A formatted ASCII chart ready for display, e.g.:
  BTC Price Distribution (Polymarket-implied)
    < $60K  ░░░░░░░░░░░░░░░░░░░░   0.3%
  $60–$62K  █░░░░░░░░░░░░░░░░░░░   1.0%
  $62–$70K  ██████████████████░░  95.2%  ◄ current
    > $70K  █░░░░░░░░░░░░░░░░░░░   3.5%
`;

const schema = z.object({
  thresholds: z.array(z.object({
    price: z.number().describe('Price level'),
    probability: z.number().min(0).max(1).describe('Upper-tail probability P(asset > price)'),
  })).min(2).describe('At least 2 price threshold points'),
  current_price: z.number().optional().describe('Current asset price for marker'),
  label: z.string().optional().describe('Asset label (e.g. "BTC", "GLD")'),
});

export const priceDistributionChartTool = new DynamicStructuredTool({
  name: 'price_distribution_chart',
  description: PRICE_DISTRIBUTION_CHART_DESCRIPTION,
  schema,
  func: async (input) => {
    const chart = buildPriceDistributionChart(
      input.thresholds,
      input.current_price,
      input.label ?? 'Asset',
    );
    if (!chart) {
      return 'Insufficient threshold data — need at least 2 distinct price levels to build a distribution chart.';
    }
    return chart;
  },
});
