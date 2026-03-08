import { extractDataArray, extractNumber } from './utils.js';

export type QuoteSnapshot = {
  symbol: string;
  bid: number;
  ask: number;
  mark: number;
  last: number;
  delta: number | null;
  theta: number | null;
  iv: number | null;
};

export type OptionContract = {
  symbol: string;
  optionType: 'C' | 'P';
  strike: number;
  expirationDate: string | null;
  dte: number | null;
};

type WalkContext = {
  expirationDate: string | null;
  dte: number | null;
  strike: number | null;
};

export function detectUnderlyingInstrumentType(symbol: string): 'Equity' | 'Index' {
  const upper = symbol.trim().toUpperCase();
  return ['SPX', 'NDX', 'RUT', 'VIX'].includes(upper) ? 'Index' : 'Equity';
}

export function extractQuoteMap(data: unknown): Map<string, QuoteSnapshot> {
  const result = new Map<string, QuoteSnapshot>();
  walkQuotes(data, result);
  for (const [symbol, quote] of result.entries()) {
    if (!quote.mark) {
      const mid = quote.bid && quote.ask ? (quote.bid + quote.ask) / 2 : quote.last;
      result.set(symbol, { ...quote, mark: mid });
    }
  }
  return result;
}

function walkQuotes(node: unknown, result: Map<string, QuoteSnapshot>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkQuotes(item, result);
    return;
  }
  if (typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  const symbol = typeof obj.symbol === 'string' ? obj.symbol : typeof obj['streamer-symbol'] === 'string' ? (obj['streamer-symbol'] as string) : null;
  if (symbol) {
    const bid = extractNumber(obj.bid_price ?? obj['bid-price'] ?? obj.bid);
    const ask = extractNumber(obj.ask_price ?? obj['ask-price'] ?? obj.ask);
    const last = extractNumber(obj.last_price ?? obj['last-price'] ?? obj.last);
    const mark = extractNumber(obj.mark_price ?? obj['mark-price'] ?? obj.mark ?? (bid && ask ? (bid + ask) / 2 : last));
    const delta = optionalNumber(obj.delta);
    const theta = optionalNumber(obj.theta);
    const iv = optionalNumber(obj.iv ?? obj.implied_volatility ?? obj['implied-volatility']);
    result.set(symbol, { symbol, bid, ask, last, mark, delta, theta, iv });
  }

  for (const value of Object.values(obj)) walkQuotes(value, result);
}

export function extractOptionContracts(data: unknown): OptionContract[] {
  const contracts = new Map<string, OptionContract>();
  walkChain(data, { expirationDate: null, dte: null, strike: null }, contracts);
  return [...contracts.values()];
}

function walkChain(node: unknown, context: WalkContext, contracts: Map<string, OptionContract>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkChain(item, context, contracts);
    return;
  }
  if (typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  const nextContext: WalkContext = {
    expirationDate:
      stringValue(
        obj['expiration-date'] ??
          obj.expiration_date ??
          obj.expiration ??
          obj['expires-at']
      ) ?? context.expirationDate,
    dte: optionalNumber(obj['days-to-expiration'] ?? obj.days_to_expiration ?? obj.dte) ?? context.dte,
    strike:
      optionalNumber(obj['strike-price'] ?? obj.strike_price ?? obj.strike) ?? context.strike,
  };

  addContract(
    contracts,
    stringValue(obj['call-symbol'] ?? obj.call_symbol ?? obj.callSymbol ?? obj.call),
    'C',
    nextContext
  );
  addContract(
    contracts,
    stringValue(obj['put-symbol'] ?? obj.put_symbol ?? obj.putSymbol ?? obj.put),
    'P',
    nextContext
  );

  const symbol = stringValue(obj.symbol);
  const optionType = inferOptionType(obj);
  if (symbol && optionType && nextContext.strike != null) {
    addContract(contracts, symbol, optionType, nextContext);
  }

  for (const value of Object.values(obj)) {
    walkChain(value, nextContext, contracts);
  }
}

function addContract(
  contracts: Map<string, OptionContract>,
  symbol: string | null,
  optionType: 'C' | 'P',
  context: WalkContext
): void {
  if (!symbol || context.strike == null) return;
  if (contracts.has(symbol)) return;
  contracts.set(symbol, {
    symbol,
    optionType,
    strike: context.strike,
    expirationDate: context.expirationDate,
    dte: context.dte,
  });
}

function inferOptionType(obj: Record<string, unknown>): 'C' | 'P' | null {
  const raw = stringValue(obj['option-type'] ?? obj.option_type ?? obj['call-or-put'] ?? obj.call_or_put);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.startsWith('C')) return 'C';
  if (upper.startsWith('P')) return 'P';
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function candidateScore(params: {
  credit: number;
  maxLoss: number;
  deltaDistance: number;
  dteDistance: number;
  policyPenalty?: number;
}): number {
  const rewardRisk = params.maxLoss > 0 ? params.credit / params.maxLoss : 0;
  return rewardRisk * 100 - params.deltaDistance * 10 - params.dteDistance * 0.25 - (params.policyPenalty ?? 0);
}

export function buildOrderJson(params: {
  price: number;
  legs: Array<{ symbol: string; quantity: number; action: string; instrument_type: string }>;
  time_in_force?: 'Day' | 'GTC';
  order_type?: 'Limit' | 'Market';
}): Record<string, unknown> {
  return {
    time_in_force: params.time_in_force ?? 'Day',
    order_type: params.order_type ?? 'Limit',
    price: Number(params.price.toFixed(2)),
    legs: params.legs,
  };
}

export function summarizeOrder(order: Record<string, unknown>): {
  price: number;
  legs: Array<{ symbol: string; quantity: number; action: string; instrument_type: string }>;
} {
  const rawLegs = Array.isArray(order.legs) ? order.legs : [];
  return {
    price: extractNumber(order.price ?? order.value),
    legs: rawLegs
      .map((leg) => {
        if (!leg || typeof leg !== 'object') return null;
        const entry = leg as Record<string, unknown>;
        const symbol = typeof entry.symbol === 'string' ? entry.symbol : '';
        const quantity = extractNumber(entry.quantity);
        const action = typeof entry.action === 'string' ? entry.action : '';
        const instrument_type =
          typeof entry.instrument_type === 'string' ? entry.instrument_type : 'Equity Option';
        if (!symbol || !action || !quantity) return null;
        return { symbol, quantity, action, instrument_type };
      })
      .filter((leg): leg is { symbol: string; quantity: number; action: string; instrument_type: string } => Boolean(leg)),
  };
}

export function uniqueSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.filter(Boolean))];
}

export function flattenResponse(data: unknown): Record<string, unknown>[] {
  return extractDataArray(data).filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
}
