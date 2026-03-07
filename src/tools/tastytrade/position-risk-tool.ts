import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getBalances, getPositions, getQuotes } from './api.js';
import {
  availableBuyingPowerFromBalances,
  getFirstAccountNumber,
  normalizePositions,
  totalEquityFromBalances,
} from './utils.js';
import { detectUnderlyingInstrumentType, extractQuoteMap, uniqueSymbols } from './theta-helpers.js';

export const tastytradePositionRiskTool = new DynamicStructuredTool({
  name: 'tastytrade_position_risk',
  description:
    'Enrich live tastytrade positions into a decision-ready risk view: DTE, option type, concentration, buying power usage, and challenged short options.',
  schema: z.object({
    account_number: z
      .string()
      .optional()
      .describe('Tastytrade account number. If omitted, uses the first linked account.'),
  }),
  func: async (input) => {
    const accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({ error: 'No tastytrade account found. Provide account_number or link an account.' });
    }

    const [positionsRes, balancesRes] = await Promise.all([getPositions(accountNumber), getBalances(accountNumber)]);
    const positions = normalizePositions(positionsRes.data);
    const totalEquity = totalEquityFromBalances(balancesRes.data);
    const buyingPower = availableBuyingPowerFromBalances(balancesRes.data);

    const underlyings = uniqueSymbols(positions.map((position) => position.underlying));
    const underlyingQuotes = new Map<string, number>();
    for (const underlying of underlyings) {
      const instrumentType = detectUnderlyingInstrumentType(underlying);
      try {
        const quoteRes = await getQuotes([underlying], instrumentType);
        const quoteMap = extractQuoteMap(quoteRes.data);
        const quote = quoteMap.get(underlying);
        if (quote) {
          underlyingQuotes.set(underlying, quote.mark || quote.last || quote.bid || quote.ask);
        }
      } catch {
        // Best effort only; positions still remain usable without quotes.
      }
    }

    const concentration = new Map<string, number>();
    let portfolioTheta = 0;
    let portfolioDelta = 0;

    const enrichedPositions = positions.map((position) => {
      const grossValue = Math.abs(position.value || position.mark * position.quantity * 100);
      concentration.set(position.underlying, (concentration.get(position.underlying) ?? 0) + grossValue);
      portfolioTheta += position.theta != null ? position.theta * Math.abs(position.quantity) : 0;
      portfolioDelta += position.delta != null ? position.delta * position.quantity * 100 : 0;

      const underlyingPrice = underlyingQuotes.get(position.underlying) ?? null;
      const challenged =
        position.side === 'short' && position.optionType && underlyingPrice != null && position.strike != null
          ? isChallenged(position.optionType, position.strike, underlyingPrice)
          : false;

      return {
        symbol: position.symbol,
        underlying: position.underlying,
        instrument_type: position.instrumentType,
        side: position.side,
        quantity: position.quantity,
        average_open_price: position.averageOpenPrice,
        mark: position.mark,
        value: position.value,
        option_type: position.optionType,
        strike: position.strike,
        expiration_date: position.expirationDate,
        dte: position.dte,
        delta: position.delta,
        theta: position.theta,
        gamma: position.gamma,
        vega: position.vega,
        underlying_price: underlyingPrice,
        challenged,
        assignment_risk:
          position.side === 'short' && position.optionType && position.dte != null && position.dte <= 7 && challenged,
      };
    });

    const concentrationRows = [...concentration.entries()]
      .map(([underlying, grossValue]) => ({
        underlying,
        gross_value: Number(grossValue.toFixed(2)),
        portfolio_weight_pct: totalEquity > 0 ? Number(((grossValue / totalEquity) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.gross_value - a.gross_value);

    const challengedShorts = enrichedPositions.filter((position) => position.challenged);

    return JSON.stringify({
      account_number: accountNumber,
      total_equity: totalEquity,
      buying_power: buyingPower,
      buying_power_usage_pct:
        totalEquity > 0 && buyingPower > 0 ? Number((((totalEquity - buyingPower) / totalEquity) * 100).toFixed(2)) : null,
      portfolio_theta: Number(portfolioTheta.toFixed(4)),
      portfolio_delta: Number(portfolioDelta.toFixed(4)),
      concentration: concentrationRows,
      challenged_short_positions: challengedShorts,
      positions: enrichedPositions,
    });
  },
});

function isChallenged(optionType: 'C' | 'P', strike: number, underlyingPrice: number): boolean {
  if (underlyingPrice <= 0) return false;
  if (optionType === 'P') {
    return underlyingPrice <= strike * 1.01;
  }
  return underlyingPrice >= strike * 0.99;
}
