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
}
