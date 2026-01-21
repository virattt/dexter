import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform Alpha Vantage MARKET_STATUS response
 */
function transformMarketStatus(data: Record<string, unknown>): Record<string, unknown> {
  const markets = data['markets'] as Array<Record<string, string>> | undefined;

  return {
    endpoint: data['endpoint'],
    markets: (markets || []).map((market) => ({
      marketType: market['market_type'],
      region: market['region'],
      primaryExchanges: market['primary_exchanges'],
      localOpen: market['local_open'],
      localClose: market['local_close'],
      currentStatus: market['current_status'],
      notes: market['notes'],
    })),
  };
}

export const getMarketStatus = new DynamicStructuredTool({
  name: 'get_market_status',
  description: `Returns the current trading status of major global stock exchanges and whether they are open or closed. Covers US, UK, Canada, Germany, France, Japan, China, India, and other major markets. Useful for understanding when markets are trading.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('MARKET_STATUS', {});
    return formatToolResult(transformMarketStatus(data), [url]);
  },
});
