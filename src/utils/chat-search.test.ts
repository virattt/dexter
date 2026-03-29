import { describe, it, expect } from 'bun:test';
import { searchHistory } from './chat-search.js';
import type { HistoryEntry } from './chat-search.js';

const sampleHistory: HistoryEntry[] = [
  { query: "What is AAPL's P/E ratio?", answer: "Apple's P/E ratio is currently 28.5", turn: 1 },
  { query: 'Compare AAPL and MSFT margins', answer: 'AAPL gross margin is 44.5% while MSFT is 70.2%', turn: 2 },
  { query: 'Who is the CEO of Tesla?', answer: 'Elon Musk is the CEO of Tesla', turn: 3 },
];

describe('searchHistory', () => {
  it('matches keyword in query field (case-insensitive)', () => {
    const results = searchHistory(sampleHistory, 'aapl');
    expect(results.length).toBe(2);
    expect(results[0].turn).toBe(1);
    expect(results[1].turn).toBe(2);
  });

  it('matches keyword in answer field (case-insensitive)', () => {
    const results = searchHistory(sampleHistory, 'elon');
    expect(results.length).toBe(1);
    expect(results[0].turn).toBe(3);
  });

  it('is case-insensitive for query matches', () => {
    const results = searchHistory(sampleHistory, 'TESLA');
    expect(results.length).toBe(1);
  });

  it('is case-insensitive for answer matches', () => {
    const results = searchHistory(sampleHistory, 'APPLE');
    expect(results.length).toBe(1);
    expect(results[0].turn).toBe(1);
  });

  it('returns empty array when no matches', () => {
    const results = searchHistory(sampleHistory, 'bitcoin');
    expect(results).toEqual([]);
  });

  it('returns empty array for empty history', () => {
    const results = searchHistory([], 'AAPL');
    expect(results).toEqual([]);
  });

  it('returns empty array for empty keyword', () => {
    const results = searchHistory(sampleHistory, '');
    expect(results).toEqual([]);
  });

  it('matches across both query and answer fields in same entry', () => {
    // turn 2 matches both query ("AAPL") and answer ("AAPL") — should appear once
    const results = searchHistory(sampleHistory, 'msft');
    expect(results.length).toBe(1);
    expect(results[0].turn).toBe(2);
  });
});
