import { describe, it, expect } from 'bun:test';
import { extractTickers, TICKER_STOP_WORDS } from './ticker-extractor.js';

// ============================================================================
// $TICKER pattern — unambiguous
// ============================================================================

describe('extractTickers — dollar-sign prefix', () => {
  it('extracts a single $TICKER', () => {
    expect(extractTickers('$AAPL reported strong earnings')).toContain('AAPL');
  });

  it('extracts multiple $TICKERs from one sentence', () => {
    const result = extractTickers('Bullish on $TSLA and $NVDA into year-end');
    expect(result).toContain('TSLA');
    expect(result).toContain('NVDA');
  });

  it('extracts single-letter tickers like $V and $F', () => {
    expect(extractTickers('Bought $F and $V today')).toContain('F');
    expect(extractTickers('Bought $F and $V today')).toContain('V');
  });

  it('extracts ticker with exchange suffix via $ prefix', () => {
    expect(extractTickers('Long $BRK.B since 2022')).toContain('BRK.B');
  });

  it('does not extract $USD as a ticker', () => {
    expect(extractTickers('$USD strength weighing on exports')).not.toContain('USD');
  });
});

// ============================================================================
// Bare uppercase tickers (no dollar sign)
// ============================================================================

describe('extractTickers — bare uppercase tokens', () => {
  it('extracts well-known US tickers from prose', () => {
    const result = extractTickers('Bought AAPL and MSFT today before close');
    expect(result).toContain('AAPL');
    expect(result).toContain('MSFT');
  });

  it('extracts international ticker with exchange suffix', () => {
    expect(extractTickers('VWS.CO is a major wind energy company')).toContain('VWS.CO');
  });

  it('extracts class-share tickers like BRK.B', () => {
    expect(extractTickers('BRK.B is the Berkshire B class share')).toContain('BRK.B');
  });

  it('handles a 5-letter ticker like GOOGL', () => {
    expect(extractTickers('GOOGL parent Alphabet beat estimates')).toContain('GOOGL');
  });

  it('does NOT extract 6+ letter tokens (too long for a ticker)', () => {
    const result = extractTickers('AMAZON and GOOGLE reported earnings');
    expect(result).not.toContain('AMAZON');
    expect(result).not.toContain('GOOGLE');
  });
});

// ============================================================================
// Stop-word filtering
// ============================================================================

describe('extractTickers — stop-word filtering', () => {
  it('returns empty array for pure common-English uppercase text', () => {
    expect(extractTickers('THE COMPANY IS AT THE TOP OF ITS INDUSTRY')).toEqual([]);
  });

  it('filters financial abbreviations that are not tickers', () => {
    const text = 'The CEO noted strong FCF and improving ROIC. EPS beat SEC estimates.';
    const result = extractTickers(text);
    expect(result).not.toContain('CEO');
    expect(result).not.toContain('FCF');
    expect(result).not.toContain('ROIC');
    expect(result).not.toContain('EPS');
    expect(result).not.toContain('SEC');
  });

  it('filters currency codes', () => {
    const result = extractTickers('Revenue grew 12% in USD and EUR terms');
    expect(result).not.toContain('USD');
    expect(result).not.toContain('EUR');
  });

  it('filters ETF and REIT abbreviations', () => {
    expect(extractTickers('Consider an ETF instead of individual REIT holdings')).toEqual([]);
  });

  it('filters common direction words', () => {
    expect(extractTickers('BUY SELL HOLD LONG SHORT positions')).toEqual([]);
  });

  it('returns empty array for plain lowercase prose', () => {
    expect(extractTickers('the quick brown fox jumps over the lazy dog')).toEqual([]);
  });
});

// ============================================================================
// Deduplication and ordering
// ============================================================================

describe('extractTickers — deduplication and ordering', () => {
  it('returns unique tickers even if repeated multiple times', () => {
    const result = extractTickers('AAPL $AAPL AAPL great investment $AAPL');
    expect(result.filter((t) => t === 'AAPL').length).toBe(1);
  });

  it('returns tickers in alphabetical order', () => {
    const result = extractTickers('TSLA and AAPL and NVDA look interesting');
    expect(result).toEqual([...new Set(result)].sort());
  });

  it('returns empty array for empty string', () => {
    expect(extractTickers('')).toEqual([]);
  });
});

// ============================================================================
// Mixed financial analysis text
// ============================================================================

describe('extractTickers — realistic financial text', () => {
  it('extracts tickers from a typical agent response', () => {
    const text = `
AAPL Q3 results beat consensus EPS estimates. CEO Tim Cook noted that AI-driven
iPhone sales continue to outperform. TSLA competition is intensifying in EVs.
NVDA dominates the GPU market. The FED rate decision weighed on all equities.
Consider a BRK.B position as a defensive play.
    `.trim();

    const result = extractTickers(text);
    expect(result).toContain('AAPL');
    expect(result).toContain('TSLA');
    expect(result).toContain('NVDA');
    expect(result).toContain('BRK.B');
    // These must NOT be included:
    expect(result).not.toContain('CEO');
    expect(result).not.toContain('EPS');
    expect(result).not.toContain('FED');
    expect(result).not.toContain('AI');
    expect(result).not.toContain('GPU');
  });

  it('handles investment thesis with multiple mentions', () => {
    const text = 'Added to VALE position at $12.50. VALE trades at a P/E discount vs BHP peers.';
    const result = extractTickers(text);
    expect(result).toContain('VALE');
    expect(result).toContain('BHP');
    expect(result.filter((t) => t === 'VALE').length).toBe(1);
  });
});

// ============================================================================
// TICKER_STOP_WORDS set completeness
// ============================================================================

describe('TICKER_STOP_WORDS', () => {
  it('contains common financial abbreviations', () => {
    expect(TICKER_STOP_WORDS.has('CEO')).toBe(true);
    expect(TICKER_STOP_WORDS.has('EPS')).toBe(true);
    expect(TICKER_STOP_WORDS.has('ETF')).toBe(true);
    expect(TICKER_STOP_WORDS.has('IPO')).toBe(true);
    expect(TICKER_STOP_WORDS.has('SEC')).toBe(true);
    expect(TICKER_STOP_WORDS.has('WACC')).toBe(true);
  });

  it('contains common currency codes', () => {
    expect(TICKER_STOP_WORDS.has('USD')).toBe(true);
    expect(TICKER_STOP_WORDS.has('EUR')).toBe(true);
    expect(TICKER_STOP_WORDS.has('GBP')).toBe(true);
  });

  it('does NOT contain real stock tickers', () => {
    expect(TICKER_STOP_WORDS.has('AAPL')).toBe(false);
    expect(TICKER_STOP_WORDS.has('TSLA')).toBe(false);
    expect(TICKER_STOP_WORDS.has('NVDA')).toBe(false);
    expect(TICKER_STOP_WORDS.has('VALE')).toBe(false);
  });
});
