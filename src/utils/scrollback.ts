import type { HistoryItem } from '../types.js';
import { theme } from '../theme.js';
import { formatResponse } from './markdown-table.js';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

/**
 * Format a completed exchange as plain ANSI text for the terminal scrollback buffer.
 * Renders the user query, full answer (with markdown tables / bold), and timing stats.
 */
export function formatExchangeForScrollback(item: HistoryItem): string {
  const lines: string[] = [];

  // User query — match UserQueryComponent styling
  lines.push('');
  lines.push(theme.queryBg(theme.white(`❯ ${item.query} `)));
  lines.push('');

  // Answer
  if (item.answer?.trim()) {
    const formatted = formatResponse(item.answer.trim());
    lines.push(`${theme.primary('⏺ ')}${formatted}`);
  } else if (item.status === 'interrupted') {
    lines.push(theme.muted('  ⎿  Interrupted'));
  } else if (item.status === 'error') {
    lines.push(theme.error('  ⎿  Error — see above for details'));
  }

  // Performance footer
  if (item.duration != null) {
    lines.push('');
    lines.push(theme.muted(`✻ ${formatDuration(item.duration)}`));
  }

  lines.push('');
  return lines.join('\n');
}
