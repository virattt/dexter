/**
 * HL execution policy: load from ~/.dexter/hl-execution-policy.json and validate intents (Phase 9b).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HLExecutionIntent } from './hyperliquid-execution-types.js';

const DEXTER = join(homedir(), '.dexter');
const POLICY_JSON_PATH = join(DEXTER, 'hl-execution-policy.json');

export interface HLExecutionPolicy {
  allowedSymbols?: string[];
  maxOrderNotional?: number;
  maxLeverage?: number;
  maxSlippageBps?: number;
  allowMarketOrders?: boolean;
  allowOpeningPositions?: boolean;
  reduceOnlyOnly?: boolean;
}

export function loadHLExecutionPolicy(): HLExecutionPolicy | null {
  if (!existsSync(POLICY_JSON_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(POLICY_JSON_PATH, 'utf-8')) as Record<string, unknown>;
    const p: HLExecutionPolicy = {};
    if (Array.isArray(raw.allowedSymbols)) {
      p.allowedSymbols = raw.allowedSymbols.map((s) => String(s).trim().toUpperCase());
    }
    if (typeof raw.maxOrderNotional === 'number') p.maxOrderNotional = raw.maxOrderNotional;
    if (typeof raw.maxLeverage === 'number') p.maxLeverage = raw.maxLeverage;
    if (typeof raw.maxSlippageBps === 'number') p.maxSlippageBps = raw.maxSlippageBps;
    if (typeof raw.allowMarketOrders === 'boolean') p.allowMarketOrders = raw.allowMarketOrders;
    if (typeof raw.allowOpeningPositions === 'boolean') p.allowOpeningPositions = raw.allowOpeningPositions;
    if (typeof raw.reduceOnlyOnly === 'boolean') p.reduceOnlyOnly = raw.reduceOnlyOnly;
    return p;
  } catch {
    return null;
  }
}

export function validateIntentAgainstPolicy(
  intent: HLExecutionIntent,
  policy: HLExecutionPolicy | null,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  if (!policy) return { valid: true, violations: [] };

  const sym = intent.symbol.trim().toUpperCase();
  if (policy.allowedSymbols != null && policy.allowedSymbols.length > 0) {
    if (!policy.allowedSymbols.includes(sym)) {
      violations.push(`Symbol ${intent.symbol} not in policy allowedSymbols`);
    }
  }
  if (policy.maxOrderNotional != null && intent.notionalUsd > policy.maxOrderNotional) {
    violations.push(
      `Notional ${intent.notionalUsd} exceeds maxOrderNotional ${policy.maxOrderNotional}`,
    );
  }
  if (policy.allowMarketOrders === false && intent.orderType === 'market') {
    violations.push('Market orders disallowed by policy');
  }
  if (policy.allowOpeningPositions === false && !intent.reduceOnly) {
    violations.push('Opening new positions disallowed by policy (reduce-only only)');
  }
  if (policy.reduceOnlyOnly === true && !intent.reduceOnly) {
    violations.push('Policy requires reduce-only');
  }
  return {
    valid: violations.length === 0,
    violations,
  };
}
