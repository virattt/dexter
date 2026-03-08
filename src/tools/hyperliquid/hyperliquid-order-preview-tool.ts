import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { formatToolResult } from '../types.js';
import { runRebalanceCheck } from './hyperliquid-portfolio-ops-tool.js';
import { resolveUnderlyingsToMarkets } from './hyperliquid-market-resolver.js';
import { loadHLExecutionPolicy, validateIntentAgainstPolicy } from './hl-execution-policy.js';
import type { HLExecutionIntent, HLOrderType, HLTimeInForce } from './hyperliquid-execution-types.js';

const DEXTER = join(homedir(), '.dexter');
const DEFAULT_PORTFOLIO_PATH = join(DEXTER, 'PORTFOLIO-HYPERLIQUID.md');

const MIN_NOTIONAL_USD = 1;
const ILLIQUID_VOLUME_THRESHOLD = 10_000;

export const HYPERLIQUID_ORDER_PREVIEW_DESCRIPTION = `
Convert Hyperliquid rebalance output into reviewable order intents. Always run after hyperliquid_portfolio_ops rebalance_check (and optionally hyperliquid_sync_portfolio). Never submit orders without explicit user confirmation.

## Flow
1. Sync live holdings (hyperliquid_sync_portfolio write_to_file=true) if using live account.
2. Run hyperliquid_portfolio_ops with action rebalance_check.
3. Run this tool (hyperliquid_order_preview) to get proposed intents.
4. Present preview to user and stop; do not call any submit tool until user confirms.

## Output
Proposed order intents with resolved market symbols, estimated size, rationale, and warnings (unresolved, illiquid, policy violations, tiny size). Intents are validated against ~/.dexter/hl-execution-policy.json when present.
`.trim();

const schema = z.object({
  portfolio_path: z
    .string()
    .optional()
    .describe(`Path to PORTFOLIO-HYPERLIQUID.md; default ${DEFAULT_PORTFOLIO_PATH}`),
  target_path: z
    .string()
    .optional()
    .describe('Path to HEARTBEAT.md or SOUL-HL.md for target table'),
  aum_hl: z
    .number()
    .positive()
    .optional()
    .describe('AUM in USD for HL portfolio; overrides fund-config.json aum_hl if provided'),
  max_positions_to_adjust: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Cap number of order intents (default: no cap)'),
  min_drift_threshold: z
    .number()
    .min(0)
    .optional()
    .describe('Skip actions with |drift| below this percentage (e.g. 0.5 for 0.5%%)'),
});

function roundSize(size: number, decimals: number): number {
  const m = 10 ** (decimals ?? 2);
  return Math.round(size * m) / m;
}

export const hyperliquidOrderPreviewTool = new DynamicStructuredTool({
  name: 'hyperliquid_order_preview',
  description:
    'Convert HL rebalance output into reviewable order intents. Run after portfolio_ops rebalance_check; never submit without user confirmation.',
  schema,
  func: async (input) => {
    const portfolioPath = input.portfolio_path?.trim() || DEFAULT_PORTFOLIO_PATH;
    const result = runRebalanceCheck(portfolioPath, input.target_path);
    if (result.error) {
      return formatToolResult({ intents: [], warnings: [result.error], rationale: [] });
    }
    let actions = result.actions;
    const aum = input.aum_hl ?? result.aum_hl;
    if (aum == null || aum <= 0) {
      return formatToolResult({
        intents: [],
        warnings: ['aum_hl not set; provide aum_hl or set fund-config.json aum_hl to get order sizes'],
        rationale: actions.map((a) => `${a.ticker} ${a.action}: ${a.reason}`),
      });
    }
    if (input.min_drift_threshold != null && input.min_drift_threshold > 0) {
      const driftByTicker = new Map(result.drift.map((d) => [d.ticker, d.driftPct]));
      actions = actions.filter((a) => {
        const drift = driftByTicker.get(a.ticker) ?? 0;
        return Math.abs(drift) >= input.min_drift_threshold!;
      });
    }
    if (input.max_positions_to_adjust != null) {
      actions = actions.slice(0, input.max_positions_to_adjust);
    }
    if (actions.length === 0) {
      return formatToolResult({
        intents: [],
        warnings: [],
        rationale: ['No actions after filters'],
      });
    }
    const tickers = actions.map((a) => a.ticker);
    const markets = await resolveUnderlyingsToMarkets(tickers);
    const policy = loadHLExecutionPolicy();
    const intents: HLExecutionIntent[] = [];
    const warnings: string[] = [];
    const rationale: string[] = [];
    for (const a of actions) {
      const sym = a.ticker.trim().toUpperCase();
      const resolved = markets.get(sym);
      const notional = a.suggestedDollar ?? (aum * Math.abs(a.suggestedPct - (result.portfolio.find((p) => p.ticker === a.ticker)?.weight ?? 0))) / 100;
      if (notional < MIN_NOTIONAL_USD) {
        warnings.push(`${a.ticker}: skipped (notional $${notional.toFixed(2)} < $${MIN_NOTIONAL_USD})`);
        continue;
      }
      if (!resolved) {
        warnings.push(`${a.ticker}: unresolved market (no HIP-3 market found)`);
        rationale.push(`${a.ticker} ${a.action}: ${a.reason} (notional ~$${notional.toFixed(0)}) — unresolved`);
        continue;
      }
      if (resolved.dayNtlVlm < ILLIQUID_VOLUME_THRESHOLD) {
        warnings.push(`${a.ticker}: low 24h volume ($${resolved.dayNtlVlm.toLocaleString()})`);
      }
      const markPx = resolved.markPx ?? 0;
      const size = markPx > 0 ? roundSize(notional / markPx, resolved.szDecimals ?? 2) : 0;
      if (size <= 0) {
        warnings.push(`${a.ticker}: could not compute size (no mark price)`);
        continue;
      }
      const side = a.action === 'trim' ? 'sell' : 'buy';
      const reduceOnly = a.action === 'trim';
      const intent: HLExecutionIntent = {
        symbol: a.ticker,
        marketSymbol: resolved.marketSymbol,
        side,
        notionalUsd: notional,
        size,
        orderType: 'market' as HLOrderType,
        timeInForce: 'IOC' as HLTimeInForce,
        reduceOnly,
        source: 'rebalance',
        reason: a.reason,
      };
      const policyResult = validateIntentAgainstPolicy(intent, policy);
      if (!policyResult.valid) {
        warnings.push(`${a.ticker}: policy violations: ${policyResult.violations.join('; ')}`);
        rationale.push(`${a.ticker} ${a.action}: ${a.reason} — blocked by policy`);
        continue;
      }
      intents.push(intent);
      rationale.push(`${a.ticker} ${a.action}: ${a.reason} (~$${notional.toFixed(0)}, ${side} ${size} @ ${resolved.marketSymbol})`);
    }
    return formatToolResult({
      intents,
      warnings: warnings.length ? warnings : undefined,
      rationale,
      policy_loaded: policy != null,
    });
  },
});
