import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Connect } from 'kiteconnect';
import { formatToolResult } from '../types.js';
import { getKiteClient } from './client.js';

const VARIETY_REGULAR = 'regular';

function notConfigured(): string {
  return formatToolResult({
    error: 'Zerodha Kite is not configured. Set KITE_API_KEY and KITE_ACCESS_TOKEN (or KITE_REQUEST_TOKEN + KITE_API_SECRET) in .env',
  });
}

export const zerodhaHoldingsTool = new DynamicStructuredTool({
  name: 'zerodha_holdings',
  description: 'Get long-term equity holdings from the Zerodha portfolio (Indian market).',
  schema: z.object({}),
  func: async () => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const data = await kc.getHoldings();
    return formatToolResult(data);
  },
});

export const zerodhaPositionsTool = new DynamicStructuredTool({
  name: 'zerodha_positions',
  description: 'Get open short-term positions from Zerodha (Indian market).',
  schema: z.object({}),
  func: async () => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const data = await kc.getPositions();
    return formatToolResult(data);
  },
});

export const zerodhaMarginsTool = new DynamicStructuredTool({
  name: 'zerodha_margins',
  description: 'Get margin information for equity or commodity segment from Zerodha.',
  schema: z.object({
    segment: z.enum(['equity', 'commodity']).optional().describe('Margin segment (default: equity)'),
  }),
  func: async ({ segment }) => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const data = await kc.getMargins(segment ?? 'equity');
    return formatToolResult(data);
  },
});

export const zerodhaOrdersTool = new DynamicStructuredTool({
  name: 'zerodha_orders',
  description: 'Get list of all orders (open and executed) for the day from Zerodha.',
  schema: z.object({}),
  func: async () => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const data = await kc.getOrders();
    return formatToolResult(data);
  },
});

const exchangeEnum = z.enum(['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX', 'BCD']);
const instrumentsSchema = z.object({
  exchange: exchangeEnum.optional().describe('Exchange code (NSE, BSE, NFO, etc.). Omit for all exchanges.'),
});

export const zerodhaInstrumentsTool = new DynamicStructuredTool({
  name: 'zerodha_instruments',
  description: 'Get list of instruments from Zerodha for an exchange (e.g. NSE, BSE). Use to look up tradingsymbol for placing orders.',
  schema: instrumentsSchema,
  func: async (input) => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const exchange = (input.exchange as string) || undefined;
    const data = await kc.getInstruments(exchange as 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX' | 'BCD');
    return formatToolResult(Array.isArray(data) ? data : data);
  },
});

export const zerodhaQuoteTool = new DynamicStructuredTool({
  name: 'zerodha_quote',
  description: 'Get live quote for one or more instruments from Zerodha. Pass instruments as exchange:tradingsymbol (e.g. NSE:RELIANCE).',
  schema: z.object({
    instruments: z
      .string()
      .describe('Comma-separated instruments in format exchange:tradingsymbol (e.g. NSE:RELIANCE,NSE:INFY)'),
  }),
  func: async ({ instruments }) => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const list = instruments.split(',').map((s) => s.trim()).filter(Boolean);
    const data = await kc.getQuote(list);
    return formatToolResult(data);
  },
});

const placeOrderSchema = z.object({
  exchange: z.enum(['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX', 'BCD']).describe('Exchange code'),
  tradingsymbol: z.string().describe('Trading symbol (e.g. RELIANCE, INFY)'),
  transaction_type: z.enum(['BUY', 'SELL']).describe('BUY or SELL'),
  quantity: z.number().int().positive().describe('Order quantity'),
  order_type: z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M']).describe('Order type'),
  product: z.enum(['NRML', 'MIS', 'CNC', 'CO', 'BO']).describe('Product: NRML, MIS, CNC, CO, BO'),
  price: z.number().optional().describe('Price (required for LIMIT/SL)'),
  trigger_price: z.number().optional().describe('Trigger price (for SL, SL-M)'),
  validity: z.enum(['DAY', 'IOC', 'TTL']).optional().describe('Validity'),
  tag: z.string().max(20).optional().describe('Optional tag for the order'),
});

export const zerodhaPlaceOrderTool = new DynamicStructuredTool({
  name: 'zerodha_place_order',
  description:
    'Place an order on Zerodha Kite (Indian market). Requires user approval before execution. Use for BUY/SELL only when the user has explicitly requested the trade.',
  schema: placeOrderSchema,
  func: async (input) => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const params = {
      exchange: input.exchange,
      tradingsymbol: input.tradingsymbol,
      transaction_type: input.transaction_type,
      quantity: input.quantity,
      order_type: input.order_type,
      product: input.product,
      ...(input.price != null && { price: input.price }),
      ...(input.trigger_price != null && { trigger_price: input.trigger_price }),
      ...(input.validity && { validity: input.validity }),
      ...(input.tag && { tag: input.tag }),
    };
    const result = await kc.placeOrder(
      VARIETY_REGULAR as 'regular',
      params as Parameters<Connect['placeOrder']>[1],
    );
    return formatToolResult(result);
  },
});

const modifyOrderSchema = z.object({
  order_id: z.string().describe('Order ID to modify'),
  quantity: z.number().int().positive().optional().describe('New quantity'),
  order_type: z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M']).optional(),
  price: z.number().optional(),
  trigger_price: z.number().optional(),
  validity: z.enum(['DAY', 'IOC', 'TTL']).optional(),
});

export const zerodhaModifyOrderTool = new DynamicStructuredTool({
  name: 'zerodha_modify_order',
  description: 'Modify an existing order on Zerodha Kite. Requires user approval before execution.',
  schema: modifyOrderSchema,
  func: async (input) => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const { order_id, ...rest } = input;
    const params: Record<string, unknown> = { ...rest };
    const result = await kc.modifyOrder(VARIETY_REGULAR, order_id, params);
    return formatToolResult(result);
  },
});

export const zerodhaCancelOrderTool = new DynamicStructuredTool({
  name: 'zerodha_cancel_order',
  description: 'Cancel an existing order on Zerodha Kite. Requires user approval before execution.',
  schema: z.object({
    order_id: z.string().describe('Order ID to cancel'),
  }),
  func: async ({ order_id }) => {
    const kc = await getKiteClient();
    if (!kc) return notConfigured();
    const result = await kc.cancelOrder(VARIETY_REGULAR, order_id);
    return formatToolResult(result);
  },
});
