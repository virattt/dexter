import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { api, resolveSymbol, FINTOKEI_INSTRUMENTS } from './api.js';
import { formatToolResult } from '../types.js';

export const QUANT_STRATEGY_DESCRIPTION = `
Quantitative strategy analysis engine. Performs backtesting, Monte Carlo simulation, Kelly Criterion optimization, and expected value calculations for Fintokei trading strategies.

## When to Use

- Backtesting a trading strategy on historical data (mean-reversion, momentum, breakout, etc.)
- Monte Carlo simulation of equity curves and drawdown distributions for Fintokei challenges
- Kelly Criterion calculation for optimal position sizing given a known edge
- Expected value (EV) calculation for a trade setup given win rate and R:R
- Strategy comparison: which approach has the best risk-adjusted returns?
- Fintokei challenge probability: P(reaching profit target) vs P(hitting drawdown limit)

## When NOT to Use

- Current price data (use get_market_data)
- Statistical analysis of price series (use statistical_analysis tools)
- Macro indicators (use macro_analysis)
- Recording actual trades (use trade_journal)

## Usage Notes

- Backtests use historical close data — no intraday granularity below the selected interval
- Monte Carlo simulations run 10,000 paths by default for robust probability estimates
- Kelly Criterion assumes independent trades — correlation between consecutive trades reduces optimal fraction
- All strategy metrics include Sharpe, Sortino, max drawdown, profit factor, and expected payoff
`.trim();

// ============================================================================
// Shared Statistics
// ============================================================================

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

async function fetchCloses(symbol: string, interval: string, outputsize: number): Promise<number[]> {
  const resolved = resolveSymbol(symbol);
  if (!resolved) throw new Error(`Unknown instrument: ${symbol}`);
  const { data } = await api.get('/time_series', { symbol: resolved.apiSymbol, interval, outputsize });
  const values = (data.values || []) as Array<{ close: string }>;
  return [...values].reverse().map(v => parseFloat(v.close));
}

// ============================================================================
// Tool: Simple Strategy Backtest
// ============================================================================

const BacktestInputSchema = z.object({
  symbol: z.string().describe('Instrument symbol'),
  interval: z.enum(['1h', '4h', '1day']).default('1day'),
  lookback: z.number().default(500).describe('Number of candles for backtest'),
  strategy: z.enum([
    'sma_crossover',
    'mean_reversion_zscore',
    'momentum_rsi',
    'bollinger_breakout',
    'donchian_channel',
  ]).describe('Strategy to backtest'),
  params: z.object({
    fast_period: z.number().optional().describe('Fast MA period (default 10)'),
    slow_period: z.number().optional().describe('Slow MA period (default 30)'),
    zscore_threshold: z.number().optional().describe('Z-score entry threshold (default 2.0)'),
    rsi_period: z.number().optional().describe('RSI period (default 14)'),
    rsi_overbought: z.number().optional().describe('RSI overbought (default 70)'),
    rsi_oversold: z.number().optional().describe('RSI oversold (default 30)'),
    bb_period: z.number().optional().describe('Bollinger period (default 20)'),
    bb_std: z.number().optional().describe('Bollinger std dev (default 2.0)'),
    channel_period: z.number().optional().describe('Donchian channel period (default 20)'),
    stop_loss_atr_mult: z.number().optional().describe('Stop loss as ATR multiple (default 2.0)'),
    take_profit_atr_mult: z.number().optional().describe('Take profit as ATR multiple (default 3.0)'),
  }).default({}).describe('Strategy-specific parameters'),
});

export const backtestStrategy = new DynamicStructuredTool({
  name: 'backtest_strategy',
  description: 'Backtest a quantitative strategy on historical data. Returns full performance metrics: Sharpe, Sortino, max drawdown, profit factor, win rate, expected payoff, and equity curve statistics.',
  schema: BacktestInputSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    onProgress?.(`Backtesting ${input.strategy} on ${input.symbol}...`);

    const closes = await fetchCloses(input.symbol, input.interval, input.lookback);
    if (closes.length < 100) {
      return formatToolResult({ error: 'Insufficient data for backtest (need at least 100 candles)' }, []);
    }

    // Compute ATR for stop/TP sizing
    function atr(prices: number[], period: number): number[] {
      const atrs: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const tr = Math.abs(prices[i] - prices[i - 1]);
        atrs.push(tr);
      }
      const result: number[] = [];
      for (let i = period; i <= atrs.length; i++) {
        result.push(mean(atrs.slice(i - period, i)));
      }
      return result;
    }

    // Generate signals based on strategy
    function generateSignals(): Array<{ index: number; direction: 'long' | 'short' }> {
      const signals: Array<{ index: number; direction: 'long' | 'short' }> = [];
      const p = input.params;

      switch (input.strategy) {
        case 'sma_crossover': {
          const fast = p.fast_period || 10;
          const slow = p.slow_period || 30;
          for (let i = slow; i < closes.length; i++) {
            const fastMA = mean(closes.slice(i - fast, i));
            const slowMA = mean(closes.slice(i - slow, i));
            const prevFastMA = mean(closes.slice(i - fast - 1, i - 1));
            const prevSlowMA = mean(closes.slice(i - slow - 1, i - 1));
            if (prevFastMA <= prevSlowMA && fastMA > slowMA) signals.push({ index: i, direction: 'long' });
            if (prevFastMA >= prevSlowMA && fastMA < slowMA) signals.push({ index: i, direction: 'short' });
          }
          break;
        }
        case 'mean_reversion_zscore': {
          const lookback = p.slow_period || 30;
          const threshold = p.zscore_threshold || 2.0;
          for (let i = lookback; i < closes.length; i++) {
            const window = closes.slice(i - lookback, i);
            const m = mean(window);
            const s = stdDev(window);
            if (s === 0) continue;
            const z = (closes[i] - m) / s;
            if (z < -threshold) signals.push({ index: i, direction: 'long' });
            if (z > threshold) signals.push({ index: i, direction: 'short' });
          }
          break;
        }
        case 'momentum_rsi': {
          const period = p.rsi_period || 14;
          const ob = p.rsi_overbought || 70;
          const os = p.rsi_oversold || 30;
          for (let i = period + 1; i < closes.length; i++) {
            const changes = closes.slice(i - period, i).map((c, j, arr) => j > 0 ? c - arr[j - 1] : 0).slice(1);
            const gains = changes.filter(c => c > 0);
            const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
            const avgGain = gains.length > 0 ? mean(gains) : 0.0001;
            const avgLoss = losses.length > 0 ? mean(losses) : 0.0001;
            const rs = avgGain / avgLoss;
            const rsi = 100 - 100 / (1 + rs);
            if (rsi < os) signals.push({ index: i, direction: 'long' });
            if (rsi > ob) signals.push({ index: i, direction: 'short' });
          }
          break;
        }
        case 'bollinger_breakout': {
          const period = p.bb_period || 20;
          const numStd = p.bb_std || 2.0;
          for (let i = period; i < closes.length; i++) {
            const window = closes.slice(i - period, i);
            const m = mean(window);
            const s = stdDev(window);
            const upper = m + numStd * s;
            const lower = m - numStd * s;
            if (closes[i] > upper && closes[i - 1] <= m + numStd * stdDev(closes.slice(i - period - 1, i - 1))) {
              signals.push({ index: i, direction: 'long' });
            }
            if (closes[i] < lower && closes[i - 1] >= m - numStd * stdDev(closes.slice(i - period - 1, i - 1))) {
              signals.push({ index: i, direction: 'short' });
            }
          }
          break;
        }
        case 'donchian_channel': {
          const period = p.channel_period || 20;
          for (let i = period; i < closes.length; i++) {
            const window = closes.slice(i - period, i);
            const high = Math.max(...window);
            const low = Math.min(...window);
            if (closes[i] > high) signals.push({ index: i, direction: 'long' });
            if (closes[i] < low) signals.push({ index: i, direction: 'short' });
          }
          break;
        }
      }
      return signals;
    }

    const signals = generateSignals();
    if (signals.length < 5) {
      return formatToolResult({ error: `Only ${signals.length} signals generated. Need at least 5 for meaningful backtest. Try longer lookback or different parameters.` }, []);
    }

    // Simulate trades with ATR-based stops
    const atrValues = atr(closes, 14);
    const slMult = input.params.stop_loss_atr_mult || 2.0;
    const tpMult = input.params.take_profit_atr_mult || 3.0;

    interface TradeResult { pnlPct: number; direction: string; entryPrice: number; exitPrice: number; bars: number }
    const trades: TradeResult[] = [];

    for (const signal of signals) {
      const atrIdx = signal.index - (closes.length - atrValues.length);
      if (atrIdx < 0 || atrIdx >= atrValues.length) continue;
      const currentATR = atrValues[atrIdx];
      const entry = closes[signal.index];
      const sl = signal.direction === 'long' ? entry - slMult * currentATR : entry + slMult * currentATR;
      const tp = signal.direction === 'long' ? entry + tpMult * currentATR : entry - tpMult * currentATR;

      // Walk forward to find exit
      for (let j = signal.index + 1; j < closes.length && j < signal.index + 50; j++) {
        const price = closes[j];
        if (signal.direction === 'long') {
          if (price <= sl) { trades.push({ pnlPct: (sl - entry) / entry * 100, direction: 'long', entryPrice: entry, exitPrice: sl, bars: j - signal.index }); break; }
          if (price >= tp) { trades.push({ pnlPct: (tp - entry) / entry * 100, direction: 'long', entryPrice: entry, exitPrice: tp, bars: j - signal.index }); break; }
          if (j === signal.index + 49) { trades.push({ pnlPct: (price - entry) / entry * 100, direction: 'long', entryPrice: entry, exitPrice: price, bars: 50 }); }
        } else {
          if (price >= sl) { trades.push({ pnlPct: (entry - sl) / entry * 100, direction: 'short', entryPrice: entry, exitPrice: sl, bars: j - signal.index }); break; }
          if (price <= tp) { trades.push({ pnlPct: (entry - tp) / entry * 100, direction: 'short', entryPrice: entry, exitPrice: tp, bars: j - signal.index }); break; }
          if (j === signal.index + 49) { trades.push({ pnlPct: (entry - price) / entry * 100, direction: 'short', entryPrice: entry, exitPrice: price, bars: 50 }); }
        }
      }
    }

    if (trades.length < 5) {
      return formatToolResult({ error: 'Insufficient completed trades for analysis' }, []);
    }

    // Performance metrics
    const pnls = trades.map(t => t.pnlPct);
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const winRate = wins.length / pnls.length;
    const avgWin = wins.length > 0 ? mean(wins) : 0;
    const avgLoss = losses.length > 0 ? mean(losses) : 0;
    const profitFactor = losses.length > 0 && mean(losses.map(Math.abs)) > 0
      ? (wins.reduce((s, v) => s + v, 0)) / Math.abs(losses.reduce((s, v) => s + v, 0)) : Infinity;
    const expectedPayoff = mean(pnls);

    // Sharpe & Sortino
    const pnlStd = stdDev(pnls);
    const sharpe = pnlStd > 0 ? expectedPayoff / pnlStd : 0;
    const downside = pnls.filter(p => p < 0);
    const downsideStd = downside.length > 0 ? stdDev(downside) : 0;
    const sortino = downsideStd > 0 ? expectedPayoff / downsideStd : 0;

    // Max drawdown on cumulative equity
    const cumPnl: number[] = [];
    let cum = 0;
    for (const p of pnls) { cum += p; cumPnl.push(cum); }
    let peak = 0, maxDD = 0;
    for (const c of cumPnl) { if (c > peak) peak = c; const dd = peak - c; if (dd > maxDD) maxDD = dd; }

    // Consecutive wins/losses
    let maxConsecWins = 0, maxConsecLosses = 0, cw = 0, cl = 0;
    for (const p of pnls) {
      if (p > 0) { cw++; cl = 0; maxConsecWins = Math.max(maxConsecWins, cw); }
      else { cl++; cw = 0; maxConsecLosses = Math.max(maxConsecLosses, cl); }
    }

    // Kelly Criterion
    const kelly = avgLoss !== 0 ? winRate - (1 - winRate) / (avgWin / Math.abs(avgLoss)) : 0;

    return formatToolResult({
      instrument: input.symbol.toUpperCase(),
      strategy: input.strategy,
      parameters: input.params,
      interval: input.interval,
      dataPoints: closes.length,
      performance: {
        totalTrades: trades.length,
        winRate: `${(winRate * 100).toFixed(1)}%`,
        avgWin: `${avgWin.toFixed(3)}%`,
        avgLoss: `${avgLoss.toFixed(3)}%`,
        profitFactor: profitFactor === Infinity ? 'Inf' : profitFactor.toFixed(2),
        expectedPayoffPerTrade: `${expectedPayoff.toFixed(3)}%`,
        totalReturn: `${cum.toFixed(2)}%`,
        sharpeRatio: sharpe.toFixed(3),
        sortinoRatio: sortino.toFixed(3),
        maxDrawdown: `${maxDD.toFixed(2)}%`,
        maxConsecutiveWins: maxConsecWins,
        maxConsecutiveLosses: maxConsecLosses,
        avgHoldingPeriod: `${mean(trades.map(t => t.bars)).toFixed(1)} bars`,
      },
      kellyCriterion: {
        optimalFraction: `${(kelly * 100).toFixed(1)}%`,
        halfKelly: `${(kelly * 50).toFixed(1)}%`,
        recommendation: kelly <= 0 ? 'NEGATIVE EDGE — Do not trade this strategy'
          : kelly < 0.05 ? 'Marginal edge — use minimal position size (0.25-0.5%)'
          : kelly < 0.15 ? 'Moderate edge — use half-Kelly (conservative)'
          : 'Strong edge — use half-Kelly to full Kelly',
      },
      edgeAssessment: expectedPayoff > 0 && trades.length > 20
        ? `POSITIVE EDGE: ${expectedPayoff.toFixed(3)}% per trade over ${trades.length} trades. Statistical significance: ${trades.length > 50 ? 'STRONG' : 'MODERATE'}.`
        : expectedPayoff > 0
        ? `TENTATIVE EDGE: ${expectedPayoff.toFixed(3)}% per trade but only ${trades.length} trades. Need more data.`
        : `NO EDGE: Expected payoff is ${expectedPayoff.toFixed(3)}%. Strategy does not have positive expectancy.`,
    }, []);
  },
});

// ============================================================================
// Tool: Monte Carlo Simulation
// ============================================================================

const MonteCarloInputSchema = z.object({
  winRate: z.number().min(0).max(1).describe('Win rate as decimal (e.g., 0.55 for 55%)'),
  avgWinPct: z.number().describe('Average winning trade as % of account (e.g., 2.0 for +2%)'),
  avgLossPct: z.number().describe('Average losing trade as % of account (e.g., -1.0 for -1%). Use negative number.'),
  tradesPerDay: z.number().default(3).describe('Average number of trades per day'),
  tradingDays: z.number().default(30).describe('Number of trading days to simulate'),
  numSimulations: z.number().default(10000).describe('Number of Monte Carlo paths (default 10000)'),
  profitTargetPct: z.number().default(8).describe('Profit target as % of initial balance (Fintokei Phase 1: 8%)'),
  maxDrawdownPct: z.number().default(10).describe('Max drawdown % that fails the challenge (Fintokei: 10%)'),
  dailyLossLimitPct: z.number().default(5).describe('Daily loss limit % (Fintokei: 5%)'),
});

export const monteCarloSimulation = new DynamicStructuredTool({
  name: 'monte_carlo_simulation',
  description: 'Run Monte Carlo simulation of Fintokei challenge outcomes. Given trade statistics (win rate, avg win/loss), simulates thousands of equity curves to calculate: P(reaching profit target), P(hitting drawdown limit), expected time to target, drawdown distribution, and risk of ruin.',
  schema: MonteCarloInputSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    onProgress?.(`Running ${input.numSimulations} Monte Carlo simulations...`);

    const { winRate, avgWinPct, avgLossPct, tradesPerDay, tradingDays, numSimulations, profitTargetPct, maxDrawdownPct, dailyLossLimitPct } = input;
    const totalTrades = tradesPerDay * tradingDays;

    let passCount = 0;
    let failDrawdown = 0;
    let failDailyLimit = 0;
    let failTimeOut = 0;
    const finalEquities: number[] = [];
    const maxDrawdowns: number[] = [];
    const daysToPass: number[] = [];

    for (let sim = 0; sim < numSimulations; sim++) {
      let equity = 100;
      let peak = 100;
      let maxDD = 0;
      let passed = false;
      let failed = false;
      let passDay = 0;

      for (let day = 0; day < tradingDays && !passed && !failed; day++) {
        let dailyPnl = 0;

        for (let t = 0; t < tradesPerDay && !failed; t++) {
          const isWin = Math.random() < winRate;
          const pnl = isWin ? equity * (avgWinPct / 100) : equity * (avgLossPct / 100);
          equity += pnl;
          dailyPnl += pnl;

          // Check max drawdown
          if (equity > peak) peak = equity;
          const dd = (peak - equity) / 100 * 100; // DD as % of initial
          if (dd > maxDD) maxDD = dd;

          if (dd >= maxDrawdownPct) { failed = true; failDrawdown++; break; }
        }

        // Check daily loss limit
        if (!failed && dailyPnl < 0 && Math.abs(dailyPnl) >= 100 * (dailyLossLimitPct / 100)) {
          failed = true;
          failDailyLimit++;
        }

        // Check profit target
        if (!failed && equity - 100 >= profitTargetPct) {
          passed = true;
          passDay = day + 1;
          passCount++;
          daysToPass.push(passDay);
        }
      }

      if (!passed && !failed) failTimeOut++;
      finalEquities.push(equity);
      maxDrawdowns.push(maxDD);
    }

    const passRate = passCount / numSimulations;
    const failRate = (failDrawdown + failDailyLimit + failTimeOut) / numSimulations;

    return formatToolResult({
      inputs: {
        winRate: `${(winRate * 100).toFixed(1)}%`,
        avgWin: `+${avgWinPct}%`,
        avgLoss: `${avgLossPct}%`,
        expectedValue: `${(winRate * avgWinPct + (1 - winRate) * avgLossPct).toFixed(3)}%`,
        tradesPerDay,
        tradingDays,
        totalTradesSimulated: totalTrades,
        simulations: numSimulations,
      },
      challengeOutcome: {
        passRate: `${(passRate * 100).toFixed(1)}%`,
        failRate: `${(failRate * 100).toFixed(1)}%`,
        failByDrawdown: `${((failDrawdown / numSimulations) * 100).toFixed(1)}%`,
        failByDailyLimit: `${((failDailyLimit / numSimulations) * 100).toFixed(1)}%`,
        failByTimeout: `${((failTimeOut / numSimulations) * 100).toFixed(1)}%`,
        medianDaysToPass: daysToPass.length > 0 ? Math.round(percentile(daysToPass, 50)) : 'N/A',
      },
      equityDistribution: {
        mean: `${mean(finalEquities).toFixed(2)}%`,
        median: `${percentile(finalEquities, 50).toFixed(2)}%`,
        p10: `${percentile(finalEquities, 10).toFixed(2)}%`,
        p25: `${percentile(finalEquities, 25).toFixed(2)}%`,
        p75: `${percentile(finalEquities, 75).toFixed(2)}%`,
        p90: `${percentile(finalEquities, 90).toFixed(2)}%`,
        worst: `${Math.min(...finalEquities).toFixed(2)}%`,
        best: `${Math.max(...finalEquities).toFixed(2)}%`,
      },
      drawdownDistribution: {
        meanMaxDD: `${mean(maxDrawdowns).toFixed(2)}%`,
        medianMaxDD: `${percentile(maxDrawdowns, 50).toFixed(2)}%`,
        p95MaxDD: `${percentile(maxDrawdowns, 95).toFixed(2)}%`,
        p99MaxDD: `${percentile(maxDrawdowns, 99).toFixed(2)}%`,
      },
      recommendation: passRate > 0.7
        ? `HIGH probability of passing (${(passRate * 100).toFixed(0)}%). This edge is robust for Fintokei. Use half-Kelly sizing.`
        : passRate > 0.5
        ? `MODERATE probability (${(passRate * 100).toFixed(0)}%). Edge exists but volatile. Reduce position size to improve consistency.`
        : passRate > 0.3
        ? `LOW probability (${(passRate * 100).toFixed(0)}%). Edge is marginal. Significantly reduce risk or improve win rate/R:R.`
        : `VERY LOW probability (${(passRate * 100).toFixed(0)}%). Current statistics do not support passing the challenge. Rethink strategy.`,
    }, []);
  },
});

// ============================================================================
// Tool: Expected Value Calculator
// ============================================================================

const ExpectedValueInputSchema = z.object({
  scenarios: z.array(z.object({
    name: z.string().describe('Scenario name (e.g., "TP1 hit", "SL hit", "BE exit")'),
    probability: z.number().min(0).max(1).describe('Probability of this outcome (0-1)'),
    pnlPips: z.number().describe('P&L in pips for this outcome'),
  })).min(2).describe('Array of possible outcomes with probabilities (must sum to ~1.0)'),
  pipValue: z.number().default(10).describe('Pip value in USD per standard lot (default $10 for major pairs)'),
  lotSize: z.number().default(0.1).describe('Position size in lots'),
});

export const calculateExpectedValue = new DynamicStructuredTool({
  name: 'calculate_expected_value',
  description: 'Calculate expected value of a trade setup given multiple scenarios with their probabilities and P&L outcomes. Returns EV in pips and currency, and determines if the trade has positive mathematical expectancy.',
  schema: ExpectedValueInputSchema,
  func: async (input) => {
    const totalProb = input.scenarios.reduce((s, sc) => s + sc.probability, 0);
    if (Math.abs(totalProb - 1.0) > 0.05) {
      return formatToolResult({
        error: `Probabilities sum to ${totalProb.toFixed(2)}, should be ~1.0`,
        scenarios: input.scenarios,
      }, []);
    }

    const evPips = input.scenarios.reduce((s, sc) => s + sc.probability * sc.pnlPips, 0);
    const evUSD = evPips * input.pipValue * input.lotSize;

    // Variance and standard deviation
    const variance = input.scenarios.reduce((s, sc) => s + sc.probability * (sc.pnlPips - evPips) ** 2, 0);
    const sdPips = Math.sqrt(variance);

    // Best and worst cases
    const best = input.scenarios.reduce((max, sc) => sc.pnlPips > max.pnlPips ? sc : max);
    const worst = input.scenarios.reduce((min, sc) => sc.pnlPips < min.pnlPips ? sc : min);

    return formatToolResult({
      expectedValue: {
        pips: Math.round(evPips * 100) / 100,
        usd: `$${evUSD.toFixed(2)}`,
        isPositive: evPips > 0,
      },
      riskMetrics: {
        standardDeviation: `${sdPips.toFixed(1)} pips`,
        coefficientOfVariation: sdPips > 0 ? Math.round(Math.abs(sdPips / evPips) * 100) / 100 : 'N/A',
        bestCase: `${best.name}: +${best.pnlPips} pips (P=${(best.probability * 100).toFixed(0)}%)`,
        worstCase: `${worst.name}: ${worst.pnlPips} pips (P=${(worst.probability * 100).toFixed(0)}%)`,
      },
      scenarios: input.scenarios.map(sc => ({
        ...sc,
        probability: `${(sc.probability * 100).toFixed(1)}%`,
        contribution: `${(sc.probability * sc.pnlPips).toFixed(1)} pips`,
        usdValue: `$${(sc.pnlPips * input.pipValue * input.lotSize).toFixed(2)}`,
      })),
      decision: evPips > 0
        ? `TRADE: Positive EV of ${evPips.toFixed(1)} pips ($${evUSD.toFixed(2)}) per trade. Mathematical edge exists.`
        : `SKIP: Negative EV of ${evPips.toFixed(1)} pips ($${evUSD.toFixed(2)}). No mathematical edge.`,
    }, []);
  },
});
