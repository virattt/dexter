import { getOptionChain, getQuotes } from './api.js';
import { buildOrderJson, detectUnderlyingInstrumentType, extractOptionContracts, extractQuoteMap, OptionContract } from './theta-helpers.js';
import { NormalizedPosition } from './utils.js';

export function findShortOptionPosition(
  positions: NormalizedPosition[],
  input: { position_symbol?: string; underlying_symbol?: string; option_type?: 'C' | 'P'; strike?: number }
): NormalizedPosition | null {
  if (input.position_symbol) {
    return positions.find((position) => position.symbol === input.position_symbol && position.side === 'short') ?? null;
  }

  return (
    positions.find(
      (position) =>
        position.side === 'short' &&
        position.optionType &&
        (!input.underlying_symbol || position.underlying === input.underlying_symbol.toUpperCase()) &&
        (!input.option_type || position.optionType === input.option_type) &&
        (input.strike == null || position.strike === input.strike)
    ) ?? null
  );
}

export async function buildRollCandidate(
  position: NormalizedPosition,
  targetDaysOut = 7
): Promise<{
  target_contract: OptionContract | null;
  current_mark: number;
  target_mark: number;
  net_credit: number;
  order_json: Record<string, unknown> | null;
}> {
  const instrumentType = detectUnderlyingInstrumentType(position.underlying);
  const optionInstrumentType = instrumentType === 'Index' ? 'Index Option' : 'Equity Option';
  const chainRes = await getOptionChain(position.underlying);
  const contracts = extractOptionContracts(chainRes.data).filter(
    (contract) =>
      contract.optionType === position.optionType &&
      contract.expirationDate !== position.expirationDate &&
      contract.dte != null &&
      position.dte != null &&
      contract.dte > position.dte
  );
  const targetContract = chooseRollTarget(contracts, position, targetDaysOut);
  if (!targetContract) {
    return {
      target_contract: null,
      current_mark: position.mark,
      target_mark: 0,
      net_credit: -position.mark,
      order_json: null,
    };
  }

  const quotesRes = await getQuotes([position.symbol, targetContract.symbol], 'Equity Option');
  const quotes = extractQuoteMap(quotesRes.data);
  const currentMark = quotes.get(position.symbol)?.mark || position.mark;
  const targetMark = quotes.get(targetContract.symbol)?.mark || 0;
  const netCredit = targetMark - currentMark;

  return {
    target_contract: targetContract,
    current_mark: currentMark,
    target_mark: targetMark,
    net_credit: Number(netCredit.toFixed(2)),
    order_json: buildOrderJson({
      price: netCredit,
      legs: [
        {
          symbol: position.symbol,
          quantity: Math.abs(position.quantity),
          action: 'Buy to Close',
          instrument_type: optionInstrumentType,
        },
        {
          symbol: targetContract.symbol,
          quantity: Math.abs(position.quantity),
          action: 'Sell to Open',
          instrument_type: optionInstrumentType,
        },
      ],
    }),
  };
}

function chooseRollTarget(
  contracts: OptionContract[],
  position: NormalizedPosition,
  targetDaysOut: number
): OptionContract | null {
  let best: OptionContract | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const contract of contracts) {
    const strikeDistance = Math.abs((contract.strike ?? 0) - (position.strike ?? 0));
    const dteDistance = Math.abs((contract.dte ?? targetDaysOut) - targetDaysOut);
    const score = strikeDistance + dteDistance * 0.5;
    if (score < bestScore) {
      best = contract;
      bestScore = score;
    }
  }
  return best;
}
