type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
}

type LogSubscriber = (logs: LogEntry[]) => void;

class DebugLogger {
  private logs: LogEntry[] = [];
  private subscribers: Set<LogSubscriber> = new Set();
  private maxLogs = 50;

  private emit() {
    this.subscribers.forEach(fn => fn([...this.logs]));
  }

  private add(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      level,
      message,
      timestamp: new Date(),
      data,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.emit();
  }

  debug(message: string, data?: unknown) {
    this.add('debug', message, data);
  }

  info(message: string, data?: unknown) {
    this.add('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.add('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.add('error', message, data);
  }

  subscribe(fn: LogSubscriber): () => void {
    this.subscribers.add(fn);
    fn([...this.logs]); // Send current logs immediately
    return () => this.subscribers.delete(fn);
  }

  clear() {
    this.logs = [];
    this.emit();
  }
}

// Singleton instance
export const logger = new DebugLogger();
export type { LogEntry, LogLevel };
