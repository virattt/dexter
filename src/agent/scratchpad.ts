import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Record of a tool call for external consumers (e.g., DoneEvent)
 */
export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

/**
 * Full context data for final answer generation
 */
export interface ToolContext {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
}

/**
 * Tool context with LLM summary for selective inclusion.
 * Used when context exceeds token budget and LLM must select relevant results.
 */
export interface ToolContextWithSummary extends ToolContext {
  llmSummary: string;
  index: number; // For LLM to reference when selecting
}

export interface ScratchpadEntry {
  type: 'init' | 'tool_result' | 'thinking';
  timestamp: string;
  // For init/thinking:
  content?: string;
  // For tool_result:
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown; // Stored as parsed object when possible, string otherwise
  llmSummary?: string;
}

/**
 * Append-only scratchpad for tracking agent work on a query.
 * Uses JSONL format (newline-delimited JSON) for resilient appending.
 * Files are persisted in .dexter/scratchpad/ for debugging/history.
 * 
 * This is the single source of truth for all agent work on a query.
 */
export class Scratchpad {
  private readonly scratchpadDir = '.dexter/scratchpad';
  private readonly filepath: string;

  constructor(query: string) {
    if (!existsSync(this.scratchpadDir)) {
      mkdirSync(this.scratchpadDir, { recursive: true });
    }

    const hash = createHash('md5').update(query).digest('hex').slice(0, 12);
    const now = new Date();
    const timestamp = now.toISOString()
      .slice(0, 19)           // "2026-01-21T15:30:45"
      .replace('T', '-')      // "2026-01-21-15:30:45"
      .replace(/:/g, '');     // "2026-01-21-153045"
    this.filepath = join(this.scratchpadDir, `${timestamp}_${hash}.jsonl`);

    // Write initial entry with the query
    this.append({ type: 'init', content: query, timestamp: new Date().toISOString() });
  }

  /**
   * Add a complete tool result with full data and LLM summary.
   * Parses JSON strings to store as objects for cleaner JSONL output.
   */
  addToolResult(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
    llmSummary: string
  ): void {
    this.append({
      type: 'tool_result',
      timestamp: new Date().toISOString(),
      toolName,
      args,
      result: this.parseResultSafely(result),
      llmSummary,
    });
  }

  /**
   * Safely parse a result string as JSON if possible.
   * Returns the parsed object if valid JSON, otherwise returns the original string.
   */
  private parseResultSafely(result: string): unknown {
    try {
      return JSON.parse(result);
    } catch {
      // Not valid JSON, return as-is (e.g., error messages, plain text)
      return result;
    }
  }

  /**
   * Append thinking/reasoning
   */
  addThinking(thought: string): void {
    this.append({ type: 'thinking', content: thought, timestamp: new Date().toISOString() });
  }

  /**
   * Get all LLM summaries for building the iteration prompt
   */
  getToolSummaries(): string[] {
    return this.readEntries()
      .filter(e => e.type === 'tool_result' && e.llmSummary)
      .map(e => e.llmSummary!);
  }

  /**
   * Get tool call records for DoneEvent (external consumers)
   */
  getToolCallRecords(): ToolCallRecord[] {
    return this.readEntries()
      .filter(e => e.type === 'tool_result' && e.toolName)
      .map(e => ({
        tool: e.toolName!,
        args: e.args!,
        result: this.stringifyResult(e.result),
      }));
  }

  /**
   * Get full contexts for final answer generation
   */
  getFullContexts(): ToolContext[] {
    return this.readEntries()
      .filter(e => e.type === 'tool_result' && e.toolName && e.result)
      .map(e => ({
        toolName: e.toolName!,
        args: e.args!,
        result: this.stringifyResult(e.result),
      }));
  }

  /**
   * Get full contexts with LLM summaries for selective inclusion.
   * Used when context exceeds token budget and we need LLM to select relevant results.
   * Each context includes an index for the LLM to reference.
   */
  getFullContextsWithSummaries(): ToolContextWithSummary[] {
    return this.readEntries()
      .filter(e => e.type === 'tool_result' && e.toolName && e.result)
      .map((e, index) => ({
        toolName: e.toolName!,
        args: e.args!,
        result: this.stringifyResult(e.result),
        llmSummary: e.llmSummary || '',
        index,
      }));
  }

  /**
   * Convert a result back to string for API compatibility.
   * If already a string, returns as-is. Otherwise JSON stringifies.
   */
  private stringifyResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }
    return JSON.stringify(result);
  }

  /**
   * Check if any tool results have been recorded
   */
  hasToolResults(): boolean {
    return this.readEntries().some(e => e.type === 'tool_result');
  }

  /**
   * Check if a skill has already been executed in this query.
   * Used for deduplication - each skill should only run once per query.
   */
  hasExecutedSkill(skillName: string): boolean {
    return this.readEntries().some(
      e => e.type === 'tool_result' && e.toolName === 'skill' && e.args?.skill === skillName
    );
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
