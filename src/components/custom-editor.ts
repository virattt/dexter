import { Editor, Key, matchesKey } from '@mariozechner/pi-tui';

export class CustomEditor extends Editor {
  onEscape?: () => void;
  onCtrlC?: () => void;
  onSlashChange?: (text: string) => void;
  onSlashSelect?: () => void;
  onSlashNavigate?: (direction: 'up' | 'down') => void;
  onSlashDismiss?: () => void;
  slashActive: boolean = false;

  // Map truncated display text → full original text for history entries
  private historyFullText = new Map<string, string>();

  /**
   * Add to history with truncation for display. Full text is preserved
   * and restored when the user submits a history entry.
   */
  addToHistoryWithTruncation(text: string): void {
    const lines = text.split('\n');
    if (lines.length <= 3) {
      super.addToHistory(text);
      return;
    }
    const firstLine = lines[0].trim() || lines[1]?.trim() || 'pasted content';
    const preview = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
    const truncated = `${preview} [+${lines.length - 1} lines]`;
    this.historyFullText.set(truncated, text);
    super.addToHistory(truncated);
  }

  /**
   * Get the full text for the given content, expanding truncated
   * history entries back to their original.
   */
  getFullText(text?: string): string {
    const t = text ?? this.getText();
    return this.historyFullText.get(t) ?? this.historyFullText.get(t.trim()) ?? t;
  }

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
