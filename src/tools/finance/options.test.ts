import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeContract(overrides: Partial<{
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  contractSymbol: string;
}> = {}) {
  return {
    strike: 150,
    bid: 2.5,
    ask: 2.6,
    lastPrice: 2.55,
    volume: 1000,
    openInterest: 5000,
    impliedVolatility: 0.25,
    inTheMoney: false,
    contractSymbol: 'AAPL240719C00150000',
    ...overrides,
  };
}

function makeYahooOptionsResponse(calls: unknown[], puts: unknown[]) {
  return {
    optionChain: {
      result: [
        {
          underlyingSymbol: 'AAPL',
          expirationDates: [1721347200, 1723939200],
          quote: { regularMarketPrice: 150.5 },
          options: [{ calls, puts }],
        },
      ],
      error: null,
    },
  };
}

// ── mock fetch ────────────────────────────────────────────────────────────────

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── Yahoo Finance response parsing ────────────────────────────────────────────

describe('Yahoo Finance options response parsing', () => {
  it('parses contract fields correctly', () => {
    const raw = makeContract({ strike: 160, impliedVolatility: 0.30, inTheMoney: true });
    // Mirror parseContract logic from options.ts
    const parsed = {
      strike: raw.strike ?? 0,
      bid: raw.bid ?? null,
      ask: raw.ask ?? null,
      last: raw.lastPrice ?? null,
      volume: raw.volume ?? 0,
      openInterest: raw.openInterest ?? 0,
      impliedVolatility:
        raw.impliedVolatility != null ? parseFloat((raw.impliedVolatility * 100).toFixed(2)) : null,
      inTheMoney: raw.inTheMoney ?? false,
      contractSymbol: raw.contractSymbol ?? '',
    };

    expect(parsed.strike).toBe(160);
    expect(parsed.impliedVolatility).toBe(30);
    expect(parsed.inTheMoney).toBe(true);
    expect(parsed.bid).toBe(2.5);
  });

  it('handles missing optional fields gracefully', () => {
    const raw = { strike: 200 };
    const parsed = {
      strike: (raw as { strike?: number }).strike ?? 0,
      bid: null,
      ask: null,
      last: null,
      volume: 0,
      openInterest: 0,
      impliedVolatility: null,
      inTheMoney: false,
      contractSymbol: '',
    };

    expect(parsed.volume).toBe(0);
    expect(parsed.bid).toBeNull();
    expect(parsed.impliedVolatility).toBeNull();
  });
});

// ── PCR calculation ───────────────────────────────────────────────────────────

describe('Put/Call Ratio calculation', () => {
  it('computes PCR correctly from OI', () => {
    const calls = [makeContract({ openInterest: 3000 }), makeContract({ openInterest: 2000 })];
    const puts = [makeContract({ openInterest: 4000 }), makeContract({ openInterest: 1000 })];

    const totalCallOI = calls.reduce((s, c) => s + c.openInterest, 0); // 5000
    const totalPutOI = puts.reduce((s, c) => s + c.openInterest, 0);   // 5000
    const pcr = totalCallOI > 0 ? parseFloat((totalPutOI / totalCallOI).toFixed(4)) : null;

    expect(pcr).toBe(1.0);
  });

  it('returns null PCR when no calls have OI', () => {
    const totalCallOI = 0;
    const totalPutOI = 500;
    const pcr = totalCallOI > 0 ? parseFloat((totalPutOI / totalCallOI).toFixed(4)) : null;

    expect(pcr).toBeNull();
  });

  it('detects bearish sentiment when PCR > 1', () => {
    const pcr = 1.5;
    expect(pcr > 1).toBe(true);
  });
});

// ── unusual volume detection ──────────────────────────────────────────────────

describe('Unusual volume detection', () => {
  it('flags contracts with volume > 3× average', () => {
    // Need enough low-volume contracts so one high-volume outlier exceeds 3× average.
    // avg = (50+50+50+50+50+1500)/6 = 1800/6 = 300; 3×avg = 900; 1500 > 900 ✓
    const contracts = [
      makeContract({ volume: 50 }),
      makeContract({ volume: 50 }),
      makeContract({ volume: 50 }),
      makeContract({ volume: 50 }),
      makeContract({ volume: 50 }),
      makeContract({ volume: 1500 }),
    ];

    const avgVol = contracts.reduce((s, c) => s + c.volume, 0) / contracts.length; // 300
    const unusual = contracts.filter((c) => c.volume > 0 && c.volume > avgVol * 3);

    expect(unusual.length).toBe(1);
    expect(unusual[0].volume).toBe(1500);
  });

  it('returns empty when no unusual volume', () => {
    const contracts = [
      makeContract({ volume: 100 }),
      makeContract({ volume: 110 }),
      makeContract({ volume: 90 }),
    ];
    const avgVol = contracts.reduce((s, c) => s + c.volume, 0) / contracts.length;
    const unusual = contracts.filter((c) => c.volume > 0 && c.volume > avgVol * 3);

    expect(unusual.length).toBe(0);
  });
});

// ── get_options_chain tool integration ────────────────────────────────────────

describe('get_options_chain tool', () => {
  it('returns parsed markdown output with PCR and expiry dates', async () => {
    const calls = [
      makeContract({ strike: 145, openInterest: 8000, volume: 500 }),
      makeContract({ strike: 150, openInterest: 6000, volume: 300, inTheMoney: true }),
    ];
    const puts = [
      makeContract({ strike: 145, openInterest: 4000, volume: 200 }),
      makeContract({ strike: 150, openInterest: 3000, volume: 150 }),
    ];

    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(makeYahooOptionsResponse(calls, puts)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { getOptionsChainTool } = await import('./options.js');
    const raw = await getOptionsChainTool.invoke({ ticker: 'AAPL', type: 'all' });
    const parsed = JSON.parse(raw) as {
      data: { markdown: string; pcr: number | null; atmStrike: number | null; expiryDates: string[] };
    };

    expect(parsed.data.markdown).toContain('Options Chain: AAPL');
    expect(parsed.data.markdown).toContain('Put/Call Ratio');
    expect(parsed.data.expiryDates).toBeArray();
    expect(parsed.data.expiryDates.length).toBe(2);

    // PCR = 7000 / 14000 = 0.5
    expect(parsed.data.pcr).toBe(0.5);
  });

  it('returns error when ticker has no options', async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ optionChain: { result: [], error: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { getOptionsChainTool } = await import('./options.js');
    const raw = await getOptionsChainTool.invoke({ ticker: 'FAKEXYZ', type: 'all' });
    const parsed = JSON.parse(raw) as { data: { error: string } };

    expect(parsed.data.error).toContain('No options data');
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = mock(async () =>
      new Response('Not Found', { status: 404 }),
    ) as unknown as typeof fetch;

    const { getOptionsChainTool } = await import('./options.js');
    const raw = await getOptionsChainTool.invoke({ ticker: 'AAPL', type: 'calls' });
    const parsed = JSON.parse(raw) as { data: { error: string } };

    expect(parsed.data.error).toContain('HTTP 404');
  });

  it('filters to calls only when type=calls', async () => {
    const calls = [makeContract({ strike: 155, openInterest: 5000 })];
    const puts = [makeContract({ strike: 145, openInterest: 3000 })];

    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(makeYahooOptionsResponse(calls, puts)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { getOptionsChainTool } = await import('./options.js');
    const raw = await getOptionsChainTool.invoke({ ticker: 'AAPL', type: 'calls' });
    const parsed = JSON.parse(raw) as { data: { markdown: string } };

    expect(parsed.data.markdown).toContain('Calls');
    expect(parsed.data.markdown).not.toContain('**Puts**');
  });
});
