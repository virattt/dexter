import { Container, Text } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';

export class EvalProgress extends Container {
  private readonly progressText: Text;

  constructor() {
    super();
    this.progressText = new Text('', 0, 0);
    this.addChild(this.progressText);
  }

  setProgress(completed: number, total: number) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const barWidth = 20;
    const filledWidth = total > 0 ? Math.round((completed / total) * barWidth) : 0;
    const emptyWidth = Math.max(0, barWidth - filledWidth);
    const filledBar = '█'.repeat(filledWidth);
    const emptyBar = '░'.repeat(emptyWidth);

    this.progressText.setText(
      `${theme.muted('Evaluating ')}${theme.primary(filledBar)}${theme.mutedDark(
        emptyBar,
      )}${theme.muted(` ${percentage}% `)}${theme.muted(`(${completed}/${total})`)}`,
    );
  }
}
