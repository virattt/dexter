import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getBalances, getPositions, getQuotes } from './api.js';
import { summarizeOrder } from './theta-helpers.js';
import { buildRollCandidate, findShortOptionPosition } from './roll-helpers.js';
import { detectUnderlyingInstrumentType, extractQuoteMap } from './theta-helpers.js';
import {
  availableBuyingPowerFromBalances,
  getFirstAccountNumber,
  loadThetaPolicy,
  normalizePositions,
  parseOptionSymbol,
  validateOrderAgainstPolicy,
} from './utils.js';

export const tastytradeRepairPositionTool = new DynamicStructuredTool({
  name: 'tastytrade_repair_position',
  description:
    'Analyze a challenged short option and recommend hold, roll, close, or (for short puts) possible assignment based on DTE, moneyness, and buying power.',
  schema: z.object({
    account_number: z.string().optional().describe('Tastytrade account number. If omitted, uses the first linked account.'),
    position_symbol: z.string().optional().describe('Exact short option symbol to repair.'),
    underlying_symbol: z.string().optional().describe('Underlying if position_symbol is not provided.'),
    option_type: z.enum(['C', 'P']).optional().describe('Option type if selecting by underlying.'),
    strike: z.number().optional().describe('Strike if selecting by underlying.'),
    target_days_out: z.number().optional().default(7).describe('Preferred DTE if rolling is recommended.'),
  }),
  func: async (input) => {
    const accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({ error: 'No tastytrade account found. Provide account_number or link an account.' });
    }

    const [positionsRes, balancesRes] = await Promise.all([getPositions(accountNumber), getBalances(accountNumber)]);
    const positions = normalizePositions(positionsRes.data);
    const position = findShortOptionPosition(positions, input);
    if (!position) {
      return JSON.stringify({ error: 'No matching short option position found to repair.' });
    }

    const instrumentType = detectUnderlyingInstrumentType(position.underlying);
    const underlyingQuoteRes = await getQuotes([position.underlying], instrumentType);
    const underlyingQuote = extractQuoteMap(underlyingQuoteRes.data).get(position.underlying);
    const underlyingPrice = underlyingQuote?.mark || underlyingQuote?.last || 0;
    const buyingPower = availableBuyingPowerFromBalances(balancesRes.data);
    const closeNowCost = Math.abs(position.mark * position.quantity * 100);
    const challenged = isChallenged(position.optionType, position.strike, underlyingPrice);
    const roll = challenged ? await buildRollCandidate(position, input.target_days_out ?? 7) : null;

    let rollPolicyBlocked: boolean | null = null;
    let rollPolicyViolations: string[] = [];
    if (roll?.order_json) {
      const summary = summarizeOrder(roll.order_json as Record<string, unknown>);
      const legs = summary.legs.map((leg) => {
        const parsed = parseOptionSymbol(leg.symbol);
        return {
          underlying: parsed.underlying,
          option_type: parsed.optionType,
          action: leg.action,
          dte: parsed.dte ?? null,
        };
      });
      const underlyings = [...new Set(legs.map((l) => l.underlying))];
      const policy = loadThetaPolicy();
      const policyValidation = validateOrderAgainstPolicy({ underlyings, legs, policy });
      rollPolicyBlocked = !policyValidation.allowed;
      rollPolicyViolations = policyValidation.violations;
    }

    const assignmentCost =
      position.optionType === 'P' && position.strike != null
        ? Number((position.strike * Math.abs(position.quantity) * 100).toFixed(2))
        : null;

    const recommendation = chooseRecommendation({
      position,
      challenged,
      rollNetCredit: roll?.net_credit ?? null,
      assignmentCost,
      buyingPower,
    });

    return JSON.stringify({
      account_number: accountNumber,
      current_position: {
        symbol: position.symbol,
        underlying: position.underlying,
        option_type: position.optionType,
        strike: position.strike,
        expiration_date: position.expirationDate,
        dte: position.dte,
        mark: position.mark,
        underlying_price: underlyingPrice,
        challenged,
      },
      alternatives: {
        hold: {
          viable: !challenged,
          reason: challenged
            ? 'Short strike is challenged; holding increases gamma and assignment risk.'
            : 'Position is not yet challenged; continued monitoring may be acceptable.',
        },
        close_now: {
          cost: Number(closeNowCost.toFixed(2)),
        },
        roll:
          roll?.target_contract && roll.order_json
            ? {
                target_symbol: roll.target_contract.symbol,
                target_expiration_date: roll.target_contract.expirationDate,
                target_strike: roll.target_contract.strike,
                net_credit: roll.net_credit,
                order_json: roll.order_json,
                policy_blocked: rollPolicyBlocked ?? false,
                policy_violations: rollPolicyViolations.length > 0 ? rollPolicyViolations : undefined,
                policy_note:
                  rollPolicyBlocked === true
                    ? 'Roll candidate violates THETA-POLICY; consider close_now or adjust policy before rolling.'
                    : rollPolicyBlocked === false
                      ? 'Roll candidate is within THETA-POLICY.'
                      : undefined,
              }
            : null,
        take_assignment:
          assignmentCost != null
            ? {
                possible: buyingPower >= assignmentCost,
                assignment_cost: assignmentCost,
              }
            : null,
      },
      recommendation,
    });
  },
});

function isChallenged(optionType: 'C' | 'P' | null, strike: number | null, underlyingPrice: number): boolean {
  if (!optionType || strike == null || underlyingPrice <= 0) return false;
  if (optionType === 'P') return underlyingPrice <= strike * 1.01;
  return underlyingPrice >= strike * 0.99;
}

function chooseRecommendation(params: {
  position: ReturnType<typeof normalizePositions>[number];
  challenged: boolean;
  rollNetCredit: number | null;
  assignmentCost: number | null;
  buyingPower: number;
}): { action: 'hold' | 'roll' | 'close_now' | 'take_assignment'; reason: string } {
  if (!params.challenged) {
    return {
      action: 'hold',
      reason: 'The short strike is not yet challenged; continue monitoring and manage per the normal take-profit / stop-loss rules.',
    };
  }

  if (params.rollNetCredit != null && params.rollNetCredit >= 0) {
    return {
      action: 'roll',
      reason: 'The position is challenged and a later-dated roll is available for even or better net credit.',
    };
  }

  if (params.position.optionType === 'P' && params.assignmentCost != null && params.buyingPower >= params.assignmentCost) {
    return {
      action: 'take_assignment',
      reason: 'The short put is challenged and assignment is feasible with available buying power; consider assignment if the underlying still fits the thesis.',
    };
  }

  return {
    action: 'close_now',
    reason: 'The position is challenged and no favorable credit roll is available; closing reduces gamma and assignment risk.',
  };
}
