import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import type { WorkingState } from '../types.js';
import { getRandomThinkingVerb } from '../utils/thinking-verbs.js';
import { theme } from '../theme.js';
import { subscribeSpinner, currentSpinnerFrame } from '../utils/spinner.js';

export class WorkingIndicatorComponent extends Container {
  private spacer: Spacer;
  private text: Text;
  private state: WorkingState = { status: 'idle' };
  private thinkingVerb = getRandomThinkingVerb();
  private prevStatus: WorkingState['status'] = 'idle';
  private unsubscribeSpinner: (() => void) | null = null;

  constructor(_tui: unknown) {
    super();
    this.spacer = new Spacer(0);
    this.text = new Text('', 0, 0);
    this.addChild(this.spacer);
    this.addChild(this.text);
  }

  setState(state: WorkingState) {
    const isThinking =
      state.status === 'thinking' || state.status === 'tool' || state.status === 'approval';
    const wasThinking =
      this.prevStatus === 'thinking' ||
      this.prevStatus === 'tool' ||
      this.prevStatus === 'approval';
    if (isThinking && !wasThinking) {
      this.thinkingVerb = getRandomThinkingVerb();
    }
    this.prevStatus = state.status;
    this.state = state;

    if (state.status === 'idle') {
      this.stopSpinner();
      this.spacer.setLines(0);
      this.text.setText('');
      return;
    }
    this.spacer.setLines(1);
    this.startSpinner();
    this.updateMessage(currentSpinnerFrame());
  }

  dispose() {
    this.stopSpinner();
  }

  private startSpinner() {
    if (this.unsubscribeSpinner) return;
    this.unsubscribeSpinner = subscribeSpinner((frame) => {
      this.updateMessage(frame);
    });
  }

  private stopSpinner() {
    if (this.unsubscribeSpinner) {
      this.unsubscribeSpinner();
      this.unsubscribeSpinner = null;
    }
  }

  private updateMessage(frame: string) {
    if (this.state.status === 'idle') {
      this.text.setText('');
      return;
    }
    const message = this.state.status === 'approval'
      ? 'Waiting for approval...'
      : `${this.thinkingVerb}...`;
    this.text.setText(` ${theme.primary(frame)} ${theme.primary(message)}`);
  }
}
