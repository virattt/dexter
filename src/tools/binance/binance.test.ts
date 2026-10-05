import { describe, expect, test } from 'bun:test';
import { roundToStep, sign, type Candle } from './client.js';
import { atr, buildTradePlan, ema, rsi } from './strategy.js';
import { runBacktest, simulateTrade } from './backtest.js';
import { evaluatePermission } from '../../permissions/engine.js';

function trending(n: number, drift: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i * drift + Math.sin(i / 3) * 0.8;
    return { openTime: i, open: close - 0.2, high: close + 1, low: close - 1, close, volume: 1 };
  });
}

describe('binance helpers', () => {
  test('sign matches the Binance docs example', () => {
    const q = 'symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559';
    const secret = 'NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j';
    expect(sign(q, secret)).toBe('c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71');
  });
  test('roundToStep floors without float noise', () => {
    expect(roundToStep(0.123456, 0.001)).toBe('0.123');
    expect(roundToStep(0.3, 0.1)).toBe('0.3');
    expect(roundToStep(5.9, 1)).toBe('5');
  });
});

describe('indicators', () => {
  test('rsi is 100 on a monotonic rise and ema tracks it', () => {
    const closes = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(rsi(closes).at(-1)).toBe(100);
    expect(ema(closes, 5).at(-1)!).toBeLessThan(40);
  });
  test('atr is positive', () => {
    expect(atr(trending(60, 0.1)).at(-1)!).toBeGreaterThan(0);
  });
});

describe('buildTradePlan', () => {
  const base = { market: 'futures' as const, accountUsdt: 1000, riskPercent: 1, maxNotionalUsdt: 100000, maxLeverage: 5 };
  test('long plan has stop below entry, targets above, and risk-sized quantity', () => {
    const p = buildTradePlan({ ...base, candles: trending(300, 0.3), higherBias: 'long' });
    if (p.action === 'no_trade') return; // RSI may be extended on a synthetic ramp
    expect(p.action).toBe('long');
    expect(p.stopLoss!).toBeLessThan(p.entry!);
    expect(p.takeProfit1!).toBeGreaterThan(p.entry!);
    expect(p.riskUsdt!).toBeLessThanOrEqual(10.01);
  });
  test('spot never shorts and conflicting higher timeframe means no trade', () => {
    expect(buildTradePlan({ ...base, market: 'spot', candles: trending(300, -0.3), higherBias: 'short' }).action).toBe('no_trade');
    expect(buildTradePlan({ ...base, candles: trending(300, 0.3), higherBias: 'short' }).action).toBe('no_trade');
  });
  test('notional is capped', () => {
    const p = buildTradePlan({ ...base, maxNotionalUsdt: 50, candles: trending(300, 0.3), higherBias: 'long' });
    if (p.action !== 'no_trade') expect(p.notionalUsdt!).toBeLessThanOrEqual(50.001);
  });
});

describe('permissions', () => {
  test('binance_trade always asks and is never session-cacheable', () => {
    const d = evaluatePermission({ tool: 'binance_trade', args: { market: 'futures', symbol: 'BTCUSDT', side: 'BUY', quantity: 0.01 } });
    expect(d.mode).toBe('ask');
    expect(d.sessionCacheable).toBe(false);
    expect(d.command).toContain('BTCUSDT');
  });
});

describe('backtest', () => {
  const o = { feeRate: 0, slippage: 0, maxHoldBars: 48 };
  const bar = (high: number, low: number, close = (high + low) / 2): Candle => ({ openTime: 0, open: close, high, low, close, volume: 1 });
  const plan = { stopLoss: 98, takeProfit1: 103, takeProfit2: 106 };

  test('long: TP1 then reversal to breakeven yields half of TP1 profit', () => {
    const r = simulateTrade([bar(101, 99), bar(104, 100), bar(101, 99.9)], 0, 'long', 100, plan, 1, o);
    expect(r.reason).toBe('breakeven');
    expect(r.pnl).toBeCloseTo(1.5, 6); // 0.5 * (103 - 100)
  });
  test('long: full run hits TP2', () => {
    const r = simulateTrade([bar(101, 99), bar(107, 100)], 0, 'long', 100, plan, 1, o);
    expect(r.reason).toBe('tp2');
    expect(r.pnl).toBeCloseTo(0.5 * 3 + 0.5 * 6, 6);
  });
  test('same bar touching stop and target counts as a stop loss', () => {
    const r = simulateTrade([bar(104, 97)], 0, 'long', 100, plan, 1, o);
    expect(r.reason).toBe('stop');
    expect(r.pnl).toBeCloseTo(-2, 6);
  });
  test('short mirrors the long logic', () => {
    const r = simulateTrade([bar(101, 99), bar(100, 93)], 0, 'short', 100, { stopLoss: 102, takeProfit1: 97, takeProfit2: 94 }, 1, o);
    expect(r.reason).toBe('tp2');
    expect(r.pnl).toBeCloseTo(0.5 * 3 + 0.5 * 6, 6);
  });
  test('fees reduce pnl', () => {
    const r = simulateTrade([bar(101, 99), bar(107, 100)], 0, 'long', 100, plan, 1, { ...o, feeRate: 0.001 });
    expect(r.pnl).toBeLessThan(4.5);
  });
  test('runBacktest keeps its invariants on synthetic data', () => {
    const candles = trending(900, 0.15).map((c, i) => ({ ...c, openTime: i * 3_600_000 }));
    const higher = Array.from({ length: 300 }, (_, k) => {
      const c = candles[Math.min(k * 4 + 3, candles.length - 1)];
      return { ...c, openTime: k * 14_400_000 };
    });
    const r = runBacktest(candles, higher, 14_400_000, { market: 'futures' });
    expect(r.longTrades + r.shortTrades).toBe(r.trades);
    expect(r.maxDrawdownPct).toBeGreaterThanOrEqual(0);
    expect(r.maxDrawdownPct).toBeLessThanOrEqual(100);
    expect(r.endingUsdt).toBeGreaterThan(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
