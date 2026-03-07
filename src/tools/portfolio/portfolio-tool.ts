import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const PORTFOLIO_MD_PATH = join(homedir(), '.dexter', 'PORTFOLIO.md');

export const PORTFOLIO_TOOL_DESCRIPTION = `
Manage the user's portfolio file (~/.dexter/PORTFOLIO.md).
Used for weekly rebalance checks and quarterly performance reports.

## MANDATORY: Auto-Save on Suggest

When you suggest a portfolio (any allocation with tickers and weights), you MUST call portfolio with action=update to save it. No exceptions.
- NEVER end with "I can format this for you" or "if you want, I can copy-paste" — the file must be written automatically
- Call the tool BEFORE or AS PART OF your final response — do not wait for user confirmation
- Save the main positions table (Ticker, Weight, Layer, Tier) — include BTC, crypto (SOL/NEAR/SUI/ETH), and equity tickers

## When to Use

- User asks you to suggest a portfolio → MUST call update to save (see above)
- User asks "what's in my portfolio?" or "show my holdings" → use view
- User asks to update or replace their portfolio → use update

## Actions

- view: Show the current portfolio (or say it doesn't exist yet)
- update: Save portfolio content. Format:
  # Current Portfolio

  | Ticker | Weight | Layer | Tier |
  |--------|--------|-------|------|
  | BTC    | 55%    | Core  | Core |
  | TSM    | 7%     | Foundry | Core |
  ...
`.trim();

const portfolioSchema = z.object({
  action: z.enum(['view', 'update']),
  content: z
    .string()
    .optional()
    .describe('Portfolio markdown content (required for update). Use table format.'),
});

export const portfolioTool = new DynamicStructuredTool({
  name: 'portfolio',
  description:
    'View or update the portfolio file (~/.dexter/PORTFOLIO.md). Use update after suggesting a portfolio to save it automatically.',
  schema: portfolioSchema,
  func: async (input) => {
    if (input.action === 'view') {
      if (!existsSync(PORTFOLIO_MD_PATH)) {
        return 'No portfolio file yet. Use the update action to save a suggested portfolio.';
      }
      const content = readFileSync(PORTFOLIO_MD_PATH, 'utf-8');
      return `Current portfolio (~/.dexter/PORTFOLIO.md):\n\n${content}`;
    }

    if (input.action === 'update') {
      if (!input.content) {
        return 'Error: content is required for the update action.';
      }
      const dir = dirname(PORTFOLIO_MD_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(PORTFOLIO_MD_PATH, input.content, 'utf-8');
      return `Saved portfolio to ~/.dexter/PORTFOLIO.md (${input.content.length} characters).`;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
