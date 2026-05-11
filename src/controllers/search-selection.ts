import { getSetting, setSetting } from '../utils/config.js';
import {
  checkApiKeyForSearchProvider,
  getSearchProviderDisplayName,
  saveApiKeyForSearchProvider,
  type SearchProviderId,
} from '../utils/env.js';

const SELECTION_STATES = ['provider_select', 'api_key_confirm', 'api_key_input'] as const;

export type SearchSelectionAppState = 'idle' | (typeof SELECTION_STATES)[number];

export interface SearchSelectionState {
  appState: SearchSelectionAppState;
  pendingProvider: SearchProviderId | null;
  preferredProvider: SearchProviderId;
}

type ChangeListener = () => void;

const DEFAULT_PREFERRED: SearchProviderId = 'exa';

export class SearchSelectionController {
  private preferredProviderValue: SearchProviderId;
  private pendingProviderValue: SearchProviderId | null = null;
  private appStateValue: SearchSelectionAppState = 'idle';
  private readonly onError: (message: string) => void;
  private readonly onChange?: ChangeListener;

  constructor(onError: (message: string) => void, onChange?: ChangeListener) {
    this.onError = onError;
    this.onChange = onChange;
    const saved = getSetting<SearchProviderId | undefined>('webSearchPreferredProvider', undefined);
    this.preferredProviderValue = saved ?? DEFAULT_PREFERRED;
  }

  get state(): SearchSelectionState {
    return {
      appState: this.appStateValue,
      pendingProvider: this.pendingProviderValue,
      preferredProvider: this.preferredProviderValue,
    };
  }

  get preferredProvider(): SearchProviderId {
    return this.preferredProviderValue;
  }

  isInSelectionFlow(): boolean {
    return this.appStateValue !== 'idle';
  }

  startSelection() {
    this.appStateValue = 'provider_select';
    this.pendingProviderValue = null;
    this.emitChange();
  }

  cancelSelection() {
    this.resetPendingState();
  }

  handleProviderSelect(providerId: SearchProviderId) {
    this.pendingProviderValue = providerId;

    if (checkApiKeyForSearchProvider(providerId)) {
      this.commitPreference(providerId);
      return;
    }

    this.appStateValue = 'api_key_confirm';
    this.emitChange();
  }

  handleApiKeyConfirm(wantsToSet: boolean) {
    if (!this.pendingProviderValue) {
      this.resetPendingState();
      return;
    }

    if (wantsToSet) {
      this.appStateValue = 'api_key_input';
      this.emitChange();
      return;
    }

    this.onError(
      `Cannot use ${getSearchProviderDisplayName(this.pendingProviderValue)} without an API key.`,
    );
    this.resetPendingState();
  }

  handleApiKeySubmit(apiKey: string | null) {
    if (!this.pendingProviderValue) {
      this.resetPendingState();
      return;
    }

    if (!apiKey) {
      this.onError(
        `${getSearchProviderDisplayName(this.pendingProviderValue)} API key not set. Preference unchanged.`,
      );
      this.resetPendingState();
      return;
    }

    const saved = saveApiKeyForSearchProvider(this.pendingProviderValue, apiKey);
    if (!saved) {
      this.onError('Failed to save API key.');
      this.resetPendingState();
      return;
    }

    const providerId = this.pendingProviderValue;
    const displayName = getSearchProviderDisplayName(providerId);
    this.commitPreference(providerId);

    if (providerId !== 'perplexity') {
      this.onError(`API key saved. Restart Dexter to use ${displayName}.`);
    }
  }

  private commitPreference(providerId: SearchProviderId) {
    this.preferredProviderValue = providerId;
    setSetting('webSearchPreferredProvider', providerId);
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
