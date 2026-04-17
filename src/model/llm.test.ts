import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { getChatModel, getFastModel } from './llm';

// ---------------------------------------------------------------------------
// MiniMax LLM factory
// ---------------------------------------------------------------------------

describe('MiniMax LLM factory', () => {
  const originalEnv = process.env.MINIMAX_API_KEY;

  beforeAll(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.MINIMAX_API_KEY = originalEnv;
    } else {
      delete process.env.MINIMAX_API_KEY;
    }
  });

  test('getChatModel returns a model for minimax: prefix', () => {
    const model = getChatModel('minimax:MiniMax-M2.7', false);
    expect(model).toBeDefined();
  });

  test('getChatModel returns a model for minimax highspeed', () => {
    const model = getChatModel('minimax:MiniMax-M2.7-highspeed', false);
    expect(model).toBeDefined();
  });

  test('getChatModel supports streaming option', () => {
    const model = getChatModel('minimax:MiniMax-M2.7', true);
    expect(model).toBeDefined();
  });

  test('throws when MINIMAX_API_KEY is not set', () => {
    const saved = process.env.MINIMAX_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    try {
      expect(() => getChatModel('minimax:MiniMax-M2.7', false)).toThrow('MINIMAX_API_KEY');
    } finally {
      process.env.MINIMAX_API_KEY = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// getFastModel for MiniMax
// ---------------------------------------------------------------------------

describe('getFastModel for MiniMax', () => {
  test('returns MiniMax fast model', () => {
    const fast = getFastModel('minimax', 'minimax:MiniMax-M2.7');
    expect(fast).toBe('minimax:MiniMax-M2.7-highspeed');
  });

  test('falls back to provided model for unknown provider', () => {
    const fast = getFastModel('unknown-provider', 'some-model');
    expect(fast).toBe('some-model');
  });
});
