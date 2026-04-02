import { Container, Text } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';
import type { SlashCommand } from '../commands/index.js';

/**
 * Contextual hint bar displayed below the input editor.
 * Shows keyboard shortcuts, slash command suggestions, and transient messages.
 * Expands to multiple lines when showing command suggestions.
 */
export class HintBarComponent extends Container {
  private hintText: Text;
  private showingSuggestions: boolean = false;

  constructor() {
    super();
    this.hintText = new Text('', 0, 0);
    this.addChild(this.hintText);
  }

  setHint(text: string): void {
    this.hintText.setText(text ? theme.muted(`  ${text}`) : '');
  }

  /**
   * Show slash command suggestions. Expands the hint bar to multiple lines.
   */
  setSuggestions(commands: SlashCommand[], selectedIndex: number): void {
    this.clear();
    this.showingSuggestions = true;
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? theme.primary('> ') : '  ';
      const name = isSelected ? theme.primary(`/${cmd.name}`) : theme.muted(`/${cmd.name}`);
      const desc = theme.muted(` — ${cmd.description}`);
      this.addChild(new Text(`${prefix}${name}${desc}`, 0, 0));
    }
  }

  /**
   * Hide suggestions and restore the normal single-line hint.
   */
  clearSuggestions(): void {
    if (!this.showingSuggestions) return;
    this.showingSuggestions = false;
    this.clear();
    this.addChild(this.hintText);
  }

  /**
   * Build a contextual hint based on current app state.
   */
  update(state: {
    isProcessing: boolean;
    hasPendingApproval: boolean;
    hasInput: boolean;
    escPendingClear: boolean;
    escPendingExit: boolean;
    queueLength: number;
  }): void {
    if (state.escPendingClear) {
      this.setHint('esc again to clear');
      return;
    }

    if (state.escPendingExit) {
      this.setHint('esc again to exit');
      return;
    }

    if (state.isProcessing) {
      const queueNote = state.queueLength > 0
        ? ` · ${state.queueLength} message${state.queueLength !== 1 ? 's' : ''} queued`
        : '';
      this.setHint(`esc to interrupt${queueNote}`);
      return;
    }

    if (state.hasPendingApproval) {
      this.setHint('enter to approve · esc to deny');
      return;
    }

    if (!state.hasInput) {
      this.setHint('/ for commands · esc to exit');
      return;
    }

    this.setHint('');
  }
}
