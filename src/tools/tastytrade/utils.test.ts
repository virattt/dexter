import { describe, expect, test } from 'bun:test';
import {
  checkHyperliquidOverlap,
  computePortfolioFit,
  extractDataArray,
  extractFirstObject,
  extractNumber,
  filterOutHyperliquidTickers,
  getUpcomingEarningsDates,
  hasEarningsInWindow,
  isTickerTradableOnHyperliquid,
  loadThetaPolicy,
  loadSoulPortfolioContext,
  normalizeUnderlyingTicker,
  parseOptionSymbol,
  totalEquityFromBalances,
  availableBuyingPowerFromBalances,
  validateOrderAgainstPolicy,
} from './utils.js';

describe('tastytrade utils', () => {
  describe('extractDataArray', () => {
    test('returns array as-is', () => {
      const arr = [1, 2];
      expect(extractDataArray(arr)).toEqual([1, 2]);
    });
    test('returns data from object', () => {
      expect(extractDataArray({ data: [3, 4] })).toEqual([3, 4]);
      expect(extractDataArray({ items: [5] })).toEqual([5]);
    });
    test('returns empty for null or non-array', () => {
      expect(extractDataArray(null)).toEqual([]);
      expect(extractDataArray({})).toEqual([]);
    });
  });

  describe('extractFirstObject', () => {
    test('returns first element of data array', () => {
      const data = { data: [{ a: 1 }, { b: 2 }] };
      expect(extractFirstObject(data)).toEqual({ a: 1 });
    });
    test('returns null for empty', () => {
      expect(extractFirstObject(null)).toBeNull();
      expect(extractFirstObject({ data: [] })).toBeNull();
    });
  });

  describe('extractNumber', () => {
    test('parses number', () => {
      expect(extractNumber('123.45')).toBe(123.45);
      expect(extractNumber(100)).toBe(100);
    });
    test('returns 0 for invalid', () => {
      expect(extractNumber('')).toBe(0);
      expect(extractNumber(NaN)).toBe(0);
    });
  });

  describe('normalizeUnderlyingTicker', () => {
    test('uppercases and takes first token', () => {
      expect(normalizeUnderlyingTicker('spy')).toBe('SPY');
      expect(normalizeUnderlyingTicker('  aapl  ')).toBe('AAPL');
    });
    test('returns em dash for empty', () => {
      expect(normalizeUnderlyingTicker('')).toBe('—');
    });
  });

  describe('parseOptionSymbol', () => {
    test('returns empty shape for empty input', () => {
      const out = parseOptionSymbol('');
      expect(out.rawSymbol).toBe('');
      expect(out.underlying).toBe('—');
      expect(out.optionType).toBeNull();
      expect(out.strike).toBeNull();
    });
    test('parses compact OCC-style symbol', () => {
      const out = parseOptionSymbol('SPY250117C00600000');
      expect(out.underlying).toBe('SPY');
      expect(out.optionType).toBe('C');
      expect(out.strike).toBe(600);
      expect(out.expirationDate).toBe('2025-01-17');
    });
    test('parses spaced symbol (OCC style: 6d date, C/P, 8d strike)', () => {
      const out = parseOptionSymbol('SPY 250117C00600000');
      expect(out.underlying).toBe('SPY');
      expect(out.optionType).toBe('C');
      expect(out.strike).toBe(600);
    });
  });

  describe('totalEquityFromBalances', () => {
    test('extracts net liquidating value', () => {
      const data = { data: [{ 'net-liquidating-value': 100000 }] };
      expect(totalEquityFromBalances(data)).toBe(100000);
    });
    test('returns 0 for empty', () => {
      expect(totalEquityFromBalances(null)).toBe(0);
      expect(totalEquityFromBalances({ data: [] })).toBe(0);
    });
  });

  describe('availableBuyingPowerFromBalances', () => {
    test('extracts derivative buying power', () => {
      const data = { data: [{ 'derivative-buying-power': 50000 }] };
      expect(availableBuyingPowerFromBalances(data)).toBe(50000);
    });
    test('returns 0 for empty', () => {
      expect(availableBuyingPowerFromBalances({})).toBe(0);
    });
  });

  describe('loadThetaPolicy', () => {
    test('returns policy with expected shape and defaults', () => {
      const policy = loadThetaPolicy();
      expect(policy.source).toBeDefined();
      expect(Array.isArray(policy.allowedUnderlyings)).toBe(true);
      expect(policy.allowedUnderlyings.length).toBeGreaterThan(0);
      expect(typeof policy.shortDeltaMin).toBe('number');
      expect(typeof policy.shortDeltaMax).toBe('number');
      expect(policy.minDte).toBeGreaterThanOrEqual(0);
      expect(policy.maxDte).toBeGreaterThan(0);
    });
  });

  describe('loadSoulPortfolioContext', () => {
    test('returns context with soul and portfolio maps', () => {
      const ctx = loadSoulPortfolioContext();
      expect(Array.isArray(ctx.soulCoreOrAvoidTickers)).toBe(true);
      expect(ctx.portfolioTargetWeightByTicker instanceof Map).toBe(true);
    });
  });

  describe('getUpcomingEarningsDates', () => {
    test('returns empty array when FINANCIAL_DATASETS_API_KEY is unset', async () => {
      const orig = process.env.FINANCIAL_DATASETS_API_KEY;
      delete process.env.FINANCIAL_DATASETS_API_KEY;
      const dates = await getUpcomingEarningsDates('AAPL');
      expect(dates).toEqual([]);
      if (orig !== undefined) process.env.FINANCIAL_DATASETS_API_KEY = orig;
    });
  });

  describe('hasEarningsInWindow', () => {
    test('returns false when windowDays is 0', async () => {
      const out = await hasEarningsInWindow('AAPL', 0);
      expect(out).toBe(false);
    });
    test('returns false when no API key (no dates)', async () => {
      const orig = process.env.FINANCIAL_DATASETS_API_KEY;
      delete process.env.FINANCIAL_DATASETS_API_KEY;
      const out = await hasEarningsInWindow('AAPL', 2);
      expect(out).toBe(false);
      if (orig !== undefined) process.env.FINANCIAL_DATASETS_API_KEY = orig;
    });
  });

  describe('computePortfolioFit', () => {
    test('returns block for short call on SOUL Core/Avoid', () => {
      const fit = computePortfolioFit({
        underlying: 'NVDA',
        soulCoreOrAvoidTickers: ['NVDA', 'AAPL'],
        portfolioTargetWeightByTicker: new Map(),
        isShortCall: true,
      });
      expect(fit.result).toBe('block');
      expect(fit.reason).toContain('SOUL');
    });
    test('returns block when underlying normalized matches SOUL (case-insensitive)', () => {
      const fit = computePortfolioFit({
        underlying: 'nvda',
        soulCoreOrAvoidTickers: ['NVDA'],
        portfolioTargetWeightByTicker: new Map(),
        isShortCall: true,
      });
      expect(fit.result).toBe('block');
    });
    test('returns warn for short put on SOUL ticker', () => {
      const fit = computePortfolioFit({
        underlying: 'NVDA',
        soulCoreOrAvoidTickers: ['NVDA'],
        portfolioTargetWeightByTicker: new Map(),
        isShortCall: false,
      });
      expect(fit.result).toBe('warn');
    });
    test('returns pass when no SOUL and no target', () => {
      const fit = computePortfolioFit({
        underlying: 'SPY',
        soulCoreOrAvoidTickers: [],
        portfolioTargetWeightByTicker: new Map(),
      });
      expect(fit.result).toBe('pass');
    });
    test('deterministic pass when exposure estimate missing (no false block)', () => {
      const fit = computePortfolioFit({
        underlying: 'SPY',
        soulCoreOrAvoidTickers: [],
        portfolioTargetWeightByTicker: new Map([['SPY', 10]]),
        targetWeightPct: 10,
        currentWeightPct: undefined,
        tradeExposurePct: undefined,
      });
      expect(fit.result).toBe('pass');
    });
  });

  describe('validateOrderAgainstPolicy', () => {
    test('returns allowed when underlying in policy and DTE in range', () => {
      const policy = loadThetaPolicy();
      const result = validateOrderAgainstPolicy({
        underlyings: ['SPY'],
        legs: [{ underlying: 'SPY', option_type: 'C', action: 'Sell to Open', dte: 7 }],
        policy,
      });
      expect(result.allowed).toBe(true);
      expect(result.violations).toEqual([]);
    });
    test('returns violations when underlying not in allowed list', () => {
      const policy = loadThetaPolicy();
      const result = validateOrderAgainstPolicy({
        underlyings: ['XYZ'],
        legs: [{ underlying: 'XYZ', option_type: 'P', action: 'Sell to Open', dte: 14 }],
        policy,
      });
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('not in THETA-POLICY'))).toBe(true);
    });
    test('returns violation when underlying is tradable on Hyperliquid', () => {
      const policy = loadThetaPolicy();
      const result = validateOrderAgainstPolicy({
        underlyings: ['AAPL'],
        legs: [{ underlying: 'AAPL', option_type: 'P', action: 'Sell to Open', dte: 14 }],
        policy,
      });
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('Hyperliquid') || v.includes('zero overlap'))).toBe(true);
    });
  });

  describe('Hyperliquid overlap helpers', () => {
    test('isTickerTradableOnHyperliquid returns true for HL symbols', () => {
      expect(isTickerTradableOnHyperliquid('AAPL')).toBe(true);
      expect(isTickerTradableOnHyperliquid('BTC')).toBe(true);
      expect(isTickerTradableOnHyperliquid('  msft  ')).toBe(true);
      expect(isTickerTradableOnHyperliquid('TSM')).toBe(true);
    });
    test('isTickerTradableOnHyperliquid returns false for non-HL symbols', () => {
      expect(isTickerTradableOnHyperliquid('UNKNOWNXYZ')).toBe(false);
    });
    test('checkHyperliquidOverlap returns overlap and reason for HL ticker', () => {
      const out = checkHyperliquidOverlap('AAPL');
      expect(out.overlap).toBe(true);
      expect(out.reason).toBe('hl_overlap_universe');
    });
    test('checkHyperliquidOverlap returns no overlap for non-HL ticker', () => {
      const out = checkHyperliquidOverlap('UNKNOWNXYZ');
      expect(out.overlap).toBe(false);
      expect(out.reason).toBeUndefined();
    });
    test('filterOutHyperliquidTickers removes HL symbols', () => {
      const list = ['TSM', 'AAPL', 'AMAT', 'MSFT', 'KLAC'];
      const filtered = filterOutHyperliquidTickers(list);
      expect(filtered).toContain('AMAT');
      expect(filtered).toContain('KLAC');
      expect(filtered).not.toContain('TSM');
      expect(filtered).not.toContain('AAPL');
      expect(filtered).not.toContain('MSFT');
    });
  });
});
