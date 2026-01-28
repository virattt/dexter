import { useState, useCallback, useRef } from 'react';
import { getSetting, setSetting } from '../utils/config.js';
import { getProviderDisplayName, checkApiKeyExistsForProvider, saveApiKeyForProvider } from '../utils/env.js';
import { getModelsForProvider, getDefaultModelForProvider } from '../components/ModelSelector.js';
import { getOllamaModels } from '../utils/ollama.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../model/llm.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

// ============================================================================
// Types
// ============================================================================

const SELECTION_STATES = ['provider_select', 'model_select', 'api_key_confirm', 'api_key_input'] as const;
type SelectionState = typeof SELECTION_STATES[number];
type AppState = 'idle' | SelectionState;

export interface ModelSelectionState {
  appState: AppState;
  pendingProvider: string | null;
  pendingModels: string[];
}

export interface UseModelSelectionResult {
  // Current state
  selectionState: ModelSelectionState;
  provider: string;
  model: string;
  inMemoryChatHistoryRef: React.RefObject<InMemoryChatHistory>;
  
  // Actions
  startSelection: () => void;
  cancelSelection: () => void;
  handleProviderSelect: (providerId: string | null) => Promise<void>;
  handleModelSelect: (modelId: string | null) => void;
  handleApiKeyConfirm: (wantsToSet: boolean) => void;
  handleApiKeySubmit: (apiKey: string | null) => void;
  
  // Helpers
  isInSelectionFlow: () => boolean;
}

// ============================================================================
// Helper
// ============================================================================

function isSelectionState(state: AppState): state is SelectionState {
  return (SELECTION_STATES as readonly string[]).includes(state);
}

// ============================================================================
// Hook
// ============================================================================

export function useModelSelection(
  onError: (message: string) => void
): UseModelSelectionResult {
  // Provider and model state (persisted)
  const [provider, setProvider] = useState(() => getSetting('provider', DEFAULT_PROVIDER));
  const [model, setModel] = useState(() => {
    const savedModel = getSetting('modelId', null) as string | null;
    const savedProvider = getSetting('provider', DEFAULT_PROVIDER) as string;
    if (savedModel) {
      return savedModel;
    }
    return getDefaultModelForProvider(savedProvider) || DEFAULT_MODEL;
  });
  
  // Selection flow state
  const [appState, setAppState] = useState<AppState>('idle');
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [pendingModels, setPendingModels] = useState<string[]>([]);
  
  // Message history ref - shared with agent runner
  const inMemoryChatHistoryRef = useRef<InMemoryChatHistory>(new InMemoryChatHistory(model));
  
  // Helper to complete a model switch (DRY pattern)
  const completeModelSwitch = useCallback((newProvider: string, newModelId: string) => {
    setProvider(newProvider);
    setModel(newModelId);
    setSetting('provider', newProvider);
    setSetting('modelId', newModelId);
    inMemoryChatHistoryRef.current.setModel(newModelId);
    setPendingProvider(null);
    setPendingModels([]);
    setAppState('idle');
  }, []);
  
  // Reset pending state
  const resetPendingState = useCallback(() => {
    setPendingProvider(null);
    setPendingModels([]);
    setAppState('idle');
  }, []);
  
  // Start selection flow
  const startSelection = useCallback(() => {
    setAppState('provider_select');
  }, []);
  
  // Cancel selection flow
  const cancelSelection = useCallback(() => {
    resetPendingState();
  }, [resetPendingState]);
  
  // Check if in selection flow
  const isInSelectionFlow = useCallback(() => {
    return isSelectionState(appState);
  }, [appState]);
  
  // Provider selection handler
  const handleProviderSelect = useCallback(async (providerId: string | null) => {
    if (providerId) {
      setPendingProvider(providerId);
      
      // Fetch models for the provider
      if (providerId === 'ollama') {
        const ollamaModels = await getOllamaModels();
        setPendingModels(ollamaModels);
      } else {
        setPendingModels(getModelsForProvider(providerId));
      }
      
      setAppState('model_select');
    } else {
      setAppState('idle');
    }
  }, []);
  
  // Model selection handler
  const handleModelSelect = useCallback((modelId: string | null) => {
    if (!modelId || !pendingProvider) {
      // User cancelled - go back to provider select
      setPendingProvider(null);
      setPendingModels([]);
      setAppState('provider_select');
      return;
    }
    
    // For Ollama, skip API key flow entirely
    if (pendingProvider === 'ollama') {
      const fullModelId = `ollama:${modelId}`;
      completeModelSwitch(pendingProvider, fullModelId);
      return;
    }
    
    // For cloud providers, check API key
    if (checkApiKeyExistsForProvider(pendingProvider)) {
      completeModelSwitch(pendingProvider, modelId);
    } else {
      // Need to get API key - store the selected model temporarily
      setPendingModels([modelId]);
      setAppState('api_key_confirm');
    }
  }, [pendingProvider, completeModelSwitch]);
  
  // API key confirmation handler
  const handleApiKeyConfirm = useCallback((wantsToSet: boolean) => {
    if (wantsToSet) {
      setAppState('api_key_input');
    } else {
      // Check if existing key is available
      const selectedModel = pendingModels[0];
      if (pendingProvider && selectedModel && checkApiKeyExistsForProvider(pendingProvider)) {
        completeModelSwitch(pendingProvider, selectedModel);
      } else {
        onError(`Cannot use ${pendingProvider ? getProviderDisplayName(pendingProvider) : 'provider'} without an API key.`);
        resetPendingState();
      }
    }
  }, [pendingProvider, pendingModels, completeModelSwitch, resetPendingState, onError]);
  
  // API key submit handler
  const handleApiKeySubmit = useCallback((apiKey: string | null) => {
    const selectedModel = pendingModels[0];
    
    // Guard: ensure we have a selected model
    if (!selectedModel) {
      onError('No model selected.');
      resetPendingState();
      return;
    }
    
    if (apiKey && pendingProvider) {
      const saved = saveApiKeyForProvider(pendingProvider, apiKey);
      if (saved) {
        completeModelSwitch(pendingProvider, selectedModel);
      } else {
        onError('Failed to save API key.');
        resetPendingState();
      }
    } else if (!apiKey && pendingProvider && checkApiKeyExistsForProvider(pendingProvider)) {
      // Cancelled but existing key available
      completeModelSwitch(pendingProvider, selectedModel);
    } else {
      onError('API key not set. Provider unchanged.');
      resetPendingState();
    }
  }, [pendingProvider, pendingModels, completeModelSwitch, resetPendingState, onError]);
  
  return {
    selectionState: {
      appState,
      pendingProvider,
      pendingModels,
    },
    provider,
    model,
    inMemoryChatHistoryRef,
    startSelection,
    cancelSelection,
    handleProviderSelect,
    handleModelSelect,
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInSelectionFlow,
  };
}
