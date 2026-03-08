import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { orderDryRun } from './api.js';
import { summarizeOrder } from './theta-helpers.js';
import {
  computePortfolioFit,
  loadThetaPolicy,
  loadSoulPortfolioContext,
  parseOptionSymbol,
  validateOrderAgainstPolicy,
} from './utils.js';

export const tastytradeStrategyPreviewTool = new DynamicStructuredTool({
  name: 'tastytrade_strategy_preview',
  description:
    'Build a trade memo for a candidate or manual order and run tastytrade dry-run (read-only; no live trading required).',
  schema: z.object({
    account_number: z.string().describe('Tastytrade account number.'),
    order_json: z
      .string()
      .describe('Order as JSON (typically from tastytrade_theta_scan).'),
    thesis: z
      .string()
      .optional()
      .describe('Optional plain-English thesis or context to include in the trade memo.'),
    exit_plan: z
      .string()
      .optional()
      .describe('Optional exit plan. If omitted, uses a conservative default for short premium trades.'),
  }),
  func: async (input) => {
    let order: Record<string, unknown>;
    try {
      order = JSON.parse(input.order_json) as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: 'order_json must be valid JSON.' });
    }

    const summary = summarizeOrder(order);
    if (summary.legs.length === 0) {
      return JSON.stringify({ error: 'order_json must include at least one valid leg.' });
    }

    const legs = summary.legs.map((leg) => {
      const parsed = parseOptionSymbol(leg.symbol);
      return {
        ...leg,
        underlying: parsed.underlying,
        option_type: parsed.optionType,
        strike: parsed.strike,
        expiration_date: parsed.expirationDate,
        dte: parsed.dte,
      };
    });

    const underlyings = [...new Set(legs.map((leg) => leg.underlying))];
    const policy = loadThetaPolicy();
    const policyValidation = validateOrderAgainstPolicy({
      underlyings,
      legs: legs.map((l) => ({
        underlying: l.underlying,
        option_type: l.option_type ?? null,
        action: l.action,
        dte: l.dte ?? null,
      })),
      policy,
    });
    if (!policyValidation.allowed) {
      let dryRunResult: unknown = null;
      try {
        const res = await orderDryRun(input.account_number, order);
        dryRunResult = res.data;
      } catch (error) {
        dryRunResult = { error: error instanceof Error ? error.message : String(error) };
      }
      return JSON.stringify({
        account_number: input.account_number,
        policy_blocked: true,
        violations: policyValidation.violations,
        order_json: order,
        dry_run_attempted: true,
        dry_run_result: dryRunResult,
        note: 'Do not submit; order violates THETA-POLICY. Adjust underlyings, no-call list, or DTE range and re-run preview.',
      });
    }
    const strikes = legs.map((leg) => leg.strike).filter((strike): strike is number => typeof strike === 'number');
    const price = Number(summary.price.toFixed(2));
    const creditOrDebit = price >= 0 ? 'credit' : 'debit';
    const width = strikes.length >= 2 ? Math.max(...strikes) - Math.min(...strikes) : null;
    const estimatedMaxLoss =
      creditOrDebit === 'credit' && width != null ? Number((width * 100 - Math.abs(price) * 100).toFixed(2)) : null;
    const breakevens = estimateBreakevens(legs, price);
    const inferredStrategy = inferStrategy(legs);
    const soulPortfolio = loadSoulPortfolioContext();
    const soulFlagged = underlyings.filter((u) => u !== '—' && soulPortfolio.soulCoreOrAvoidTickers.includes(u));
    const targetWeights = underlyings
      .filter((u) => u !== '—')
      .map((u) => ({ ticker: u, target_pct: soulPortfolio.portfolioTargetWeightByTicker.get(u) }))
      .filter((x) => x.target_pct != null);

    const fitResults = underlyings
      .filter((u) => u !== '—')
      .map((u) => {
        const isShortCall = legs.some(
          (leg) => leg.underlying === u && leg.option_type === 'C' && leg.action === 'Sell to Open'
        );
        return computePortfolioFit({
          underlying: u,
          soulCoreOrAvoidTickers: soulPortfolio.soulCoreOrAvoidTickers,
          portfolioTargetWeightByTicker: soulPortfolio.portfolioTargetWeightByTicker,
          targetWeightPct: soulPortfolio.portfolioTargetWeightByTicker.get(u),
          isShortCall,
        });
      });
    const blockCount = fitResults.filter((f) => f.result === 'block').length;
    const warnCount = fitResults.filter((f) => f.result === 'warn').length;
    const portfolioFitResult =
      blockCount > 0 ? 'block' : warnCount > 0 ? 'warn' : 'pass';
    const portfolioFitReason =
      fitResults.map((f) => `${f.result}: ${f.reason}`).join('; ') || 'No SOUL/PORTFOLIO context.';

    let dryRunResult: unknown = null;
    let dryRunAttempted = true;
    try {
      const res = await orderDryRun(input.account_number, order);
      dryRunResult = res.data;
    } catch (error) {
      dryRunResult = { error: error instanceof Error ? error.message : String(error) };
    }

    return JSON.stringify({
      account_number: input.account_number,
      policy_blocked: false,
      strategy_type: inferredStrategy,
      thesis: input.thesis ?? 'Short premium should remain subordinate to the Portfolio Builder target and THETA-POLICY.',
      trade_memo: {
        underlyings,
        legs,
        premium_type: creditOrDebit,
        price,
        estimated_max_loss: estimatedMaxLoss,
        estimated_breakevens: breakevens,
        exit_plan:
          input.exit_plan ??
          'Default: take profits around 50% max credit on short premium trades, and reassess or roll if the short strike becomes challenged or if DTE falls below the management window.',
        invalidation:
          'Invalidate if the position violates THETA-POLICY, if macro/event conditions change materially, or if a threatened short strike requires a defensive roll.',
        roll_plan:
          'If challenged, compare close-now cost versus rolling out in time for equal or better credit while keeping size within policy caps.',
        portfolio_fit: {
        result: portfolioFitResult,
        reason: portfolioFitReason,
        details:
          soulFlagged.length > 0 || targetWeights.length > 0
            ? [
                soulFlagged.length > 0
                  ? `SOUL.md flags ${soulFlagged.join(', ')} as Core/Avoid.`
                  : null,
                targetWeights.length > 0
                  ? `PORTFOLIO.md targets: ${targetWeights.map((x) => `${x.ticker} ${x.target_pct}%`).join('; ')}.`
                  : null,
              ]
                .filter(Boolean)
                .join(' ')
            : 'No SOUL/PORTFOLIO context loaded.',
      },
      },
      order_json: order,
      dry_run_attempted: dryRunAttempted,
      dry_run_result: dryRunResult,
      note: 'Use tastytrade_submit_order only after the user explicitly confirms this preview.',
    });
  },
});

function inferStrategy(
  legs: Array<{ symbol: string; quantity: number; action: string; instrument_type: string }>
): string {
  if (legs.length === 1) {
    return legs[0]?.action === 'Sell to Open' ? 'single_short_option' : 'single_leg';
  }
  if (legs.length === 2) return 'vertical_spread';
  if (legs.length === 4) return 'iron_condor';
  return 'multi_leg';
}

function estimateBreakevens(
  legs: Array<{
    symbol: string;
    quantity: number;
    action: string;
    instrument_type: string;
    strike?: number | null;
    option_type?: 'C' | 'P' | null;
  }>,
  price: number
): { lower: number | null; upper: number | null } {
  const shortPuts = legs.filter((leg) => leg.action === 'Sell to Open' && leg.option_type === 'P');
  const shortCalls = legs.filter((leg) => leg.action === 'Sell to Open' && leg.option_type === 'C');
  const putStrike = shortPuts[0]?.strike ?? null;
  const callStrike = shortCalls[0]?.strike ?? null;
  return {
    lower: putStrike != null ? Number((putStrike - Math.abs(price)).toFixed(2)) : null,
    upper: callStrike != null ? Number((callStrike + Math.abs(price)).toFixed(2)) : null,
  };
}
