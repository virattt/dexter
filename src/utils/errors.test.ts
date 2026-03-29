/**
 * TDD tests for formatUserFacingError() actionable messages (Feature 8).
 *
 * Each known error type must return a string that includes:
 *   1. A description of what happened
 *   2. A concrete fix hint (what to do next)
 */
import { describe, it, expect } from 'bun:test';
import { formatUserFacingError } from './errors.js';

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------
describe('formatUserFacingError — rate_limit', () => {
  it('identifies a 429 HTTP error', () => {
    const msg = formatUserFacingError('rate limit exceeded 429', 'OpenAI');
    expect(msg.toLowerCase()).toMatch(/rate limit/);
  });

  it('includes a wait-time hint', () => {
    const msg = formatUserFacingError('too many requests', 'OpenAI');
    expect(msg).toMatch(/60|wait/i);
  });

  it('mentions switching providers as an option', () => {
    const msg = formatUserFacingError('quota exceeded', 'Anthropic');
    expect(msg).toMatch(/\/model/);
  });

  it('includes the provider label when given', () => {
    const msg = formatUserFacingError('rate_limit exceeded', 'Google');
    expect(msg).toMatch(/Google/);
  });
});

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
describe('formatUserFacingError — billing', () => {
  it('identifies a 402 HTTP error', () => {
    const msg = formatUserFacingError('status: 402 payment required');
    expect(msg.toLowerCase()).toMatch(/billing|credit|balance/);
  });

  it('tells the user how to fix it (top-up or switch key)', () => {
    const msg = formatUserFacingError('insufficient credits');
    expect(msg).toMatch(/\.env|billing|top.?up|switch/i);
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('formatUserFacingError — auth', () => {
  it('identifies an invalid API key', () => {
    const msg = formatUserFacingError('invalid_api_key provided');
    expect(msg.toLowerCase()).toMatch(/auth|invalid|expired/);
  });

  it('tells the user where to look (.env)', () => {
    const msg = formatUserFacingError('incorrect api key');
    expect(msg).toMatch(/\.env/i);
  });

  it('handles 401 status', () => {
    const msg = formatUserFacingError('HTTP 401 Unauthorized');
    expect(msg.toLowerCase()).toMatch(/auth|key|invalid/);
  });
});

// ---------------------------------------------------------------------------
// Context overflow
// ---------------------------------------------------------------------------
describe('formatUserFacingError — context_overflow', () => {
  it('identifies context length exceeded', () => {
    const msg = formatUserFacingError("this model's maximum context length is 8192");
    expect(msg.toLowerCase()).toMatch(/context|conversation|large/);
  });

  it('tells the user what to do (/exit or /model)', () => {
    const msg = formatUserFacingError('context length exceeded');
    expect(msg).toMatch(/\/exit|\/model|new conversation|larger/i);
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------
describe('formatUserFacingError — timeout', () => {
  it('identifies timeout errors', () => {
    const msg = formatUserFacingError('request timed out after 30s');
    expect(msg.toLowerCase()).toMatch(/timeout|timed/);
  });

  it('suggests a fix', () => {
    const msg = formatUserFacingError('deadline exceeded');
    expect(msg).toMatch(/shorter|faster|\/model|again/i);
  });
});

// ---------------------------------------------------------------------------
// Overloaded
// ---------------------------------------------------------------------------
describe('formatUserFacingError — overloaded', () => {
  it('identifies overloaded service', () => {
    const msg = formatUserFacingError('overloaded_error: service unavailable');
    expect(msg.toLowerCase()).toMatch(/overload|unavailable|demand/);
  });

  it('tells the user to wait or switch', () => {
    const msg = formatUserFacingError('overloaded');
    expect(msg).toMatch(/wait|\/model/i);
  });
});

// ---------------------------------------------------------------------------
// Unknown / fallback
// ---------------------------------------------------------------------------
describe('formatUserFacingError — unknown', () => {
  it('returns the raw message if under 300 chars', () => {
    const msg = formatUserFacingError('some obscure error');
    expect(msg).toBe('some obscure error');
  });

  it('truncates raw messages longer than 300 chars', () => {
    const long = 'x'.repeat(400);
    const msg = formatUserFacingError(long);
    expect(msg.length).toBeLessThanOrEqual(303); // 300 chars + '...'
    expect(msg.endsWith('...')).toBe(true);
  });

  it('returns a fallback for empty input', () => {
    const msg = formatUserFacingError('');
    expect(msg.length).toBeGreaterThan(0);
  });
});
