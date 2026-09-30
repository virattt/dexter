import { describe, expect, test } from 'bun:test';
import {
  formatCompactNumber,
  parseNumericValue,
  detectChartOpportunity,
  renderBarChart,
  renderSparkline,
  transformChartsInResponse,
} from './charts.js';

describe('formatCompactNumber', () => {
  test('formats billions', () => {
    expect(formatCompactNumber(394_300_000_000)).toBe('$394.3B');
  });

  test('formats millions', () => {
    expect(formatCompactNumber(1_200_000)).toBe('$1.2M');
  });

  test('formats thousands', () => {
    expect(formatCompactNumber(45_000)).toBe('$45K');
  });

  test('formats small numbers without suffix', () => {
    expect(formatCompactNumber(999)).toBe('$999');
  });

  test('formats whole billions without decimal', () => {
    expect(formatCompactNumber(2_000_000_000)).toBe('$2B');
  });

  test('formats trillions', () => {
    expect(formatCompactNumber(1_500_000_000_000)).toBe('$1.5T');
  });

  test('handles negative values', () => {
    expect(formatCompactNumber(-500_000_000)).toBe('$-500M');
  });
});

describe('parseNumericValue', () => {
  test('parses plain number', () => {
    expect(parseNumericValue('1234')).toBe(1234);
  });

  test('parses dollar amount with commas', () => {
    expect(parseNumericValue('$1,234,567')).toBe(1234567);
  });

  test('parses value with B suffix', () => {
    expect(parseNumericValue('$394.3B')).toBe(394_300_000_000);
  });

  test('parses value with M suffix', () => {
    expect(parseNumericValue('$1.2M')).toBe(1_200_000);
  });

  test('parses value with K suffix', () => {
    expect(parseNumericValue('45K')).toBe(45_000);
  });

  test('returns null for non-numeric text', () => {
    expect(parseNumericValue('Apple')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseNumericValue('')).toBeNull();
  });

  test('parses negative with parentheses', () => {
    const result = parseNumericValue('($500M)');
    expect(result).toBe(-500_000_000);
  });
});

describe('detectChartOpportunity', () => {
  test('detects bar chart for label + value columns', () => {
    const headers = ['Company', 'Revenue'];
    const rows = [
      ['Apple', '$394.3B'],
      ['Google', '$307.4B'],
      ['Microsoft', '$245.1B'],
    ];
    const result = detectChartOpportunity(headers, rows);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('bar');
    expect(result!.data.labels).toEqual(['Apple', 'Google', 'Microsoft']);
  });

  test('detects sparkline for date + value columns', () => {
    const headers = ['Year', 'Revenue'];
    const rows = [
      ['2020', '$274.5B'],
      ['2021', '$365.8B'],
      ['2022', '$394.3B'],
    ];
    const result = detectChartOpportunity(headers, rows);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('sparkline');
  });

  test('detects sparkline for quarter dates', () => {
    const headers = ['Period', 'EPS'];
    const rows = [
      ['Q1 2024', '$1.50'],
      ['Q2 2024', '$1.62'],
      ['Q3 2024', '$1.78'],
    ];
    const result = detectChartOpportunity(headers, rows);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('sparkline');
  });

  test('returns null for single row', () => {
    const result = detectChartOpportunity(['A', 'B'], [['x', '1']]);
    expect(result).toBeNull();
  });

  test('returns null for non-numeric data', () => {
    const headers = ['Name', 'Status'];
    const rows = [
      ['Alice', 'Active'],
      ['Bob', 'Inactive'],
    ];
    expect(detectChartOpportunity(headers, rows)).toBeNull();
  });

  test('returns null for single column', () => {
    expect(detectChartOpportunity(['A'], [['x'], ['y']])).toBeNull();
  });
});

describe('renderBarChart', () => {
  test('renders non-empty output', () => {
    const result = renderBarChart({
      labels: ['Apple', 'Google', 'MSFT'],
      values: [394.3e9, 307.4e9, 245.1e9],
      header: 'Company',
      valueHeader: 'Revenue',
    });
    expect(result).toContain('📊');
    expect(result).toContain('Revenue');
    expect(result).toContain('Apple');
    expect(result).toContain('Google');
    expect(result).toContain('MSFT');
  });

  test('returns empty string for empty data', () => {
    expect(renderBarChart({ labels: [], values: [], header: '', valueHeader: '' })).toBe('');
  });

  test('returns empty string when all values are zero', () => {
    expect(
      renderBarChart({ labels: ['A', 'B'], values: [0, 0], header: '', valueHeader: 'X' }),
    ).toBe('');
  });

  test('truncates long labels', () => {
    const result = renderBarChart({
      labels: ['A very long company name here'],
      values: [100],
      header: 'Name',
      valueHeader: 'Val',
    });
    // Label should be truncated to 16 chars
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('renderSparkline', () => {
  test('renders trend with start/end values', () => {
    const result = renderSparkline({
      labels: ['2020', '2021', '2022', '2023', '2024'],
      values: [274.5e9, 365.8e9, 394.3e9, 383.3e9, 391e9],
      header: 'Year',
      valueHeader: 'AAPL Revenue',
    });
    expect(result).toContain('📈');
    expect(result).toContain('AAPL Revenue');
    expect(result).toContain('2020');
    expect(result).toContain('2024');
    expect(result).toContain('→');
  });

  test('shows positive change in green', () => {
    const result = renderSparkline({
      labels: ['2020', '2024'],
      values: [100, 200],
      header: 'Year',
      valueHeader: 'Revenue',
    });
    expect(result).toContain('+');
  });

  test('returns empty for single data point', () => {
    expect(
      renderSparkline({ labels: ['2024'], values: [100], header: '', valueHeader: '' }),
    ).toBe('');
  });

  test('handles first value of zero without crashing', () => {
    const result = renderSparkline({
      labels: ['2020', '2024'],
      values: [0, 100],
      header: 'Year',
      valueHeader: 'Revenue',
    });
    expect(result).toContain('+0.0%');
  });
});

describe('transformChartsInResponse', () => {
  test('appends bar chart below a qualifying table', () => {
    const markdown = [
      '| Company | Revenue |',
      '|---------|---------|',
      '| Apple | $394.3B |',
      '| Google | $307.4B |',
      '| MSFT | $245.1B |',
    ].join('\n');

    const result = transformChartsInResponse(markdown);
    expect(result).toContain('📊');
    expect(result).toContain(markdown); // original table preserved
  });

  test('appends sparkline for time-series table', () => {
    const markdown = [
      '| Year | Revenue |',
      '|------|---------|',
      '| 2020 | $274.5B |',
      '| 2021 | $365.8B |',
      '| 2022 | $394.3B |',
    ].join('\n');

    const result = transformChartsInResponse(markdown);
    expect(result).toContain('📈');
  });

  test('does not modify text without tables', () => {
    const text = 'Hello world, no tables here.';
    expect(transformChartsInResponse(text)).toBe(text);
  });

  test('does not modify non-chartable tables', () => {
    const markdown = [
      '| Name | Status |',
      '|------|--------|',
      '| Alice | Active |',
      '| Bob | Inactive |',
    ].join('\n');

    expect(transformChartsInResponse(markdown)).toBe(markdown);
  });
});
