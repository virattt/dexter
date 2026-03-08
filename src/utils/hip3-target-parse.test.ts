import { describe, expect, test } from 'bun:test';
import { parseHIP3TargetMarkdown, targetMidpoint } from './hip3-target-parse.js';

describe('parseHIP3TargetMarkdown', () => {
  test('parses HIP-3 Target section table', () => {
    const content = `
## HIP-3 Target (for PORTFOLIO-HYPERLIQUID.md)

| Ticker | TargetMin | TargetMax | Category | Notes |
|--------|-----------|-----------|----------|-------|
| BTC | 35 | 40 | Core | Base layer |
| SOL | 8 | 12 | L1 | Agentic |
`;
    const rows = parseHIP3TargetMarkdown(content);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ ticker: 'BTC', targetMin: 35, targetMax: 40, category: 'Core', notes: 'Base layer' });
    expect(rows[1]).toEqual({ ticker: 'SOL', targetMin: 8, targetMax: 12, category: 'L1', notes: 'Agentic' });
  });

  test('parses Target Allocation section (SOUL-HL style)', () => {
    const content = `
## Target Allocation

| Ticker | TargetMin | TargetMax | Category | Notes |
| ORCL | 2 | 4 | AI infra | |
`;
    const rows = parseHIP3TargetMarkdown(content);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ticker).toBe('ORCL');
    expect(rows[0]!.targetMin).toBe(2);
    expect(rows[0]!.targetMax).toBe(4);
  });

  test('returns empty array when no section found', () => {
    const content = `# Other doc\n| A | B |\n`;
    expect(parseHIP3TargetMarkdown(content)).toHaveLength(0);
  });

  test('skips header and separator rows', () => {
    const content = `
## HIP-3 Target
| Ticker | TargetMin | TargetMax | Category | Notes |
|--------|-----------|-----------|----------|-------|
| NVDA | 5 | 10 | Tech | |
`;
    const rows = parseHIP3TargetMarkdown(content);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ticker).toBe('NVDA');
  });
});

describe('targetMidpoint', () => {
  test('returns average of targetMin and targetMax', () => {
    expect(targetMidpoint({ ticker: 'X', targetMin: 10, targetMax: 20, category: '', notes: '' })).toBe(15);
    expect(targetMidpoint({ ticker: 'Y', targetMin: 0, targetMax: 5, category: '', notes: '' })).toBe(2.5);
  });
});
