import { describe, expect, test } from 'bun:test';
import { getProviderById, resolveProvider } from './providers.js';

describe('MiniMax provider registration', () => {
  test('registers OpenAI-compatible and Anthropic-compatible regional endpoints', () => {
    const provider = getProviderById('minimax');

    expect(provider?.displayName).toBe('MiniMax');
    expect(provider?.modelPrefix).toBe('minimax:');
    expect(provider?.apiKeyEnvVar).toBe('MINIMAX_API_KEY');
    expect(provider?.contextWindow).toBe(1_000_000);
    expect(provider?.openAIBaseUrl).toBe('https://api.minimax.io/v1');
    expect(provider?.anthropicBaseUrl).toBe('https://api.minimax.io/anthropic');
    expect(provider?.regionalEndpoints).toEqual([
      {
        region: 'global_en',
        openAIBaseUrl: 'https://api.minimax.io/v1',
        anthropicBaseUrl: 'https://api.minimax.io/anthropic',
        docsRoot: 'https://platform.minimax.io/docs',
      },
      {
        region: 'cn_zh',
        openAIBaseUrl: 'https://api.minimaxi.com/v1',
        anthropicBaseUrl: 'https://api.minimaxi.com/anthropic',
        docsRoot: 'https://platform.minimaxi.com/docs',
      },
    ]);
  });

  test('routes MiniMax-prefixed models to the MiniMax provider', () => {
    expect(resolveProvider('minimax:MiniMax-M3').id).toBe('minimax');
    expect(resolveProvider('minimax:MiniMax-M2.7').id).toBe('minimax');
  });

  test('keeps current MiniMax model metadata in the canonical registry', () => {
    const models = getProviderById('minimax')?.models ?? [];

    expect(models.map((model) => model.id)).toEqual([
      'minimax:MiniMax-M3',
      'minimax:MiniMax-M2.7',
    ]);
    expect(models[0]).toMatchObject({
      contextWindow: 1_000_000,
      pricingUsdPerMillionTokens: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.12,
        cacheWrite: null,
      },
      inputModalities: ['text', 'image', 'video'],
      thinking: ['adaptive', 'disabled'],
    });
    expect(models[1]).toMatchObject({
      contextWindow: 204_800,
      pricingUsdPerMillionTokens: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
        cacheWrite: 0.375,
      },
      inputModalities: ['text'],
      thinking: ['always_on'],
    });
  });
});
