import { describe, it, expect } from 'bun:test';
import { buildFtsQueryExpanded, detectSynonyms } from './financial-synonyms.js';

describe('buildFtsQueryExpanded', () => {
  it('returns null for empty string', () => {
    expect(buildFtsQueryExpanded('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(buildFtsQueryExpanded('   ')).toBeNull();
  });

  it('returns base AND query for plain non-financial terms', () => {
    const result = buildFtsQueryExpanded('earnings growth');
    expect(result).toBe('"earnings" "growth"');
  });

  it('single token — no OR wrapper', () => {
    const result = buildFtsQueryExpanded('revenue');
    expect(result).toBe('"revenue"');
  });

  // ── Valuation ratios ────────────────────────────────────────────────────

  it('expands "P/E" to price-to-earnings synonyms', () => {
    const result = buildFtsQueryExpanded('P/E');
    expect(result).not.toBeNull();
    expect(result).toContain('"price" "to" "earnings"');
    expect(result).toContain('"earnings" "multiple"');
    expect(result).toContain(' OR ');
  });

  it('expands "PE ratio" (no slash variant)', () => {
    const result = buildFtsQueryExpanded('PE ratio');
    expect(result).toContain('"price" "to" "earnings"');
  });

  it('expands "P/E ratio" (full phrase)', () => {
    const result = buildFtsQueryExpanded('P/E ratio');
    expect(result).toContain('"earnings" "multiple"');
  });

  it('expands "P/B" to price-to-book synonyms', () => {
    const result = buildFtsQueryExpanded('P/B');
    expect(result).toContain('"price" "to" "book"');
  });

  // ── Cash flow ────────────────────────────────────────────────────────────

  it('expands "FCF" to free cash flow', () => {
    const result = buildFtsQueryExpanded('FCF analysis');
    expect(result).toContain('"free" "cash" "flow"');
  });

  it('expands "capex" to capital expenditure', () => {
    const result = buildFtsQueryExpanded('capex reduction');
    expect(result).toContain('"capital" "expenditure"');
  });

  // ── Per-share metrics ────────────────────────────────────────────────────

  it('expands "EPS" to earnings per share', () => {
    const result = buildFtsQueryExpanded('EPS growth');
    expect(result).toContain('"earnings" "per" "share"');
  });

  // ── Valuation / DCF ──────────────────────────────────────────────────────

  it('expands "DCF" to discounted cash flow', () => {
    const result = buildFtsQueryExpanded('DCF valuation');
    expect(result).toContain('"discounted" "cash" "flow"');
  });

  it('expands "WACC" to cost of capital', () => {
    const result = buildFtsQueryExpanded('WACC');
    expect(result).toContain('"weighted" "average" "cost" "of" "capital"');
  });

  // ── Market metrics ───────────────────────────────────────────────────────

  it('expands "market cap" to market capitalization', () => {
    const result = buildFtsQueryExpanded('market cap comparison');
    expect(result).toContain('"market" "capitalization"');
  });

  it('expands "YoY" to year over year', () => {
    const result = buildFtsQueryExpanded('YoY growth rate');
    expect(result).toContain('"year" "over" "year"');
  });

  it('expands "QoQ" to quarter over quarter', () => {
    const result = buildFtsQueryExpanded('QoQ improvement');
    expect(result).toContain('"quarter" "over" "quarter"');
  });

  // ── Case insensitivity ───────────────────────────────────────────────────

  it('is case-insensitive for abbreviations', () => {
    const lower = buildFtsQueryExpanded('fcf yield');
    const upper = buildFtsQueryExpanded('FCF yield');
    expect(lower).toEqual(upper);
  });

  it('is case-insensitive for "pe ratio"', () => {
    const mixed = buildFtsQueryExpanded('Pe Ratio');
    expect(mixed).toContain('"price" "to" "earnings"');
  });

  // ── Multi-acronym queries ────────────────────────────────────────────────

  it('expands multiple acronyms in the same query', () => {
    const result = buildFtsQueryExpanded('EPS and FCF outlook');
    expect(result).toContain('"earnings" "per" "share"');
    expect(result).toContain('"free" "cash" "flow"');
  });

  // ── No duplicate parts ───────────────────────────────────────────────────

  it('does not produce duplicate OR clauses', () => {
    const result = buildFtsQueryExpanded('P/E PE ratio');
    const parts = result!.split(' OR ');
    const unique = new Set(parts);
    expect(unique.size).toBe(parts.length);
  });
});

// ---------------------------------------------------------------------------

describe('detectSynonyms', () => {
  it('returns empty array for non-financial terms', () => {
    expect(detectSynonyms('quarterly revenue results')).toHaveLength(0);
  });

  it('detects P/E synonyms', () => {
    const syns = detectSynonyms('P/E ratio analysis');
    expect(syns).toContain('price to earnings');
    expect(syns).toContain('earnings multiple');
  });

  it('detects multiple acronyms in same query', () => {
    const syns = detectSynonyms('EPS and FCF growth');
    expect(syns).toContain('earnings per share');
    expect(syns).toContain('free cash flow');
  });

  it('detects ROE', () => {
    expect(detectSynonyms('ROE improvement')).toContain('return on equity');
  });

  it('detects EBITDA', () => {
    expect(detectSynonyms('EBITDA margin')).toContain('operating earnings');
  });
});
