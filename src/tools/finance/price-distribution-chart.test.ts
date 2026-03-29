import { describe, it, expect } from 'bun:test';
import {
  buildPriceDistributionChart,
  extractPriceThresholds,
  type ThresholdPoint,
} from './price-distribution-chart.js';

// ---------------------------------------------------------------------------
// extractPriceThresholds
// ---------------------------------------------------------------------------

describe('extractPriceThresholds', () => {
  it('extracts plain dollar amounts from question text', () => {
    const markets = [
      { question: 'Will BTC reach $70,000 by March?', probability: 0.035 },
      { question: 'Will BTC stay above $60,000?', probability: 0.997 },
    ];
    const pts = extractPriceThresholds(markets);
    expect(pts).toHaveLength(2);
    expect(pts[0]?.price).toBe(60_000);
    expect(pts[1]?.price).toBe(70_000);
  });

  it('handles K suffix (e.g. $70K → 70000)', () => {
    const markets = [
      { question: 'Will BTC exceed $70K?', probability: 0.04 },
      { question: 'Will BTC stay above $60K?', probability: 0.99 },
    ];
    const pts = extractPriceThresholds(markets);
    expect(pts[0]?.price).toBe(60_000);
    expect(pts[1]?.price).toBe(70_000);
  });

  it('handles M suffix (e.g. $1.5M → 1500000)', () => {
    const markets = [
      { question: 'Will BTC exceed $1.5M?', probability: 0.001 },
    ];
    const pts = extractPriceThresholds(markets);
    expect(pts[0]?.price).toBe(1_500_000);
  });

  it('averages probability when same price appears in multiple markets', () => {
    const markets = [
      { question: 'Will gold exceed $3,400?', probability: 0.08 },
      { question: 'Will gold settle above $3,400?', probability: 0.10 },
    ];
    const pts = extractPriceThresholds(markets);
    expect(pts).toHaveLength(1);
    expect(pts[0]?.price).toBe(3_400);
    expect(pts[0]?.probability).toBeCloseTo(0.09, 5);
  });

  it('returns empty array when no price patterns found', () => {
    const markets = [
      { question: 'Will the Fed cut rates before July?', probability: 0.15 },
      { question: 'Will US recession happen in 2026?', probability: 0.36 },
    ];
    expect(extractPriceThresholds(markets)).toEqual([]);
  });

  it('sorts results ascending by price', () => {
    const markets = [
      { question: 'Will BTC exceed $80K?', probability: 0.01 },
      { question: 'Will BTC exceed $60K?', probability: 0.99 },
      { question: 'Will BTC exceed $70K?', probability: 0.04 },
    ];
    const pts = extractPriceThresholds(markets);
    expect(pts.map(p => p.price)).toEqual([60_000, 70_000, 80_000]);
  });

  it('handles comma-formatted numbers like $3,400', () => {
    const markets = [
      { question: 'Will Gold hit $3,400?', probability: 0.079 },
    ];
    const pts = extractPriceThresholds(markets);
    expect(pts[0]?.price).toBe(3_400);
  });
});

// ---------------------------------------------------------------------------
// buildPriceDistributionChart — structure and math
// ---------------------------------------------------------------------------

describe('buildPriceDistributionChart', () => {
  const btcThresholds: ThresholdPoint[] = [
    { price: 60_000, probability: 0.997 },
    { price: 62_000, probability: 0.987 },
    { price: 70_000, probability: 0.035 },
  ];

  it('returns a non-empty string for valid input', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    expect(typeof chart).toBe('string');
    expect(chart.length).toBeGreaterThan(0);
  });

  it('includes a header with the asset label', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    expect(chart).toContain('BTC');
    expect(chart).toContain('Price Distribution');
  });

  it('includes current price in header when provided', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    expect(chart).toContain('current');
  });

  it('marks the bucket containing current price with ◄', () => {
    // current = 66,539 → falls in $62K–$70K bucket
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    const lines = chart.split('\n');
    const markedLine = lines.find(l => l.includes('◄'));
    expect(markedLine).toBeDefined();
    expect(markedLine).toContain('62');
    expect(markedLine).toContain('70');
  });

  it('has correct number of bucket rows (thresholds.length + 1)', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    const barLines = chart.split('\n').filter(l => l.includes('█') || l.includes('░'));
    // 3 thresholds → 4 buckets: below 60K, 60K–62K, 62K–70K, above 70K
    expect(barLines).toHaveLength(4);
  });

  it('bucket probabilities sum to ~100%', () => {
    const chart = buildPriceDistributionChart(btcThresholds);
    // Extract percentages from the chart lines
    const pctMatches = [...chart.matchAll(/(\d+\.\d)%/g)].map(m => parseFloat(m[1]!));
    const sum = pctMatches.reduce((a, b) => a + b, 0);
    // Should sum to ~100 (allow small floating point rounding)
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it('uses filled bars (█) for high-probability buckets', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    const lines = chart.split('\n');
    // The $62K–$70K bucket has 95.2% probability → should have many filled chars
    const bigBucket = lines.find(l => l.includes('◄'));
    expect(bigBucket).toBeDefined();
    const filledCount = (bigBucket!.match(/█/g) ?? []).length;
    expect(filledCount).toBeGreaterThan(15); // out of 20 max
  });

  it('uses mostly empty bars (░) for low-probability buckets', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    const lines = chart.split('\n').filter(l => l.includes('░'));
    // below $60K (0.3%) and above $70K (3.5%) should be mostly empty
    const belowLine = lines.find(l => l.includes('< $60'));
    expect(belowLine).toBeDefined();
    const emptyCount = (belowLine!.match(/░/g) ?? []).length;
    expect(emptyCount).toBeGreaterThan(18); // near-empty bar
  });

  it('returns empty string for fewer than 2 thresholds', () => {
    const chart = buildPriceDistributionChart([]);
    expect(chart).toBe('');
  });

  it('returns single-threshold fallback text for exactly 1 threshold', () => {
    const chart = buildPriceDistributionChart([{ price: 70_000, probability: 0.035 }]);
    expect(chart).toContain('single threshold');
    expect(chart).toContain('3.5%');
  });

  it('works without current_price (no ◄ marker)', () => {
    const chart = buildPriceDistributionChart(btcThresholds);
    expect(chart).not.toContain('◄');
  });

  it('handles gold-style prices (low thousands)', () => {
    const goldThresholds: ThresholdPoint[] = [
      { price: 3_400, probability: 0.079 },
      { price: 5_000, probability: 0.12 },
      { price: 6_200, probability: 0.09 },
    ];
    const chart = buildPriceDistributionChart(goldThresholds, 3_100, 'GLD');
    expect(chart).toContain('GLD');
    const barLines = chart.split('\n').filter(l => l.includes('█') || l.includes('░'));
    expect(barLines).toHaveLength(4); // 3 thresholds → 4 buckets
  });

  it('formats prices compactly (K for thousands, M for millions)', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 66_539, 'BTC');
    expect(chart).toContain('60K');
    expect(chart).toContain('70K');
  });

  it('does not include current marker when price is above all thresholds', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 75_000, 'BTC');
    const lines = chart.split('\n');
    const markedLine = lines.find(l => l.includes('◄'));
    // Should be in the "> $70K" bucket
    expect(markedLine).toBeDefined();
    expect(markedLine).toContain('>');
  });

  it('does not include current marker when price is below all thresholds', () => {
    const chart = buildPriceDistributionChart(btcThresholds, 55_000, 'BTC');
    const lines = chart.split('\n');
    const markedLine = lines.find(l => l.includes('◄'));
    expect(markedLine).toBeDefined();
    expect(markedLine).toContain('<');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: extract + build
// ---------------------------------------------------------------------------

describe('extractPriceThresholds + buildPriceDistributionChart round-trip', () => {
  it('produces a valid chart from real-world-style market question data', () => {
    const markets = [
      { question: 'Will BTC reach $70K by March 30?', probability: 0.035 },
      { question: 'Will BTC stay above $62K by March 30?', probability: 0.987 },
      { question: 'Will BTC stay above $60K by March 30?', probability: 0.997 },
    ];
    const thresholds = extractPriceThresholds(markets);
    expect(thresholds.length).toBeGreaterThanOrEqual(2);

    const chart = buildPriceDistributionChart(thresholds, 66_539, 'BTC');
    expect(chart).toContain('BTC Price Distribution');
    expect(chart).toContain('◄');

    // Probabilities sum to ~100%
    const pctMatches = [...chart.matchAll(/(\d+\.\d)%/g)].map(m => parseFloat(m[1]!));
    const sum = pctMatches.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThanOrEqual(101);
  });
});
