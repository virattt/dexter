import { useState, useEffect } from 'react';
import { logger, LogEntry } from '../utils/logger.js';

export function useDebugLogs(): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    return logger.subscribe(setLogs);
  }, []);

  return logs;
}
