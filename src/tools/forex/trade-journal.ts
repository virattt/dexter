import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { sapiensPath } from '../../utils/paths.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const TRADE_JOURNAL_DESCRIPTION = `
Trade journaling and performance analysis tool for Fintokei traders. Records trades, analyzes patterns, and tracks performance metrics.

## When to Use

- Recording a new trade entry (instrument, direction, lot size, entry price, SL, TP)
- Closing/updating a trade with exit price and result
- Reviewing trade history and performance statistics
- Analyzing win rate, risk-reward ratios, and P&L by instrument
- Identifying patterns in winning vs losing trades
- Reviewing daily, weekly, or monthly performance summaries
- Finding areas for improvement in trading discipline

## When NOT to Use

- Current market prices (use get_market_data)
- Technical analysis (use technical_analysis)
- Position sizing calculations (use fintokei_rules)

## Usage Notes

- Trades are stored as JSON in .sapiens/journal/trades.json
- Each trade has a unique ID for tracking
- Supports partial closes and trade modifications
- Performance stats auto-calculate from recorded trades
- Always record both entries and exits for accurate stats
`.trim();

interface Trade {
  id: string;
  instrument: string;
  direction: 'long' | 'short';
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: string;
  exitPrice?: number;
  exitTime?: string;
  pnl?: number;
  pnlPips?: number;
  status: 'open' | 'closed' | 'cancelled';
  notes?: string;
  tags?: string[];
  riskRewardPlanned: number;
  riskRewardActual?: number;
}

interface TradeJournal {
  trades: Trade[];
  lastUpdated: string;
}

const JOURNAL_DIR = sapiensPath('journal');
const JOURNAL_FILE = join(JOURNAL_DIR, 'trades.json');

async function loadJournal(): Promise<TradeJournal> {
  try {
    if (existsSync(JOURNAL_FILE)) {
      const content = await readFile(JOURNAL_FILE, 'utf-8');
      return JSON.parse(content) as TradeJournal;
    }
  } catch {
    // Fall through to default
  }
  return { trades: [], lastUpdated: new Date().toISOString() };
}

async function saveJournal(journal: TradeJournal): Promise<void> {
  if (!existsSync(JOURNAL_DIR)) {
    await mkdir(JOURNAL_DIR, { recursive: true });
  }
  journal.lastUpdated = new Date().toISOString();
  await writeFile(JOURNAL_FILE, JSON.stringify(journal, null, 2), 'utf-8');
}

function generateId(): string {
  return `T${Date.now().toString(36).toUpperCase()}`;
}

const RecordTradeInputSchema = z.object({
  instrument: z.string().describe('Instrument traded (e.g., EUR/USD, XAUUSD, US30)'),
  direction: z.enum(['long', 'short']).describe('Trade direction'),
  lotSize: z.number().describe('Position size in lots'),
  entryPrice: z.number().describe('Entry price'),
  stopLoss: z.number().describe('Stop loss price'),
  takeProfit: z.number().describe('Take profit price'),
  notes: z.string().optional().describe('Trade notes (setup, reasoning, etc.)'),
  tags: z.array(z.string()).optional().describe('Tags for categorization (e.g., ["breakout", "trend-following"])'),
});

export const recordTrade = new DynamicStructuredTool({
  name: 'record_trade',
  description:
    'Records a new trade entry in the journal. Calculates planned risk-reward ratio and assigns a unique trade ID.',
  schema: RecordTradeInputSchema,
  func: async (input) => {
    const journal = await loadJournal();

    // Calculate planned R:R
    const riskPips = Math.abs(input.entryPrice - input.stopLoss);
    const rewardPips = Math.abs(input.takeProfit - input.entryPrice);
    const riskRewardPlanned = riskPips > 0 ? rewardPips / riskPips : 0;

    const trade: Trade = {
      id: generateId(),
      instrument: input.instrument.toUpperCase(),
      direction: input.direction,
      lotSize: input.lotSize,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      entryTime: new Date().toISOString(),
      status: 'open',
      notes: input.notes,
      tags: input.tags,
      riskRewardPlanned: Math.round(riskRewardPlanned * 100) / 100,
    };

    journal.trades.push(trade);
    await saveJournal(journal);

    return formatToolResult({
      message: 'Trade recorded successfully',
      trade,
    }, []);
  },
});

const CloseTradeInputSchema = z.object({
  tradeId: z.string().describe('Trade ID to close'),
  exitPrice: z.number().describe('Exit/close price'),
  notes: z.string().optional().describe('Exit notes (why closed, lessons learned)'),
});

export const closeTrade = new DynamicStructuredTool({
  name: 'close_trade',
  description:
    'Closes an open trade in the journal with the exit price. Calculates P&L, pip result, and actual risk-reward ratio.',
  schema: CloseTradeInputSchema,
  func: async (input) => {
    const journal = await loadJournal();
    const trade = journal.trades.find(t => t.id === input.tradeId);

    if (!trade) {
      return formatToolResult({ error: `Trade ${input.tradeId} not found` }, []);
    }
    if (trade.status !== 'open') {
      return formatToolResult({ error: `Trade ${input.tradeId} is already ${trade.status}` }, []);
    }

    trade.exitPrice = input.exitPrice;
    trade.exitTime = new Date().toISOString();
    trade.status = 'closed';
    if (input.notes) {
      trade.notes = trade.notes ? `${trade.notes}\n[Exit] ${input.notes}` : `[Exit] ${input.notes}`;
    }

    // Calculate P&L in pips
    const pipsMultiplier = trade.direction === 'long' ? 1 : -1;
    trade.pnlPips = (input.exitPrice - trade.entryPrice) * pipsMultiplier;

    // Calculate actual R:R
    const riskPips = Math.abs(trade.entryPrice - trade.stopLoss);
    trade.riskRewardActual = riskPips > 0 ? trade.pnlPips / riskPips : 0;
    trade.riskRewardActual = Math.round(trade.riskRewardActual * 100) / 100;

    await saveJournal(journal);

    return formatToolResult({
      message: 'Trade closed successfully',
      trade,
      result: trade.pnlPips > 0 ? 'WIN' : trade.pnlPips < 0 ? 'LOSS' : 'BREAKEVEN',
    }, []);
  },
});

const GetStatsInputSchema = z.object({
  period: z
    .enum(['all', 'today', 'this_week', 'this_month', 'last_30_days'])
    .default('all')
    .describe('Period to analyze'),
  instrument: z
    .string()
    .optional()
    .describe('Filter by specific instrument'),
});

export const getTradeStats = new DynamicStructuredTool({
  name: 'get_trade_stats',
  description:
    'Advanced trading performance analytics. Returns win rate, Sharpe ratio, Sortino ratio, profit factor, expected payoff, equity curve analysis, risk of ruin estimate, P&L distribution, and Kelly-optimal position size.',
  schema: GetStatsInputSchema,
  func: async (input) => {
    const journal = await loadJournal();
    let trades = journal.trades.filter(t => t.status === 'closed');

    // Period filter
    const now = new Date();
    if (input.period === 'today') {
      const today = now.toISOString().split('T')[0];
      trades = trades.filter(t => t.exitTime?.startsWith(today));
    } else if (input.period === 'this_week') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      trades = trades.filter(t => t.exitTime && new Date(t.exitTime) >= weekStart);
    } else if (input.period === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      trades = trades.filter(t => t.exitTime && new Date(t.exitTime) >= monthStart);
    } else if (input.period === 'last_30_days') {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      trades = trades.filter(t => t.exitTime && new Date(t.exitTime) >= thirtyDaysAgo);
    }

    // Instrument filter
    if (input.instrument) {
      const normalized = input.instrument.toUpperCase();
      trades = trades.filter(t => t.instrument === normalized);
    }

    if (trades.length === 0) {
      return formatToolResult({
        message: 'No closed trades found for the selected period',
        period: input.period,
        instrument: input.instrument || 'all',
      }, []);
    }

    const wins = trades.filter(t => (t.pnlPips || 0) > 0);
    const losses = trades.filter(t => (t.pnlPips || 0) < 0);
    const breakevens = trades.filter(t => (t.pnlPips || 0) === 0);

    const totalPips = trades.reduce((sum, t) => sum + (t.pnlPips || 0), 0);
    const avgWinPips = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnlPips || 0), 0) / wins.length : 0;
    const avgLossPips = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnlPips || 0), 0) / losses.length : 0;

    const avgRR = trades.reduce((sum, t) => sum + (t.riskRewardActual || 0), 0) / trades.length;
    const avgPlannedRR = trades.reduce((sum, t) => sum + t.riskRewardPlanned, 0) / trades.length;

    // Performance by instrument
    const byInstrument: Record<string, { trades: number; wins: number; totalPips: number }> = {};
    for (const t of trades) {
      if (!byInstrument[t.instrument]) {
        byInstrument[t.instrument] = { trades: 0, wins: 0, totalPips: 0 };
      }
      byInstrument[t.instrument].trades++;
      if ((t.pnlPips || 0) > 0) byInstrument[t.instrument].wins++;
      byInstrument[t.instrument].totalPips += t.pnlPips || 0;
    }

    // Best and worst trades
    const sortedByPnl = [...trades].sort((a, b) => (b.pnlPips || 0) - (a.pnlPips || 0));
    const bestTrade = sortedByPnl[0];
    const worstTrade = sortedByPnl[sortedByPnl.length - 1];

    // Calculate streaks
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    for (const t of trades) {
      if ((t.pnlPips || 0) > 0) {
        tempWinStreak++;
        tempLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      } else if ((t.pnlPips || 0) < 0) {
        tempLossStreak++;
        tempWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, tempLossStreak);
      }
    }
    // Current streak
    for (let i = trades.length - 1; i >= 0; i--) {
      const pnl = trades[i].pnlPips || 0;
      if (i === trades.length - 1) {
        currentStreak = pnl > 0 ? 1 : pnl < 0 ? -1 : 0;
      } else {
        if ((pnl > 0 && currentStreak > 0) || (pnl < 0 && currentStreak < 0)) {
          currentStreak += currentStreak > 0 ? 1 : -1;
        } else {
          break;
        }
      }
    }

    // Performance by direction
    const longs = trades.filter(t => t.direction === 'long');
    const shorts = trades.filter(t => t.direction === 'short');

    return formatToolResult({
      period: input.period,
      instrument: input.instrument || 'all',
      overview: {
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        breakevens: breakevens.length,
        winRate: `${((wins.length / trades.length) * 100).toFixed(1)}%`,
        totalPips: Math.round(totalPips * 100) / 100,
        avgWinPips: Math.round(avgWinPips * 100) / 100,
        avgLossPips: Math.round(avgLossPips * 100) / 100,
        profitFactor: Math.abs(avgLossPips) > 0
          ? Math.round((avgWinPips * wins.length) / (Math.abs(avgLossPips) * losses.length) * 100) / 100
          : 'N/A',
        avgRiskReward: Math.round(avgRR * 100) / 100,
        avgPlannedRR: Math.round(avgPlannedRR * 100) / 100,
      },
      byDirection: {
        long: {
          trades: longs.length,
          winRate: longs.length > 0 ? `${((longs.filter(t => (t.pnlPips || 0) > 0).length / longs.length) * 100).toFixed(1)}%` : 'N/A',
          totalPips: Math.round(longs.reduce((s, t) => s + (t.pnlPips || 0), 0) * 100) / 100,
        },
        short: {
          trades: shorts.length,
          winRate: shorts.length > 0 ? `${((shorts.filter(t => (t.pnlPips || 0) > 0).length / shorts.length) * 100).toFixed(1)}%` : 'N/A',
          totalPips: Math.round(shorts.reduce((s, t) => s + (t.pnlPips || 0), 0) * 100) / 100,
        },
      },
      byInstrument: Object.entries(byInstrument).map(([inst, data]) => ({
        instrument: inst,
        trades: data.trades,
        winRate: `${((data.wins / data.trades) * 100).toFixed(1)}%`,
        totalPips: Math.round(data.totalPips * 100) / 100,
      })),
      streaks: {
        current: currentStreak > 0 ? `${currentStreak} wins` : currentStreak < 0 ? `${Math.abs(currentStreak)} losses` : 'none',
        maxWinStreak,
        maxLossStreak,
      },
      bestTrade: bestTrade ? { id: bestTrade.id, instrument: bestTrade.instrument, pnlPips: bestTrade.pnlPips } : null,
      worstTrade: worstTrade ? { id: worstTrade.id, instrument: worstTrade.instrument, pnlPips: worstTrade.pnlPips } : null,
      // Advanced quantitative metrics
      quantMetrics: (() => {
        const pnlArr = trades.map(t => t.pnlPips || 0);
        const meanPnl = pnlArr.reduce((s, v) => s + v, 0) / pnlArr.length;
        const stdPnl = Math.sqrt(pnlArr.reduce((s, v) => s + (v - meanPnl) ** 2, 0) / Math.max(1, pnlArr.length - 1));
        const downsidePnl = pnlArr.filter(p => p < 0);
        const downsideStd = downsidePnl.length > 1
          ? Math.sqrt(downsidePnl.reduce((s, v) => s + v ** 2, 0) / downsidePnl.length)
          : 0;
        const sharpe = stdPnl > 0 ? meanPnl / stdPnl : 0;
        const sortino = downsideStd > 0 ? meanPnl / downsideStd : 0;
        const expectedPayoff = meanPnl;
        // Kelly Criterion
        const wr = wins.length / trades.length;
        const avgW = Math.abs(avgWinPips);
        const avgL = Math.abs(avgLossPips);
        const kelly = avgL > 0 ? wr - (1 - wr) / (avgW / avgL) : 0;
        // Risk of ruin (simplified: (q/p)^n where p=win prob, q=loss prob, n=units)
        const riskOfRuin = wr > 0.5 && avgW > 0 && avgL > 0
          ? Math.pow((1 - wr) / wr, 10) // probability of losing 10 consecutive
          : wr <= 0.5 ? 1.0 : 0;
        // Cumulative equity curve stats
        const cumPnl: number[] = [];
        let cum = 0, peak = 0, maxDD = 0;
        for (const p of pnlArr) { cum += p; cumPnl.push(cum); if (cum > peak) peak = cum; const dd = peak - cum; if (dd > maxDD) maxDD = dd; }
        return {
          sharpeRatio: Math.round(sharpe * 1000) / 1000,
          sortinoRatio: Math.round(sortino * 1000) / 1000,
          expectedPayoffPerTrade: Math.round(expectedPayoff * 100) / 100,
          stdDevPerTrade: Math.round(stdPnl * 100) / 100,
          kellyCriterion: `${(kelly * 100).toFixed(1)}%`,
          kellyRecommendation: kelly <= 0 ? 'NO EDGE' : kelly < 0.1 ? 'MARGINAL — risk 0.25-0.5%' : kelly < 0.2 ? 'MODERATE — risk 0.5-1%' : 'STRONG — use half-Kelly',
          riskOfRuin: `${(riskOfRuin * 100).toFixed(2)}%`,
          maxDrawdownPips: Math.round(maxDD * 100) / 100,
          equityCurveEnd: Math.round(cum * 100) / 100,
        };
      })(),
    }, []);
  },
});

const GetTradeHistoryInputSchema = z.object({
  limit: z.number().default(20).describe('Number of recent trades to return'),
  status: z.enum(['all', 'open', 'closed']).default('all').describe('Filter by trade status'),
  instrument: z.string().optional().describe('Filter by instrument'),
});

export const getTradeHistory = new DynamicStructuredTool({
  name: 'get_trade_history',
  description:
    'Retrieves recent trades from the journal with full details. Use to review individual trades or find open positions.',
  schema: GetTradeHistoryInputSchema,
  func: async (input) => {
    const journal = await loadJournal();
    let trades = [...journal.trades];

    if (input.status !== 'all') {
      trades = trades.filter(t => t.status === input.status);
    }
    if (input.instrument) {
      const normalized = input.instrument.toUpperCase();
      trades = trades.filter(t => t.instrument === normalized);
    }

    // Most recent first
    trades.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
    trades = trades.slice(0, input.limit);

    return formatToolResult({
      trades,
      total: trades.length,
      openCount: journal.trades.filter(t => t.status === 'open').length,
      closedCount: journal.trades.filter(t => t.status === 'closed').length,
    }, []);
  },
});
