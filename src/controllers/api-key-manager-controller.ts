/**
 * ApiKeyManagerController — manages the in-app API key management flow.
 *
 * Triggered by the /keys command. Shows all configured and missing API keys
 * for LLM providers and data services, and lets the user add or update any key.
 *
 * Flow:
 *   1. provider_select — list of all keys with ✓/✗ status
 *   2. key_input       — text input for the selected key
 *   3. done            — brief confirmation before returning to list
 */

import { PROVIDERS } from '../providers.js';
import { checkApiKeyExists, saveApiKeyToEnv } from '../utils/env.js';

export interface ManagedKey {
  /** Label shown in the selector (e.g. "OpenAI") */
  label: string;
  /** The env var name (e.g. "OPENAI_API_KEY") */
  envVar: string;
  /** Whether a non-placeholder value is currently set */
  isSet: boolean;
}

export type ApiKeyManagerAppState = 'idle' | 'provider_select' | 'key_input' | 'done';

export interface ApiKeyManagerState {
  appState: ApiKeyManagerAppState;
  keys: ManagedKey[];
  selectedKey: ManagedKey | null;
  savedKeyLabel: string | null;
}

const EXTRA_KEYS: Array<{ label: string; envVar: string }> = [
  { label: 'Halal Terminal', envVar: 'HALAL_TERMINAL_API_KEY' },
  { label: 'Exa Search', envVar: 'EXASEARCH_API_KEY' },
  { label: 'Perplexity', envVar: 'PERPLEXITY_API_KEY' },
  { label: 'Tavily', envVar: 'TAVILY_API_KEY' },
  { label: 'X / Twitter', envVar: 'X_BEARER_TOKEN' },
];

function buildManagedKeys(): ManagedKey[] {
  const keys: ManagedKey[] = [];

  // LLM providers (skip Ollama — no API key)
  for (const provider of PROVIDERS) {
    if (!provider.apiKeyEnvVar) continue;
    keys.push({
      label: provider.displayName,
      envVar: provider.apiKeyEnvVar,
      isSet: checkApiKeyExists(provider.apiKeyEnvVar),
    });
  }

  // Data / search keys
  for (const extra of EXTRA_KEYS) {
    keys.push({
      label: extra.label,
      envVar: extra.envVar,
      isSet: checkApiKeyExists(extra.envVar),
    });
  }

  return keys;
}

export class ApiKeyManagerController {
  private _state: ApiKeyManagerState = {
    appState: 'idle',
    keys: [],
    selectedKey: null,
    savedKeyLabel: null,
  };
  private readonly onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  get state(): ApiKeyManagerState {
    return this._state;
  }

  isActive(): boolean {
    return this._state.appState !== 'idle';
  }

  /** Open the key manager — call when user types /keys */
  open(): void {
    this._state = {
      appState: 'provider_select',
      keys: buildManagedKeys(),
      selectedKey: null,
      savedKeyLabel: null,
    };
    this.onUpdate();
  }

  /** User selected a key from the list (null = cancel / close) */
  handleKeySelect(envVar: string | null): void {
    if (!envVar) {
      this._state = { ...this._state, appState: 'idle', selectedKey: null };
      this.onUpdate();
      return;
    }
    const key = this._state.keys.find((k) => k.envVar === envVar) ?? null;
    this._state = { ...this._state, appState: 'key_input', selectedKey: key };
    this.onUpdate();
  }

  /** User submitted a value in the key input (null = back to list) */
  handleKeySubmit(value: string | null): void {
    if (!value || !this._state.selectedKey) {
      // Go back to the list
      this._state = {
        ...this._state,
        appState: 'provider_select',
        keys: buildManagedKeys(),
        selectedKey: null,
      };
      this.onUpdate();
      return;
    }

    const label = this._state.selectedKey.label;
    saveApiKeyToEnv(this._state.selectedKey.envVar, value.trim());

    this._state = {
      ...this._state,
      appState: 'done',
      savedKeyLabel: label,
      selectedKey: null,
    };
    this.onUpdate();
  }

  /** Dismiss the "done" confirmation and return to the list */
  dismissDone(): void {
    this._state = {
      appState: 'provider_select',
      keys: buildManagedKeys(),
      selectedKey: null,
      savedKeyLabel: null,
    };
    this.onUpdate();
  }

  /** Close the manager entirely */
  close(): void {
    this._state = {
      appState: 'idle',
      keys: [],
      selectedKey: null,
      savedKeyLabel: null,
    };
    this.onUpdate();
  }
}
