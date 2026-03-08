import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { formatToolResult } from '../types.js';
import { parsePortfolioMarkdown, validateHLPortfolioSymbols } from '../../utils/portfolio-parse.js';
import { parseHIP3TargetMarkdown, targetMidpoint, type HIP3TargetRow } from '../../utils/hip3-target-parse.js';
import { KNOWN_HL_SYMBOLS } from './hl-fd-mapping.js';
import { computeHLPeriodReturns } from './hyperliquid-performance-tool.js';

const DEXTER = join(homedir(), '.dexter');
const DEFAULT_PORTFOLIO_PATH = join(DEXTER, 'PORTFOLIO-HYPERLIQUID.md');
const DEFAULT_HEARTBEAT_PATH = join(DEXTER, 'HEARTBEAT.md');
const DEFAULT_SOUL_HL_PATH = join(DEXTER, 'SOUL-HL.md');
const FUND_CONFIG_PATH = join(DEXTER, 'fund-config.json');
const CONCENTRATION_THRESHOLD_PCT = 5;

export const HYPERLIQUID_PORTFOLIO_OPS_DESCRIPTION = `
Deterministic Hyperliquid portfolio operations. Use for weekly rebalance checks and quarterly report payloads instead of freeform reasoning.

## Actions
- rebalance_check: Compare current HL portfolio to target (from HEARTBEAT.md or SOUL-HL.md). Returns drift, concentration alerts (current > targetMax + 5%), and trim/add recommendations.
- quarterly_summary: For a given period, returns hl_basket and portfolio_hl plus period dates. Use the returned quarterly payload with performance_history record_quarter.
- validate_target: Parse and validate HIP-3 target table; optionally validate portfolio symbols against known HL universe.

## When to Use
- Weekly heartbeat: call rebalance_check to get computed drift and actions.
- Quarterly report: call quarterly_summary with period (e.g. 2026-Q1), then pass result to performance_history record_quarter.
- After editing HEARTBEAT.md or SOUL-HL.md: call validate_target to check the target table format.

## Live sync (Phase 9)
When HYPERLIQUID_ACCOUNT_ADDRESS is set, hyperliquid_sync_portfolio and hyperliquid_positions are available. Prefer calling hyperliquid_sync_portfolio with write_to_file=true before rebalance_check or quarterly_summary so this tool operates on current on-chain holdings; otherwise it uses ~/.dexter/PORTFOLIO-HYPERLIQUID.md as-is.
`.trim();

export interface DriftRow {
  ticker: string;
  currentPct: number;
  targetPct: number;
  targetMin: number;
  targetMax: number;
  driftPct: number;
  category: string;
}

export interface AlertRow {
  ticker: string;
  message: string;
  currentPct: number;
  thresholdPct: number;
}

export interface ActionRow {
  ticker: string;
  action: 'trim' | 'add';
  suggestedPct: number;
  reason: string;
  suggestedDollar?: number;
}

export interface RebalanceCheckResult {
  portfolio: { ticker: string; weight: number }[];
  target: HIP3TargetRow[];
  drift: DriftRow[];
  alerts: AlertRow[];
  actions: ActionRow[];
  attribution: Record<string, { currentPct: number; targetPct: number }>;
  aum_hl?: number;
  error?: string;
}

function loadTargetContent(targetPath: string | undefined): string {
  if (targetPath?.trim()) {
    const path = targetPath.trim();
    if (existsSync(path)) return readFileSync(path, 'utf-8');
  }
  if (existsSync(DEFAULT_HEARTBEAT_PATH)) return readFileSync(DEFAULT_HEARTBEAT_PATH, 'utf-8');
  if (existsSync(DEFAULT_SOUL_HL_PATH)) return readFileSync(DEFAULT_SOUL_HL_PATH, 'utf-8');
  return '';
}

function loadAumHL(): number | undefined {
  try {
    if (!existsSync(FUND_CONFIG_PATH)) return undefined;
    const config = JSON.parse(readFileSync(FUND_CONFIG_PATH, 'utf-8')) as { aum_hl?: number };
    return typeof config.aum_hl === 'number' && config.aum_hl > 0 ? config.aum_hl : undefined;
  } catch {
    return undefined;
  }
}

export function runRebalanceCheck(
  portfolioPath: string,
  targetPath: string | undefined,
): RebalanceCheckResult {
  const result: RebalanceCheckResult = {
    portfolio: [],
    target: [],
    drift: [],
    alerts: [],
    actions: [],
    attribution: {},
  };

  if (!existsSync(portfolioPath)) {
    result.error = `Portfolio file not found: ${portfolioPath}`;
    return result;
  }

  const portfolioContent = readFileSync(portfolioPath, 'utf-8');
  const positions = parsePortfolioMarkdown(portfolioContent);
  if (positions.length === 0) {
    result.error = 'Portfolio has no valid positions.';
    return result;
  }

  const totalWeight = positions.reduce((s, p) => s + p.weight, 0);
  const scale = totalWeight > 0 ? 100 / totalWeight : 0;
  const portfolio = positions.map((p) => ({ ticker: p.ticker, weight: p.weight * scale }));
  result.portfolio = portfolio;

  const targetContent = loadTargetContent(targetPath);
  if (!targetContent) {
    result.error = 'Could not load target (HEARTBEAT.md or SOUL-HL.md).';
    return result;
  }

  const targetRows = parseHIP3TargetMarkdown(targetContent);
  if (targetRows.length === 0) {
    result.error = 'No HIP-3 Target table found in HEARTBEAT.md or SOUL-HL.md. Use format: Ticker | TargetMin | TargetMax | Category | Notes';
    return result;
  }
  result.target = targetRows;

  const targetByTicker = new Map<string, HIP3TargetRow>();
  for (const row of targetRows) targetByTicker.set(row.ticker, row);

  const currentByTicker = new Map<string, number>();
  for (const p of portfolio) currentByTicker.set(p.ticker, p.weight);

  for (const p of portfolio) {
    const t = targetByTicker.get(p.ticker);
    const targetPct = t ? targetMidpoint(t) : 0;
    const driftPct = p.weight - targetPct;
    result.drift.push({
      ticker: p.ticker,
      currentPct: p.weight,
      targetPct,
      targetMin: t?.targetMin ?? 0,
      targetMax: t?.targetMax ?? 0,
      driftPct,
      category: t?.category ?? '',
    });

    if (t && p.weight > t.targetMax + CONCENTRATION_THRESHOLD_PCT) {
      result.alerts.push({
        ticker: p.ticker,
        message: `Concentration: ${p.weight.toFixed(1)}% is > target max ${t.targetMax}% + ${CONCENTRATION_THRESHOLD_PCT}%`,
        currentPct: p.weight,
        thresholdPct: t.targetMax + CONCENTRATION_THRESHOLD_PCT,
      });
      result.actions.push({
        ticker: p.ticker,
        action: 'trim',
        suggestedPct: t.targetMax,
        reason: `Above target band (max ${t.targetMax}%)`,
      });
    }
  }

  for (const t of targetRows) {
    const current = currentByTicker.get(t.ticker) ?? 0;
    if (current < t.targetMin) {
      result.actions.push({
        ticker: t.ticker,
        action: 'add',
        suggestedPct: targetMidpoint(t),
        reason: `Below target band (min ${t.targetMin}%)`,
      });
    }
    const cat = t.category || 'Other';
    if (!result.attribution[cat]) result.attribution[cat] = { currentPct: 0, targetPct: 0 };
    result.attribution[cat].currentPct += current;
    result.attribution[cat].targetPct += targetMidpoint(t);
  }

  const aumHL = loadAumHL();
  if (aumHL != null) {
    result.aum_hl = aumHL;
    for (const a of result.actions) {
      const currentPct = result.portfolio.find((p) => p.ticker === a.ticker)?.weight ?? 0;
      const pctDelta = Math.abs(a.suggestedPct - currentPct);
      a.suggestedDollar = (aumHL * pctDelta) / 100;
    }
  }

  return result;
}

const schema = z.object({
  action: z
    .enum(['rebalance_check', 'quarterly_summary', 'validate_target'])
    .describe('Action: rebalance_check, quarterly_summary, or validate_target'),
  portfolio_path: z
    .string()
    .optional()
    .describe(`Path to PORTFOLIO-HYPERLIQUID.md; default ${DEFAULT_PORTFOLIO_PATH}`),
  target_path: z
    .string()
    .optional()
    .describe('Path to HEARTBEAT.md or SOUL-HL.md for target table; default HEARTBEAT.md'),
  period: z
    .string()
    .optional()
    .describe('Period for quarterly_summary, e.g. 2026-Q1 or 7d'),
});

export const hyperliquidPortfolioOpsTool = new DynamicStructuredTool({
  name: 'hyperliquid_portfolio_ops',
  description:
    'Deterministic HL portfolio ops: rebalance check (drift, alerts, trim/add), quarterly summary (payload for performance_history), validate target.',
  schema,
  func: async (input) => {
    const portfolioPath =
      input.portfolio_path?.trim() || DEFAULT_PORTFOLIO_PATH;

    if (input.action === 'rebalance_check') {
      const result = runRebalanceCheck(portfolioPath, input.target_path);
      return formatToolResult(result);
    }

    if (input.action === 'validate_target') {
      let targetContent: string;
      try {
        targetContent = loadTargetContent(input.target_path);
      } catch {
        return formatToolResult({
          valid: false,
          error: 'Could not read HEARTBEAT.md or SOUL-HL.md',
        });
      }
      const targetRows = parseHIP3TargetMarkdown(targetContent);
      const errors: string[] = [];
      if (targetRows.length === 0) {
        errors.push('No HIP-3 Target table found. Use: Ticker | TargetMin | TargetMax | Category | Notes');
      }
      for (const row of targetRows) {
        if (!KNOWN_HL_SYMBOLS.has(row.ticker)) {
          errors.push(`Unknown HL symbol in target: ${row.ticker}`);
        }
      }
      const pathToCheck = input.portfolio_path?.trim();
      if (pathToCheck && existsSync(pathToCheck)) {
        const content = readFileSync(pathToCheck, 'utf-8');
        const positions = parsePortfolioMarkdown(content);
        const symbolErrors = validateHLPortfolioSymbols(positions, KNOWN_HL_SYMBOLS);
        errors.push(...symbolErrors);
      }
      return formatToolResult({
        valid: errors.length === 0,
        targetRows: targetRows.length,
        errors: errors.length ? errors : undefined,
      });
    }

    if (input.action === 'quarterly_summary') {
      const period = input.period?.trim();
      if (!period) {
        return formatToolResult({ error: 'period is required for quarterly_summary' });
      }
      const perf = await computeHLPeriodReturns(period, portfolioPath);
      const quarterly: {
        portfolio_hl?: number;
        hl_basket: number | null;
        period: string;
        startDate: string;
        endDate: string;
      } = {
        hl_basket: perf.hl_basket,
        period: perf.period,
        startDate: perf.startDate,
        endDate: perf.endDate,
      };
      if (perf.portfolio_hl != null) quarterly.portfolio_hl = perf.portfolio_hl;
      return formatToolResult({
        quarterly,
        error: perf.error,
        warning: perf.warning,
      });
    }

    return formatToolResult({ error: 'Unknown action' });
  },
});
