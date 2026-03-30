import { describe, test, expect } from 'bun:test';
import { getToolDescription } from './tool-description.js';

describe('getToolDescription', () => {
  test('returns tool name only when no known args', () => {
    const result = getToolDescription('get_stock_price', {});
    expect(result).toBe('stock price');
  });

  test('formats tool name: removes get_ prefix', () => {
    expect(getToolDescription('get_income_statements', {})).toBe('income statements');
  });

  test('formats tool name: removes search_ prefix', () => {
    expect(getToolDescription('search_stocks', {})).toBe('stocks');
  });

  test('formats tool name: replaces underscores with spaces', () => {
    expect(getToolDescription('get_key_ratios', {})).toBe('key ratios');
  });

  test('prepends ticker in uppercase when present', () => {
    const result = getToolDescription('get_financials', { ticker: 'aapl' });
    expect(result).toContain('AAPL');
    expect(result.startsWith('AAPL')).toBe(true);
  });

  test('adds quoted query when present', () => {
    const result = getToolDescription('web_search', { query: 'bitcoin price' });
    expect(result).toContain('"bitcoin price"');
  });

  test('adds period qualifier in parens when present', () => {
    const result = getToolDescription('get_income_statements', { period: 'annual' });
    expect(result).toContain('(annual)');
  });

  test('adds limit as "N periods" when present and numeric', () => {
    const result = getToolDescription('get_income_statements', { limit: 5 });
    expect(result).toContain('- 5 periods');
  });

  test('does not add limit when non-numeric', () => {
    const result = getToolDescription('get_stock_price', { limit: 'all' });
    expect(result).not.toContain('periods');
  });

  test('adds date range when both start_date and end_date present', () => {
    const result = getToolDescription('get_stock_prices', {
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });
    expect(result).toContain('from 2024-01-01 to 2024-12-31');
  });

  test('appends remaining unknown args as key=value pairs in brackets', () => {
    const result = getToolDescription('get_financials', { interval: 'day' });
    expect(result).toContain('[interval=day]');
  });

  test('combines ticker, tool name, period, limit, date range', () => {
    const result = getToolDescription('get_income_statements', {
      ticker: 'MSFT',
      period: 'quarterly',
      limit: 4,
    });
    expect(result).toContain('MSFT');
    expect(result).toContain('income statements');
    expect(result).toContain('(quarterly)');
    expect(result).toContain('- 4 periods');
  });

  test('ticker and query both appear when provided together', () => {
    const result = getToolDescription('get_market_data', { ticker: 'AAPL', query: 'latest news' });
    expect(result).toContain('AAPL');
    expect(result).toContain('"latest news"');
  });

  test('does not include start_date alone without end_date', () => {
    const result = getToolDescription('get_stock_prices', { start_date: '2024-01-01' });
    expect(result).not.toContain('from');
    // start_date alone should appear as a remaining arg in brackets
    expect(result).toContain('[start_date=2024-01-01]');
  });
});
