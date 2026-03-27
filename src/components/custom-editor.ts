import { Editor, Key, matchesKey } from '@mariozechner/pi-tui';

export class CustomEditor extends Editor {
  onEscape?: () => void;
  onCtrlC?: () => void;

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) && this.onEscape) {
      this.onEscape();
      return;
    }
    if (matchesKey(data, Key.ctrl('c')) && this.onCtrlC) {
      this.onCtrlC();
      return;
    }
    super.handleInput(data);
  }

  /**
   * Override setText to clear autocomplete state first.
   * Pi-tui's built-in submit handler clears the editor but does not call
   * cancelAutocomplete(), so if autocomplete was showing when the user pressed
   * Enter the dropdown state persists into the next message. Clearing it here
   * (called from onSubmit after submit) ensures a clean slate.
   */
  setText(text: string): void {
    (this as unknown as { cancelAutocomplete: () => void }).cancelAutocomplete?.();
    super.setText(text);
  }
}
