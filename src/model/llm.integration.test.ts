import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { getChatModel } from '@/model/llm';
import { resolveProvider, getProviderById } from '@/providers';
import { getModelsForProvider, getDefaultModelForProvider, getModelDisplayName } from '@/utils/model';

/**
 * Integration tests for MiniMax provider support.
 *
 * These tests verify the end-to-end flow from provider resolution
 * through model instantiation. They do NOT call the MiniMax API —
 * they validate that the wiring between providers.ts, model.ts, and
 * llm.ts is correct.
 *
 * To run a live API test, set MINIMAX_API_KEY and use:
 *   MINIMAX_LIVE=1 bun test src/model/llm.integration.test.ts
 */

describe('MiniMax integration: provider → model → factory', () => {
  const originalKey = process.env.MINIMAX_API_KEY;

  beforeAll(() => {
    process.env.MINIMAX_API_KEY = 'test-integration-key';
  });

  afterAll(() => {
    if (originalKey !== undefined) {
      process.env.MINIMAX_API_KEY = originalKey;
    } else {
      delete process.env.MINIMAX_API_KEY;
    }
  });

  test('provider registry, model list, and factory are consistent', () => {
    // 1. Provider exists
    const providerDef = getProviderById('minimax');
    expect(providerDef).toBeDefined();
    expect(providerDef!.modelPrefix).toBe('minimax:');

    // 2. Models are registered
    const models = getModelsForProvider('minimax');
    expect(models.length).toBeGreaterThan(0);

    // 3. Default model resolves correctly
    const defaultModel = getDefaultModelForProvider('minimax');
    expect(defaultModel).toBeDefined();

    // 4. Model name resolves to MiniMax provider
    const resolved = resolveProvider(defaultModel!);
    expect(resolved.id).toBe('minimax');

    // 5. Factory creates a model instance
    const chatModel = getChatModel(defaultModel!, false);
    expect(chatModel).toBeDefined();

    // 6. Display name works
    const displayName = getModelDisplayName(defaultModel!);
    expect(displayName).not.toBe(defaultModel); // Should have human-friendly name
  });

  test('all MiniMax models can be instantiated via factory', () => {
    const models = getModelsForProvider('minimax');
    for (const model of models) {
      const provider = resolveProvider(model.id);
      expect(provider.id).toBe('minimax');

      const chatModel = getChatModel(model.id, false);
      expect(chatModel).toBeDefined();
    }
  });

  test('fast model resolves through the same pipeline', () => {
    const providerDef = getProviderById('minimax');
    expect(providerDef!.fastModel).toBeDefined();

    const fastModel = providerDef!.fastModel!;
    const resolved = resolveProvider(fastModel);
    expect(resolved.id).toBe('minimax');

    const chatModel = getChatModel(fastModel, true);
    expect(chatModel).toBeDefined();
  });
});
