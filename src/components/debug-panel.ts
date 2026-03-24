import { Box, Container, Text } from '@mariozechner/pi-tui';
import { logger, type LogEntry, type LogLevel } from '../utils/logger.js';
import { theme } from '../theme.js';

const LEVEL_COLORS: Record<LogLevel, (text: string) => string> = {
  debug: theme.mutedDark,
  info: theme.info,
  warn: theme.warning,
  error: theme.error,
};

export class DebugPanelComponent extends Container {
  private readonly box: Box;
  private readonly maxLines: number;
  private readonly show: boolean;
  private logs: LogEntry[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(maxLines = 8, show = true) {
    super();
    this.maxLines = maxLines;
    this.show = show;
    this.box = new Box(1, 0, () => '');
    this.addChild(this.box);
    this.unsubscribe = logger.subscribe((entries) => {
      this.logs = entries;
      this.refresh();
    });
    this.refresh();
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private refresh() {
    this.box.clear();
    if (!this.show || this.logs.length === 0) {
      return;
    }

    this.box.addChild(new Text(theme.dim('─ Debug ─'), 0, 0));
    const displayLogs = this.logs.slice(-this.maxLines);
    for (const entry of displayLogs) {
      const level = `[${entry.level.toUpperCase().padEnd(5)}]`;
      const prefix = LEVEL_COLORS[entry.level](level);
      const data = entry.data !== undefined ? ` ${theme.mutedDark(JSON.stringify(entry.data))}` : '';
      this.box.addChild(new Text(`${prefix} ${entry.message}${data}`, 0, 0));
    }
  }
}
