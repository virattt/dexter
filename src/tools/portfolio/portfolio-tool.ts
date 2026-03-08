import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { parsePortfolioMarkdown } from '../../utils/portfolio-parse.js';
import { isTickerTradableOnHyperliquid } from '../tastytrade/utils.js';

const DEXTER_DIR = join(homedir(), '.dexter');
const PORTFOLIO_MD_PATH = join(DEXTER_DIR, 'PORTFOLIO.md');
const PORTFOLIO_HL_PATH = join(DEXTER_DIR, 'PORTFOLIO-HYPERLIQUID.md');

export type PortfolioId = 'default' | 'hyperliquid';

export function getPortfolioPath(portfolioId: PortfolioId): string {
  return portfolioId === 'hyperliquid' ? PORTFOLIO_HL_PATH : PORTFOLIO_MD_PATH;
}

/** Shared write for portfolio content (used by portfolio tool and tastytrade_sync_portfolio). */
export function writePortfolioContent(portfolioId: PortfolioId, content: string): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }
  const path = getPortfolioPath(portfolioId);
  writeFileSync(path, content, 'utf-8');
}

export const PORTFOLIO_TOOL_DESCRIPTION = `
Manage portfolio files. **Use two portfolios** — zero overlap between them.

1. **default** (~/.dexter/PORTFOLIO.md) — Tastytrade sleeve: ONLY tickers that are NOT tradable on Hyperliquid (e.g. TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET). Used for weekly rebalance, theta, and quarterly reports. Saving HL-tradable symbols here is blocked.
2. **hyperliquid** (~/.dexter/PORTFOLIO-HYPERLIQUID.md) — On-chain sleeve: ONLY tickers tradeable on Hyperliquid (HIP-3): BTC, SOL, SUI, NEAR, ETH, HYPE, and on-chain stocks (e.g. AAPL, MSFT, NVDA, PLTR). See docs/HYPERLIQUID-SYMBOL-MAP.md.

## MANDATORY: Auto-Save on Suggest

When you suggest a portfolio (any allocation with tickers and weights), you MUST call portfolio with action=update to save it. No exceptions.
- NEVER end with "I can format this for you" or "if you want, I can copy-paste" — the file must be written automatically
- Call the tool BEFORE or AS PART OF your final response — do not wait for user confirmation
- **Two portfolios:** If the user asks for a full portfolio, suggest BOTH sleeves and make TWO update calls: one with portfolio_id=default (non-HL names only), one with portfolio_id=hyperliquid (HL names only).
- Default (tastytrade): Table Ticker | Weight | Layer | Tier. No AAPL, MSFT, AMZN, META, COIN, BTC, SOL, etc.
- Hyperliquid: Table Ticker | Weight | Category | Notes. Only HL universe. Prefer high-volume underlyings; see docs/PRD-HYPERLIQUID-PORTFOLIO.md §2.1.

## When to Use

- User asks you to suggest a portfolio → MUST call update to save. Prefer suggesting BOTH portfolios and saving both (default + hyperliquid).
- User asks "what's in my portfolio?" or "show my holdings" → use view (default) and/or view with portfolio_id=hyperliquid
- User asks for "tastytrade portfolio" or "non-HL portfolio" → portfolio_id=default only
- User asks for "Hyperliquid portfolio", "on-chain portfolio", "HIP-3 portfolio" → portfolio_id=hyperliquid only

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
      if (portfolioId === 'default') {
        const positions = parsePortfolioMarkdown(input.content);
        const hlTickers = positions.filter((p) => isTickerTradableOnHyperliquid(p.ticker)).map((p) => p.ticker);
        if (hlTickers.length > 0) {
          return `Error: The default portfolio (tastytrade sleeve) must not contain Hyperliquid-tradable symbols. Remove or move these to portfolio_id=hyperliquid (PORTFOLIO-HYPERLIQUID.md): ${hlTickers.join(', ')}.`;
        }
      }
      writePortfolioContent(portfolioId, input.content);
      return `Saved ${label} to ${path} (${input.content.length} characters).`;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
