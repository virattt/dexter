import { getSetting, setSetting } from '../utils/config.js';
import {
  checkApiKeyExistsForProvider,
  getProviderDisplayName,
  saveApiKeyForProvider,
} from '../utils/env.js';
import {
  getDefaultModelForProvider,
  getModelsForProvider,
  type Model,
} from '../utils/model.js';
import { getOllamaModels } from '../utils/ollama.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../model/llm.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

const SELECTION_STATES = [
  'provider_select',
  'model_select',
  'model_input',
  'api_key_confirm',
  'api_key_input',
] as const;

export type SelectionState = (typeof SELECTION_STATES)[number];
export type AppState = 'idle' | SelectionState;

export interface ModelSelectionState {
  appState: AppState;
  pendingProvider: string | null;
  pendingModels: Model[];
}

type ChangeListener = () => void;

export class ModelSelectionController {
  private providerValue: string;
  private modelValue: string;
  private appStateValue: AppState = 'idle';
  private pendingProviderValue: string | null = null;
  private pendingModelsValue: Model[] = [];
  private pendingSelectedModelId: string | null = null;
  private readonly onError: (message: string) => void;
  private readonly onChange?: ChangeListener;
  private readonly chatHistory = new InMemoryChatHistory(DEFAULT_MODEL);

  constructor(onError: (message: string) => void, onChange?: ChangeListener) {
    this.onError = onError;
    this.onChange = onChange;
    this.providerValue = getSetting('provider', DEFAULT_PROVIDER);
    const savedModel = getSetting('modelId', null) as string | null;
    this.modelValue =
      savedModel ?? getDefaultModelForProvider(this.providerValue) ?? DEFAULT_MODEL;
    this.chatHistory.setModel(this.modelValue);
  }

  get state(): ModelSelectionState {
    return {
      appState: this.appStateValue,
      pendingProvider: this.pendingProviderValue,
      pendingModels: this.pendingModelsValue,
    };
  }

  get provider(): string {
    return this.providerValue;
  }

  get model(): string {
    return this.modelValue;
  }

  get inMemoryChatHistory(): InMemoryChatHistory {
    return this.chatHistory;
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

  async handleProviderSelect(providerId: string | null) {
    if (!providerId) {
      this.appStateValue = 'idle';
      this.emitChange();
      return;
    }

    this.pendingProviderValue = providerId;
    if (providerId === 'openrouter') {
      this.pendingModelsValue = [];
      this.appStateValue = 'model_input';
      this.emitChange();
      return;
    }

    if (providerId === 'ollama') {
      const ollamaModelIds = await getOllamaModels();
      this.pendingModelsValue = ollamaModelIds.map((id) => ({ id, displayName: id }));
      this.appStateValue = 'model_select';
      this.emitChange();
      return;
    }

    this.pendingModelsValue = getModelsForProvider(providerId);
    this.appStateValue = 'model_select';
    this.emitChange();
  }

  handleModelSelect(modelId: string | null) {
    if (!modelId || !this.pendingProviderValue) {
      this.pendingProviderValue = null;
      this.pendingModelsValue = [];
      this.pendingSelectedModelId = null;
      this.appStateValue = 'provider_select';
      this.emitChange();
      return;
    }

    if (this.pendingProviderValue === 'ollama') {
      this.completeModelSwitch(this.pendingProviderValue, `ollama:${modelId}`);
      return;
    }

    if (checkApiKeyExistsForProvider(this.pendingProviderValue)) {
      this.completeModelSwitch(this.pendingProviderValue, modelId);
      return;
    }

    this.pendingSelectedModelId = modelId;
    this.appStateValue = 'api_key_confirm';
    this.emitChange();
  }

  handleModelInputSubmit(modelName: string | null) {
    if (!modelName || !this.pendingProviderValue) {
      this.pendingProviderValue = null;
      this.pendingModelsValue = [];
      this.pendingSelectedModelId = null;
      this.appStateValue = 'provider_select';
      this.emitChange();
      return;
    }

    const fullModelId = `${this.pendingProviderValue}:${modelName}`;
    if (checkApiKeyExistsForProvider(this.pendingProviderValue)) {
      this.completeModelSwitch(this.pendingProviderValue, fullModelId);
      return;
    }

    this.pendingSelectedModelId = fullModelId;
    this.appStateValue = 'api_key_confirm';
    this.emitChange();
  }

  handleApiKeyConfirm(wantsToSet: boolean) {
    if (wantsToSet) {
      this.appStateValue = 'api_key_input';
      this.emitChange();
      return;
    }

    if (
      this.pendingProviderValue &&
      this.pendingSelectedModelId &&
      checkApiKeyExistsForProvider(this.pendingProviderValue)
    ) {
      this.completeModelSwitch(this.pendingProviderValue, this.pendingSelectedModelId);
      return;
    }

    this.onError(
      `Cannot use ${
        this.pendingProviderValue ? getProviderDisplayName(this.pendingProviderValue) : 'provider'
      } without an API key.`,
    );
    this.resetPendingState();
  }

  handleApiKeySubmit(apiKey: string | null) {
    if (!this.pendingSelectedModelId) {
      this.onError('No model selected.');
      this.resetPendingState();
      return;
    }

    if (apiKey && this.pendingProviderValue) {
      const saved = saveApiKeyForProvider(this.pendingProviderValue, apiKey);
      if (saved) {
        this.completeModelSwitch(this.pendingProviderValue, this.pendingSelectedModelId);
      } else {
        this.onError('Failed to save API key.');
        this.resetPendingState();
      }
      return;
    }

    if (
      !apiKey &&
      this.pendingProviderValue &&
      checkApiKeyExistsForProvider(this.pendingProviderValue)
    ) {
      this.completeModelSwitch(this.pendingProviderValue, this.pendingSelectedModelId);
      return;
    }

    this.onError('API key not set. Provider unchanged.');
    this.resetPendingState();
  }

  private completeModelSwitch(newProvider: string, newModelId: string) {
    this.providerValue = newProvider;
    this.modelValue = newModelId;
    setSetting('provider', newProvider);
    setSetting('modelId', newModelId);
    this.chatHistory.setModel(newModelId);
    this.pendingProviderValue = null;
    this.pendingModelsValue = [];
    this.pendingSelectedModelId = null;
    this.appStateValue = 'idle';
    this.emitChange();
  }

  private resetPendingState() {
    this.pendingProviderValue = null;
    this.pendingModelsValue = [];
    this.pendingSelectedModelId = null;
    this.appStateValue = 'idle';
    this.emitChange();
  }

  private emitChange() {
    this.onChange?.();
  }
}
