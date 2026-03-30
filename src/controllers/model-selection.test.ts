/**
 * Unit tests for ModelSelectionController state machine.
 *
 * Strategy: test state transitions that do NOT require external calls first,
 * then use spyOn on module namespace objects for the ollama path (HTTP call).
 * Branches that write to disk (setSetting / saveApiKeyForProvider) are covered
 * by the ollama/openrouter paths that don't reach completeModelSwitch, and by
 * the api_key_confirm path where no key is available.
 */
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import * as ollamaUtils from '../utils/ollama.js';
import { ModelSelectionController } from './model-selection.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeController(onError?: (msg: string) => void, onChange?: () => void) {
  const errors: string[] = [];
  const errorCb = onError ?? ((msg: string) => errors.push(msg));
  const ctrl = new ModelSelectionController(errorCb, onChange);
  return { ctrl, errors };
}

// ---------------------------------------------------------------------------
// Constructor + getters
// ---------------------------------------------------------------------------

describe('ModelSelectionController — constructor & getters', () => {
  it('initializes with provider and model from settings (or defaults)', () => {
    const { ctrl } = makeController();
    expect(typeof ctrl.provider).toBe('string');
    expect(ctrl.provider.length).toBeGreaterThan(0);
    expect(typeof ctrl.model).toBe('string');
    expect(ctrl.model.length).toBeGreaterThan(0);
  });

  it('state getter returns current appState, pendingProvider, pendingModels', () => {
    const { ctrl } = makeController();
    const s = ctrl.state;
    expect(s.appState).toBe('idle');
    expect(s.pendingProvider).toBeNull();
    expect(s.pendingModels).toEqual([]);
  });

  it('inMemoryChatHistory getter returns the chat history instance', () => {
    const { ctrl } = makeController();
    expect(ctrl.inMemoryChatHistory).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// isInSelectionFlow
// ---------------------------------------------------------------------------

describe('ModelSelectionController — isInSelectionFlow', () => {
  it('returns false when idle', () => {
    const { ctrl } = makeController();
    expect(ctrl.isInSelectionFlow()).toBe(false);
  });

  it('returns true after startSelection', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    expect(ctrl.isInSelectionFlow()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// startSelection / cancelSelection
// ---------------------------------------------------------------------------

describe('ModelSelectionController — startSelection / cancelSelection', () => {
  it('startSelection transitions to provider_select', () => {
    const onChange = mock(() => {});
    const { ctrl } = makeController(undefined, onChange);
    ctrl.startSelection();
    expect(ctrl.state.appState).toBe('provider_select');
    expect(onChange).toHaveBeenCalled();
  });

  it('cancelSelection resets to idle', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    ctrl.cancelSelection();
    expect(ctrl.state.appState).toBe('idle');
    expect(ctrl.state.pendingProvider).toBeNull();
    expect(ctrl.state.pendingModels).toEqual([]);
  });

  it('cancelSelection emits change', () => {
    const onChange = mock(() => {});
    const { ctrl } = makeController(undefined, onChange);
    ctrl.startSelection();
    onChange.mockClear();
    ctrl.cancelSelection();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// handleProviderSelect
// ---------------------------------------------------------------------------

describe('ModelSelectionController — handleProviderSelect', () => {
  it('null provider → idle', async () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    await ctrl.handleProviderSelect(null);
    expect(ctrl.state.appState).toBe('idle');
  });

  it('openrouter provider → model_input (no HTTP call needed)', async () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    await ctrl.handleProviderSelect('openrouter');
    expect(ctrl.state.appState).toBe('model_input');
    expect(ctrl.state.pendingProvider).toBe('openrouter');
    expect(ctrl.state.pendingModels).toEqual([]);
  });

  it('openai provider → model_select with model list', async () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    await ctrl.handleProviderSelect('openai');
    expect(ctrl.state.appState).toBe('model_select');
    expect(ctrl.state.pendingProvider).toBe('openai');
    expect(ctrl.state.pendingModels.length).toBeGreaterThan(0);
  });

  it('anthropic provider → model_select with model list', async () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    await ctrl.handleProviderSelect('anthropic');
    expect(ctrl.state.appState).toBe('model_select');
    expect(ctrl.state.pendingModels.length).toBeGreaterThan(0);
  });

  it('ollama provider with no local models → model_input (fallback to manual entry)', async () => {
    const spy = spyOn(ollamaUtils, 'getOllamaModels').mockResolvedValue([]);
    try {
      const { ctrl } = makeController();
      ctrl.startSelection();
      await ctrl.handleProviderSelect('ollama');
      expect(ctrl.state.appState).toBe('model_input');
      expect(ctrl.state.pendingProvider).toBe('ollama');
    } finally {
      spy.mockRestore();
    }
  });

  it('ollama provider with local models → model_select', async () => {
    const spy = spyOn(ollamaUtils, 'getOllamaModels').mockResolvedValue(['llama2', 'mistral']);
    try {
      const { ctrl } = makeController();
      ctrl.startSelection();
      await ctrl.handleProviderSelect('ollama');
      expect(ctrl.state.appState).toBe('model_select');
      expect(ctrl.state.pendingModels).toEqual([
        { id: 'llama2', displayName: 'llama2' },
        { id: 'mistral', displayName: 'mistral' },
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// handleModelSelect
// ---------------------------------------------------------------------------

describe('ModelSelectionController — handleModelSelect', () => {
  it('null modelId → resets to provider_select', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'openai';
    ctrl.handleModelSelect(null);
    expect(ctrl.state.appState).toBe('provider_select');
    expect(ctrl.state.pendingProvider).toBeNull();
  });

  it('null pendingProvider → resets to provider_select', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    ctrl.handleModelSelect('gpt-5.4');
    expect(ctrl.state.appState).toBe('provider_select');
  });

  it('ollama provider → completes switch immediately (no api key check)', async () => {
    const spy = spyOn(ollamaUtils, 'getOllamaModels').mockResolvedValue(['llama2', 'mistral']);
    try {
      const { ctrl } = makeController();
      ctrl.startSelection();
      await ctrl.handleProviderSelect('ollama');
      ctrl.handleModelSelect('llama2');
      expect(ctrl.state.appState).toBe('idle');
      expect(ctrl.model).toBe('ollama:llama2');
    } finally {
      spy.mockRestore();
    }
  });

  it('non-ollama provider with no api key → api_key_confirm', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    // Set pending state manually to avoid real HTTP calls
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'anthropic';
    (ctrl as unknown as { pendingModelsValue: unknown[] }).pendingModelsValue = [
      { id: 'claude-3', displayName: 'Claude 3' },
    ];
    // Remove any ANTHROPIC_API_KEY from env temporarily
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      ctrl.handleModelSelect('claude-3');
      expect(ctrl.state.appState).toBe('api_key_confirm');
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// handleModelInputSubmit
// ---------------------------------------------------------------------------

describe('ModelSelectionController — handleModelInputSubmit', () => {
  it('null modelName → resets to provider_select', async () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    await ctrl.handleProviderSelect('openrouter');
    ctrl.handleModelInputSubmit(null);
    expect(ctrl.state.appState).toBe('provider_select');
    expect(ctrl.state.pendingProvider).toBeNull();
  });

  it('null pendingProvider → resets to provider_select', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    ctrl.handleModelInputSubmit('my-custom-model');
    expect(ctrl.state.appState).toBe('provider_select');
  });

  it('openrouter with custom model name + no api key → api_key_confirm', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'openrouter';
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      ctrl.handleModelInputSubmit('meta-llama/llama-3');
      expect(ctrl.state.appState).toBe('api_key_confirm');
    } finally {
      if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// handleApiKeyConfirm
// ---------------------------------------------------------------------------

describe('ModelSelectionController — handleApiKeyConfirm', () => {
  it('wantsToSet=true → transitions to api_key_input', () => {
    const { ctrl } = makeController();
    ctrl.startSelection();
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'openai';
    ctrl.handleApiKeyConfirm(true);
    expect(ctrl.state.appState).toBe('api_key_input');
  });

  it('wantsToSet=false with no api key + no pending model → calls onError and resets to idle', () => {
    const { ctrl, errors } = makeController();
    ctrl.startSelection();
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'openai';
    // pendingSelectedModelId is null — falls to onError branch
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      ctrl.handleApiKeyConfirm(false);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('without an API key');
      expect(ctrl.state.appState).toBe('idle');
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });

  it('wantsToSet=false emits onChange on api_key_input transition', () => {
    const onChange = mock(() => {});
    const { ctrl } = makeController(undefined, onChange);
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'openai';
    onChange.mockClear();
    ctrl.handleApiKeyConfirm(true);
    expect(onChange).toHaveBeenCalled();
    expect(ctrl.state.appState).toBe('api_key_input');
  });
});

// ---------------------------------------------------------------------------
// handleApiKeySubmit
// ---------------------------------------------------------------------------

describe('ModelSelectionController — handleApiKeySubmit', () => {
  it('no pending model → calls onError with "No model selected"', () => {
    const { ctrl, errors } = makeController();
    ctrl.handleApiKeySubmit(null);
    expect(errors).toContain('No model selected.');
    expect(ctrl.state.appState).toBe('idle');
  });

  it('null apiKey + pending model + provider + no key in env → final onError', () => {
    const { ctrl, errors } = makeController();
    (ctrl as unknown as { pendingProviderValue: string }).pendingProviderValue = 'openai';
    (ctrl as unknown as { pendingSelectedModelId: string }).pendingSelectedModelId = 'gpt-5.4';
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      ctrl.handleApiKeySubmit(null);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[errors.length - 1]).toContain('API key not set');
      expect(ctrl.state.appState).toBe('idle');
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });

  it('null apiKey when no pendingProvider → falls through to onError', () => {
    const { ctrl, errors } = makeController();
    (ctrl as unknown as { pendingSelectedModelId: string }).pendingSelectedModelId = 'some-model';
    // pendingProviderValue is null by default
    ctrl.handleApiKeySubmit(null);
    // No OPENAI_API_KEY and no provider → onError
    expect(errors.length).toBeGreaterThan(0);
  });
});
