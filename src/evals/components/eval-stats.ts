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
  private exactPass = 0;
  private completed = 0;
  private averageScore = 0;
  private contradictions = 0;
  private failures = 0;
  private trackingErrors = 0;
  private startTime: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(tui: TUI) {
    super();
    this.tui = tui;
    this.statsText = new Text('', 0, 0);
    this.addChild(this.statsText);
  }

  setStats(stats: {
    exactPass: number;
    completed: number;
    averageScore: number;
    contradictions: number;
    failures: number;
    trackingErrors: number;
    startTime: number | null;
  }) {
    this.exactPass = stats.exactPass;
    this.completed = stats.completed;
    this.averageScore = stats.averageScore;
    this.contradictions = stats.contradictions;
    this.failures = stats.failures;
    this.trackingErrors = stats.trackingErrors;
    this.startTime = stats.startTime;
    this.refresh();
    if (stats.startTime === null) {
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
      `${theme.success(`✓ ${this.exactPass} exact`)}  ${theme.primary(
        `avg ${(this.averageScore * 100).toFixed(1)}%`,
      )}  ${theme.error(`fail ${this.failures}`)}  ${theme.error(
        `contr ${this.contradictions}`,
      )}  ${theme.muted(`track ${this.trackingErrors}`)}  ${theme.muted(`⏱ ${elapsed}`)}`,
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
