import { Container, Text } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';
import type { SlashCommand } from '../commands/index.js';

// Strip ANSI escape codes to get visible character count
function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * Contextual hint bar displayed below the input editor.
 * Shows keyboard shortcuts, slash command suggestions, and transient messages.
 * Supports left-aligned hints + right-aligned esc hints on a single line.
 */
export class HintBarComponent extends Container {
  private hintText: Text;
  private showingSuggestions: boolean = false;
  private leftHint: string = '';
  private rightHint: string = '';
  private currentHintMode: 'left' | 'right' | 'both' | 'none' = 'none';

  constructor() {
    super();
    this.hintText = new Text('', 0, 0);
    this.addChild(this.hintText);
  }

  private updateHintLine(): void {
    if (!this.leftHint && !this.rightHint) {
      this.currentHintMode = 'none';
      this.hintText.setText('');
      return;
    }
    if (this.rightHint && !this.leftHint) {
      this.currentHintMode = 'right';
      this.hintText.setText(this.rightHint);
      return;
    }
    if (this.leftHint && !this.rightHint) {
      this.currentHintMode = 'left';
      this.hintText.setText(this.leftHint);
      return;
    }
    // Both: placeholder, render() handles positioning
    this.currentHintMode = 'both';
    this.hintText.setText(this.leftHint);
  }

  render(width: number): string[] {
    if (this.showingSuggestions) {
      return super.render(width);
    }

    if (this.currentHintMode === 'none') {
      return [''];
    }

    if (this.currentHintMode === 'both') {
      const leftLen = visibleLength(this.leftHint);
      const rightLen = visibleLength(this.rightHint);
      const padding = Math.max(1, width - leftLen - rightLen);
      return [this.leftHint + ' '.repeat(padding) + this.rightHint];
    }

    if (this.currentHintMode === 'right') {
      const rightLen = visibleLength(this.rightHint);
      const padding = Math.max(0, width - rightLen);
      return [' '.repeat(padding) + this.rightHint];
    }

    return super.render(width);
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
   * Build contextual hints based on current app state.
   * Left side: general hints. Right side: esc action hints.
   */
  update(state: {
    isProcessing: boolean;
    hasPendingApproval: boolean;
    hasInput: boolean;
    escPendingClear: boolean;
    escPendingExit: boolean;
    queueLength: number;
  }): void {
    this.leftHint = '';
    this.rightHint = '';

    // Right-side esc hints (transient)
    if (state.escPendingClear) {
      this.rightHint = theme.muted('esc again to clear');
    } else if (state.escPendingExit) {
      this.rightHint = theme.muted('esc again to exit');
    }

    // Left-side contextual hints
    if (state.isProcessing) {
      const queueNote = state.queueLength > 0
        ? ` · ${state.queueLength} message${state.queueLength !== 1 ? 's' : ''} queued`
        : '';
      this.leftHint = theme.muted(` esc to interrupt${queueNote}`);
    } else if (state.hasPendingApproval) {
      this.leftHint = theme.muted(' enter to approve · esc to deny');
    } else if (!state.hasInput && !state.escPendingExit) {
      this.leftHint = theme.muted(' / for commands');
    }

    this.updateHintLine();
  }
}
