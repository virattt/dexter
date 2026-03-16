import { describe, expect, test } from 'bun:test';
import {
  normalizeTicker,
  validateDate,
  validateDateRange,
  validateLimit,
  validateReportPeriodFilters,
  validateTicker,
} from '../validation.js';

describe('finance validation helpers', () => {
  describe('normalizeTicker', () => {
    test('normalizes and uppercases tickers', () => {
      expect(normalizeTicker(' aapl ')).toBe('AAPL');
      expect(normalizeTicker('mSft')).toBe('MSFT');
      expect(normalizeTicker(' brk.b ')).toBe('BRK.B');
    });

    test('strips whitespace and punctuation', () => {
      expect(normalizeTicker(' 1 555-A P L ')).toBe('1555-APL');
    });
  });

  describe('validateTicker', () => {
    test('accepts common valid tickers', () => {
      expect(validateTicker('AAPL')).toBe('AAPL');
      expect(validateTicker(' msft ')).toBe('MSFT');
      expect(validateTicker('brk.b')).toBe('BRK.B');
    });

    test('rejects empty tickers', () => {
      expect(() => validateTicker('   ')).toThrow(/empty after trimming/i);
    });

    test('rejects overlong tickers', () => {
      expect(() => validateTicker('THISIS-AN-EXCESSIVELY-LONG-TICKER')).toThrow(/too long/i);
    });
  });

  describe('validateLimit', () => {
    test('accepts integer limits in range', () => {
      expect(validateLimit(1)).toBe(1);
      expect(validateLimit(10, { min: 1, max: 20 })).toBe(10);
    });

    test('rejects non-integer or out-of-range limits', () => {
      expect(() => validateLimit(0)).toThrow(/>= 1/);
      expect(() => validateLimit(1000, { max: 40 })).toThrow(/<= 40/);
      expect(() => validateLimit(1.5)).toThrow(/integer/);
    });
  });

  describe('validateDate and validateDateRange', () => {
    test('accepts valid ISO dates', () => {
      expect(validateDate('2024-01-31', 'start_date')).toBe('2024-01-31');
    });

    test('rejects malformed or impossible dates', () => {
      expect(() => validateDate('2024-13-01', 'start_date')).toThrow(/not a real calendar date/i);
      expect(() => validateDate('01-01-2024', 'start_date')).toThrow(/YYYY-MM-DD/);
    });

    test('accepts valid date ranges and rejects inverted ones', () => {
      expect(validateDateRange('2024-01-01', '2024-02-01')).toEqual({
        start: '2024-01-01',
        end: '2024-02-01',
      });
      expect(() => validateDateRange('2024-02-01', '2024-01-01')).toThrow(/start_date.*before.*end_date/i);
    });
  });

  describe('validateReportPeriodFilters', () => {
    test('passes through undefined filters', () => {
      const result = validateReportPeriodFilters({});
      expect(result).toEqual({
        report_period: undefined,
        report_period_gt: undefined,
        report_period_gte: undefined,
        report_period_lt: undefined,
        report_period_lte: undefined,
      });
    });

    test('validates date formats when present', () => {
      const result = validateReportPeriodFilters({
        report_period: '2024-01-01',
        report_period_gte: '2023-01-01',
      });
      expect(result.report_period).toBe('2024-01-01');
      expect(result.report_period_gte).toBe('2023-01-01');
      expect(() =>
        validateReportPeriodFilters({
          report_period_lt: '01-01-2024',
        }),
      ).toThrow(/YYYY-MM-DD/);
    });
  });
});

