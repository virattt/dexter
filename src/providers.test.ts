import { describe, test, expect } from 'bun:test';
import { PROVIDERS, resolveProvider, getProviderById } from './providers';

// ---------------------------------------------------------------------------
// MiniMax provider registration
// ---------------------------------------------------------------------------

describe('MiniMax provider registration', () => {
  test('MiniMax is present in PROVIDERS array', () => {
    const minimax = PROVIDERS.find((p) => p.id === 'minimax');
    expect(minimax).toBeDefined();
    expect(minimax!.displayName).toBe('MiniMax');
    expect(minimax!.modelPrefix).toBe('minimax:');
    expect(minimax!.apiKeyEnvVar).toBe('MINIMAX_API_KEY');
    expect(minimax!.fastModel).toBe('minimax:MiniMax-M2.7-highspeed');
  });

  test('getProviderById returns MiniMax', () => {
    const minimax = getProviderById('minimax');
    expect(minimax).toBeDefined();
    expect(minimax!.id).toBe('minimax');
  });
});

// ---------------------------------------------------------------------------
// resolveProvider routing
// ---------------------------------------------------------------------------

describe('resolveProvider routing', () => {
  test('routes minimax: prefixed models to MiniMax provider', () => {
    const provider = resolveProvider('minimax:MiniMax-M2.7');
    expect(provider.id).toBe('minimax');
  });

  test('routes minimax:MiniMax-M2.7-highspeed to MiniMax provider', () => {
    const provider = resolveProvider('minimax:MiniMax-M2.7-highspeed');
    expect(provider.id).toBe('minimax');
  });

  test('does not route non-minimax models to MiniMax', () => {
    const provider = resolveProvider('gpt-5.4');
    expect(provider.id).not.toBe('minimax');
  });

  test('does not route deepseek models to MiniMax', () => {
    const provider = resolveProvider('deepseek-chat');
    expect(provider.id).toBe('deepseek');
  });
});
