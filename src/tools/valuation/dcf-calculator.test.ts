import { describe, expect, test } from 'bun:test';
import { calculateDcf, dcfCalculatorTool } from './dcf-calculator.js';

describe('calculateDcf', () => {
  test('reconciles the Apple owner-earnings case that exposed the terminal value bug', () => {
    const result = calculateDcf({
      baseFcf: 83.8,
      growthRates: [0.05, 0.045, 0.04, 0.035, 0.03],
      discountRate: 0.10,
      terminalGrowthRate: 0.025,
      netDebt: -20,
      sharesOutstanding: 14.95,
      units: 'billions',
    });

    expect(result.projections.map((projection) => projection.fcf)).toEqual([
      87.99,
      91.9495,
      95.6275,
      98.9745,
      101.9437,
    ]);
    expect(result.totalPvFcf).toBeCloseTo(358.7286, 4);
    expect(result.terminalValue).toBeCloseTo(1393.2310, 4);
    expect(result.pvTerminalValue).toBeCloseTo(865.0868, 4);
    expect(result.enterpriseValue).toBeCloseTo(1223.8154, 4);
    expect(result.equityValue).toBeCloseTo(1243.8154, 4);
    expect(result.valuePerShare).toBeCloseTo(83.1984, 4);
  });

  test('computes the same base case when explicit projected FCFs are provided', () => {
    const result = calculateDcf({
      baseFcf: 83.8,
      projectedFcfs: [88.0, 92.0, 95.7, 99.1, 102.1],
      discountRate: 0.10,
      terminalGrowthRate: 0.025,
      netDebt: -20,
      sharesOutstanding: 14.95,
      units: 'billions',
    });

    expect(result.totalPvFcf).toBeCloseTo(359.0166, 4);
    expect(result.terminalValue).toBeCloseTo(1395.3667, 4);
    expect(result.pvTerminalValue).toBeCloseTo(866.4129, 4);
    expect(result.valuePerShare).toBeCloseTo(83.3063, 4);
  });

  test('returns a sensitivity matrix from explicit rate grids', () => {
    const result = calculateDcf({
      baseFcf: 83.8,
      growthRates: [0.05, 0.045, 0.04, 0.035, 0.03],
      discountRate: 0.10,
      terminalGrowthRate: 0.025,
      netDebt: -20,
      sharesOutstanding: 14.95,
      discountRates: [0.09, 0.10, 0.11],
      terminalGrowthRates: [0.02, 0.025, 0.03],
      units: 'billions',
    });

    expect(result.sensitivity).toHaveLength(3);
    expect(result.sensitivity[0]).toHaveLength(3);
    expect(result.sensitivity[1][1].valuePerShare).toBeCloseTo(result.valuePerShare, 4);
    expect(result.sensitivity[0][2].valuePerShare).toBeGreaterThan(result.sensitivity[2][0].valuePerShare);
  });

  test('rejects terminal growth at or above the discount rate', () => {
    expect(() =>
      calculateDcf({
        baseFcf: 10,
        growthRates: [0.03],
        discountRate: 0.03,
        terminalGrowthRate: 0.03,
        sharesOutstanding: 1,
      }),
    ).toThrow('discountRate must be greater than terminalGrowthRate');
  });
});

describe('dcfCalculatorTool', () => {
  test('serializes deterministic DCF output as a tool result', async () => {
    const raw = await dcfCalculatorTool.func({
      baseFcf: 83.8,
      growthRates: [0.05, 0.045, 0.04, 0.035, 0.03],
      discountRate: 0.10,
      terminalGrowthRate: 0.025,
      netDebt: -20,
      sharesOutstanding: 14.95,
      units: 'billions',
    });
    expect(typeof raw).toBe('string');
    if (typeof raw !== 'string') {
      throw new Error('Expected dcfCalculatorTool to return a string result.');
    }
    const parsed = JSON.parse(raw) as { data: { valuePerShare: number; pvTerminalValue: number } };

    expect(parsed.data.valuePerShare).toBeCloseTo(83.1984, 4);
    expect(parsed.data.pvTerminalValue).toBeCloseTo(865.0868, 4);
  });
});
