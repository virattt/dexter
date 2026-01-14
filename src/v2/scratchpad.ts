import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface ScratchpadEntry {
  type: 'init' | 'tool_result' | 'thinking';
  content: string;
  timestamp: string;
}

/**
 * Append-only scratchpad for tracking agent work on a query.
 * Uses JSONL format (newline-delimited JSON) for resilient appending.
 * Files are persisted in .dexter/scratchpad/ for debugging/history.
 */
export class Scratchpad {
  private readonly scratchpadDir = '.dexter/scratchpad';
  private readonly filepath: string;

  constructor(query: string) {
    if (!existsSync(this.scratchpadDir)) {
      mkdirSync(this.scratchpadDir, { recursive: true });
    }

    const hash = createHash('md5').update(query).digest('hex').slice(0, 12);
    const timestamp = Date.now();
    this.filepath = join(this.scratchpadDir, `${hash}_${timestamp}.jsonl`);

    // Write initial entry with the query
    this.append({ type: 'init', content: query, timestamp: new Date().toISOString() });
  }

  /**
   * Append a tool result entry
   */
  addToolEntry(summary: string): void {
    this.append({ type: 'tool_result', content: summary, timestamp: new Date().toISOString() });
  }

  /**
   * Append thinking/reasoning
   */
  addThinking(thought: string): void {
    this.append({ type: 'thinking', content: thought, timestamp: new Date().toISOString() });
  }

  /**
   * Get all tool summaries for building the iteration prompt
   */
  getToolSummaries(): string[] {
    return this.readEntries()
      .filter(e => e.type === 'tool_result')
      .map(e => e.content);
  }

  /**
   * Append-only write
   */
  private append(entry: ScratchpadEntry): void {
    appendFileSync(this.filepath, JSON.stringify(entry) + '\n');
  }

  /**
   * Read all entries from the log
   */
  private readEntries(): ScratchpadEntry[] {
    if (!existsSync(this.filepath)) {
      return [];
    }

    return readFileSync(this.filepath, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as ScratchpadEntry);
  }
}
