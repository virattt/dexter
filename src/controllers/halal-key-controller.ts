/**
 * HalalKeyController — manages the Halal Terminal API key setup flow.
 *
 * On startup, if HALAL_TERMINAL_API_KEY is not set, this controller drives
 * a short setup wizard:
 *   1. Confirm screen — "Set up Halal Terminal (free)?"
 *   2. Email input   — "Enter your email to generate a free key"
 *   3. Generating    — calls POST /api/keys/generate
 *   4. Done / Error  — saves key to .env and returns to main app
 */

import { checkApiKeyExists, saveApiKeyToEnv } from '../utils/env.js';

export type HalalKeyState =
  | 'confirm'      // Ask user if they want to set up Halal Terminal
  | 'email_input'  // Ask for email address
  | 'generating'   // API call in progress
  | 'done'         // Key saved successfully
  | 'error'        // API call failed
  | 'skipped';     // User declined

export interface HalalKeyControllerState {
  appState: HalalKeyState;
  errorMessage?: string;
  generatedKey?: string;
}

const HALAL_API_KEY_NAME = 'HALAL_TERMINAL_API_KEY';
const GENERATE_URL = 'https://api.halalterminal.com/api/keys/generate';

export class HalalKeyController {
  private _state: HalalKeyControllerState = { appState: 'skipped' };
  private readonly onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  /** Returns true if setup is needed and the wizard should be shown. */
  startIfNeeded(): boolean {
    if (checkApiKeyExists(HALAL_API_KEY_NAME)) {
      return false;
    }
    this._state = { appState: 'confirm' };
    return true;
  }

  get state(): HalalKeyControllerState {
    return this._state;
  }

  /** Whether the wizard is active (not yet skipped, errored-out, or done). */
  isActive(): boolean {
    return this._state.appState === 'confirm'
      || this._state.appState === 'email_input'
      || this._state.appState === 'generating';
  }

  /** User chose Yes/No on the confirm screen. */
  handleConfirm(wantsToSetUp: boolean): void {
    if (!wantsToSetUp) {
      this._state = { appState: 'skipped' };
    } else {
      this._state = { appState: 'email_input' };
    }
    this.onUpdate();
  }

  /** User submitted their email (null = cancelled). */
  async handleEmailSubmit(email: string | null): Promise<void> {
    if (!email) {
      this._state = { appState: 'skipped' };
      this.onUpdate();
      return;
    }

    this._state = { appState: 'generating' };
    this.onUpdate();

    try {
      const response = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = (body as { message?: string }).message ?? `${response.status} ${response.statusText}`;
        throw new Error(detail);
      }

      const data = await response.json() as { api_key: string };
      const apiKey = data.api_key;

      saveApiKeyToEnv(HALAL_API_KEY_NAME, apiKey);

      this._state = { appState: 'done', generatedKey: apiKey };
      this.onUpdate();
    } catch (err) {
      this._state = {
        appState: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
      this.onUpdate();
    }
  }

  /** Dismiss error and return to email input to retry. */
  retryFromError(): void {
    this._state = { appState: 'email_input' };
    this.onUpdate();
  }

  /** Dismiss done/error screen and continue to main app. */
  dismiss(): void {
    this._state = { appState: 'skipped' };
    this.onUpdate();
  }
}
