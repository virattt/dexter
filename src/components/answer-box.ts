import { Container, Markdown, Spacer } from '@mariozechner/pi-tui';
import { formatResponse } from '../utils/markdown-table.js';
import { markdownTheme, theme } from '../theme.js';

export class AnswerBoxComponent extends Container {
  private readonly body: Markdown;
  private value = '';
  private streaming = false;

  constructor(initialText = '') {
    super();
    this.addChild(new Spacer(1));
    this.body = new Markdown('', 0, 0, markdownTheme, { color: (line) => line });
    this.addChild(this.body);
    this.setText(initialText);
  }

  setText(text: string) {
    this.value = text;
    const rendered = formatResponse(text);
    // Prevent "⏺" from appearing on its own line when model output starts with newlines.
    const normalized = rendered.replace(/^\n+/, '');
    const value = this.streaming ? `${normalized}▌` : normalized;
    this.body.setText(`${theme.primary('⏺ ')}${value}`);
  }

  setStreaming(streaming: boolean) {
    this.streaming = streaming;
    this.setText(this.value);
  }
}
