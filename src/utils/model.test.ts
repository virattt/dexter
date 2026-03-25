import { describe, test, expect } from 'bun:test';
import {
  PROVIDERS,
  getModelsForProvider,
  getModelIdsForProvider,
  getDefaultModelForProvider,
  getModelDisplayName,
} from './model';

// ---------------------------------------------------------------------------
// MiniMax model definitions
// ---------------------------------------------------------------------------

describe('MiniMax model definitions', () => {
  test('MiniMax provider is listed in PROVIDERS', () => {
    const minimax = PROVIDERS.find((p) => p.providerId === 'minimax');
    expect(minimax).toBeDefined();
    expect(minimax!.displayName).toBe('MiniMax');
  });

  test('MiniMax has two models', () => {
    const models = getModelsForProvider('minimax');
    expect(models).toHaveLength(2);
  });

  test('MiniMax models have correct IDs', () => {
    const ids = getModelIdsForProvider('minimax');
    expect(ids).toContain('minimax:MiniMax-M2.7');
    expect(ids).toContain('minimax:MiniMax-M2.7-highspeed');
  });

  test('default MiniMax model is M2.7', () => {
    const defaultModel = getDefaultModelForProvider('minimax');
    expect(defaultModel).toBe('minimax:MiniMax-M2.7');
  });

  test('getModelDisplayName returns correct display names', () => {
    expect(getModelDisplayName('minimax:MiniMax-M2.7')).toBe('MiniMax M2.7');
    expect(getModelDisplayName('minimax:MiniMax-M2.7-highspeed')).toBe('MiniMax M2.7 Highspeed');
  });
});
