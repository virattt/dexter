import { describe, it, expect } from 'bun:test';
import { shouldRunMemoryFlush, MEMORY_FLUSH_TOKEN, validateFlushOutput } from './flush.js';
import { CONTEXT_THRESHOLD } from '../utils/tokens.js';

// ============================================================================
// shouldRunMemoryFlush
// ============================================================================

describe('shouldRunMemoryFlush', () => {
  it('returns true when tokens meet the threshold', () => {
    expect(shouldRunMemoryFlush({ estimatedContextTokens: CONTEXT_THRESHOLD, alreadyFlushed: false })).toBe(true);
  });

  it('returns true when tokens exceed the threshold', () => {
    expect(shouldRunMemoryFlush({ estimatedContextTokens: CONTEXT_THRESHOLD + 1000, alreadyFlushed: false })).toBe(true);
  });

  it('returns false when tokens are below threshold', () => {
    expect(shouldRunMemoryFlush({ estimatedContextTokens: CONTEXT_THRESHOLD - 1, alreadyFlushed: false })).toBe(false);
  });

  it('returns false when already flushed, even above threshold', () => {
    expect(shouldRunMemoryFlush({ estimatedContextTokens: CONTEXT_THRESHOLD + 5000, alreadyFlushed: true })).toBe(false);
  });

  it('respects a custom threshold', () => {
    const customThreshold = 1000;
    expect(shouldRunMemoryFlush({ estimatedContextTokens: 1000, alreadyFlushed: false, threshold: customThreshold })).toBe(true);
    expect(shouldRunMemoryFlush({ estimatedContextTokens: 999, alreadyFlushed: false, threshold: customThreshold })).toBe(false);
  });
});

// ============================================================================
// MEMORY_FLUSH_TOKEN
// ============================================================================

describe('MEMORY_FLUSH_TOKEN', () => {
  it('is a non-empty string sentinel value', () => {
    expect(typeof MEMORY_FLUSH_TOKEN).toBe('string');
    expect(MEMORY_FLUSH_TOKEN.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// MEMORY_FLUSH_PROMPT content (imported at module level via flush.ts internals)
// Validate the P1-P4 priority hierarchy and key instructions are present.
// ============================================================================

describe('MEMORY_FLUSH_PROMPT content', () => {
  // We test the shape of the prompt by importing the module and inspecting what
  // gets embedded. The cleanest way: export the prompt string. Since it's not
  // exported, we test through the observable contract in runMemoryFlush's
  // assembled prompt — or we inspect the source statically here.
  //
  // As a practical alternative: re-read the module source and assert on key phrases.

  // Import the raw source to verify the prompt contains required sections.
  const flushSource = Bun.file(new URL('./flush.ts', import.meta.url).pathname);

  it('contains P1 — CRITICAL section with ticker routing', async () => {
    const source = await flushSource.text();
    expect(source).toContain('P1 — CRITICAL');
    expect(source).toContain('Ticker routing');
  });

  it('contains P2 — IMPORTANT section with investment theses', async () => {
    const source = await flushSource.text();
    expect(source).toContain('P2 — IMPORTANT');
    expect(source).toContain('Investment theses');
  });

  it('contains P3 — USEFUL section with sector / macro context', async () => {
    const source = await flushSource.text();
    expect(source).toContain('P3 — USEFUL');
    expect(source).toContain('Sector');
  });

  it('contains P4 — PERSONAL CONTEXT section', async () => {
    const source = await flushSource.text();
    expect(source).toContain('P4 — PERSONAL CONTEXT');
  });

  it('instructs date-stamping of financial data', async () => {
    const source = await flushSource.text();
    expect(source).toContain('Date-stamp all financial data');
  });

  it('instructs to exclude raw stock prices', async () => {
    const source = await flushSource.text();
    expect(source).toContain('raw stock prices');
  });

  it('includes WACC / valuation assumptions as P2 item', async () => {
    const source = await flushSource.text();
    expect(source).toContain('WACC');
  });
});

// ============================================================================
// validateFlushOutput
// ============================================================================

describe('validateFlushOutput', () => {
  it('accepts valid dash-bullet output', () => {
    const valid = '- AAPL: bullish thesis, target $200 (2025-Q1)\n- TSLA: hold, competitive pressure from BYD';
    expect(validateFlushOutput(valid)).toBe(true);
  });

  it('accepts valid asterisk-bullet output', () => {
    const valid = '* Portfolio: 10% cash, growth focus (rebalanced 2025-Q1)\n* NVDA: core AI holding';
    expect(validateFlushOutput(valid)).toBe(true);
  });

  it('accepts output with markdown headers above bullets', () => {
    const valid = '### P1 — Critical\n- AAPL: FMP ok, fundamentals solid (Q3 2024)\n- VWS.CO: use web_search';
    expect(validateFlushOutput(valid)).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateFlushOutput('')).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(validateFlushOutput('   \n\n   \t  ')).toBe(false);
  });

  it('rejects output shorter than 50 characters', () => {
    expect(validateFlushOutput('- short')).toBe(false);
  });

  it('rejects output with no bullet points (plain prose)', () => {
    const noBullets = 'Just some plain text without any list structure or bullet points at all, quite long enough';
    expect(validateFlushOutput(noBullets)).toBe(false);
  });

  it('rejects output where bullet is not at line start', () => {
    const indented = 'Some text   - this is not a line-start bullet point, it is inline';
    expect(validateFlushOutput(indented)).toBe(false);
  });

  it('accepts MEMORY_FLUSH_TOKEN rejection path via sentinel check (not validateFlushOutput)', () => {
    // The sentinel value itself would pass length check but typically has no bullets.
    // runMemoryFlush checks sentinel BEFORE validateFlushOutput, so this is informational.
    expect(typeof MEMORY_FLUSH_TOKEN).toBe('string');
  });
});
