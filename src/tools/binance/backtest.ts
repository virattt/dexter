import type { Candle } from './client.js';
import { buildTradePlan, trendBias, type TradePlan } from './strategy.js';

export interface BacktestOptions {
  market: 'spot' | 'futures';
  riskPercent: number;
  maxLeverage: number;
  startingUsdt: number;
  /** Fee per side as a fraction (0.0005 = 0.05% taker). */
  feeRate: number;
  /** Adverse slippage on market-type fills (entries, stops, timeouts). */
  slippage: number;
  /** Bars a limit entry may wait before being cancelled. */
  limitWaitBars: number;
  /** Bars a position may stay open before being closed at market. */
  maxHoldBars: number;
}

export const DEFAULT_BACKTEST: Omit<BacktestOptions, 'market'> = {
  riskPercent: 1,
  maxLeverage: 5,
  startingUsdt: 1000,
  feeRate: 0.0005,
  slippage: 0.0002,
  limitWaitBars: 6,
  maxHoldBars: 48,
};

export interface Trade {
  side: 'long' | 'short';
  entryTime: number;
  exitTime: number;
  entry: number;
  exit: number;
  pnlUsdt: number;
  r: number;
  reason: 'stop' | 'breakeven' | 'tp2' | 'timeout';
}

export interface BacktestResult {
  trades: number;
  winRate: number;
  avgR: number;
  profitFactor: number | null;
  totalReturnPct: number;
  maxDrawdownPct: number;
  endingUsdt: number;
  buyAndHoldPct: number;
  longTrades: number;
  shortTrades: number;
  recent: Trade[];
  warnings: string[];
}

interface Sim {
  exit: number;
  exitIdx: number;
  pnl: number;
  reason: Trade['reason'];
}

/**
 * Walk one position forward from `fillIdx`. Half closes at TP1 and the stop moves to breakeven;
 * the rest exits at TP2, the stop, or at market after `maxHoldBars`. If a bar touches both the
 * stop and a target, the stop is assumed to hit first (conservative).
 */
export function simulateTrade(
  candles: Candle[],
  fillIdx: number,
  side: 'long' | 'short',
  entry: number,
  plan: Pick<TradePlan, 'stopLoss' | 'takeProfit1' | 'takeProfit2'>,
  qty: number,
  o: Pick<BacktestOptions, 'feeRate' | 'slippage' | 'maxHoldBars'>,
): Sim {
  const sgn = side === 'long' ? 1 : -1;
  const slip = (p: number) => p * (1 - sgn * o.slippage); // adverse for the exit direction
  let stop = plan.stopLoss!;
  let remaining = 1;
  let pnl = -entry * qty * o.feeRate;
  let tp1Hit = false;
  const close = (price: number, frac: number) => {
    pnl += sgn * (price - entry) * qty * frac - price * qty * frac * o.feeRate;
    remaining -= frac;
  };
  const last = Math.min(candles.length - 1, fillIdx + o.maxHoldBars);
  for (let j = fillIdx; j <= last; j++) {
    const c = candles[j];
    const stopHit = sgn === 1 ? c.low <= stop : c.high >= stop;
    if (stopHit) {
      const px = slip(stop);
      close(px, remaining);
      return { exit: px, exitIdx: j, pnl, reason: tp1Hit ? 'breakeven' : 'stop' };
    }
    const reach = (t: number) => (sgn === 1 ? c.high >= t : c.low <= t);
    if (!tp1Hit && reach(plan.takeProfit1!)) {
      close(plan.takeProfit1!, 0.5);
      tp1Hit = true;
      stop = entry;
    }
    if (tp1Hit && reach(plan.takeProfit2!)) {
      close(plan.takeProfit2!, remaining);
      return { exit: plan.takeProfit2!, exitIdx: j, pnl, reason: 'tp2' };
    }
  }
  const px = slip(candles[last].close);
  close(px, remaining);
  return { exit: px, exitIdx: last, pnl, reason: 'timeout' };
}

/**
 * Replays buildTradePlan bar by bar. Signals use only candles closed at bar i; fills happen on
 * bar i+1 or later, so there is no lookahead. One position at a time, risk sized on running equity.
 */
export function runBacktest(
  candles: Candle[],
  higher: Candle[],
  higherMs: number,
  opts: Partial<BacktestOptions> & { market: 'spot' | 'futures' },
): BacktestResult {
  const o: BacktestOptions = { ...DEFAULT_BACKTEST, ...opts };
  const WARMUP = 250;
  const trades: Trade[] = [];
  let equity = o.startingUsdt;
  let peak = equity;
  let maxDd = 0;
  let hi = 0; // first higher-timeframe candle not yet closed at bar i

  let i = WARMUP;
  while (i < candles.length - 2) {
    const now = candles[i + 1].openTime; // close time of bar i
    while (hi < higher.length && higher[hi].openTime + higherMs <= now) hi++;
    const plan = buildTradePlan({
      candles: candles.slice(Math.max(0, i - 299), i + 1),
      higherBias: trendBias(higher.slice(Math.max(0, hi - 300), hi)),
      market: o.market,
      accountUsdt: equity,
      riskPercent: o.riskPercent,
      maxNotionalUsdt: Infinity,
      maxLeverage: o.maxLeverage,
    });
    if (plan.action === 'no_trade') {
      i++;
      continue;
    }

    const side = plan.action;
    const sgn = side === 'long' ? 1 : -1;
    let fillIdx = -1;
    let entry = plan.entry!;
    if (plan.entryType === 'MARKET') {
      fillIdx = i + 1;
      entry = candles[fillIdx].open * (1 + sgn * o.slippage);
    } else {
      for (let j = i + 1; j <= Math.min(candles.length - 1, i + o.limitWaitBars); j++) {
        if (sgn === 1 ? candles[j].low <= entry : candles[j].high >= entry) {
          fillIdx = j;
          break;
        }
      }
    }
    // Skip if no fill, or the real fill already sits beyond the stop (gap).
    if (fillIdx < 0 || (sgn === 1 ? entry <= plan.stopLoss! : entry >= plan.stopLoss!)) {
      i++;
      continue;
    }

    const riskPerUnit = Math.abs(entry - plan.stopLoss!);
    const cap = o.market === 'futures' ? equity * o.maxLeverage : equity;
    const qty = Math.min((equity * o.riskPercent) / 100 / riskPerUnit, cap / entry);
    const sim = simulateTrade(candles, fillIdx, side, entry, plan, qty, o);
    const riskUsdt = qty * riskPerUnit;
    equity += sim.pnl;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, (peak - equity) / peak);
    trades.push({
      side,
      entryTime: candles[fillIdx].openTime,
      exitTime: candles[sim.exitIdx].openTime,
      entry,
      exit: sim.exit,
      pnlUsdt: sim.pnl,
      r: sim.pnl / riskUsdt,
      reason: sim.reason,
    });
    if (equity <= 0) break;
    i = sim.exitIdx + 1;
  }

  const wins = trades.filter((t) => t.pnlUsdt > 0);
  const grossWin = wins.reduce((a, t) => a + t.pnlUsdt, 0);
  const grossLoss = trades.filter((t) => t.pnlUsdt <= 0).reduce((a, t) => a - t.pnlUsdt, 0);
  const first = candles[WARMUP]?.close ?? candles[0].close;
  const warnings: string[] = [];
  if (trades.length < 30) warnings.push(`Only ${trades.length} trades: too few to be statistically meaningful.`);
  warnings.push('Past performance does not predict future results; fills are simulated (no order-book depth, funding costs or outages).');
  return {
    trades: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    avgR: trades.length ? trades.reduce((a, t) => a + t.r, 0) / trades.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    totalReturnPct: (equity / o.startingUsdt - 1) * 100,
    maxDrawdownPct: maxDd * 100,
    endingUsdt: equity,
    buyAndHoldPct: (candles.at(-1)!.close / first - 1) * 100,
    longTrades: trades.filter((t) => t.side === 'long').length,
    shortTrades: trades.filter((t) => t.side === 'short').length,
    recent: trades.slice(-10),
    warnings,
  };
}
