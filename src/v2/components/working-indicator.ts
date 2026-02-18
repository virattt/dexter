import { Container, Loader, type TUI } from '@mariozechner/pi-tui';
import type { WorkingState } from '../types.js';
import { getRandomThinkingVerb } from '../../utils/thinking-verbs.js';
import { theme } from '../theme.js';

export class WorkingIndicatorComponent extends Container {
  private readonly tui: TUI;
  private loader: Loader | null = null;
  private timer: NodeJS.Timeout | null = null;
  private state: WorkingState = { status: 'idle' };
  private thinkingVerb = getRandomThinkingVerb();
  private prevStatus: WorkingState['status'] = 'idle';

  constructor(tui: TUI) {
    super();
    this.tui = tui;
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
      this.stopTimer();
      this.stopLoader();
      this.renderIdle();
      return;
    }
    this.renderBusy();
  }

  dispose() {
    this.stopTimer();
    this.stopLoader();
  }

  private renderIdle() {
    this.clear();
  }

  private renderBusy() {
    this.clear();
    this.ensureLoader();
    this.updateMessage();
    if (this.state.status === 'answering') {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  private ensureLoader() {
    if (this.loader) {
      this.addChild(this.loader);
      return;
    }
    this.loader = new Loader(
      this.tui,
      (spinner) => theme.primary(spinner),
      (text) => theme.primary(text),
      '',
    );
    this.addChild(this.loader);
  }

  private stopLoader() {
    if (!this.loader) {
      return;
    }
    this.loader.stop();
    this.loader = null;
  }

  private startTimer() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.updateMessage();
      this.tui.requestRender();
    }, 1000);
  }

  private stopTimer() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  private updateMessage() {
    if (!this.loader || this.state.status === 'idle') {
      return;
    }
    if (this.state.status === 'approval') {
      this.loader.setMessage('Waiting for approval... (esc to interrupt)');
      return;
    }
    if (this.state.status === 'answering') {
      const elapsed = Math.floor((Date.now() - this.state.startTime) / 1000);
      this.loader.setMessage(`Answering (${elapsed}s, esc to interrupt)`);
      return;
    }
    this.loader.setMessage(`${this.thinkingVerb}... (esc to interrupt)`);
  }
}
