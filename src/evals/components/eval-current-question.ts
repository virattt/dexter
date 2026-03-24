import { Container, Loader, type TUI } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';

function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.5) {
    return `${str.slice(0, lastSpace)}...`;
  }
  return `${str.slice(0, maxLength)}...`;
}

export class EvalCurrentQuestion extends Container {
  private readonly tui: TUI;
  private loader: Loader | null = null;

  constructor(tui: TUI) {
    super();
    this.tui = tui;
  }

  setQuestion(question: string | null) {
    if (!question) {
      this.clearLoader();
      return;
    }
    this.ensureLoader();
    this.loader?.setMessage(truncateAtWord(question, 65));
  }

  dispose() {
    this.clearLoader();
  }

  private ensureLoader() {
    if (this.loader) {
      return;
    }
    this.loader = new Loader(
      this.tui,
      (spinner) => theme.primary(spinner),
      (text) => text,
      '',
    );
    this.addChild(this.loader);
  }

  private clearLoader() {
    if (!this.loader) {
      this.clear();
      return;
    }
    this.loader.stop();
    this.loader = null;
    this.clear();
  }
}
