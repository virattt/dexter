import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { getLiveAccountState, getHLAccountAddress } from './hyperliquid-account-api.js';

const DEXTER_DIR = join(homedir(), '.dexter');
const DEFAULT_PORTFOLIO_HL_PATH = join(DEXTER_DIR, 'PORTFOLIO-HYPERLIQUID.md');

/**
 * Build portfolio markdown table: Ticker | Weight | Category | Notes
 * (Category and Notes left as — for compatibility with parsePortfolioMarkdown and HL ops.)
 */
function buildPortfolioMarkdown(positions: { symbol: string; weightPct: number }[]): string {
  const header = '| Ticker | Weight | Category | Notes |';
  const sep = '| --- | --- | --- | --- |';
  const rows = positions
    .sort((a, b) => b.weightPct - a.weightPct)
    .map((p) => `| ${p.symbol} | ${p.weightPct.toFixed(2)}% | — | — |`);
  return [header, sep, ...rows].join('\n');
}

export const HYPERLIQUID_SYNC_PORTFOLIO_DESCRIPTION = `
Sync live Hyperliquid positions to portfolio markdown (same format as PORTFOLIO-HYPERLIQUID.md).
Fetches clearinghouse state, aggregates by symbol, computes weights, and optionally writes to ~/.dexter/PORTFOLIO-HYPERLIQUID.md.

## When to Use
- User says "sync my HL portfolio", "update PORTFOLIO-HYPERLIQUID from live", "refresh HL holdings to file".
- Before rebalance_check or quarterly_summary when you want to run from live data: call this with write_to_file=true, then hyperliquid_portfolio_ops.

## Requirements
- HYPERLIQUID_ACCOUNT_ADDRESS must be set. If not set, returns not_configured.
`.trim();

export const hyperliquidSyncPortfolioTool = new DynamicStructuredTool({
  name: 'hyperliquid_sync_portfolio',
  description: 'Convert live HL holdings to portfolio markdown and optionally write to PORTFOLIO-HYPERLIQUID.md.',
  schema: z.object({
    write_to_file: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, write the generated table to ~/.dexter/PORTFOLIO-HYPERLIQUID.md'),
  }),
  func: async (input) => {
    const address = getHLAccountAddress();
    if (!address) {
      return formatToolResult({
        configured: false,
        error: 'HYPERLIQUID_ACCOUNT_ADDRESS not set. Set it to your wallet address to sync live HL portfolio.',
      });
    }
    try {
      const state = await getLiveAccountState();
      if (!state) {
        return formatToolResult({
          configured: true,
          accountAddress: address,
          error: 'Failed to fetch clearinghouse state.',
        });
      }
      const positions = state.positions.map((p) => ({ symbol: p.symbol, weightPct: p.weightPct }));
      const markdown = buildPortfolioMarkdown(positions);

      let writtenPath: string | null = null;
      if (input.write_to_file) {
        if (!existsSync(DEXTER_DIR)) mkdirSync(DEXTER_DIR, { recursive: true });
        writeFileSync(DEFAULT_PORTFOLIO_HL_PATH, markdown, 'utf-8');
        writtenPath = DEFAULT_PORTFOLIO_HL_PATH;
      }

      return formatToolResult({
        configured: true,
        accountAddress: state.accountAddress,
        accountValue: state.accountValue,
        positionCount: positions.length,
        markdown,
        written_to_file: writtenPath,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return formatToolResult({
        configured: true,
        accountAddress: address,
        error: message,
      });
    }
  },
});
