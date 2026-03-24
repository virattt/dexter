import { Container, Text, type TUI } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';

function formatElapsed(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export class EvalStats extends Container {
  private readonly tui: TUI;
  private readonly statsText: Text;
  private correct = 0;
  private incorrect = 0;
  private startTime: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(tui: TUI) {
    super();
    this.tui = tui;
    this.statsText = new Text('', 0, 0);
    this.addChild(this.statsText);
  }

  setStats(correct: number, incorrect: number, startTime: number | null) {
    this.correct = correct;
    this.incorrect = incorrect;
    this.startTime = startTime;
    this.refresh();
    if (startTime === null) {
      this.stopTimer();
      return;
    }
    this.ensureTimer();
  }

  dispose() {
    this.stopTimer();
  }

  private refresh() {
    const elapsed = this.startTime === null ? '0s' : formatElapsed(this.startTime);
    this.statsText.setText(
      `${theme.success(`✓ ${this.correct} correct`)}  ${theme.error(
        `✗ ${this.incorrect} incorrect`,
      )}  ${theme.muted(`⏱ ${elapsed}`)}`,
    );
  }

  private ensureTimer() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.refresh();
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
}
