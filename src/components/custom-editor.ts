import { Editor, Key, matchesKey } from '@mariozechner/pi-tui';

export class CustomEditor extends Editor {
  onEscape?: () => void;
  onCtrlC?: () => void;
  onSlashChange?: (text: string) => void;
  onSlashSelect?: () => void;
  onSlashNavigate?: (direction: 'up' | 'down') => void;
  onSlashDismiss?: () => void;
  slashActive: boolean = false;

  handleInput(data: string): void {
    const showingSuggestions = this.slashActive;

    // Esc: dismiss suggestions first, then existing behavior
    if (matchesKey(data, Key.escape)) {
      if (showingSuggestions) {
        this.slashActive = false;
        this.onSlashDismiss?.();
        return;
      }
      if (this.onEscape) {
        this.onEscape();
        return;
      }
    }

    // Arrow keys: navigate suggestions if active
    if (showingSuggestions && matchesKey(data, Key.up)) {
      this.onSlashNavigate?.('up');
      return;
    }
    if (showingSuggestions && matchesKey(data, Key.down)) {
      this.onSlashNavigate?.('down');
      return;
    }

    // Tab or Enter: select suggestion if active
    if (showingSuggestions && (matchesKey(data, Key.tab) || matchesKey(data, Key.enter))) {
      this.onSlashSelect?.();
      return;
    }

    if (matchesKey(data, Key.ctrl('c')) && this.onCtrlC) {
      this.onCtrlC();
      return;
    }

    // Default: pass to editor
    super.handleInput(data);

    // Check if slash mode should activate or deactivate
    const newText = this.getText();
    if (newText.startsWith('/')) {
      this.slashActive = true;
      this.onSlashChange?.(newText);
    } else if (this.slashActive) {
      this.slashActive = false;
      this.onSlashDismiss?.();
    }
  }
}
