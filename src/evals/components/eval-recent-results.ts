import { Container, Text } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';

export interface EvalResult {
  question: string;
  score: number;
  comment: string;
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
      const isCorrect = result.score === 1;
      const icon = isCorrect ? '✓' : '✗';
      const color = isCorrect ? theme.success : theme.error;
      this.addChild(new Text(`${color(icon)} ${truncateAtWord(result.question, 60)}`, 0, 0));
    }
  }
}
