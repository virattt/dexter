import { getSetting, setSetting } from '../utils/config.js';
import {
  checkSearchApiKeyExists,
  getSearchProviderDisplayName,
  saveSearchApiKey,
} from '../utils/env.js';

export type SearchProviderId = 'auto' | 'exa' | 'perplexity' | 'tavily';

export interface SearchSelectionState {
  appState: 'idle' | 'provider_select' | 'api_key_confirm' | 'api_key_input';
  preferredProvider: SearchProviderId;
  pendingProvider: string | null;
}

type ErrorListener = (message: string) => void;
type ChangeListener = () => void;

export class SearchSelectionController {
  private preferredProviderValue: SearchProviderId;
  private appStateValue: 'idle' | 'provider_select' | 'api_key_confirm' | 'api_key_input' = 'idle';
  private pendingProviderValue: string | null = null;
  private readonly onError: ErrorListener;
  private readonly onChange?: ChangeListener;

  constructor(onError: ErrorListener, onChange?: ChangeListener) {
    this.onError = onError;
    this.onChange = onChange;
    this.preferredProviderValue = (getSetting('webSearchPreferredProvider', 'auto') as SearchProviderId) ?? 'auto';
  }

  get state(): SearchSelectionState {
    return {
      appState: this.appStateValue,
      preferredProvider: this.preferredProviderValue,
      pendingProvider: this.pendingProviderValue,
    };
  }

  isInSelectionFlow(): boolean {
    return this.appStateValue !== 'idle';
  }

  startSelection() {
    this.appStateValue = 'provider_select';
    this.emitChange();
  }

  cancelSelection() {
    this.resetPendingState();
  }

  handleProviderSelect(providerId: string | null) {
    if (!providerId || providerId === 'auto') {
      this.preferredProviderValue = 'auto';
      setSetting('webSearchPreferredProvider', null);
      this.appStateValue = 'idle';
      this.emitChange();
      return;
    }

    this.pendingProviderValue = providerId;

    if (checkSearchApiKeyExists(providerId)) {
      this.preferredProviderValue = providerId as SearchProviderId;
      setSetting('webSearchPreferredProvider', providerId);
      this.appStateValue = 'idle';
      this.emitChange();
      return;
    }

    this.appStateValue = 'api_key_confirm';
    this.emitChange();
  }

  handleApiKeyConfirm(wantsToSet: boolean) {
    if (wantsToSet) {
      this.appStateValue = 'api_key_input';
      this.emitChange();
      return;
    }

    if (this.pendingProviderValue && checkSearchApiKeyExists(this.pendingProviderValue)) {
      this.preferredProviderValue = this.pendingProviderValue as SearchProviderId;
      setSetting('webSearchPreferredProvider', this.pendingProviderValue);
      this.resetPendingState();
      return;
    }

    this.onError(
      `Cannot use ${
        this.pendingProviderValue ? getSearchProviderDisplayName(this.pendingProviderValue) : 'provider'
      } without an API key.`,
    );
    this.resetPendingState();
  }

  handleApiKeySubmit(apiKey: string | null) {
    if (apiKey && this.pendingProviderValue) {
      const saved = saveSearchApiKey(this.pendingProviderValue, apiKey);
      if (saved) {
        this.preferredProviderValue = this.pendingProviderValue as SearchProviderId;
        setSetting('webSearchPreferredProvider', this.pendingProviderValue);
        this.resetPendingState();
      } else {
        this.onError('Failed to save API key.');
        this.resetPendingState();
      }
      return;
    }

    if (!apiKey && this.pendingProviderValue && checkSearchApiKeyExists(this.pendingProviderValue)) {
      this.preferredProviderValue = this.pendingProviderValue as SearchProviderId;
      setSetting('webSearchPreferredProvider', this.pendingProviderValue);
      this.resetPendingState();
      return;
    }

    this.onError('API key not set. Provider unchanged.');
    this.resetPendingState();
  }

  private resetPendingState() {
    this.pendingProviderValue = null;
    this.appStateValue = 'idle';
    this.emitChange();
  }

  private emitChange() {
    this.onChange?.();
  }
}
