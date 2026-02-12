import { useState, useCallback, useRef } from 'react';
import { getSetting, setSetting } from '../utils/config.js';
import { getProviderDisplayName, checkApiKeyExistsForProvider, saveApiKeyForProvider } from '../utils/env.js';
import { getModelsForProvider, getDefaultModelForProvider, type Model } from '../components/ModelSelector.js';
import { getOllamaModels } from '../utils/ollama.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../model/llm.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import {
  getOpenAIAuthMode,
  isOpenAIOAuthModelSupported,
  hasOpenAIOAuthCredentials,
  setOpenAIAuthMode,
  startOpenAIDeviceAuth,
  pollOpenAIDeviceAuth,
  saveOpenAIOAuthCredentials,
} from '../utils/openai-oauth.js';

// ============================================================================
// Types
// ============================================================================

const SELECTION_STATES = [
  'provider_select',
  'model_select',
  'model_input',
  'openai_auth_select',
  'openai_oauth_wait',
  'api_key_confirm',
  'api_key_input',
] as const;
type SelectionState = typeof SELECTION_STATES[number];
type AppState = 'idle' | SelectionState;

export interface OpenAIOAuthDisplay {
  verificationUrl: string;
  userCode: string;
}

export interface ModelSelectionState {
  appState: AppState;
  pendingProvider: string | null;
  pendingModels: Model[];
  openAIOAuthDisplay: OpenAIOAuthDisplay | null;
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
  handleModelInputSubmit: (modelName: string | null) => void;
  handleOpenAIAuthMethodSelect: (method: 'oauth' | 'api_key' | null) => Promise<void>;
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return String(error);
}

function isOpenAIOAuthCancelError(error: unknown): boolean {
  return error instanceof Error && error.message === 'OpenAI OAuth cancelled.';
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
  const [pendingModels, setPendingModels] = useState<Model[]>([]);
  const [pendingSelectedModelId, setPendingSelectedModelId] = useState<string | null>(null);
  const [openAIOAuthDisplay, setOpenAIOAuthDisplay] = useState<OpenAIOAuthDisplay | null>(null);
  const openAIOAuthAbortControllerRef = useRef<AbortController | null>(null);
  
  // Message history ref - shared with agent runner
  const inMemoryChatHistoryRef = useRef<InMemoryChatHistory>(new InMemoryChatHistory(model));
  
  // Helper to complete a model switch (DRY pattern)
  const completeModelSwitch = useCallback((newProvider: string, newModelId: string) => {
    openAIOAuthAbortControllerRef.current?.abort();
    openAIOAuthAbortControllerRef.current = null;
    setProvider(newProvider);
    setModel(newModelId);
    setSetting('provider', newProvider);
    setSetting('modelId', newModelId);
    inMemoryChatHistoryRef.current.setModel(newModelId);
    setPendingProvider(null);
    setPendingModels([]);
    setPendingSelectedModelId(null);
    setOpenAIOAuthDisplay(null);
    setAppState('idle');
  }, []);
  
  // Reset pending state
  const resetPendingState = useCallback(() => {
    openAIOAuthAbortControllerRef.current?.abort();
    openAIOAuthAbortControllerRef.current = null;
    setPendingProvider(null);
    setPendingModels([]);
    setPendingSelectedModelId(null);
    setOpenAIOAuthDisplay(null);
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
      
      // OpenRouter uses free-text model input instead of a list
      if (providerId === 'openrouter') {
        setPendingModels([]);
        setAppState('model_input');
      } else if (providerId === 'ollama') {
        // Fetch models from local Ollama API and convert to Model objects
        const ollamaModelIds = await getOllamaModels();
        const ollamaModels: Model[] = ollamaModelIds.map((id) => ({ id, displayName: id }));
        setPendingModels(ollamaModels);
        setAppState('model_select');
      } else {
        setPendingModels(getModelsForProvider(providerId));
        setAppState('model_select');
      }
    } else {
      setAppState('idle');
    }
  }, []);
  
  // Model selection handler (for list-based selection)
  const handleModelSelect = useCallback((modelId: string | null) => {
    if (!modelId || !pendingProvider) {
      // User cancelled - go back to provider select
      setPendingProvider(null);
      setPendingModels([]);
      setPendingSelectedModelId(null);
      setAppState('provider_select');
      return;
    }
    
    // For Ollama, skip API key flow entirely
    if (pendingProvider === 'ollama') {
      const fullModelId = `ollama:${modelId}`;
      completeModelSwitch(pendingProvider, fullModelId);
      return;
    }

    if (pendingProvider === 'openai') {
      const hasOpenAIApiKey = checkApiKeyExistsForProvider('openai');
      const hasOpenAIOAuth = hasOpenAIOAuthCredentials();
      const preferredAuthMode = getOpenAIAuthMode();

      if (hasOpenAIOAuth && preferredAuthMode === 'oauth' && isOpenAIOAuthModelSupported(modelId)) {
        completeModelSwitch('openai', modelId);
        return;
      }

      if (hasOpenAIApiKey) {
        setOpenAIAuthMode('api_key');
        completeModelSwitch('openai', modelId);
        return;
      }

      if (hasOpenAIOAuth && isOpenAIOAuthModelSupported(modelId)) {
        setOpenAIAuthMode('oauth');
        completeModelSwitch('openai', modelId);
        return;
      }

      setPendingSelectedModelId(modelId);
      setAppState('openai_auth_select');
      return;
    }
    
    // For cloud providers, check API key
    if (checkApiKeyExistsForProvider(pendingProvider)) {
      completeModelSwitch(pendingProvider, modelId);
    } else {
      // Need to get API key - store the selected model temporarily
      setPendingSelectedModelId(modelId);
      setAppState('api_key_confirm');
    }
  }, [pendingProvider, completeModelSwitch]);
  
  // Model input handler (for free-text input like OpenRouter)
  const handleModelInputSubmit = useCallback((modelName: string | null) => {
    if (!modelName || !pendingProvider) {
      // User cancelled - go back to provider select
      setPendingProvider(null);
      setPendingModels([]);
      setPendingSelectedModelId(null);
      setAppState('provider_select');
      return;
    }
    
    // Store with provider prefix (e.g., openrouter:anthropic/claude-3.5-sonnet)
    const fullModelId = `${pendingProvider}:${modelName}`;
    
    // Check API key for the provider
    if (checkApiKeyExistsForProvider(pendingProvider)) {
      completeModelSwitch(pendingProvider, fullModelId);
    } else {
      // Need to get API key - store the selected model temporarily
      setPendingSelectedModelId(fullModelId);
      setAppState('api_key_confirm');
    }
  }, [pendingProvider, completeModelSwitch]);

  // OpenAI auth method selection handler
  const handleOpenAIAuthMethodSelect = useCallback(async (method: 'oauth' | 'api_key' | null) => {
    if (!pendingProvider || pendingProvider !== 'openai') {
      resetPendingState();
      return;
    }

    if (!pendingSelectedModelId) {
      onError('No model selected.');
      resetPendingState();
      return;
    }

    if (!method) {
      setPendingProvider(null);
      setPendingModels([]);
      setPendingSelectedModelId(null);
      setOpenAIOAuthDisplay(null);
      setAppState('provider_select');
      return;
    }

    if (method === 'api_key') {
      setOpenAIAuthMode('api_key');
      setOpenAIOAuthDisplay(null);
      setAppState('api_key_input');
      return;
    }

    if (!isOpenAIOAuthModelSupported(pendingSelectedModelId)) {
      onError('OpenAI OAuth currently supports Codex models only (for example: gpt-5.2). Choose gpt-5.2 or use API key auth.');
      return;
    }

    try {
      const session = await startOpenAIDeviceAuth();
      setOpenAIOAuthDisplay({
        verificationUrl: session.verificationUrl,
        userCode: session.userCode,
      });
      setAppState('openai_oauth_wait');

      const controller = new AbortController();
      openAIOAuthAbortControllerRef.current = controller;

      const credentials = await pollOpenAIDeviceAuth(session, { signal: controller.signal });
      const saved = saveOpenAIOAuthCredentials(credentials);
      if (!saved) {
        throw new Error('Failed to save OpenAI OAuth credentials.');
      }

      setOpenAIAuthMode('oauth');
      completeModelSwitch('openai', pendingSelectedModelId);
    } catch (error) {
      if (isOpenAIOAuthCancelError(error)) {
        return;
      }
      onError(getErrorMessage(error));
      setOpenAIOAuthDisplay(null);
      setAppState('openai_auth_select');
    } finally {
      openAIOAuthAbortControllerRef.current = null;
    }
  }, [pendingProvider, pendingSelectedModelId, completeModelSwitch, resetPendingState, onError]);
  
  // API key confirmation handler
  const handleApiKeyConfirm = useCallback((wantsToSet: boolean) => {
    if (wantsToSet) {
      setAppState('api_key_input');
    } else {
      // Check if existing key is available
      if (pendingProvider && pendingSelectedModelId && checkApiKeyExistsForProvider(pendingProvider)) {
        completeModelSwitch(pendingProvider, pendingSelectedModelId);
      } else {
        onError(`Cannot use ${pendingProvider ? getProviderDisplayName(pendingProvider) : 'provider'} without an API key.`);
        resetPendingState();
      }
    }
  }, [pendingProvider, pendingSelectedModelId, completeModelSwitch, resetPendingState, onError]);
  
  // API key submit handler
  const handleApiKeySubmit = useCallback((apiKey: string | null) => {
    // Guard: ensure we have a selected model
    if (!pendingSelectedModelId) {
      onError('No model selected.');
      resetPendingState();
      return;
    }
    
    if (apiKey && pendingProvider) {
      const saved = saveApiKeyForProvider(pendingProvider, apiKey);
      if (saved) {
        if (pendingProvider === 'openai') {
          setOpenAIAuthMode('api_key');
        }
        completeModelSwitch(pendingProvider, pendingSelectedModelId);
      } else {
        onError('Failed to save API key.');
        resetPendingState();
      }
    } else if (!apiKey && pendingProvider && checkApiKeyExistsForProvider(pendingProvider)) {
      // Cancelled but existing key available
      completeModelSwitch(pendingProvider, pendingSelectedModelId);
    } else {
      onError('API key not set. Provider unchanged.');
      resetPendingState();
    }
  }, [pendingProvider, pendingSelectedModelId, completeModelSwitch, resetPendingState, onError]);
  
  return {
    selectionState: {
      appState,
      pendingProvider,
      pendingModels,
      openAIOAuthDisplay,
    },
    provider,
    model,
    inMemoryChatHistoryRef,
    startSelection,
    cancelSelection,
    handleProviderSelect,
    handleModelSelect,
    handleModelInputSubmit,
    handleOpenAIAuthMethodSelect,
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInSelectionFlow,
  };
}
