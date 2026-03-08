import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getBalances, getPositions, orderDryRun } from './api.js';
import { summarizeOrder } from './theta-helpers.js';
import { buildRollCandidate, findShortOptionPosition } from './roll-helpers.js';
import {
  availableBuyingPowerFromBalances,
  getFirstAccountNumber,
  loadThetaPolicy,
  normalizePositions,
  parseOptionSymbol,
  validateOrderAgainstPolicy,
} from './utils.js';

export const tastytradeRollShortOptionTool = new DynamicStructuredTool({
  name: 'tastytrade_roll_short_option',
  description:
    'Build a roll candidate for a short option (buy to close current, sell to open a later expiry) and run dry-run (read-only; no live trading required).',
  schema: z.object({
    account_number: z.string().optional().describe('Tastytrade account number. If omitted, uses the first linked account.'),
    position_symbol: z.string().optional().describe('Exact short option symbol to roll.'),
    underlying_symbol: z.string().optional().describe('Underlying if position_symbol is not provided.'),
    option_type: z.enum(['C', 'P']).optional().describe('Option type if selecting by underlying.'),
    strike: z.number().optional().describe('Strike if selecting by underlying.'),
    target_days_out: z.number().optional().default(7).describe('Preferred DTE for the rolled option.'),
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
      return JSON.stringify({ error: 'No matching short option position found to roll.' });
    }

    const roll = await buildRollCandidate(position, input.target_days_out ?? 7);
    if (!roll.target_contract || !roll.order_json) {
      return JSON.stringify({
        account_number: accountNumber,
        position_symbol: position.symbol,
        error: 'No later-dated matching contract found for a roll candidate.',
      });
    }

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

    let dryRunResult: unknown = null;
    try {
      const res = await orderDryRun(accountNumber, roll.order_json);
      dryRunResult = res.data;
    } catch (error) {
      dryRunResult = { error: error instanceof Error ? error.message : String(error) };
    }

    if (!policyValidation.allowed) {
      return JSON.stringify({
        account_number: accountNumber,
        policy_blocked: true,
        violations: policyValidation.violations,
        buying_power: availableBuyingPowerFromBalances(balancesRes.data),
        current_position: {
          symbol: position.symbol,
          underlying: position.underlying,
          option_type: position.optionType,
          strike: position.strike,
          expiration_date: position.expirationDate,
          dte: position.dte,
          mark: roll.current_mark,
        },
        roll_candidate: {
          symbol: roll.target_contract.symbol,
          strike: roll.target_contract.strike,
          expiration_date: roll.target_contract.expirationDate,
          dte: roll.target_contract.dte,
          mark: roll.target_mark,
          net_credit: roll.net_credit,
        },
        order_json: roll.order_json,
        dry_run_result: dryRunResult,
        note: 'Do not submit; roll violates THETA-POLICY. Adjust target DTE, underlying allowlist, or no-call list and re-run.',
      });
    }

    return JSON.stringify({
      account_number: accountNumber,
      policy_blocked: false,
      buying_power: availableBuyingPowerFromBalances(balancesRes.data),
      current_position: {
        symbol: position.symbol,
        underlying: position.underlying,
        option_type: position.optionType,
        strike: position.strike,
        expiration_date: position.expirationDate,
        dte: position.dte,
        mark: roll.current_mark,
      },
      roll_candidate: {
        symbol: roll.target_contract.symbol,
        strike: roll.target_contract.strike,
        expiration_date: roll.target_contract.expirationDate,
        dte: roll.target_contract.dte,
        mark: roll.target_mark,
        net_credit: roll.net_credit,
      },
      order_json: roll.order_json,
      dry_run_result: dryRunResult,
      note: 'Use tastytrade_submit_order only after the user explicitly confirms the roll.',
    });
  },
});
