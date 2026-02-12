import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callAlpacaApi, isPaperMode } from './alpaca-client.js';
import { formatToolResult } from '../types.js';

/**
 * Get trading account details — equity, buying power, cash, mode.
 */
export const getTradingAccount = new DynamicStructuredTool({
  name: 'get_trading_account',
  description: `Fetches the current Alpaca trading account information including equity, buying power, cash balance, and whether the account is in paper (simulated) or live mode.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callAlpacaApi('GET', '/v2/account');
    const account = data as Record<string, unknown>;

    const result = {
      mode: isPaperMode() ? 'paper' : 'live',
      equity: account.equity,
      buying_power: account.buying_power,
      cash: account.cash,
      portfolio_value: account.portfolio_value,
      currency: account.currency,
      status: account.status,
      pattern_day_trader: account.pattern_day_trader,
      daytrade_count: account.daytrade_count,
      last_equity: account.last_equity,
    };

    return formatToolResult(result, [url]);
  },
});

/**
 * Get open positions — all or for a specific ticker.
 */
export const getPositions = new DynamicStructuredTool({
  name: 'get_positions',
  description: `Fetches current open positions from the Alpaca trading account. Can fetch all positions or a specific ticker's position with P&L details.`,
  schema: z.object({
    ticker: z
      .string()
      .optional()
      .describe("Optional: specific ticker to get position for (e.g. 'AAPL'). Omit to get all positions."),
  }),
  func: async (input) => {
    const endpoint = input.ticker ? `/v2/positions/${input.ticker}` : '/v2/positions';
    const { data, url } = await callAlpacaApi('GET', endpoint);

    const mode = isPaperMode() ? 'paper' : 'live';

    // Format position(s) with P&L info
    const positions = Array.isArray(data) ? data : [data];
    const formatted = positions.map((pos: Record<string, unknown>) => ({
      ticker: pos.symbol,
      qty: pos.qty,
      side: pos.side,
      market_value: pos.market_value,
      cost_basis: pos.cost_basis,
      unrealized_pl: pos.unrealized_pl,
      unrealized_plpc: pos.unrealized_plpc,
      current_price: pos.current_price,
      avg_entry_price: pos.avg_entry_price,
      asset_class: pos.asset_class,
    }));

    return formatToolResult({ mode, positions: formatted }, [url]);
  },
});
