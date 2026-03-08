#!/usr/bin/env bun
/**
 * Validate ~/.dexter/PORTFOLIO.md and optionally PORTFOLIO-HYPERLIQUID.md.
 * Checks: weights sum to ~100%, required fields (ticker, weight), valid format.
 * Exit 0 if valid, 1 if invalid.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parsePortfolioMarkdown, validateHLPortfolioSymbols } from '../src/utils/portfolio-parse.js';
import { KNOWN_HL_SYMBOLS } from '../src/tools/hyperliquid/hl-fd-mapping.js';

const DEXTER = join(homedir(), '.dexter');
const PORTFOLIO_PATH = join(DEXTER, 'PORTFOLIO.md');
const PORTFOLIO_HL_PATH = join(DEXTER, 'PORTFOLIO-HYPERLIQUID.md');
const WEIGHT_TOLERANCE = 0.02; // ±2%

function parsePortfolio(content: string) {
  return parsePortfolioMarkdown(content);
}

function validatePositions(positions: { ticker: string; weight: number }[], path: string): string[] {
  const errors: string[] = [];
  if (positions.length === 0) {
    errors.push(`${path}: No positions found (expected table with ticker and weight columns)`);
    return errors;
  }
  const total = positions.reduce((s, p) => s + p.weight, 0);
  if (Math.abs(total - 100) > 100 * WEIGHT_TOLERANCE) {
    errors.push(`${path}: Weights sum to ${total.toFixed(1)}% (expected ~100%)`);
  }
  for (const p of positions) {
    if (p.weight < 0 || p.weight > 100) {
      errors.push(`${path}: Invalid weight ${p.weight}% for ${p.ticker}`);
    }
  }
  return errors;
}

function main(): void {
  const errors: string[] = [];

  if (existsSync(PORTFOLIO_PATH)) {
    const content = readFileSync(PORTFOLIO_PATH, 'utf-8');
    const positions = parsePortfolio(content);
    errors.push(...validatePositions(positions, PORTFOLIO_PATH));
  } else {
    console.log('[validate] No PORTFOLIO.md found. Skipping.');
  }

  if (existsSync(PORTFOLIO_HL_PATH)) {
    const content = readFileSync(PORTFOLIO_HL_PATH, 'utf-8');
    const positions = parsePortfolio(content);
    errors.push(...validatePositions(positions, PORTFOLIO_HL_PATH));
    const hlSymbolErrors = validateHLPortfolioSymbols(positions, KNOWN_HL_SYMBOLS);
    for (const e of hlSymbolErrors) {
      errors.push(`${PORTFOLIO_HL_PATH}: ${e}`);
    }
  }

  if (errors.length > 0) {
    console.error('[validate] Validation failed:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  console.log('[validate] Portfolio(s) valid.');
  process.exit(0);
}

main();
