import type { Candle } from './client.js';

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

/** Wilder's RSI. Returns one value per input after the warm-up (NaN before). */
export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Wilder's ATR. */
export function atr(candles: Candle[], period = 14): number[] {
  const tr = candles.map((c, i) =>
    i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)),
  );
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return out;
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export type Bias = 'long' | 'short' | 'none';

/** Trend bias from price vs EMA50 vs EMA200 (used for the higher-timeframe filter). */
export function trendBias(candles: Candle[]): Bias {
  if (candles.length < 200) return 'none';
  const closes = candles.map((c) => c.close);
  const e50 = ema(closes, 50).at(-1)!;
  const e200 = ema(closes, 200).at(-1)!;
  const last = closes.at(-1)!;
  if (last > e50 && e50 > e200) return 'long';
  if (last < e50 && e50 < e200) return 'short';
  return 'none';
}

export interface TradePlanInput {
  candles: Candle[];
  higherBias: Bias;
  market: 'spot' | 'futures';
  accountUsdt: number;
  riskPercent: number;
  maxNotionalUsdt: number;
  maxLeverage: number;
}

export interface TradePlan {
  action: 'long' | 'short' | 'no_trade';
  reasons: string[];
  entry?: number;
  entryType?: 'LIMIT' | 'MARKET';
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  riskReward?: number;
  quantity?: number;
  notionalUsdt?: number;
  riskUsdt?: number;
  leverage?: number;
  indicators: { close: number; ema20: number; ema50: number; ema200: number; rsi: number; atr: number; higherBias: Bias };
}

const ATR_SL_MULT = 1.5;
const MIN_RR_TP1 = 1.5;
const MIN_ATR_PCT = 0.002; // below 0.2% ATR the move can't beat fees/slippage

/**
 * Trend-pullback plan: trade only with the higher-timeframe trend, enter on a pullback to
 * EMA20 when RSI is not extended, stop at 1.5×ATR (or beyond the recent swing), size by fixed
 * fractional risk. Returns `no_trade` with reasons when conditions aren't met — doing nothing
 * is a valid outcome.
 */
export function buildTradePlan(input: TradePlanInput): TradePlan {
  const { candles, higherBias, market, accountUsdt, riskPercent, maxNotionalUsdt, maxLeverage } = input;
  const closes = candles.map((c) => c.close);
  const close = closes.at(-1)!;
  const e20 = ema(closes, 20).at(-1)!;
  const e50 = ema(closes, 50).at(-1)!;
  const e200 = ema(closes, 200).at(-1)!;
  const r = rsi(closes).at(-1)!;
  const a = atr(candles).at(-1)!;
  const indicators = { close, ema20: e20, ema50: e50, ema200: e200, rsi: r, atr: a, higherBias };
  const none = (reasons: string[]): TradePlan => ({ action: 'no_trade', reasons, indicators });

  if (candles.length < 200 || !Number.isFinite(r) || !Number.isFinite(a)) return none(['Not enough candle history.']);
  if (a / close < MIN_ATR_PCT) return none(['Volatility too low: ATR is under 0.2% of price.']);

  const localBias = trendBias(candles);
  let side: 'long' | 'short';
  if (localBias === 'long' && higherBias !== 'short') side = 'long';
  else if (localBias === 'short' && higherBias !== 'long' && market === 'futures') side = 'short';
  else {
    const why = localBias === 'short' && market === 'spot' ? 'Bearish trend and spot cannot short.' : 'No aligned trend (local and higher timeframe disagree or are flat).';
    return none([why]);
  }

  const reasons: string[] = [`${side} bias: EMA50/EMA200 trend agrees with higher timeframe (${higherBias}).`];
  if (side === 'long' && r > 70) return none([...reasons, `RSI ${r.toFixed(0)} is overbought; wait for a pullback.`]);
  if (side === 'short' && r < 30) return none([...reasons, `RSI ${r.toFixed(0)} is oversold; wait for a bounce.`]);

  // Extended price (>0.5 ATR from EMA20) → wait for a limit fill at EMA20; otherwise enter near market.
  const stretch = Math.abs(close - e20) / a;
  const entry = stretch > 0.5 ? e20 : close;
  const entryType: 'LIMIT' | 'MARKET' = stretch > 0.5 ? 'LIMIT' : 'MARKET';
  if (stretch > 0.5) reasons.push(`Price is ${stretch.toFixed(1)} ATR from EMA20; limit entry at the EMA20 pullback.`);

  const recent = candles.slice(-10);
  const swing = side === 'long' ? Math.min(...recent.map((c) => c.low)) : Math.max(...recent.map((c) => c.high));
  const atrStop = side === 'long' ? entry - ATR_SL_MULT * a : entry + ATR_SL_MULT * a;
  // Use whichever stop is further so normal noise doesn't tag it, but cap at 2.5 ATR.
  const wide = side === 'long' ? Math.min(atrStop, swing - 0.1 * a) : Math.max(atrStop, swing + 0.1 * a);
  const stopLoss = side === 'long' ? Math.max(wide, entry - 2.5 * a) : Math.min(wide, entry + 2.5 * a);
  const risk = Math.abs(entry - stopLoss);
  const sgn = side === 'long' ? 1 : -1;
  const takeProfit1 = entry + sgn * risk * MIN_RR_TP1;
  const takeProfit2 = entry + sgn * risk * 3;

  const riskUsdt = accountUsdt * (riskPercent / 100);
  let quantity = riskUsdt / risk;
  const cap = market === 'futures' ? Math.min(maxNotionalUsdt, accountUsdt * maxLeverage) : Math.min(maxNotionalUsdt, accountUsdt);
  if (quantity * entry > cap) quantity = cap / entry;
  const notionalUsdt = quantity * entry;
  const leverage = market === 'futures' ? Math.min(maxLeverage, Math.max(1, Math.ceil(notionalUsdt / accountUsdt))) : undefined;

  reasons.push(`Stop ${(risk / entry * 100).toFixed(2)}% away (≈${(risk / a).toFixed(1)} ATR); TP1 at 1.5R, TP2 at 3R.`);
  return {
    action: side,
    reasons,
    entry,
    entryType,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward: 3,
    quantity,
    notionalUsdt,
    riskUsdt: quantity * risk,
    leverage,
    indicators,
  };
}
