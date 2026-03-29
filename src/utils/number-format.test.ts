import { describe, it, expect } from 'bun:test';
import { formatMoney, formatShares, annotateFinancialNumbers } from './number-format.js';

describe('formatMoney', () => {
  it('formats trillions', () => {
    expect(formatMoney(2_500_000_000_000)).toBe('$2.50T');
  });
  it('formats billions', () => {
    expect(formatMoney(12_345_678_901)).toBe('$12.35B');
  });
  it('formats millions', () => {
    expect(formatMoney(4_500_000)).toBe('$4.50M');
  });
  it('formats thousands', () => {
    expect(formatMoney(980_000)).toBe('$980.00K');
  });
  it('formats sub-thousand', () => {
    expect(formatMoney(42.5)).toBe('$42.50');
  });
  it('handles negative values', () => {
    expect(formatMoney(-3_200_000_000)).toBe('-$3.20B');
  });
  it('handles zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('formatShares', () => {
  it('formats billions of shares', () => {
    expect(formatShares(15_000_000_000)).toBe('15.0B shares');
  });
  it('formats millions of shares', () => {
    expect(formatShares(420_000_000)).toBe('420.0M shares');
  });
  it('formats thousands of shares', () => {
    expect(formatShares(5_000)).toBe('5.0K shares');
  });
  it('formats small share counts', () => {
    expect(formatShares(100)).toBe('100 shares');
  });
});

describe('annotateFinancialNumbers', () => {
  it('annotates known monetary fields with _fmt companion', () => {
    const input = { revenue: 12_000_000_000, period: 'FY2024' };
    const result = annotateFinancialNumbers(input) as Record<string, unknown>;
    expect(result['revenue']).toBe(12_000_000_000);  // raw value preserved
    expect(result['revenue_fmt']).toBe('$12.00B');
    expect(result['period']).toBe('FY2024');          // skip field untouched
    expect(result['period_fmt']).toBeUndefined();
  });

  it('annotates share count fields with _fmt companion', () => {
    const input = { sharesOutstanding: 3_000_000_000 };
    const result = annotateFinancialNumbers(input) as Record<string, unknown>;
    expect(result['sharesOutstanding']).toBe(3_000_000_000);
    expect(result['sharesOutstanding_fmt']).toBe('3.0B shares');
  });

  it('does not annotate non-financial numeric fields', () => {
    const input = { beta: 1.25, peRatio: 22.5 };
    const result = annotateFinancialNumbers(input) as Record<string, unknown>;
    // beta and peRatio are not in MONETARY_FIELDS or SHARE_FIELDS
    expect(result['beta']).toBe(1.25);
    expect(result['beta_fmt']).toBeUndefined();
  });

  it('skips identifier and date fields unchanged', () => {
    const input = { symbol: 'AAPL', date: '2024-09-30', cik: '12345' };
    const result = annotateFinancialNumbers(input) as Record<string, unknown>;
    expect(result['symbol']).toBe('AAPL');
    expect(result['date']).toBe('2024-09-30');
    expect(result['symbol_fmt']).toBeUndefined();
  });

  it('processes arrays recursively', () => {
    const input = [{ revenue: 1_000_000 }, { revenue: 2_000_000 }];
    const result = annotateFinancialNumbers(input) as Array<Record<string, unknown>>;
    expect(result[0]?.['revenue_fmt']).toBe('$1.00M');
    expect(result[1]?.['revenue_fmt']).toBe('$2.00M');
  });

  it('handles nested objects recursively', () => {
    const input = { financials: { netIncome: 5_000_000_000, date: '2024-12-31' } };
    const result = annotateFinancialNumbers(input) as Record<string, Record<string, unknown>>;
    expect(result['financials']?.['netIncome_fmt']).toBe('$5.00B');
    expect(result['financials']?.['date']).toBe('2024-12-31');
  });

  it('passes through null and primitives unchanged', () => {
    expect(annotateFinancialNumbers(null)).toBeNull();
    expect(annotateFinancialNumbers('hello')).toBe('hello');
    expect(annotateFinancialNumbers(42)).toBe(42);
  });

  it('does not mutate the original object', () => {
    const input = { revenue: 1_000_000 };
    annotateFinancialNumbers(input);
    expect(Object.keys(input)).toEqual(['revenue']);
  });
});
