import { Container, Text, type TUI } from '@mariozechner/pi-tui';
import type { WorkingState } from '../types.js';
import { getRandomThinkingVerb } from '../utils/thinking-verbs.js';
import { theme } from '../theme.js';

export class WorkingIndicatorComponent extends Container {
  private readonly body: Text;
  private state: WorkingState = { status: 'idle' };
  private thinkingVerb = getRandomThinkingVerb();
  private prevStatus: WorkingState['status'] = 'idle';

  constructor(_tui: TUI) {
    super();
    this.body = new Text('', 0, 0);
    this.addChild(this.body);
    this.renderIdle();
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
      this.renderIdle();
      return;
    }
    this.renderBusy();
  }

  dispose() {}

  private renderIdle() {
    this.body.setText('');
  }

  private renderBusy() {
    if (this.state.status === 'idle') {
      this.body.setText('');
      return;
    }
    if (this.state.status === 'approval') {
      this.body.setText(theme.primary('… Waiting for approval... (esc to interrupt)'));
      return;
    }
    this.body.setText(theme.primary(`… ${this.thinkingVerb}... (esc to interrupt)`));
  }
}
