import { describe, it, expect, mock } from 'bun:test';
import type { PolymarketMarketResult } from './polymarket.js';
import type { SignalCategory } from './signal-extractor.js';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

const mockMarkets: PolymarketMarketResult[] = [
  { question: 'Will NVIDIA beat Q2 earnings?', probability: 0.72, volume24h: 500_000 },
  { question: 'Will NVIDIA revenue exceed $30B?', probability: 0.65, volume24h: 300_000 },
];

const mockSignals: SignalCategory[] = [
  {
    name: 'Earnings',
    searchPhrase: 'NVIDIA earnings',
    weight: 0.35,
    category: 'earnings_beat',
  },
];

mock.module('./polymarket.js', () => ({
  fetchPolymarketMarkets: async (_query: string, _limit: number): Promise<PolymarketMarketResult[]> =>
    mockMarkets,
}));

mock.module('./signal-extractor.js', () => ({
  extractSignals: (_query: string): SignalCategory[] => mockSignals,
}));

// Import after mocking
const { polymarketForecastTool } = await import('./polymarket-forecast.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(raw: unknown): string {
  const outer = JSON.parse(raw as string) as { data?: { result?: string; error?: string } };
  return outer.data?.result ?? outer.data?.error ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('polymarketForecastTool', () => {
  it('result string contains "Polymarket Forecast"', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('Polymarket Forecast');
  });

  it('includes the ticker in the output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('NVDA');
  });

  it('forecastPrice > 0', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    const output = parseResult(raw);
    const match = output.match(/Forecast price:\s+\$([0-9.]+)/);
    expect(match).not.toBeNull();
    const price = parseFloat(match![1]!);
    expect(price).toBeGreaterThan(0);
  });

  it('shows warning when no current_price provided', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7 },
      undefined,
    );
    expect(parseResult(raw)).toContain('No current price provided');
  });

  it('shows market questions in polymarket signal section', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('Will NVIDIA beat Q2 earnings?');
  });

  it('includes 95% CI in output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('95% CI');
  });

  it('includes grade in output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toMatch(/Grade:\s+[ABCD]/);
  });

  it('omits not-provided signals with placeholder text', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('[signal omitted — not provided]');
  });

  it('includes provided sentiment_score in output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50, sentiment_score: 0.7 },
      undefined,
    );
    expect(parseResult(raw)).toContain('very bullish');
  });

  it('grade D when 0 markets returned', async () => {
    // Temporarily override mock to return 0 markets
    mock.module('./polymarket.js', () => ({
      fetchPolymarketMarkets: async (): Promise<PolymarketMarketResult[]> => [],
    }));

    const { polymarketForecastTool: freshTool } = await import('./polymarket-forecast.js');
    const raw = await freshTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('Grade: D');
  });
});
