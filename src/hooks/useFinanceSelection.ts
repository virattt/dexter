import { useCallback, useMemo, useState } from 'react';
import { getSetting, setSetting } from '../utils/config.js';
import { checkApiKeyExists, saveApiKeyToEnv } from '../utils/env.js';
import {
  type FinanceProviderId,
  getFinanceProviderDef,
  getFinanceProviderDisplayName,
  isFinanceProviderId,
} from '../tools/finance/providers.js';

const SELECTION_STATES = ['provider_select', 'api_key_confirm', 'api_key_input'] as const;
type SelectionState = typeof SELECTION_STATES[number];
type AppState = 'idle' | SelectionState;

export interface FinanceSelectionState {
  appState: AppState;
  pendingProvider: FinanceProviderId | null;
}

export interface UseFinanceSelectionResult {
  selectionState: FinanceSelectionState;
  financeProvider: FinanceProviderId;

  startSelection: () => void;
  cancelSelection: () => void;
  handleProviderSelect: (providerId: FinanceProviderId | null) => void;
  handleApiKeyConfirm: (wantsToSet: boolean) => void;
  handleApiKeySubmit: (apiKey: string | null) => void;

  isInSelectionFlow: () => boolean;
  getPendingProviderName: () => string;
  getPendingProviderApiKeyName: () => string;
}

function isSelectionState(state: AppState): state is SelectionState {
  return (SELECTION_STATES as readonly string[]).includes(state);
}

function normalizeSavedProvider(value: unknown, fallback: FinanceProviderId): FinanceProviderId {
  if (typeof value === 'string' && isFinanceProviderId(value)) {
    return value;
  }
  return fallback;
}

export function useFinanceSelection(onError?: (error: string) => void): UseFinanceSelectionResult {
  const safeOnError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError],
  );

  const [financeProvider, setFinanceProvider] = useState<FinanceProviderId>(() =>
    normalizeSavedProvider(getSetting('financeProvider', 'auto'), 'auto'),
  );

  const [appState, setAppState] = useState<AppState>('idle');
  const [pendingProvider, setPendingProvider] = useState<FinanceProviderId | null>(null);

  const pendingApiKeyName = useMemo(() => {
    if (!pendingProvider || pendingProvider === 'auto') return '';
    return getFinanceProviderDef(pendingProvider).apiKeyEnvVar;
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

  const completeProviderSwitch = useCallback((providerId: FinanceProviderId) => {
    setFinanceProvider(providerId);
    setSetting('financeProvider', providerId);
    setPendingProvider(null);
    setAppState('idle');
  }, []);

  const handleProviderSelect = useCallback(
    (providerId: FinanceProviderId | null) => {
      if (!providerId) {
        resetPending();
        return;
      }

      if (!isFinanceProviderId(providerId)) {
        safeOnError('Invalid finance provider.');
        setAppState('provider_select');
        return;
      }

      if (providerId === 'auto') {
        completeProviderSwitch('auto');
        return;
      }

      const apiKeyEnvVar = getFinanceProviderDef(providerId).apiKeyEnvVar;
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

      const apiKeyEnvVar = getFinanceProviderDef(pendingProvider).apiKeyEnvVar;
      if (checkApiKeyExists(apiKeyEnvVar)) {
        completeProviderSwitch(pendingProvider);
        return;
      }

      safeOnError(`Cannot use ${getFinanceProviderDisplayName(pendingProvider)} without an API key.`);
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

      const apiKeyEnvVar = getFinanceProviderDef(pendingProvider).apiKeyEnvVar;

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
    if (pendingProvider) return getFinanceProviderDisplayName(pendingProvider);
    return getFinanceProviderDisplayName(financeProvider);
  }, [pendingProvider, financeProvider]);

  const getPendingProviderApiKeyName = useCallback((): string => pendingApiKeyName, [pendingApiKeyName]);

  return {
    selectionState: {
      appState,
      pendingProvider,
    },
    financeProvider,
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
