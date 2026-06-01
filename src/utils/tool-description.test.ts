import { describe, test, expect } from 'bun:test';
import { getToolDescription } from './tool-description.js';

describe('getToolDescription', () => {
  test('formats ticker-based tool call', () => {
    const desc = getToolDescription('get_income_statements', {
      ticker: 'aapl',
      period: 'annual',
      limit: 5,
    });
    expect(desc).toBe('AAPL income statements (annual) - 5 periods');
  });

  test('formats search-based tool call', () => {
    const desc = getToolDescription('search_tavily', {
      query: 'bitcoin price',
    });
    expect(desc).toBe('"bitcoin price" tavily');
  });

  test('strips get_ prefix from tool name', () => {
    const desc = getToolDescription('get_balance_sheets', { ticker: 'MSFT' });
    expect(desc).toContain('balance sheets');
    expect(desc).not.toContain('get_');
  });

  test('strips search_ prefix from tool name', () => {
    const desc = getToolDescription('search_news', { query: 'earnings' });
    expect(desc).toContain('news');
    expect(desc).not.toContain('search_');
  });

  test('uppercases ticker', () => {
    const desc = getToolDescription('get_prices', { ticker: 'tsla' });
    expect(desc).toContain('TSLA');
  });

  test('includes date range when both start and end are present', () => {
    const desc = getToolDescription('get_prices', {
      ticker: 'AAPL',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });
    expect(desc).toContain('from 2024-01-01 to 2024-12-31');
  });

  test('appends remaining unhandled args in brackets', () => {
    const desc = getToolDescription('get_prices', {
      ticker: 'AAPL',
      interval: 'day',
    });
    expect(desc).toContain('[interval=day]');
  });

  test('handles tool with no recognized args', () => {
    const desc = getToolDescription('custom_tool', {});
    expect(desc).toBe('custom tool');
  });

  test('handles tool with only limit (no ticker)', () => {
    const desc = getToolDescription('get_market_data', { limit: 10 });
    expect(desc).toBe('market data - 10 periods');
  });
});
