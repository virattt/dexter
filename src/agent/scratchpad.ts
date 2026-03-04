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

export interface ScratchpadEntry {
  type: 'init' | 'tool_result' | 'thinking';
  timestamp: string;
  // For init/thinking:
  content?: string;
  // For tool_result:
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown; // Stored as parsed object when possible, string otherwise
}

/**
 * Tool call limit configuration
 */
export interface ToolLimitConfig {
  /** Max calls per tool per query (default: 3) */
  maxCallsPerTool: number;
  /** Query similarity threshold (0-1, default: 0.7) */
  similarityThreshold: number;
}

/**
 * Status of tool usage for graceful exit mechanism
 */
export interface ToolUsageStatus {
  toolName: string;
  callCount: number;
  maxCalls: number;
  remainingCalls: number;
  recentQueries: string[];
  isBlocked: boolean;
  blockReason?: string;
}

/** Default tool limit configuration */
const DEFAULT_LIMIT_CONFIG: ToolLimitConfig = {
  maxCallsPerTool: 3,
  similarityThreshold: 0.7,
};

/**
 * Append-only scratchpad for tracking agent work on a query.
 * Uses JSONL format (newline-delimited JSON) for resilient appending.
 * Files are persisted in .dexter/scratchpad/ for debugging/history.
 * 
 * This is the single source of truth for all agent work on a query.
 * 
 * Includes soft limit warnings to guide the LLM:
 * - Tool call counting with suggested limits (warnings, not blocks)
 * - Query similarity detection to help prevent retry loops
 */
export class Scratchpad {
  private readonly scratchpadDir = '.dexter/scratchpad';
  private readonly filepath: string;
  private readonly limitConfig: ToolLimitConfig;

  // In-memory tracking for tool limits (also persisted in JSONL)
  private toolCallCounts: Map<string, number> = new Map();
  private toolQueries: Map<string, string[]> = new Map();

  // In-memory tracking for Anthropic-style context clearing (JSONL file untouched)
  // Stores indices of tool_result entries that have been cleared from context
  private clearedToolIndices: Set<number> = new Set();

  constructor(query: string, limitConfig?: Partial<ToolLimitConfig>) {
    this.limitConfig = { ...DEFAULT_LIMIT_CONFIG, ...limitConfig };

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
   * Add a complete tool result with full data.
   * Parses JSON strings to store as objects for cleaner JSONL output.
   * Anthropic-style: no inline summarization, full results preserved.
   */
  addToolResult(
    toolName: string,
    args: Record<string, unknown>,
    result: string
  ): void {
    this.append({
      type: 'tool_result',
      timestamp: new Date().toISOString(),
      toolName,
      args,
      result: this.parseResultSafely(result),
    });
  }

  // ============================================================================
  // Tool Limit / Graceful Exit Methods
  // ============================================================================

  /**
   * Check if a tool call can proceed. Returns status with warning if limits exceeded.
   * Call this BEFORE executing a tool to help prevent retry loops.
   * Note: Always allows the call but provides warnings to guide the LLM.
   */
  canCallTool(toolName: string, query?: string): { allowed: boolean; warning?: string } {
    const currentCount = this.toolCallCounts.get(toolName) ?? 0;
    const maxCalls = this.limitConfig.maxCallsPerTool;

    // Check if over the suggested limit - warn but allow
    if (currentCount >= maxCalls) {
      return {
        allowed: true,
        warning: `Tool '${toolName}' has been called ${currentCount} times (suggested limit: ${maxCalls}). ` +
          `If previous calls didn't return the needed data, consider: ` +
          `(1) trying a different tool, (2) using different search terms, or ` +
          `(3) proceeding with what you have and noting any data gaps to the user.`,
      };
    }

    // Check query similarity if query provided
    if (query) {
      const previousQueries = this.toolQueries.get(toolName) ?? [];
      const similarQuery = this.findSimilarQuery(query, previousQueries);
      
      if (similarQuery) {
        // Allow but warn - the LLM should know it's repeating
        const remaining = maxCalls - currentCount;
        return {
          allowed: true,
          warning: `This query is very similar to a previous '${toolName}' call. ` +
            `You have ${remaining} attempt(s) before reaching the suggested limit. ` +
            `If the tool isn't returning useful results, consider: ` +
            `(1) trying a different tool, (2) using different search terms, or ` +
            `(3) acknowledging the data limitation to the user.`,
        };
      }
    }

    // Check if approaching limit (1 call remaining)
    if (currentCount === maxCalls - 1) {
      return {
        allowed: true,
        warning: `You are approaching the suggested limit for '${toolName}' (${currentCount + 1}/${maxCalls}). ` +
          `If this doesn't return the needed data, consider trying a different approach.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a tool call attempt. Call this AFTER the tool executes successfully.
   */
  recordToolCall(toolName: string, query?: string): void {
    // Update call count
    const currentCount = this.toolCallCounts.get(toolName) ?? 0;
    this.toolCallCounts.set(toolName, currentCount + 1);

    // Track query if provided
    if (query) {
      const queries = this.toolQueries.get(toolName) ?? [];
      queries.push(query);
      this.toolQueries.set(toolName, queries);
    }
  }

  /**
   * Get usage status for all tools that have been called.
   * Used to inject tool attempt status into prompts.
   */
  getToolUsageStatus(): ToolUsageStatus[] {
    const statuses: ToolUsageStatus[] = [];
    
    for (const [toolName, callCount] of this.toolCallCounts) {
      const maxCalls = this.limitConfig.maxCallsPerTool;
      const remainingCalls = Math.max(0, maxCalls - callCount);
      const recentQueries = this.toolQueries.get(toolName) ?? [];
      const overLimit = callCount >= maxCalls;
      
      statuses.push({
        toolName,
        callCount,
        maxCalls,
        remainingCalls,
        recentQueries: recentQueries.slice(-3), // Last 3 queries
        isBlocked: false, // Never block, just warn
        blockReason: overLimit ? `Over suggested limit of ${maxCalls} calls` : undefined,
      });
    }
    
    return statuses;
  }

  /**
   * Format tool usage status for injection into prompts.
   */
  formatToolUsageForPrompt(): string | null {
    const statuses = this.getToolUsageStatus();
    
    if (statuses.length === 0) {
      return null;
    }

    const lines = statuses.map(s => {
      const status = s.callCount >= s.maxCalls
        ? `${s.callCount} calls (over suggested limit of ${s.maxCalls})`
        : `${s.callCount}/${s.maxCalls} calls`;
      return `- ${s.toolName}: ${status}`;
    });

    return `## Tool Usage This Query\n\n${lines.join('\n')}\n\n` +
      `Note: If a tool isn't returning useful results after several attempts, consider trying a different tool/approach.`;
  }

  /**
   * Check if a query is too similar to previous queries.
   * Uses word overlap similarity (Jaccard-like).
   */
  private findSimilarQuery(newQuery: string, previousQueries: string[]): string | null {
    const newWords = this.tokenize(newQuery);
    
    for (const prevQuery of previousQueries) {
      const prevWords = this.tokenize(prevQuery);
      const similarity = this.calculateSimilarity(newWords, prevWords);
      
      if (similarity >= this.limitConfig.similarityThreshold) {
        return prevQuery;
      }
    }
    
    return null;
  }

  /**
   * Tokenize a query into normalized words for similarity comparison.
   */
  private tokenize(query: string): Set<string> {
    return new Set(
      query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2) // Skip very short words
    );
  }

  /**
   * Calculate word overlap similarity between two word sets.
   */
  private calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    
    return intersection / union; // Jaccard similarity
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
   * Get full tool results formatted for the iteration prompt.
   * Anthropic-style: full results in context, excluding cleared entries.
   * Does NOT modify the JSONL file - clearing is in-memory only.
   */
  getToolResults(): string {
    const entries = this.readEntries();
    let toolResultIndex = 0;
    
    const formattedResults: string[] = [];
    for (const entry of entries) {
      if (entry.type !== 'tool_result' || !entry.toolName) continue;
      
      // Skip entries that have been cleared from context (in-memory only)
      if (this.clearedToolIndices.has(toolResultIndex)) {
        formattedResults.push(`[Tool result #${toolResultIndex + 1} cleared from context]`);
        toolResultIndex++;
        continue;
      }
      
      const argsStr = entry.args 
        ? Object.entries(entry.args).map(([k, v]) => `${k}=${v}`).join(', ')
        : '';
      const resultStr = this.stringifyResult(entry.result);
      formattedResults.push(`### ${entry.toolName}(${argsStr})\n${resultStr}`);
      toolResultIndex++;
    }
    
    return formattedResults.join('\n\n');
  }

  /**
   * Clear oldest tool results from context (in-memory only).
   * Anthropic-style: removes oldest tool results, keeping most recent N.
   * The JSONL file is NOT modified - this only affects what gets sent to the LLM.
   * 
   * @param keepCount - Number of most recent tool results to keep
   * @returns Number of tool results that were cleared
   */
  clearOldestToolResults(keepCount: number): number {
    const entries = this.readEntries();
    const toolResultIndices: number[] = [];
    
    let index = 0;
    for (const entry of entries) {
      if (entry.type === 'tool_result') {
        // Only consider entries not already cleared
        if (!this.clearedToolIndices.has(index)) {
          toolResultIndices.push(index);
        }
        index++;
      }
    }
    
    // Calculate how many to clear
    const toClearCount = Math.max(0, toolResultIndices.length - keepCount);
    
    if (toClearCount === 0) return 0;
    
    // Clear oldest entries (first N indices)
    for (let i = 0; i < toClearCount; i++) {
      this.clearedToolIndices.add(toolResultIndices[i]);
    }
    
    return toClearCount;
  }

  /**
   * Get count of active (non-cleared) tool results.
   */
  getActiveToolResultCount(): number {
    const entries = this.readEntries();
    let count = 0;
    let index = 0;
    
    for (const entry of entries) {
      if (entry.type === 'tool_result') {
        if (!this.clearedToolIndices.has(index)) {
          count++;
        }
        index++;
      }
    }
    
    return count;
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
   * Parse and validate a single JSONL line. Returns null for malformed or invalid entries.
   */
  private parseLine(line: string): ScratchpadEntry | null {
    try {
      const parsed = JSON.parse(line);
      return parsed && typeof parsed === 'object' && 'type' in parsed && 'timestamp' in parsed
        ? (parsed as ScratchpadEntry)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Read all entries from the log.
   * Skips malformed or corrupt lines (partial writes, disk corruption) to avoid
   * a single bad line crashing tool-context methods.
   */
  private readEntries(): ScratchpadEntry[] {
    if (!existsSync(this.filepath)) {
      return [];
    }

    return readFileSync(this.filepath, 'utf-8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => this.parseLine(line))
      .filter((entry): entry is ScratchpadEntry => entry !== null);
  }
}
