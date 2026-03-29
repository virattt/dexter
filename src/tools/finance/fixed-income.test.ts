import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFredCsv(value: string): string {
  return `DATE,VALUE\n2024-01-01,.\n2024-02-01,${value}\n`;
}

function makeFredCsvEmpty(): string {
  return `DATE,VALUE\n2024-01-01,.\n`;
}

// ── mock fetch ────────────────────────────────────────────────────────────────

// We'll replace the global fetch before each test group
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── FRED CSV parsing ──────────────────────────────────────────────────────────

describe('FRED CSV parsing', () => {
  it('extracts the latest non-empty numeric value', async () => {
    // Inline CSV parse logic (mirrors fixed-income.ts internals)
    const csv = makeFredCsv('4.52');
    const lines = csv.trim().split('\n');
    let result: number | null = null;
    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(',');
      const val = parts[1]?.trim();
      if (val && val !== '.' && val !== '') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          result = num;
          break;
        }
      }
    }
    expect(result).toBe(4.52);
  });

  it('skips dot-value rows and returns null when all missing', () => {
    const csv = makeFredCsvEmpty();
    const lines = csv.trim().split('\n');
    let result: number | null = null;
    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(',');
      const val = parts[1]?.trim();
      if (val && val !== '.' && val !== '') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          result = num;
          break;
        }
      }
    }
    expect(result).toBeNull();
  });
});

// ── yield curve spread calculation ───────────────────────────────────────────

describe('yield curve spread calculation', () => {
  it('computes 10Y-2Y spread correctly', () => {
    const y10 = 4.5;
    const y2 = 4.8;
    const spread = parseFloat((y10 - y2).toFixed(4));
    expect(spread).toBe(-0.3);
  });

  it('detects inversion when spread is negative', () => {
    const spread = -0.3;
    expect(spread < 0).toBe(true);
  });

  it('detects non-inverted when spread is positive', () => {
    const spread = 0.5;
    expect(spread < 0).toBe(false);
  });

  it('returns null spread when either yield is missing', () => {
    const y10: number | null = null;
    const y2 = 4.8;
    const spread = y10 !== null && y2 !== null ? parseFloat((y10 - y2).toFixed(4)) : null;
    expect(spread).toBeNull();
  });
});

// ── get_fixed_income tool integration ────────────────────────────────────────

describe('get_fixed_income tool', () => {
  it('returns treasury_yields and yield_curve with mock fetch', async () => {
    // Mock fetch to return predictable CSV data
    const csvResponses: Record<string, string> = {
      DGS2: makeFredCsv('4.80'),
      DGS5: makeFredCsv('4.50'),
      DGS10: makeFredCsv('4.30'),
      DGS30: makeFredCsv('4.60'),
    };

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      for (const [series, csv] of Object.entries(csvResponses)) {
        if (urlStr.includes(`id=${series}`)) {
          return new Response(csv, { status: 200 });
        }
      }
      return new Response('DATE,VALUE\n2024-01-01,.', { status: 200 });
    }) as unknown as typeof fetch;

    // Dynamic import to pick up mocked fetch
    const { getFixedIncomeTool } = await import('./fixed-income.js');
    const raw = await getFixedIncomeTool.invoke({ series: ['treasury_yields', 'yield_curve'] });
    const parsed = JSON.parse(raw) as { data: Record<string, unknown> };

    expect(parsed.data).toHaveProperty('treasury_yields');
    expect(parsed.data).toHaveProperty('yield_curve');
    expect(parsed.data).toHaveProperty('as_of');

    const ty = parsed.data.treasury_yields as Record<string, number | null>;
    expect(ty['2Y']).toBe(4.8);
    expect(ty['10Y']).toBe(4.3);

    const yc = parsed.data.yield_curve as { spread_10y_2y: number; inverted: boolean };
    expect(yc.spread_10y_2y).toBe(-0.5); // 4.30 - 4.80
    expect(yc.inverted).toBe(true);
  });

  it('returns fed_funds when requested', async () => {
    globalThis.fetch = mock(async () =>
      new Response(makeFredCsv('5.33'), { status: 200 }),
    ) as unknown as typeof fetch;

    const { getFixedIncomeTool } = await import('./fixed-income.js');
    const raw = await getFixedIncomeTool.invoke({ series: ['fed_funds'] });
    const parsed = JSON.parse(raw) as { data: Record<string, unknown> };

    expect(parsed.data).toHaveProperty('fed_funds');
    const ff = parsed.data.fed_funds as { rate: number };
    expect(ff.rate).toBe(5.33);
  });

  it('gracefully returns null values when FRED is unavailable', async () => {
    globalThis.fetch = mock(async () => new Response('error', { status: 500 })) as unknown as typeof fetch;

    const { getFixedIncomeTool } = await import('./fixed-income.js');
    const raw = await getFixedIncomeTool.invoke({ series: ['treasury_yields', 'yield_curve'] });
    const parsed = JSON.parse(raw) as { data: Record<string, unknown> };

    expect(parsed.data).toHaveProperty('treasury_yields');
    const ty = parsed.data.treasury_yields as Record<string, number | null>;
    expect(ty['2Y']).toBeNull();
    expect(ty['10Y']).toBeNull();
  });
});
