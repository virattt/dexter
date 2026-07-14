import { Container, Text } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';

export interface EvalResult {
  index: number;
  question: string;
  questionType: string;
  score: number | null;
  comment: string;
  failureType?: string;
  trackingError?: string;
  contradictionDetected: boolean;
  passedCriteria: number;
  totalCriteria: number;
  latencyMs: number;
}

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

export class EvalRecentResults extends Container {
  setResults(results: EvalResult[], maxDisplay = 5) {
    this.clear();
    if (results.length === 0) {
      return;
    }

    this.addChild(new Text(theme.muted('Recent:'), 0, 0));
    const recentResults = results.slice(-maxDisplay);

    for (const result of recentResults) {
      const hasFailure = Boolean(result.failureType);
      const score = result.score === null ? 'n/a' : `${Math.round(result.score * 100)}%`;
      const icon = hasFailure ? '!' : result.score === 1 ? '✓' : result.contradictionDetected ? '✗' : '~';
      const color = hasFailure
        ? theme.error
        : result.score === 1
          ? theme.success
          : result.contradictionDetected
            ? theme.error
            : theme.primary;
      this.addChild(
        new Text(
          `${color(icon)} ${theme.muted(`[${score}]`)} ${truncateAtWord(result.question, 54)}`,
          0,
          0,
        ),
      );
    }
  }
}
