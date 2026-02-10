import { describe, test, expect } from 'bun:test';
import { parseCSV, parseRow, runReliabilityChecks } from './core.js';

describe('parseRow', () => {
  test('returns null for blank lines', () => {
    const lines = ['Question,Answer', '', 'Q1,A1'];
    expect(parseRow(lines, 1)).toBeNull();
  });

  test('parses quoted fields with escaped quotes', () => {
    const lines = ['Question,Answer', '"What is ""beta""?","A volatility measure"'];
    const row = parseRow(lines, 1);
    expect(row).not.toBeNull();
    expect(row!.row[0]).toBe('What is "beta"?');
    expect(row!.row[1]).toBe('A volatility measure');
  });
});

describe('parseCSV', () => {
  test('parses multiline quoted answers', () => {
    const csv = [
      'Question,Answer',
      '"Give me two lines","Line one',
      'Line two"',
      'Q2,A2',
    ].join('\n');

    const examples = parseCSV(csv);
    expect(examples).toHaveLength(2);
    expect(examples[0].inputs.question).toBe('Give me two lines');
    expect(examples[0].outputs.answer).toBe('Line one\nLine two');
    expect(examples[1].inputs.question).toBe('Q2');
    expect(examples[1].outputs.answer).toBe('A2');
  });
});

describe('runReliabilityChecks', () => {
  test('fails empty answers', () => {
    const result = runReliabilityChecks('   ');
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'empty_answer')).toBe(true);
  });

  test('fails on internal payload leaks', () => {
    const result = runReliabilityChecks('{"data":{},"sourceUrls":["https://example.com"]}');
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'internal_sourceurls_leak')).toBe(true);
    expect(result.issues.some((i) => i.code === 'raw_payload_output')).toBe(true);
  });

  test('fails on explicit upstream errors', () => {
    const result = runReliabilityChecks('API request failed: 429 Too Many Requests');
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'api_request_failed')).toBe(true);
  });

  test('passes clean user-facing answers', () => {
    const result = runReliabilityChecks(
      'Airbnb CFO is Ellie Mertz based on the most recent company filings.'
    );
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

