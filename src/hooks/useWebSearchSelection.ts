import { useCallback, useMemo, useState } from 'react';
import { getSetting, setSetting } from '../utils/config.js';
import { checkApiKeyExists, saveApiKeyToEnv } from '../utils/env.js';
import {
  type WebSearchProviderId,
  getWebSearchProviderDef,
  getWebSearchProviderDisplayName,
  isWebSearchProviderId,
} from '../tools/search/providers.js';

const SELECTION_STATES = ['provider_select', 'api_key_confirm', 'api_key_input'] as const;
type SelectionState = typeof SELECTION_STATES[number];
type AppState = 'idle' | SelectionState;

export interface WebSearchSelectionState {
  appState: AppState;
  pendingProvider: WebSearchProviderId | null;
}

export interface UseWebSearchSelectionResult {
  selectionState: WebSearchSelectionState;
  webSearchProvider: WebSearchProviderId;

  startSelection: () => void;
  cancelSelection: () => void;
  handleProviderSelect: (providerId: WebSearchProviderId | null) => void;
  handleApiKeyConfirm: (wantsToSet: boolean) => void;
  handleApiKeySubmit: (apiKey: string | null) => void;

  isInSelectionFlow: () => boolean;
  getPendingProviderName: () => string;
  getPendingProviderApiKeyName: () => string;
}

function isSelectionState(state: AppState): state is SelectionState {
  return (SELECTION_STATES as readonly string[]).includes(state);
}

function normalizeSavedProvider(value: unknown, fallback: WebSearchProviderId): WebSearchProviderId {
  if (typeof value === 'string' && isWebSearchProviderId(value)) {
    return value;
  }
  return fallback;
}

export function useWebSearchSelection(onError?: (error: string) => void): UseWebSearchSelectionResult {
  const safeOnError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError],
  );

  const [webSearchProvider, setWebSearchProvider] = useState<WebSearchProviderId>(() =>
    normalizeSavedProvider(getSetting('webSearchProvider', 'auto'), 'auto'),
  );

  const [appState, setAppState] = useState<AppState>('idle');
  const [pendingProvider, setPendingProvider] = useState<WebSearchProviderId | null>(null);

  const pendingApiKeyName = useMemo(() => {
    if (!pendingProvider || pendingProvider === 'auto') return '';
    return getWebSearchProviderDef(pendingProvider).apiKeyEnvVar;
  }, [pendingProvider]);

  const resetPending = useCallback(() => {
    setPendingProvider(null);
    setAppState('idle');
  }, []);

  const startSelection = useCallback(() => {
    setPendingProvider(null);
    setAppState('provider_select');
  }, []);

  const cancelSelection = useCallback(() => {
    resetPending();
  }, [resetPending]);

  const isInSelectionFlow = useCallback(() => isSelectionState(appState), [appState]);

  const completeProviderSwitch = useCallback((providerId: WebSearchProviderId) => {
    setWebSearchProvider(providerId);
    setSetting('webSearchProvider', providerId);
    setPendingProvider(null);
    setAppState('idle');
  }, []);

  const handleProviderSelect = useCallback(
    (providerId: WebSearchProviderId | null) => {
      if (!providerId) {
        resetPending();
        return;
      }

      if (!isWebSearchProviderId(providerId)) {
        safeOnError('Invalid web search provider.');
        setAppState('provider_select');
        return;
      }

      if (providerId === 'auto') {
        completeProviderSwitch('auto');
        return;
      }

      const apiKeyEnvVar = getWebSearchProviderDef(providerId).apiKeyEnvVar;
      if (checkApiKeyExists(apiKeyEnvVar)) {
        completeProviderSwitch(providerId);
        return;
      }

      setPendingProvider(providerId);
      setAppState('api_key_confirm');
    },
    [completeProviderSwitch, resetPending, safeOnError],
  );

  const handleApiKeyConfirm = useCallback(
    (wantsToSet: boolean) => {
      if (!pendingProvider || pendingProvider === 'auto') {
        resetPending();
        return;
      }

      if (wantsToSet) {
        setAppState('api_key_input');
        return;
      }

      const apiKeyEnvVar = getWebSearchProviderDef(pendingProvider).apiKeyEnvVar;
      if (checkApiKeyExists(apiKeyEnvVar)) {
        completeProviderSwitch(pendingProvider);
        return;
      }

      safeOnError(`Cannot use ${getWebSearchProviderDisplayName(pendingProvider)} without an API key.`);
      setPendingProvider(null);
      setAppState('provider_select');
    },
    [pendingProvider, completeProviderSwitch, resetPending, safeOnError],
  );

  const handleApiKeySubmit = useCallback(
    (apiKey: string | null) => {
      if (!pendingProvider || pendingProvider === 'auto') {
        resetPending();
        return;
      }

      const apiKeyEnvVar = getWebSearchProviderDef(pendingProvider).apiKeyEnvVar;

      if (apiKey && apiKey.trim()) {
        const saved = saveApiKeyToEnv(apiKeyEnvVar, apiKey.trim());
        if (saved) {
          completeProviderSwitch(pendingProvider);
        } else {
          safeOnError('Failed to save API key.');
          setPendingProvider(null);
          setAppState('provider_select');
        }
        return;
      }

      // Cancelled: allow switching only if key already exists.
      if (checkApiKeyExists(apiKeyEnvVar)) {
        completeProviderSwitch(pendingProvider);
      } else {
        setPendingProvider(null);
        setAppState('provider_select');
      }
    },
    [pendingProvider, completeProviderSwitch, resetPending, safeOnError],
  );

  const getPendingProviderName = useCallback((): string => {
    if (pendingProvider) return getWebSearchProviderDisplayName(pendingProvider);
    return getWebSearchProviderDisplayName(webSearchProvider);
  }, [pendingProvider, webSearchProvider]);

  const getPendingProviderApiKeyName = useCallback((): string => pendingApiKeyName, [pendingApiKeyName]);

  return {
    selectionState: {
      appState,
      pendingProvider,
    },
    webSearchProvider,
    startSelection,
    cancelSelection,
    handleProviderSelect,
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInSelectionFlow,
    getPendingProviderName,
    getPendingProviderApiKeyName,
  };
}
