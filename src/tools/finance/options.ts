import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

export const OPTIONS_CHAIN_DESCRIPTION = `
Fetches options chain data for a stock: available expiry dates, call/put contracts with strikes, bid/ask, implied volatility (IV), open interest (OI), and Greeks. Computes the put/call ratio (PCR) and flags unusual volume. Use for hedging analysis, directional sentiment, volatility assessment, and tail risk pricing.

## When to Use
- User asks about options, calls, puts, or implied volatility
- Assessing market sentiment via put/call ratio
- Checking cost of hedging (protective puts, collars)
- Identifying unusual options activity

## Example Queries
- "What's the options chain for AAPL?"
- "Is there unusual options activity in NVDA?"
- "What's the put/call ratio for SPY?"
- "How expensive are TSLA puts?"
`.trim();

const YAHOO_OPTIONS_BASE = 'https://query1.finance.yahoo.com/v7/finance/options';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface YahooContract {
  strike?: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
  contractSymbol?: string;
  expiration?: number;
}

interface ParsedContract {
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  inTheMoney: boolean;
  contractSymbol: string;
}

function parseContract(c: YahooContract): ParsedContract {
  return {
    strike: c.strike ?? 0,
    bid: c.bid ?? null,
    ask: c.ask ?? null,
    last: c.lastPrice ?? null,
    volume: c.volume ?? 0,
    openInterest: c.openInterest ?? 0,
    impliedVolatility:
      c.impliedVolatility != null ? parseFloat((c.impliedVolatility * 100).toFixed(2)) : null,
    inTheMoney: c.inTheMoney ?? false,
    contractSymbol: c.contractSymbol ?? '',
  };
}

function topByOI(contracts: ParsedContract[], n = 10): ParsedContract[] {
  return [...contracts].sort((a, b) => b.openInterest - a.openInterest).slice(0, n);
}

function formatContractTable(contracts: ParsedContract[], label: string): string {
  if (contracts.length === 0) return `_No ${label} data available._`;
  const header = `| Strike | Bid | Ask | Last | Volume | OI | IV% | ITM |`;
  const divider = `|--------|-----|-----|------|--------|-----|-----|-----|`;
  const rows = contracts.map(
    (c) =>
      `| ${c.strike} | ${c.bid ?? '-'} | ${c.ask ?? '-'} | ${c.last ?? '-'} | ${c.volume} | ${c.openInterest} | ${c.impliedVolatility ?? '-'} | ${c.inTheMoney ? '✓' : ''} |`,
  );
  return [`**${label}** (top ${contracts.length} by OI)`, header, divider, ...rows].join('\n');
}

const OptionsInputSchema = z.object({
  ticker: z.string().describe("Stock ticker symbol, e.g. 'AAPL'"),
  expiry: z
    .string()
    .optional()
    .describe('Optional expiry date in YYYY-MM-DD format. Omit for nearest expiry.'),
  type: z
    .enum(['all', 'calls', 'puts'])
    .default('all')
    .describe('Which contracts to return'),
});

export const getOptionsChainTool = new DynamicStructuredTool({
  name: 'get_options_chain',
  description: OPTIONS_CHAIN_DESCRIPTION,
  schema: OptionsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();

    let url = `${YAHOO_OPTIONS_BASE}/${encodeURIComponent(ticker)}`;
    if (input.expiry) {
      const ts = Math.floor(new Date(input.expiry).getTime() / 1000);
      if (!isNaN(ts)) url += `?date=${ts}`;
    }

    let json: unknown;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return formatToolResult(
          {
            error: `Options data unavailable for ${ticker} (HTTP ${res.status}). The ticker may not have listed options, or Yahoo Finance may be temporarily unavailable.`,
          },
          [],
        );
      }
      json = await res.json();
    } catch (err) {
      return formatToolResult(
        {
          error: `Failed to fetch options for ${ticker}: ${err instanceof Error ? err.message : String(err)}. The ticker may not have listed options.`,
        },
        [],
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const optionChain = (json as any)?.optionChain?.result?.[0];
    if (!optionChain) {
      return formatToolResult(
        {
          error: `No options data found for ${ticker}. The ticker may not have listed options or may be delisted.`,
        },
        [],
      );
    }

    // Available expiry dates (Unix timestamps → ISO strings)
    const expiryDates: string[] = (optionChain.expirationDates ?? []).map((ts: number) =>
      new Date(ts * 1000).toISOString().slice(0, 10),
    );

    const currentPrice: number | null = optionChain.quote?.regularMarketPrice ?? null;
    const options = optionChain.options?.[0] ?? {};

    const rawCalls: YahooContract[] = options.calls ?? [];
    const rawPuts: YahooContract[] = options.puts ?? [];
    const calls = rawCalls.map(parseContract);
    const puts = rawPuts.map(parseContract);

    // Put/call ratio by open interest
    const totalCallOI = calls.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI = puts.reduce((s, c) => s + c.openInterest, 0);
    const pcr = totalCallOI > 0 ? parseFloat((totalPutOI / totalCallOI).toFixed(4)) : null;

    // ATM strike (nearest to current price)
    let atmStrike: number | null = null;
    if (currentPrice !== null) {
      const allStrikes = [...calls, ...puts].map((c) => c.strike);
      if (allStrikes.length > 0) {
        atmStrike = allStrikes.reduce((prev, curr) =>
          Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice) ? curr : prev,
        );
      }
    }

    // Unusual volume: volume > 3× average
    const avgCallVol =
      calls.length > 0 ? calls.reduce((s, c) => s + c.volume, 0) / calls.length : 0;
    const avgPutVol =
      puts.length > 0 ? puts.reduce((s, c) => s + c.volume, 0) / puts.length : 0;

    const unusualCalls = calls
      .filter((c) => c.volume > 0 && c.volume > avgCallVol * 3)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
    const unusualPuts = puts
      .filter((c) => c.volume > 0 && c.volume > avgPutVol * 3)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    const unusualLines: string[] = [];
    for (const c of unusualCalls) {
      unusualLines.push(
        `CALL ${c.contractSymbol || `${ticker} $${c.strike}`}: vol=${c.volume} (${(c.volume / Math.max(avgCallVol, 1)).toFixed(1)}× avg), IV=${c.impliedVolatility ?? '-'}%`,
      );
    }
    for (const c of unusualPuts) {
      unusualLines.push(
        `PUT  ${c.contractSymbol || `${ticker} $${c.strike}`}: vol=${c.volume} (${(c.volume / Math.max(avgPutVol, 1)).toFixed(1)}× avg), IV=${c.impliedVolatility ?? '-'}%`,
      );
    }

    const topCalls = input.type !== 'puts' ? topByOI(calls) : [];
    const topPuts = input.type !== 'calls' ? topByOI(puts) : [];

    const sections: string[] = [
      `## Options Chain: ${ticker}`,
      `**Current Price:** ${currentPrice != null ? `$${currentPrice}` : 'N/A'}  |  **ATM Strike:** ${atmStrike != null ? `$${atmStrike}` : 'N/A'}  |  **Put/Call Ratio (OI):** ${pcr ?? 'N/A'}`,
      `**Available Expiries:** ${expiryDates.slice(0, 8).join(', ')}${expiryDates.length > 8 ? ` (+${expiryDates.length - 8} more)` : ''}`,
    ];

    if (input.type !== 'puts') sections.push('\n' + formatContractTable(topCalls, 'Calls'));
    if (input.type !== 'calls') sections.push('\n' + formatContractTable(topPuts, 'Puts'));

    if (unusualLines.length > 0) {
      sections.push('\n### Unusual Volume\n' + unusualLines.join('\n'));
    }

    return formatToolResult({ markdown: sections.join('\n'), pcr, atmStrike, expiryDates }, [url]);
  },
});
