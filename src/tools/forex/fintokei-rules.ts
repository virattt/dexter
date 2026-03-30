import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

export const FINTOKEI_RULES_DESCRIPTION = `
Fintokei prop trading challenge rules, risk calculator, and position sizing tool. Essential for staying within challenge parameters.

## When to Use

- Looking up Fintokei challenge rules (profit targets, drawdown limits, daily loss limits)
- Calculating proper position size based on account balance and risk percentage
- Checking if a planned trade fits within daily/total drawdown limits
- Understanding Fintokei plan differences (challenge types, account sizes)
- Calculating pip value for position sizing
- Evaluating remaining risk budget for the day/challenge

## When NOT to Use

- Current market prices (use get_market_data)
- Technical analysis (use technical_analysis)
- Economic events (use economic_calendar)

## Usage Notes

- Always factor in Fintokei rules when recommending position sizes
- Daily loss limit is the most critical constraint — one bad day can fail a challenge
- Position sizing should account for both stop loss distance AND daily loss limit
- The tool calculates maximum position size that respects both individual trade risk and account-level limits
`.trim();

/**
 * Fintokei Challenge Plans (as of 2024-2025)
 * Source: fintokei.com
 * Note: These may be updated — users should verify current rules on the Fintokei website.
 */
const FINTOKEI_PLANS = {
  // ProTrader Challenge (2-step evaluation)
  protrader: {
    name: 'ProTrader Challenge',
    type: '2-step evaluation',
    phases: [
      {
        name: 'Phase 1 (Challenge)',
        profitTarget: 8, // %
        maxDailyLoss: 5, // %
        maxTotalDrawdown: 10, // %
        minTradingDays: 3,
        maxTradingPeriod: 'Unlimited',
        leverage: '1:100',
      },
      {
        name: 'Phase 2 (Verification)',
        profitTarget: 5,
        maxDailyLoss: 5,
        maxTotalDrawdown: 10,
        minTradingDays: 3,
        maxTradingPeriod: 'Unlimited',
        leverage: '1:100',
      },
    ],
    funded: {
      profitSplit: 80, // %
      maxDailyLoss: 5,
      maxTotalDrawdown: 10,
      leverage: '1:100',
      payoutFrequency: 'Bi-weekly',
    },
    accountSizes: [200000, 500000, 1000000, 2000000, 5000000], // JPY
  },
  // SwiftTrader (1-step fast evaluation)
  swifttrader: {
    name: 'SwiftTrader',
    type: '1-step evaluation',
    phases: [
      {
        name: 'Evaluation',
        profitTarget: 10,
        maxDailyLoss: 5,
        maxTotalDrawdown: 10,
        minTradingDays: 3,
        maxTradingPeriod: 'Unlimited',
        leverage: '1:100',
      },
    ],
    funded: {
      profitSplit: 80,
      maxDailyLoss: 5,
      maxTotalDrawdown: 10,
      leverage: '1:100',
      payoutFrequency: 'Bi-weekly',
    },
    accountSizes: [200000, 500000, 1000000, 2000000, 5000000],
  },
  // StartTrader (instant funding, lower targets)
  starttrader: {
    name: 'StartTrader',
    type: 'Instant funding',
    phases: [],
    funded: {
      profitSplit: 50, // starts at 50%, scales up
      maxDailyLoss: 5,
      maxTotalDrawdown: 10,
      leverage: '1:50',
      payoutFrequency: 'Monthly',
      scalingNote: 'Profit split scales from 50% to 90% based on performance',
    },
    accountSizes: [200000, 500000, 1000000, 2000000, 5000000],
  },
} as const;

// Pip value calculations for common instruments (per standard lot)
const PIP_VALUES: Record<string, { pipValuePerLot: number; currency: string }> = {
  // USD-denominated pairs (pip = $10 per standard lot)
  'EUR/USD': { pipValuePerLot: 10, currency: 'USD' },
  'GBP/USD': { pipValuePerLot: 10, currency: 'USD' },
  'AUD/USD': { pipValuePerLot: 10, currency: 'USD' },
  'NZD/USD': { pipValuePerLot: 10, currency: 'USD' },
  // JPY pairs (pip = ~$6.5-7 per lot, varies with USD/JPY rate)
  'USD/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  'EUR/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  'GBP/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  'AUD/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  'NZD/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  'CAD/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  'CHF/JPY': { pipValuePerLot: 6.7, currency: 'USD' },
  // Other USD-quoted pairs
  'USD/CHF': { pipValuePerLot: 10.2, currency: 'USD' },
  'USD/CAD': { pipValuePerLot: 7.4, currency: 'USD' },
  // Crosses (approximate)
  'EUR/GBP': { pipValuePerLot: 12.5, currency: 'USD' },
  'EUR/AUD': { pipValuePerLot: 6.5, currency: 'USD' },
  'EUR/CAD': { pipValuePerLot: 7.4, currency: 'USD' },
  'EUR/CHF': { pipValuePerLot: 10.2, currency: 'USD' },
  'GBP/AUD': { pipValuePerLot: 6.5, currency: 'USD' },
  'GBP/CAD': { pipValuePerLot: 7.4, currency: 'USD' },
  'GBP/CHF': { pipValuePerLot: 10.2, currency: 'USD' },
  'AUD/CAD': { pipValuePerLot: 7.4, currency: 'USD' },
  'AUD/CHF': { pipValuePerLot: 10.2, currency: 'USD' },
  'AUD/NZD': { pipValuePerLot: 6.1, currency: 'USD' },
  'NZD/CAD': { pipValuePerLot: 7.4, currency: 'USD' },
  'NZD/CHF': { pipValuePerLot: 10.2, currency: 'USD' },
  'CAD/CHF': { pipValuePerLot: 10.2, currency: 'USD' },
  // Gold/Silver
  'XAUUSD': { pipValuePerLot: 1, currency: 'USD' }, // $1 per 0.01 move per 1 oz lot (100 oz lot = $100)
  'XAGUSD': { pipValuePerLot: 0.5, currency: 'USD' },
  // Indices (per point per lot)
  'US30': { pipValuePerLot: 1, currency: 'USD' },
  'US500': { pipValuePerLot: 1, currency: 'USD' },
  'NAS100': { pipValuePerLot: 1, currency: 'USD' },
  'JP225': { pipValuePerLot: 0.01, currency: 'USD' },
  'GER40': { pipValuePerLot: 1, currency: 'EUR' },
  'UK100': { pipValuePerLot: 1, currency: 'GBP' },
};

const GetRulesInputSchema = z.object({
  plan: z
    .enum(['protrader', 'swifttrader', 'starttrader', 'all'])
    .default('all')
    .describe('Fintokei plan type to look up rules for'),
});

export const getFintokeiRules = new DynamicStructuredTool({
  name: 'get_fintokei_rules',
  description:
    'Returns Fintokei challenge rules including profit targets, drawdown limits, daily loss limits, and account sizes for each plan type.',
  schema: GetRulesInputSchema,
  func: async (input) => {
    if (input.plan === 'all') {
      return formatToolResult({
        plans: FINTOKEI_PLANS,
        note: 'Rules may be updated by Fintokei. Always verify current rules on fintokei.com.',
      }, []);
    }
    const plan = FINTOKEI_PLANS[input.plan as keyof typeof FINTOKEI_PLANS];
    return formatToolResult({
      plan,
      note: 'Rules may be updated by Fintokei. Always verify current rules on fintokei.com.',
    }, []);
  },
});

const PositionSizingInputSchema = z.object({
  accountBalance: z
    .number()
    .describe('Current account balance (in account currency, typically JPY or USD)'),
  accountCurrency: z
    .enum(['JPY', 'USD'])
    .default('JPY')
    .describe('Account currency (JPY or USD)'),
  riskPercent: z
    .number()
    .default(1)
    .describe('Risk per trade as percentage of balance (e.g., 1 for 1%). Recommended: 0.5-2%'),
  instrument: z
    .string()
    .describe('Instrument to trade (e.g., EUR/USD, XAUUSD, US30)'),
  stopLossPips: z
    .number()
    .describe('Stop loss distance in pips (e.g., 20 pips for EUR/USD, 200 pips for XAUUSD)'),
  dailyLossLimit: z
    .number()
    .default(5)
    .describe('Maximum daily loss limit as percentage (Fintokei default: 5%)'),
  currentDailyPnl: z
    .number()
    .default(0)
    .describe('Current P&L for today (negative means already in loss)'),
});

export const calculatePositionSize = new DynamicStructuredTool({
  name: 'calculate_position_size',
  description:
    'Calculates optimal position size for a Fintokei trade, respecting both per-trade risk and daily loss limits. Returns lot size, risk amount, and safety checks.',
  schema: PositionSizingInputSchema,
  func: async (input) => {
    const {
      accountBalance,
      accountCurrency,
      riskPercent,
      instrument,
      stopLossPips,
      dailyLossLimit,
      currentDailyPnl,
    } = input;

    // Normalize instrument name
    const normalizedInstrument = instrument.toUpperCase().replace(/\s+/g, '');
    let pipKey = normalizedInstrument;
    // Try with slash for forex pairs
    if (normalizedInstrument.length === 6 && !normalizedInstrument.includes('/')) {
      pipKey = `${normalizedInstrument.slice(0, 3)}/${normalizedInstrument.slice(3)}`;
    }

    const pipInfo = PIP_VALUES[pipKey];
    if (!pipInfo) {
      return formatToolResult({
        error: `Pip value data not available for ${instrument}`,
        hint: 'Supported: ' + Object.keys(PIP_VALUES).join(', '),
      }, []);
    }

    // Convert account balance to USD if needed for calculations
    const usdJpyRate = 150; // Approximate — in production, fetch live rate
    const balanceUSD = accountCurrency === 'JPY' ? accountBalance / usdJpyRate : accountBalance;

    // Calculate risk amount per trade
    const riskAmountUSD = balanceUSD * (riskPercent / 100);

    // Calculate remaining daily budget
    const dailyLimitUSD = balanceUSD * (dailyLossLimit / 100);
    const currentDailyPnlUSD = accountCurrency === 'JPY' ? currentDailyPnl / usdJpyRate : currentDailyPnl;
    const remainingDailyBudget = dailyLimitUSD + currentDailyPnlUSD; // currentDailyPnl is negative when losing

    // Position size based on per-trade risk
    const lotSizeByRisk = riskAmountUSD / (stopLossPips * pipInfo.pipValuePerLot);

    // Position size limited by remaining daily budget
    const lotSizeByDailyLimit = remainingDailyBudget / (stopLossPips * pipInfo.pipValuePerLot);

    // Use the smaller of the two
    const recommendedLotSize = Math.min(lotSizeByRisk, lotSizeByDailyLimit);
    const roundedLotSize = Math.max(0, Math.floor(recommendedLotSize * 100) / 100); // Round down to 0.01

    // Safety warnings
    const warnings: string[] = [];
    if (remainingDailyBudget < riskAmountUSD) {
      warnings.push(`Daily loss budget (${remainingDailyBudget.toFixed(2)} USD remaining) is less than per-trade risk. Position size reduced.`);
    }
    if (riskPercent > 2) {
      warnings.push(`Risk per trade (${riskPercent}%) exceeds recommended maximum of 2% for Fintokei challenges.`);
    }
    if (currentDailyPnl < 0 && Math.abs(currentDailyPnlUSD) > dailyLimitUSD * 0.5) {
      warnings.push(`Already used >50% of daily loss budget. Consider stopping trading for today.`);
    }
    if (roundedLotSize === 0) {
      warnings.push('Calculated position size is below minimum tradeable lot (0.01). Trade not recommended.');
    }

    const riskAmountAccount = accountCurrency === 'JPY' ? riskAmountUSD * usdJpyRate : riskAmountUSD;
    const potentialLossAccount = roundedLotSize * stopLossPips * pipInfo.pipValuePerLot * (accountCurrency === 'JPY' ? usdJpyRate : 1);

    return formatToolResult({
      instrument: instrument.toUpperCase(),
      accountBalance: `${accountBalance} ${accountCurrency}`,
      riskPerTrade: `${riskPercent}%`,
      riskAmount: `${riskAmountAccount.toFixed(2)} ${accountCurrency}`,
      stopLossPips,
      pipValuePerLot: `${pipInfo.pipValuePerLot} ${pipInfo.currency}`,
      calculatedLotSize: roundedLotSize.toFixed(2),
      potentialLoss: `${potentialLossAccount.toFixed(2)} ${accountCurrency}`,
      dailyLossStatus: {
        dailyLimit: `${dailyLossLimit}% = ${(dailyLimitUSD * (accountCurrency === 'JPY' ? usdJpyRate : 1)).toFixed(2)} ${accountCurrency}`,
        currentDailyPnl: `${currentDailyPnl.toFixed(2)} ${accountCurrency}`,
        remainingBudget: `${(remainingDailyBudget * (accountCurrency === 'JPY' ? usdJpyRate : 1)).toFixed(2)} ${accountCurrency}`,
        usedPercent: `${(((dailyLimitUSD - remainingDailyBudget) / dailyLimitUSD) * 100).toFixed(1)}%`,
      },
      warnings,
      recommendation: roundedLotSize > 0
        ? `Trade ${roundedLotSize.toFixed(2)} lots with ${stopLossPips} pip stop loss.`
        : 'Do not trade — insufficient risk budget.',
    }, []);
  },
});

const RiskCheckInputSchema = z.object({
  accountBalance: z.number().describe('Current account balance'),
  accountCurrency: z.enum(['JPY', 'USD']).default('JPY'),
  initialBalance: z.number().describe('Initial account balance at challenge start'),
  currentPnl: z.number().describe('Current total P&L since challenge start (can be negative)'),
  todayPnl: z.number().default(0).describe('Today P&L (can be negative)'),
  plan: z.enum(['protrader', 'swifttrader', 'starttrader']).default('protrader'),
  phase: z.number().default(1).describe('Current phase (1 = challenge, 2 = verification)'),
});

export const checkAccountHealth = new DynamicStructuredTool({
  name: 'check_account_health',
  description:
    'Evaluates current Fintokei account health against challenge rules. Shows drawdown status, distance to limits, and profit target progress.',
  schema: RiskCheckInputSchema,
  func: async (input) => {
    const plan = FINTOKEI_PLANS[input.plan as keyof typeof FINTOKEI_PLANS];
    if (!plan) {
      return formatToolResult({ error: `Unknown plan: ${input.plan}` }, []);
    }

    const phaseIndex = Math.min(input.phase - 1, plan.phases.length - 1);
    const phase = plan.phases[phaseIndex] || plan.funded;

    const maxDailyLoss = (phase.maxDailyLoss / 100) * input.initialBalance;
    const maxTotalDrawdown = (phase.maxTotalDrawdown / 100) * input.initialBalance;
    const profitTarget = 'profitTarget' in phase ? ((phase as unknown as Record<string, number>).profitTarget / 100) * input.initialBalance : null;

    const currentDrawdown = input.initialBalance - input.accountBalance;
    const drawdownPercent = (currentDrawdown / input.initialBalance) * 100;
    const dailyLossPercent = Math.abs(Math.min(0, input.todayPnl)) / input.initialBalance * 100;

    const distanceToMaxDrawdown = maxTotalDrawdown - currentDrawdown;
    const distanceToDailyLimit = maxDailyLoss - Math.abs(Math.min(0, input.todayPnl));

    const profitProgress = profitTarget ? (input.currentPnl / profitTarget) * 100 : null;

    const status = currentDrawdown >= maxTotalDrawdown ? 'FAILED'
      : Math.abs(Math.min(0, input.todayPnl)) >= maxDailyLoss ? 'DAILY_LIMIT_BREACHED'
      : drawdownPercent > 7 ? 'DANGER'
      : drawdownPercent > 5 ? 'WARNING'
      : 'HEALTHY';

    const recommendations: string[] = [];
    if (status === 'DANGER') {
      recommendations.push('Reduce position sizes significantly. Consider trading only A+ setups.');
      recommendations.push('Maximum risk per trade should be 0.25-0.5% until account recovers.');
    }
    if (status === 'WARNING') {
      recommendations.push('Reduce risk per trade to 0.5-1%.');
      recommendations.push('Avoid correlated trades that could amplify losses.');
    }
    if (dailyLossPercent > 3) {
      recommendations.push('Consider stopping trading for today to preserve daily loss budget.');
    }
    if (profitProgress && profitProgress > 80) {
      recommendations.push('Close to profit target. Consider reducing risk to lock in the pass.');
    }

    const phaseName = 'profitTarget' in phase
      ? ('name' in phase ? String(phase.name) : `Phase ${input.phase}`)
      : 'Funded';

    return formatToolResult({
      plan: plan.name,
      phase: phaseName,
      accountHealth: {
        status,
        currentBalance: `${input.accountBalance} ${input.accountCurrency}`,
        initialBalance: `${input.initialBalance} ${input.accountCurrency}`,
        currentPnl: `${input.currentPnl >= 0 ? '+' : ''}${input.currentPnl} ${input.accountCurrency}`,
        todayPnl: `${input.todayPnl >= 0 ? '+' : ''}${input.todayPnl} ${input.accountCurrency}`,
      },
      drawdownStatus: {
        currentDrawdown: `${drawdownPercent.toFixed(2)}%`,
        maxAllowed: `${phase.maxTotalDrawdown}%`,
        distanceToLimit: `${distanceToMaxDrawdown.toFixed(2)} ${input.accountCurrency}`,
        remainingPercent: `${(phase.maxTotalDrawdown - drawdownPercent).toFixed(2)}%`,
      },
      dailyLossStatus: {
        todayLoss: `${dailyLossPercent.toFixed(2)}%`,
        maxAllowed: `${phase.maxDailyLoss}%`,
        distanceToLimit: `${distanceToDailyLimit.toFixed(2)} ${input.accountCurrency}`,
        remainingPercent: `${(phase.maxDailyLoss - dailyLossPercent).toFixed(2)}%`,
      },
      profitTarget: profitTarget ? {
        target: `${profitTarget.toFixed(2)} ${input.accountCurrency}`,
        currentProgress: `${profitProgress!.toFixed(1)}%`,
        remaining: `${(profitTarget - input.currentPnl).toFixed(2)} ${input.accountCurrency}`,
      } : null,
      recommendations,
    }, []);
  },
});
