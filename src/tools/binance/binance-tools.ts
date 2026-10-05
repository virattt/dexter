import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  binanceRequest,
  getKlines,
  getKlinesHistory,
  getLastPrice,
  intervalMs,
  getSymbolRules,
  hasBinanceKeys,
  isTestnet,
  maxOrderUsdt,
  roundToStep,
  type Market,
} from './client.js';
import { runBacktest } from './backtest.js';
import { buildTradePlan, trendBias } from './strategy.js';

export const BINANCE_DESCRIPTION = `
Binance spot and USDT-M futures: analyze a symbol into a concrete trade plan, read the account, and place orders.

## Tools

- \`binance_analyze\`: read-only. Pulls candles, computes trend/RSI/ATR and returns an entry, stop-loss, two take-profits, position size (fixed-fractional risk) and leverage — or \`no_trade\` with reasons.
- \`binance_backtest\`: read-only, no API key needed. Replays the same strategy on mainnet history. Run it before trusting a plan, and report trade count, win rate, avg R, profit factor, drawdown and the buy-and-hold comparison. Few trades or negative expectancy means the edge is unproven.
- \`binance_account\`: read-only. Balances (spot) or balance + open positions (futures).
- \`binance_trade\`: places a real order. The user is asked to approve EVERY call; never batch or retry it silently.

## Rules

- Always run \`binance_analyze\` before \`binance_trade\`; use its entry/stop/size unless the user overrides.
- Futures entries REQUIRE a stopLoss. Pass takeProfit too. Spot entries should pass both (placed as an OCO sell).
- Orders default to the Binance TESTNET; live trading only when BINANCE_TESTNET=false. State which one is active.
- A per-order notional cap (BINANCE_MAX_ORDER_USDT) is enforced; do not try to work around it.
- Present the plan with its risk (USDT at stake, R:R) and say it is a systematic estimate, not financial advice or a guarantee.
`.trim();

const marketSchema = z.enum(['spot', 'futures']).describe('"spot" or "futures" (USDT-M perpetuals).');

function higherInterval(interval: string): string {
  const map: Record<string, string> = { '5m': '1h', '15m': '1h', '30m': '4h', '1h': '4h', '2h': '4h', '4h': '1d', '1d': '1w' };
  return map[interval] ?? '1d';
}

async function accountUsdt(market: Market): Promise<number> {
  if (market === 'spot') {
    const acc = await binanceRequest<{ balances: Array<{ asset: string; free: string }> }>({ market, path: '/api/v3/account', signed: true });
    return Number(acc.balances.find((b) => b.asset === 'USDT')?.free ?? 0);
  }
  const bal = await binanceRequest<Array<{ asset: string; availableBalance: string }>>({ market, path: '/fapi/v2/balance', signed: true });
  return Number(bal.find((b) => b.asset === 'USDT')?.availableBalance ?? 0);
}

export const binanceAnalyzeTool = new DynamicStructuredTool({
  name: 'binance_analyze',
  description: 'Analyze a Binance symbol and return an optimal trade plan (entry, stop, targets, size, leverage) or no_trade.',
  schema: z.object({
    market: marketSchema,
    symbol: z.string().describe('Binance symbol, e.g. BTCUSDT.'),
    interval: z.string().default('1h').describe('Candle interval: 15m, 1h, 4h, 1d.'),
    riskPercent: z.number().min(0.1).max(5).default(1).describe('Percent of account to risk on the trade.'),
    maxLeverage: z.number().min(1).max(20).default(5).describe('Futures leverage ceiling.'),
    accountUsdt: z.number().positive().optional().describe('Account size override; otherwise fetched from the account, falling back to 1000.'),
  }),
  func: async ({ market, symbol, interval, riskPercent, maxLeverage, accountUsdt: override }) => {
    const sym = symbol.toUpperCase();
    const [candles, higher] = await Promise.all([
      getKlines(market, sym, interval, 300),
      getKlines(market, sym, higherInterval(interval), 300),
    ]);
    // The newest candle is still forming; analyze closed candles only.
    const closed = candles.slice(0, -1);
    let equity = override;
    let equitySource = 'override';
    if (equity === undefined) {
      try {
        equity = hasBinanceKeys() ? await accountUsdt(market) : undefined;
        equitySource = 'account';
      } catch {
        equity = undefined;
      }
    }
    if (!equity) {
      equity = 1000;
      equitySource = 'assumed 1000 USDT';
    }
    const plan = buildTradePlan({
      candles: closed,
      higherBias: trendBias(higher.slice(0, -1)),
      market,
      accountUsdt: equity,
      riskPercent,
      maxNotionalUsdt: maxOrderUsdt(),
      maxLeverage,
    });

    let funding: number | undefined;
    if (market === 'futures') {
      const p = await binanceRequest<{ lastFundingRate: string }>({ market, path: '/fapi/v1/premiumIndex', params: { symbol: sym } });
      funding = Number(p.lastFundingRate);
    }
    return formatToolResult({ symbol: sym, market, interval, testnet: isTestnet(), equityUsdt: equity, equitySource, fundingRate: funding, plan });
  },
});

export const binanceBacktestTool = new DynamicStructuredTool({
  name: 'binance_backtest',
  description:
    'Backtest the binance_analyze strategy on mainnet history (fees, slippage, no lookahead). Returns win rate, avg R, profit factor, return, max drawdown vs buy-and-hold.',
  schema: z.object({
    market: marketSchema,
    symbol: z.string().describe('Binance symbol, e.g. BTCUSDT.'),
    interval: z.string().default('1h').describe('Candle interval: 15m, 1h, 4h.'),
    days: z.number().int().min(30).max(730).default(180).describe('History length in days.'),
    riskPercent: z.number().min(0.1).max(5).default(1),
    maxLeverage: z.number().min(1).max(20).default(5),
    startingUsdt: z.number().positive().default(1000),
  }),
  func: async ({ market, symbol, interval, days, riskPercent, maxLeverage, startingUsdt }) => {
    const sym = symbol.toUpperCase();
    const higherIv = higherInterval(interval);
    const barsPerDay = 86_400_000 / intervalMs(interval);
    // +250 warm-up bars so the first signal has a full EMA200 history.
    const total = Math.ceil(days * barsPerDay) + 250;
    const higherTotal = Math.ceil((total * intervalMs(interval)) / intervalMs(higherIv)) + 300;
    const [candles, higher] = await Promise.all([
      getKlinesHistory(market, sym, interval, total),
      getKlinesHistory(market, sym, higherIv, higherTotal),
    ]);
    const result = runBacktest(candles.slice(0, -1), higher, intervalMs(higherIv), { market, riskPercent, maxLeverage, startingUsdt });
    return formatToolResult({ symbol: sym, market, interval, higherInterval: higherIv, days, candles: candles.length, ...result });
  },
});

export const binanceAccountTool =new DynamicStructuredTool({
  name: 'binance_account',
  description: 'Read Binance account balances (spot) or balance and open positions (futures).',
  schema: z.object({ market: marketSchema }),
  func: async ({ market }) => {
    if (market === 'spot') {
      const acc = await binanceRequest<{ balances: Array<{ asset: string; free: string; locked: string }> }>({ market, path: '/api/v3/account', signed: true });
      const balances = acc.balances.filter((b) => Number(b.free) + Number(b.locked) > 0);
      return formatToolResult({ market, testnet: isTestnet(), balances });
    }
    const [balance, positions] = await Promise.all([
      binanceRequest<Array<{ asset: string; balance: string; availableBalance: string }>>({ market, path: '/fapi/v2/balance', signed: true }),
      binanceRequest<Array<Record<string, string>>>({ market, path: '/fapi/v2/positionRisk', signed: true }),
    ]);
    return formatToolResult({
      market,
      testnet: isTestnet(),
      balance: balance.filter((b) => Number(b.balance) > 0),
      positions: positions.filter((p) => Number(p.positionAmt) !== 0),
    });
  },
});

const tradeSchema = z.object({
  market: marketSchema,
  symbol: z.string().describe('Binance symbol, e.g. BTCUSDT.'),
  side: z.enum(['BUY', 'SELL']).describe('BUY=long, SELL=short (futures) or sell (spot).'),
  quantity: z.number().positive().describe('Order size in base asset (e.g. BTC).'),
  orderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
  price: z.number().positive().optional().describe('Required for LIMIT.'),
  stopLoss: z.number().positive().optional().describe('Protective stop trigger price. Required when opening a futures position.'),
  takeProfit: z.number().positive().optional().describe('Take-profit price.'),
  leverage: z.number().int().min(1).max(20).optional().describe('Futures leverage (isolated margin).'),
  reduceOnly: z.boolean().default(false).describe('Futures: only reduce an existing position (use to close).'),
});

export type TradeInput = z.infer<typeof tradeSchema>;

/** One-line summary shown in the approval prompt. */
export function describeTrade(a: Partial<TradeInput>): string {
  const env = isTestnet() ? 'TESTNET' : 'LIVE';
  return (
    `[${env}] ${String(a.market ?? '?').toUpperCase()} ${a.side} ${a.quantity} ${a.symbol} ${a.orderType ?? 'MARKET'}` +
    (a.price ? ` @${a.price}` : '') +
    (a.stopLoss ? ` SL ${a.stopLoss}` : '') +
    (a.takeProfit ? ` TP ${a.takeProfit}` : '') +
    (a.leverage ? ` ${a.leverage}x` : '') +
    (a.reduceOnly ? ' reduceOnly' : '')
  );
}

export const binanceTradeTool = new DynamicStructuredTool({
  name: 'binance_trade',
  description: 'Place a Binance spot or futures order with optional stop-loss / take-profit. Requires user approval on every call.',
  schema: tradeSchema,
  func: async (input) => {
    const { market, side, orderType, reduceOnly } = input;
    const symbol = input.symbol.toUpperCase();
    const opening = market === 'spot' ? side === 'BUY' : !reduceOnly;
    const rules = await getSymbolRules(market, symbol);
    const ref = input.orderType === 'LIMIT' ? (input.price ?? 0) : await getLastPrice(market, symbol);
    if (orderType === 'LIMIT' && !input.price) throw new Error('LIMIT orders require a price.');

    const qty = roundToStep(input.quantity, rules.stepSize);
    const notional = Number(qty) * ref;
    if (Number(qty) < rules.minQty || notional < rules.minNotional) {
      throw new Error(`Order too small: qty ${qty} (~${notional.toFixed(2)} USDT) is below the exchange minimum.`);
    }
    if (opening && notional > maxOrderUsdt()) {
      throw new Error(`Notional ${notional.toFixed(2)} USDT exceeds BINANCE_MAX_ORDER_USDT (${maxOrderUsdt()}).`);
    }
    if (opening && market === 'futures' && !input.stopLoss) throw new Error('A stopLoss is required when opening a futures position.');
    if (input.stopLoss) {
      const wrongSide = side === 'BUY' ? input.stopLoss >= ref : input.stopLoss <= ref;
      if (wrongSide && market === 'futures') throw new Error('stopLoss is on the wrong side of the entry price.');
    }
    const px = (v: number) => roundToStep(v, rules.tickSize);
    const exitSide = side === 'BUY' ? 'SELL' : 'BUY';

    if (market === 'spot') {
      const order = await binanceRequest<{ orderId: number; status: string; executedQty: string }>({
        market,
        method: 'POST',
        path: '/api/v3/order',
        params: {
          symbol,
          side,
          type: orderType,
          quantity: qty,
          price: orderType === 'LIMIT' ? px(input.price!) : undefined,
          timeInForce: orderType === 'LIMIT' ? 'GTC' : undefined,
          newOrderRespType: 'RESULT',
        },
      });
      let exits: unknown;
      if (side === 'BUY' && input.stopLoss && input.takeProfit && order.status === 'FILLED') {
        // Stop-limit sits slightly below the trigger so it still fills in a fast move.
        exits = await binanceRequest({
          market,
          method: 'POST',
          path: '/api/v3/orderList/oco',
          params: {
            symbol,
            side: 'SELL',
            quantity: roundToStep(Number(order.executedQty), rules.stepSize),
            aboveType: 'LIMIT_MAKER',
            abovePrice: px(input.takeProfit),
            belowType: 'STOP_LOSS_LIMIT',
            belowStopPrice: px(input.stopLoss),
            belowPrice: px(input.stopLoss * 0.998),
            belowTimeInForce: 'GTC',
          },
        });
      }
      const note = side === 'BUY' && (input.stopLoss || input.takeProfit) && !exits ? 'Entry not yet filled or SL/TP incomplete: no protective OCO placed. Place it after the fill.' : undefined;
      return formatToolResult({ testnet: isTestnet(), entry: order, exits, note });
    }

    // Futures
    if (input.leverage && opening) {
      await binanceRequest({ market, method: 'POST', path: '/fapi/v1/leverage', params: { symbol, leverage: input.leverage }, signed: true });
      // Error -4046 means margin type is already ISOLATED; safe to ignore.
      await binanceRequest({ market, method: 'POST', path: '/fapi/v1/marginType', params: { symbol, marginType: 'ISOLATED' }, signed: true }).catch(() => undefined);
    }
    const entry = await binanceRequest<{ orderId: number; status: string }>({
      market,
      method: 'POST',
      path: '/fapi/v1/order',
      params: {
        symbol,
        side,
        type: orderType,
        quantity: qty,
        price: orderType === 'LIMIT' ? px(input.price!) : undefined,
        timeInForce: orderType === 'LIMIT' ? 'GTC' : undefined,
        reduceOnly: reduceOnly ? 'true' : undefined,
        newOrderRespType: 'RESULT',
      },
      signed: true,
    });

    const exits: unknown[] = [];
    const algo = (type: 'STOP_MARKET' | 'TAKE_PROFIT_MARKET', trigger: number) =>
      binanceRequest({
        market,
        method: 'POST',
        path: '/fapi/v1/algoOrder',
        params: { algoType: 'CONDITIONAL', symbol, side: exitSide, type, triggerPrice: px(trigger), closePosition: 'true', workingType: 'MARK_PRICE' },
        signed: true,
      });
    try {
      if (input.stopLoss && opening) exits.push(await algo('STOP_MARKET', input.stopLoss));
      if (input.takeProfit && opening) exits.push(await algo('TAKE_PROFIT_MARKET', input.takeProfit));
    } catch (err) {
      // Never leave a market-filled position unprotected: flatten it if the stop could not be placed.
      if (orderType === 'MARKET') {
        await binanceRequest({
          market,
          method: 'POST',
          path: '/fapi/v1/order',
          params: { symbol, side: exitSide, type: 'MARKET', quantity: qty, reduceOnly: 'true' },
          signed: true,
        }).catch(() => undefined);
      }
      throw new Error(`Entry was placed but SL/TP failed (${err instanceof Error ? err.message : err}). Position was flattened if it was a market order; verify with binance_account.`);
    }
    return formatToolResult({ testnet: isTestnet(), entry, exits });
  },
});
