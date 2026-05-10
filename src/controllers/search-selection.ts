import { getSetting, setSetting } from '../utils/config.js';

export type SearchProviderId = 'auto' | 'exa' | 'perplexity' | 'tavily';

export interface SearchSelectionState {
  appState: 'idle' | 'provider_select';
  preferredProvider: SearchProviderId;
}

type ChangeListener = () => void;

export class SearchSelectionController {
  private preferredProviderValue: SearchProviderId;
  private appStateValue: 'idle' | 'provider_select' = 'idle';
  private readonly onChange?: ChangeListener;

  constructor(onChange?: ChangeListener) {
    this.onChange = onChange;
    this.preferredProviderValue = (getSetting('webSearchPreferredProvider', 'auto') as SearchProviderId) ?? 'auto';
  }

  get state(): SearchSelectionState {
    return {
      appState: this.appStateValue,
      preferredProvider: this.preferredProviderValue,
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
    this.appStateValue = 'idle';
    this.emitChange();
  }

  handleProviderSelect(providerId: SearchProviderId | null) {
    if (!providerId) {
      this.appStateValue = 'idle';
      this.emitChange();
      return;
    }

    this.preferredProviderValue = providerId;
    setSetting('webSearchPreferredProvider', providerId === 'auto' ? null : providerId);
    this.appStateValue = 'idle';
    this.emitChange();
  }

  private emitChange() {
    this.onChange?.();
  }
}