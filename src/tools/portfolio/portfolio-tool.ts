import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const DEXTER_DIR = join(homedir(), '.dexter');
const PORTFOLIO_MD_PATH = join(DEXTER_DIR, 'PORTFOLIO.md');
const PORTFOLIO_HL_PATH = join(DEXTER_DIR, 'PORTFOLIO-HYPERLIQUID.md');

export type PortfolioId = 'default' | 'hyperliquid';

function getPortfolioPath(portfolioId: PortfolioId): string {
  return portfolioId === 'hyperliquid' ? PORTFOLIO_HL_PATH : PORTFOLIO_MD_PATH;
}

export const PORTFOLIO_TOOL_DESCRIPTION = `
Manage portfolio files. Two portfolios are supported:

1. **default** (~/.dexter/PORTFOLIO.md) — Main portfolio: thesis-aligned, BTC + equities + crypto. Used for weekly rebalance and quarterly reports.
2. **hyperliquid** (~/.dexter/PORTFOLIO-HYPERLIQUID.md) — On-chain portfolio: only tickers tradeable 24/7 on Hyperliquid (HIP-3). No fiat conversion; tax-friendly. See docs/HYPERLIQUID-SYMBOL-MAP.md for HL→FD ticker mapping.

## MANDATORY: Auto-Save on Suggest

When you suggest a portfolio (any allocation with tickers and weights), you MUST call portfolio with action=update to save it. No exceptions.
- NEVER end with "I can format this for you" or "if you want, I can copy-paste" — the file must be written automatically
- Call the tool BEFORE or AS PART OF your final response — do not wait for user confirmation
- For main portfolio: include BTC, crypto (SOL/NEAR/SUI/ETH), equity tickers. Table: Ticker | Weight | Layer | Tier
- For Hyperliquid portfolio: only use tickers from the HL universe (stocks, commodities via ETFs, indices via proxies). Prefer high-volume underlyings — call hyperliquid_liquidity for live volume ranking or see docs/PRD-HYPERLIQUID-PORTFOLIO.md §2.1. For rebalance vs target, call hyperliquid_portfolio_ops with action=rebalance_check (target from HEARTBEAT.md "## HIP-3 Target"). Table: Ticker | Weight | Category | Notes

## When to Use

- User asks you to suggest a portfolio → MUST call update to save (see above). Use portfolio_id=default for main, portfolio_id=hyperliquid for on-chain.
- User asks "what's in my portfolio?" or "show my holdings" → use view (default) or view with portfolio_id=hyperliquid for on-chain
- User asks to update or replace their portfolio → use update
- User asks for a "Hyperliquid portfolio", "on-chain portfolio", "HIP-3 portfolio" → use portfolio_id=hyperliquid

## Actions

- view: Show the current portfolio (or say it doesn't exist yet)
- update: Save portfolio content. Use portfolio_id to choose which file.
`.trim();

const portfolioSchema = z.object({
  action: z.enum(['view', 'update']),
  portfolio_id: z
    .enum(['default', 'hyperliquid'])
    .optional()
    .default('default')
    .describe(
      'Which portfolio: default (main, PORTFOLIO.md) or hyperliquid (on-chain, PORTFOLIO-HYPERLIQUID.md). Use hyperliquid when suggesting an on-chain-only portfolio.'
    ),
  content: z
    .string()
    .optional()
    .describe('Portfolio markdown content (required for update). Use table format.'),
});

export const portfolioTool = new DynamicStructuredTool({
  name: 'portfolio',
  description:
    'View or update portfolio files. Supports default (main) and hyperliquid (on-chain, HIP-3). Use update after suggesting a portfolio to save it automatically.',
  schema: portfolioSchema,
  func: async (input) => {
    const portfolioId = (input.portfolio_id ?? 'default') as PortfolioId;
    const path = getPortfolioPath(portfolioId);
    const label = portfolioId === 'hyperliquid' ? 'Hyperliquid portfolio' : 'portfolio';

    if (input.action === 'view') {
      if (!existsSync(path)) {
        return `No ${label} file yet. Use the update action with portfolio_id=${portfolioId} to save a suggested portfolio.`;
      }
      const content = readFileSync(path, 'utf-8');
      return `Current ${label} (${path}):\n\n${content}`;
    }

    if (input.action === 'update') {
      if (!input.content) {
        return 'Error: content is required for the update action.';
      }
      if (!existsSync(DEXTER_DIR)) {
        mkdirSync(DEXTER_DIR, { recursive: true });
      }
      writeFileSync(path, input.content, 'utf-8');
      return `Saved ${label} to ${path} (${input.content.length} characters).`;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
