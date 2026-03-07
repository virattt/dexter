import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const FUND_CONFIG_PATH = join(homedir(), '.dexter', 'fund-config.json');

export const FUND_CONFIG_TOOL_DESCRIPTION = `
Manage fund config (~/.dexter/fund-config.json) for AUM and inception date.
Used for dollar-amount rebalance recommendations.

## When to Use

- User asks to set or view AUM
- User asks for rebalance actions in dollar amounts
- Heartbeat rebalance: when AUM is set, output "Sell $X of Ticker, Buy $Y of Ticker"

## Schema

{ "aum": number (optional), "inceptionDate": "YYYY-MM-DD" (optional) }

## Actions

- view: Show current config (or say not set)
- update: Set aum and/or inceptionDate. aum in dollars (e.g. 1000000).
`.trim();

const fundConfigSchema = z.object({
  action: z.enum(['view', 'update']),
  aum: z.number().optional().describe('AUM in dollars (e.g. 1000000)'),
  inceptionDate: z.string().optional().describe('Inception date YYYY-MM-DD'),
});

export const fundConfigTool = new DynamicStructuredTool({
  name: 'fund_config',
  description: 'View or update fund config (AUM, inception date) for dollar rebalance recommendations.',
  schema: fundConfigSchema,
  func: async (input) => {
    if (input.action === 'view') {
      if (!existsSync(FUND_CONFIG_PATH)) {
        return 'No fund config yet. Use update to set aum and/or inceptionDate.';
      }
      const content = readFileSync(FUND_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content) as { aum?: number; inceptionDate?: string };
      return `Fund config: ${JSON.stringify(config, null, 2)}`;
    }

    if (input.action === 'update') {
      const dir = join(homedir(), '.dexter');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      let config: { aum?: number; inceptionDate?: string } = {};
      if (existsSync(FUND_CONFIG_PATH)) {
        config = JSON.parse(readFileSync(FUND_CONFIG_PATH, 'utf-8'));
      }
      if (input.aum !== undefined) config.aum = input.aum;
      if (input.inceptionDate !== undefined) config.inceptionDate = input.inceptionDate;
      writeFileSync(FUND_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      return `Updated fund config: ${JSON.stringify(config, null, 2)}`;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
