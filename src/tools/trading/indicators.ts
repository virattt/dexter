import { RSI, MACD, BollingerBands, EMA, SMA, ATR, Stochastic } from 'technicalindicators';

export interface IndicatorResult {
  name: string;
  values: unknown;
  signal: 'bullish' | 'bearish' | 'neutral';
  interpretation: string;
}

export interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Compute RSI (Relative Strength Index).
 * Overbought > 70, Oversold < 30.
 */
export function computeRSI(closes: number[], period = 14): IndicatorResult {
  const values = RSI.calculate({ values: closes, period });
  const latest = values[values.length - 1];

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = `RSI(${period}): ${latest?.toFixed(2) ?? 'N/A'}`;

  if (latest !== undefined) {
    if (latest > 70) {
      signal = 'bearish';
      interpretation += ' — Overbought (>70), potential reversal down';
    } else if (latest < 30) {
      signal = 'bullish';
      interpretation += ' — Oversold (<30), potential reversal up';
    } else {
      interpretation += ' — Neutral range';
    }
  }

  return { name: 'RSI', values: { period, latest, history: values.slice(-10) }, signal, interpretation };
}

/**
 * Compute MACD (Moving Average Convergence Divergence).
 * Bullish when MACD crosses above signal line.
 */
export function computeMACD(closes: number[]): IndicatorResult {
  const values = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const latest = values[values.length - 1];
  const prev = values[values.length - 2];

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = 'MACD: ';

  if (latest?.MACD !== undefined && latest?.signal !== undefined) {
    const macdVal = latest.MACD;
    const signalVal = latest.signal;
    const histogram = latest.histogram ?? 0;
    interpretation += `MACD=${macdVal.toFixed(2)}, Signal=${signalVal.toFixed(2)}, Histogram=${histogram.toFixed(2)}`;

    // Detect crossovers
    if (prev?.MACD !== undefined && prev?.signal !== undefined) {
      const prevAbove = prev.MACD > prev.signal;
      const currAbove = macdVal > signalVal;

      if (!prevAbove && currAbove) {
        signal = 'bullish';
        interpretation += ' — Bullish crossover (MACD crossed above signal)';
      } else if (prevAbove && !currAbove) {
        signal = 'bearish';
        interpretation += ' — Bearish crossover (MACD crossed below signal)';
      } else if (currAbove) {
        signal = 'bullish';
        interpretation += ' — MACD above signal line';
      } else {
        signal = 'bearish';
        interpretation += ' — MACD below signal line';
      }
    }
  } else {
    interpretation += 'Insufficient data';
  }

  return { name: 'MACD', values: { latest, history: values.slice(-10) }, signal, interpretation };
}

/**
 * Compute Exponential Moving Average.
 */
export function computeEMA(closes: number[], period: number): IndicatorResult {
  const values = EMA.calculate({ values: closes, period });
  const latest = values[values.length - 1];
  const currentPrice = closes[closes.length - 1];

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = `EMA(${period}): ${latest?.toFixed(2) ?? 'N/A'}`;

  if (latest !== undefined && currentPrice !== undefined) {
    if (currentPrice > latest) {
      signal = 'bullish';
      interpretation += ` — Price (${currentPrice.toFixed(2)}) above EMA, bullish trend`;
    } else {
      signal = 'bearish';
      interpretation += ` — Price (${currentPrice.toFixed(2)}) below EMA, bearish trend`;
    }
  }

  return { name: `EMA(${period})`, values: { period, latest, history: values.slice(-10) }, signal, interpretation };
}

/**
 * Compute Simple Moving Average.
 */
export function computeSMA(closes: number[], period: number): IndicatorResult {
  const values = SMA.calculate({ values: closes, period });
  const latest = values[values.length - 1];
  const currentPrice = closes[closes.length - 1];

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = `SMA(${period}): ${latest?.toFixed(2) ?? 'N/A'}`;

  if (latest !== undefined && currentPrice !== undefined) {
    if (currentPrice > latest) {
      signal = 'bullish';
      interpretation += ` — Price (${currentPrice.toFixed(2)}) above SMA, bullish trend`;
    } else {
      signal = 'bearish';
      interpretation += ` — Price (${currentPrice.toFixed(2)}) below SMA, bearish trend`;
    }
  }

  return { name: `SMA(${period})`, values: { period, latest, history: values.slice(-10) }, signal, interpretation };
}

/**
 * Compute Bollinger Bands.
 * Price near upper band → overbought, near lower → oversold.
 */
export function computeBollingerBands(closes: number[], period = 20, stdDev = 2): IndicatorResult {
  const values = BollingerBands.calculate({ values: closes, period, stdDev });
  const latest = values[values.length - 1];
  const currentPrice = closes[closes.length - 1];

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = 'Bollinger Bands: ';

  if (latest && currentPrice !== undefined) {
    const { upper, middle, lower } = latest;
    const bandWidth = ((upper - lower) / middle * 100).toFixed(2);
    interpretation += `Upper=${upper.toFixed(2)}, Mid=${middle.toFixed(2)}, Lower=${lower.toFixed(2)}, Width=${bandWidth}%`;

    if (currentPrice > upper) {
      signal = 'bearish';
      interpretation += ' — Price above upper band, overbought';
    } else if (currentPrice < lower) {
      signal = 'bullish';
      interpretation += ' — Price below lower band, oversold';
    } else {
      const position = ((currentPrice - lower) / (upper - lower) * 100).toFixed(0);
      interpretation += ` — Price at ${position}% of band range`;
    }
  } else {
    interpretation += 'Insufficient data';
  }

  return { name: 'Bollinger Bands', values: { latest, history: values.slice(-5) }, signal, interpretation };
}

/**
 * Compute Average True Range (volatility indicator).
 */
export function computeATR(bars: Bar[], period = 14): IndicatorResult {
  const values = ATR.calculate({
    high: bars.map(b => b.high),
    low: bars.map(b => b.low),
    close: bars.map(b => b.close),
    period,
  });

  const latest = values[values.length - 1];
  const currentPrice = bars[bars.length - 1]?.close;
  const atrPercent = latest && currentPrice ? (latest / currentPrice * 100).toFixed(2) : 'N/A';

  return {
    name: 'ATR',
    values: { period, latest: latest?.toFixed(2), atrPercent: `${atrPercent}%`, history: values.slice(-5).map(v => v.toFixed(2)) },
    signal: 'neutral',
    interpretation: `ATR(${period}): ${latest?.toFixed(2) ?? 'N/A'} (${atrPercent}% of price) — Measures volatility, useful for stop-loss placement`,
  };
}

/**
 * Compute Stochastic Oscillator.
 * Overbought > 80, Oversold < 20.
 */
export function computeStochastic(bars: Bar[], period = 14): IndicatorResult {
  const values = Stochastic.calculate({
    high: bars.map(b => b.high),
    low: bars.map(b => b.low),
    close: bars.map(b => b.close),
    period,
    signalPeriod: 3,
  });

  const latest = values[values.length - 1];

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = 'Stochastic: ';

  if (latest) {
    const k = latest.k;
    const d = latest.d;
    interpretation += `%K=${k.toFixed(2)}, %D=${d.toFixed(2)}`;

    if (k > 80) {
      signal = 'bearish';
      interpretation += ' — Overbought (>80)';
    } else if (k < 20) {
      signal = 'bullish';
      interpretation += ' — Oversold (<20)';
    } else {
      interpretation += ' — Neutral range';
    }
  } else {
    interpretation += 'Insufficient data';
  }

  return { name: 'Stochastic', values: { latest, history: values.slice(-5) }, signal, interpretation };
}

/**
 * Compute VWAP (Volume Weighted Average Price).
 */
export function computeVWAP(bars: Bar[]): IndicatorResult {
  // VWAP = cumulative(typical_price * volume) / cumulative(volume)
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  const vwapValues: number[] = [];

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
    vwapValues.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
  }

  const latest = vwapValues[vwapValues.length - 1];
  const currentPrice = bars[bars.length - 1]?.close;

  let signal: IndicatorResult['signal'] = 'neutral';
  let interpretation = `VWAP: ${latest?.toFixed(2) ?? 'N/A'}`;

  if (latest !== undefined && currentPrice !== undefined) {
    if (currentPrice > latest) {
      signal = 'bullish';
      interpretation += ` — Price (${currentPrice.toFixed(2)}) above VWAP, bullish`;
    } else {
      signal = 'bearish';
      interpretation += ` — Price (${currentPrice.toFixed(2)}) below VWAP, bearish`;
    }
  }

  return { name: 'VWAP', values: { latest: latest?.toFixed(2), history: vwapValues.slice(-10).map(v => v.toFixed(2)) }, signal, interpretation };
}

/**
 * Run all indicators on OHLCV bar data.
 */
export function computeAllIndicators(bars: Bar[]): IndicatorResult[] {
  const closes = bars.map(b => b.close);

  return [
    computeRSI(closes),
    computeMACD(closes),
    computeEMA(closes, 12),
    computeEMA(closes, 26),
    computeSMA(closes, 20),
    computeSMA(closes, 50),
    computeBollingerBands(closes),
    computeATR(bars),
    computeStochastic(bars),
    computeVWAP(bars),
  ];
}

/**
 * Summarize indicator signals into an overall assessment.
 */
export function summarizeSignals(results: IndicatorResult[]): {
  overall: 'bullish' | 'bearish' | 'neutral';
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  summary: string;
} {
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const r of results) {
    if (r.signal === 'bullish') bullishCount++;
    else if (r.signal === 'bearish') bearishCount++;
    else neutralCount++;
  }

  let overall: 'bullish' | 'bearish' | 'neutral';
  if (bullishCount > bearishCount + neutralCount) {
    overall = 'bullish';
  } else if (bearishCount > bullishCount + neutralCount) {
    overall = 'bearish';
  } else {
    overall = 'neutral';
  }

  const summary = `Overall: ${overall.toUpperCase()} — ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral out of ${results.length} indicators`;

  return { overall, bullishCount, bearishCount, neutralCount, summary };
}
