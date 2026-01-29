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
 * Includes graceful exit mechanisms:
 * - Tool call counting with hard limits
 * - Query similarity detection to prevent retry loops
 */
export class Scratchpad {
  private readonly scratchpadDir = '.dexter/scratchpad';
  private readonly filepath: string;
  private readonly limitConfig: ToolLimitConfig;

  // In-memory tracking for tool limits (also persisted in JSONL)
  private toolCallCounts: Map<string, number> = new Map();
  private toolQueries: Map<string, string[]> = new Map();

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

  // ============================================================================
  // Tool Limit / Graceful Exit Methods
  // ============================================================================

  /**
   * Check if a tool call can proceed. Returns status with block reason if blocked.
   * Call this BEFORE executing a tool to prevent retry loops.
   */
  canCallTool(toolName: string, query?: string): { allowed: boolean; warning?: string; blockReason?: string } {
    const currentCount = this.toolCallCounts.get(toolName) ?? 0;
    const maxCalls = this.limitConfig.maxCallsPerTool;

    // Check hard limit
    if (currentCount >= maxCalls) {
      return {
        allowed: false,
        blockReason: `Tool '${toolName}' has reached its limit of ${maxCalls} calls. ` +
          `The data you need may not be available through this tool. ` +
          `Either try a different approach or inform the user what you found and what you couldn't find.`,
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
            `You have ${remaining} attempt(s) remaining. ` +
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
        warning: `This is your last attempt for '${toolName}'. ` +
          `If this doesn't return the needed data, you must try a different approach or inform the user.`,
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
      const isBlocked = remainingCalls === 0;
      
      statuses.push({
        toolName,
        callCount,
        maxCalls,
        remainingCalls,
        recentQueries: recentQueries.slice(-3), // Last 3 queries
        isBlocked,
        blockReason: isBlocked ? `Reached limit of ${maxCalls} calls` : undefined,
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
      const status = s.isBlocked 
        ? `BLOCKED (${s.callCount}/${s.maxCalls} used)` 
        : `${s.remainingCalls} remaining (${s.callCount}/${s.maxCalls} used)`;
      return `- ${s.toolName}: ${status}`;
    });

    return `## Tool Usage This Query\n\n${lines.join('\n')}\n\n` +
      `IMPORTANT: If a tool isn't returning useful results, do NOT keep retrying with similar queries. ` +
      `Either try a different tool/approach or acknowledge the data limitation.`;
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
