/**
 * Polymarket Forecast Tool
 *
 * Prediction-market-weighted ensemble price forecast for any asset.
 * Combines Polymarket probability signals with optional news sentiment,
 * fundamental analyst targets, and options skew into a single forecast.
 *
 * Research basis:
 *   Reichenbach & Walther (2025) · Cordoba et al. (2024) · Tsang & Yang (2026)
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { polymarketBreaker } from '../../utils/circuit-breaker.js';
import { fetchPolymarketMarkets } from './polymarket.js';
import { extractSignals } from './signal-extractor.js';
import { lookupImpact, inferAssetClass } from './impact-map.js';
import { runEnsemble, computePolymarketSignal, computeEnsemble, computeConditionalReturn, adjustYesBias, type MarketInput } from '../../utils/ensemble.js';

// ---------------------------------------------------------------------------
// Description (injected into system prompt)
// ---------------------------------------------------------------------------

export const POLYMARKET_FORECAST_DESCRIPTION = `
Generates a prediction-market-weighted ensemble price forecast for any asset over a 1–365 day horizon.

Combines Polymarket crowd probabilities with optional auxiliary signals (news sentiment, fundamental
analyst targets, options skew) into a single calibrated forecast with a 95% confidence interval and
a quality grade (A–D).

Polymarket hosts markets from 1 day to 12 months out — all are valid inputs. Signal quality is
highest for liquid markets resolving in 1–90 days; longer-dated or low-volume markets are
automatically down-weighted by the quality scoring engine.

## What This Tool Does

1. Extracts relevant Polymarket search signals for the asset (earnings, macro, geopolitical, etc.)
2. Fetches live prediction-market probabilities from Polymarket
3. Maps each market to an asset-return impact using a pre-built δ(YES)/δ(NO) lookup table
4. Blends the Polymarket signal with any auxiliary signals you provide (sentiment, fundamentals, skew)
5. Outputs: forecast price, 95% CI, return percentage, per-signal breakdown, grade, and warnings

## When to Use

- User asks "Where will NVDA trade in a week / month / quarter?"
- User wants a forecast incorporating prediction-market data at any horizon (days to months)
- User asks "What does the market imply for [TICKER] by end of year?"
- You have already fetched sentiment or fundamentals and want to incorporate them into a price forecast
- User asks for a probability-weighted scenario analysis combining multiple market signals

## When NOT to Use

- Real-time stock price — use \`get_market_data\`
- Fundamental company analysis — use \`get_financials\`
- Multi-year DCF valuation (> 2 years) — use the DCF skill instead
- News summarisation — use \`web_search\`

## Signal Quality by Horizon

| Horizon | Polymarket signal strength | Notes |
|---------|--------------------------|-------|
| 1–30 days | ★★★ Strong | Many active markets, high volume, best accuracy |
| 30–90 days | ★★ Moderate | Fewer markets, still actionable |
| 90–365 days | ★ Weaker | Longer-dated markets tend to be less liquid; quality weights auto-adjust |

## Input Tips

- **ALWAYS pass \`current_price\`** (fetch with \`get_market_data\` first). Without it the 95% CI
  is shown as percentages only (relative to base 100), NOT in dollar terms. Call order:
  get_market_data(ticker) → polymarket_forecast(ticker, current_price=<fetched price>).
- **Pass \`sentiment_score\`** (from \`social_sentiment\`) if you have already called that tool —
  it improves forecast quality at no extra cost.
- **Pass \`fundamental_return\`** (analyst 1-year target implied return from \`get_financials\`) if
  available — use the decimal form, e.g. \`0.15\` for a +15% target.
- **Pass \`options_skew\`** if you have options data — use −1 (bearish), 0 (neutral), +1 (bullish).
- The tool fetches Polymarket data itself; you do **not** need to call \`polymarket_search\` first.

## Interpreting the Output

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 80–100 | High conviction — ≥5 liquid markets, multiple corroborating signals |
| B | 60–79  | Moderate conviction — useful directional signal |
| C | 40–59  | Low conviction — treat as indicative, not actionable alone |
| D | 0–39   | Speculative — few or no liquid markets, high uncertainty |

The 95% CI reflects both market-probability variance and a 20% model-uncertainty buffer.
A wide CI (σ > 5%) typically signals Grade C/D and limited predictive power.

## Composability Note

For richer analysis, call \`get_financials\` and \`social_sentiment\` first, then pass their results
to this tool via \`fundamental_return\` and \`sentiment_score\`. This turns two separate lookups into
a unified forecast with a higher quality grade.

\`\`\`
get_financials(NVDA) → fundamental_return = 0.18
social_sentiment(NVDA) → sentiment_score = 0.6
polymarket_forecast(NVDA, current_price=135.50, fundamental_return=0.18, sentiment_score=0.6)
\`\`\`
`.trim();

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  ticker: z.string().describe('Asset ticker or name, e.g. "NVDA", "BTC", "GLD"'),
  horizon_days: z.number().int().min(1).max(365).default(7)
    .describe('Forecast horizon in days (1–365). Default: 7. Polymarket has markets from 1 day to 12 months — all are valid. Signal quality is highest for 1–90 day horizons.'),
  current_price: z.number().optional()
    .describe('Current asset price. If omitted, tool uses a placeholder and notes it.'),
  sentiment_score: z.number().min(-1).max(1).optional()
    .describe('News/social sentiment: -1 bearish, 0 neutral, +1 bullish. Pass if already retrieved.'),
  fundamental_return: z.number().optional()
    .describe('Analyst 1-year price target implied return as decimal (e.g. 0.15 for +15%). Pass if known.'),
  options_skew: z.number().min(-1).max(1).optional()
    .describe('Options skew signal: -1 bearish, 0 neutral, +1 bullish. Pass if available.'),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a signal category string to a Polymarket tier. */
function categoryToTier(category: string): 'macro' | 'geopolitical' | 'electoral' {
  const lower = category.toLowerCase();
  if (lower.includes('macro') || lower.includes('fed') || lower.includes('rate') ||
      lower.includes('gdp') || lower.includes('cpi')) return 'macro';
  if (lower.includes('election') || lower.includes('vote') || lower.includes('president')) return 'electoral';
  return 'geopolitical';
}

function sign(n: number): string {
  return n >= 0 ? '+' : '';
}

function pct(n: number, decimals = 2): string {
  return `${sign(n)}${(n * 100).toFixed(decimals)}`;
}

function sentimentLabel(score: number): string {
  if (score >= 0.5) return 'very bullish';
  if (score >= 0.1) return 'bullish';
  if (score <= -0.5) return 'very bearish';
  if (score <= -0.1) return 'bearish';
  return 'neutral';
}

function optionsLabel(skew: number): string {
  if (skew >= 0.5) return 'bullish skew';
  if (skew >= 0.1) return 'mildly bullish';
  if (skew <= -0.5) return 'bearish skew';
  if (skew <= -0.1) return 'mildly bearish';
  return 'neutral skew';
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const polymarketForecastTool = new DynamicStructuredTool({
  name: 'polymarket_forecast',
  description:
    'Generate a prediction-market-weighted ensemble price forecast for an asset over any horizon (1–365 days), ' +
    'combining Polymarket probabilities (markets span 1 day to 12 months) with optional sentiment, fundamental, and options signals.',
  schema,
  func: async (input) => {
    if (polymarketBreaker.isOpen()) {
      return formatToolResult({
        error: 'Polymarket API is temporarily unavailable (circuit open). Try again in a few minutes.',
      });
    }

    try {
      const ticker = input.ticker.trim().toUpperCase();
      const horizonDays = input.horizon_days ?? 7;
      const currentPrice = input.current_price;
      const basePrice = currentPrice ?? 100;
      const assetClass = inferAssetClass(ticker);

      // Step 1: Extract signals for this ticker (up to 5)
      const signals = extractSignals(ticker).slice(0, 5);

      // Step 2: Fetch Polymarket markets for each signal (up to 3 per signal)
      const allResults = await Promise.allSettled(
        signals.map((sig) => fetchPolymarketMarkets(sig.searchPhrase, 3)),
      );

      // Deduplicate by question string
      const seen = new Set<string>();
      const rawMarkets: { question: string; probability: number; volume24h: number; signalCategory: string }[] = [];
      for (let i = 0; i < signals.length; i++) {
        const result = allResults[i];
        if (result.status !== 'fulfilled') continue;
        const sig = signals[i]!;
        for (const m of result.value) {
          if (seen.has(m.question)) continue;
          seen.add(m.question);
          rawMarkets.push({ ...m, signalCategory: sig.category });
        }
      }

      // Step 3: Build MarketInput array
      const impact = lookupImpact(signals[0]?.category ?? 'default', assetClass);
      const markets: MarketInput[] = rawMarkets.map((m) => {
        const mImpact = lookupImpact(m.signalCategory, assetClass);
        return {
          question: m.question,
          probability: m.probability,
          volume24hUsd: m.volume24h,
          ageDays: undefined,
          priceSpikeDetected: false,
          signalTier: categoryToTier(m.signalCategory),
          deltaYes: mImpact.deltaYes,
          deltaNo: mImpact.deltaNo,
        };
      });

      // Step 4: Run ensemble — also capture intermediate values for display
      const otherSignals = {
        sentimentScore: input.sentiment_score,
        fundamentalReturn: input.fundamental_return,
        optionsSkew: input.options_skew,
        horizonDays,
      };

      const { signal: pmSignal, avgQuality, warnings: pmWarnings } = computePolymarketSignal(markets);
      const { weights } = computeEnsemble(pmSignal, avgQuality, otherSignals);
      const result = runEnsemble(basePrice, markets, otherSignals);

      // Step 5: Format output
      const returnPct = (result.forecastReturn * 100).toFixed(2);
      const sigmaPct = (result.sigma * 100).toFixed(2);
      const ciLow = result.ciLow95;
      const ciHigh = result.ciHigh95;
      const pmPct = pct(result.pmSignal);
      const pmWeightPct = (result.pmEffectiveWeight * 100).toFixed(1);
      const avgQualityStr = result.avgMarketQuality.toFixed(3);

      const lines: string[] = [
        `📊 Polymarket Forecast: ${ticker}  |  Horizon: ${horizonDays} days  |  Grade: ${result.qualityGrade} (${result.qualityScore}/100)`,
      ];

      if (currentPrice === undefined) {
        lines.push('⚠️  No current price provided — price shown relative to base 100');
      }

      if (horizonDays > 90) {
        lines.push(`⚠️  Horizon ${horizonDays}d > 90 days: Polymarket signal accuracy decreases for longer horizons. Wider CI expected. Consider supplementing with DCF skill for multi-month forecasts.`);
      } else if (horizonDays > 14) {
        lines.push(`ℹ️  Horizon ${horizonDays}d: Polymarket markets exist at this range but signal quality is moderate. 95% CI is wider than short-term forecasts.`);
      }

      lines.push('');
      lines.push(`Current price:   ${currentPrice !== undefined ? '$' + basePrice : 'not provided — CI shown as %'}`);
      lines.push(`Forecast price:  ${currentPrice !== undefined ? '$' + result.forecastPrice.toFixed(2) : '(base 100) ' + result.forecastPrice.toFixed(2)}  (${sign(result.forecastReturn)}${returnPct}%)`);
      if (currentPrice !== undefined) {
        lines.push(`95% CI:          [$${ciLow.toFixed(2)} – $${ciHigh.toFixed(2)}]  (σ = ${sigmaPct}%)`);
      } else {
        const ciLowPct = ((result.ciLow95 / basePrice - 1) * 100).toFixed(2);
        const ciHighPct = ((result.ciHigh95 / basePrice - 1) * 100).toFixed(2);
        const ciHighSign = parseFloat(ciHighPct) >= 0 ? '+' : '';
        lines.push(`95% CI:          [${ciLowPct}% – ${ciHighSign}${ciHighPct}%]  (σ = ${sigmaPct}%)  ← % relative to current price`);
      }
      lines.push('');
      lines.push(`── Polymarket Signal (w̄ = ${avgQualityStr}) ──────────────────────────────────`);

      if (markets.length === 0) {
        lines.push('  [No Polymarket markets found for this asset]');
      } else {
        for (const m of markets) {
          const probPct = (m.probability * 100).toFixed(1);
          const condReturn = computeConditionalReturn(adjustYesBias(m.probability), m.deltaYes, m.deltaNo);
          const impactStr = pct(condReturn);
          lines.push(`  ${m.question}   ${probPct}% YES  →  ${impactStr}%`);
        }
      }
      lines.push(`  Polymarket contribution:  ${pmPct}% (effective weight: ${pmWeightPct}%)`);

      lines.push('');
      lines.push('── Other Signals ──────────────────────────────────────────────────────────');

      const wSent = weights['sentiment'];
      const wFund = weights['fundamental'];
      const wOpt = weights['options'];

      if (input.sentiment_score !== undefined) {
        const sentContrib = pct(input.sentiment_score * 0.04);
        lines.push(`  News sentiment:     ${sentimentLabel(input.sentiment_score)} → ${sentContrib}%  (weight: ${((wSent ?? 0) * 100).toFixed(1)}%)`);
      } else {
        lines.push('  News sentiment:     [signal omitted — not provided]');
      }

      if (input.fundamental_return !== undefined) {
        const fundContrib = pct(input.fundamental_return * (horizonDays / 365));
        lines.push(`  Fundamentals:       ${fundContrib}%  (weight: ${((wFund ?? 0) * 100).toFixed(1)}%)`);
      } else {
        lines.push('  Fundamentals:       [signal omitted — not provided]');
      }

      if (input.options_skew !== undefined) {
        const optContrib = pct(input.options_skew * 0.03);
        lines.push(`  Options skew:       ${optionsLabel(input.options_skew)} → ${optContrib}%  (weight: ${((wOpt ?? 0) * 100).toFixed(1)}%)`);
      } else {
        lines.push('  Options skew:       [signal omitted — not provided]');
      }

      lines.push('');
      lines.push('── Warnings ───────────────────────────────────────────────────────────────');

      const allWarnings = [...(result.warnings ?? []), ...pmWarnings.filter((w) => !result.warnings?.includes(w))];
      const uniqueWarnings = [...new Set(allWarnings)];
      if (uniqueWarnings.length === 0) {
        lines.push('  None');
      } else {
        for (const w of uniqueWarnings) {
          lines.push(`  ⚠ ${w}`);
        }
      }

      lines.push('');
      lines.push('── Research basis: Reichenbach & Walther (2025) · Cordoba et al. (2024) · Tsang & Yang (2026)');

      // Suppress unused variable — impact was captured for potential future use
      void impact;

      return formatToolResult({ result: lines.join('\n') });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[polymarket_forecast] ${message}`);
    }
  },
});
