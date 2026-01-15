import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { ToolCallResult, ToolSummary } from './types.js';

/**
 * Stored context data format
 */
export interface StoredContext {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: string;
}

/**
 * Simple context manager for storing and retrieving tool results
 */
export class ContextManager {
  private readonly contextDir: string;
  private readonly results: ToolCallResult[] = [];

  constructor(contextDir: string = '.dexter/context') {
    this.contextDir = contextDir;
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true });
    }
  }

  /**
   * Generate a unique filename for a tool result
   */
  private generateFilename(toolName: string, args: Record<string, unknown>): string {
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    const hash = createHash('md5').update(argsStr).digest('hex').slice(0, 8);
    const ticker = typeof args.ticker === 'string' ? `${args.ticker.toUpperCase()}_` : '';
    return `${ticker}${toolName}_${hash}.json`;
  }

  /**
   * Save a tool result to disk and memory
   */
  saveToolResult(
    toolName: string,
    args: Record<string, unknown>,
    result: string
  ): void {
    const toolResult: ToolCallResult = {
      toolName,
      args,
      result,
      timestamp: new Date(),
    };
    
    this.results.push(toolResult);

    // Save to disk
    const filename = this.generateFilename(toolName, args);
    const filepath = join(this.contextDir, filename);
    
    const stored: StoredContext = {
      toolName,
      args,
      result,
      timestamp: toolResult.timestamp.toISOString(),
    };
    
    writeFileSync(filepath, JSON.stringify(stored, null, 2));
  }

  /**
   * Get all results from this session
   */
  getResults(): ToolCallResult[] {
    return [...this.results];
  }

  /**
   * Get a summary of all tool results for context injection
   */
  getSummary(): string {
    if (this.results.length === 0) {
      return 'No tool results yet.';
    }

    return this.results.map((r, i) => {
      const argsStr = Object.entries(r.args)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      
      // Truncate long results
      const resultPreview = r.result.length > 500 
        ? r.result.slice(0, 500) + '...'
        : r.result;
      
      return `[${i + 1}] ${r.toolName}(${argsStr}):\n${resultPreview}`;
    }).join('\n\n');
  }

  /**
   * Get the most recent N results
   */
  getRecentResults(n: number = 5): ToolCallResult[] {
    return this.results.slice(-n);
  }

  /**
   * Load a stored context file
   */
  loadContext(filename: string): StoredContext | null {
    const filepath = join(this.contextDir, filename);
    
    if (!existsSync(filepath)) {
      return null;
    }
    
    try {
      const content = readFileSync(filepath, 'utf-8');
      return JSON.parse(content) as StoredContext;
    } catch {
      return null;
    }
  }

  /**
   * List all stored context files
   */
  listStoredContexts(): string[] {
    if (!existsSync(this.contextDir)) {
      return [];
    }
    
    return readdirSync(this.contextDir)
      .filter(f => f.endsWith('.json'));
  }

  /**
   * Clear all results from this session (doesn't delete files)
   */
  clear(): void {
    this.results.length = 0;
  }

  /**
   * Generate a deterministic human-readable description of a tool call.
   * Used for context compaction during the agent loop.
   */
  getToolDescription(toolName: string, args: Record<string, unknown>): string {
    const parts: string[] = [];
    const usedKeys = new Set<string>();

    // Add ticker if present (most common identifier)
    if (args.ticker) {
      parts.push(String(args.ticker).toUpperCase());
      usedKeys.add('ticker');
    }

    // Add search query if present
    if (args.query) {
      parts.push(`"${args.query}"`);
      usedKeys.add('query');
    }

    // Format tool name: get_income_statements -> income statements
    const formattedToolName = toolName
      .replace(/^get_/, '')
      .replace(/^search_/, '')
      .replace(/_/g, ' ');
    parts.push(formattedToolName);

    // Add period qualifier if present
    if (args.period) {
      parts.push(`(${args.period})`);
      usedKeys.add('period');
    }

    // Add limit if present
    if (args.limit && typeof args.limit === 'number') {
      parts.push(`- ${args.limit} periods`);
      usedKeys.add('limit');
    }

    // Add date range if present
    if (args.start_date && args.end_date) {
      parts.push(`from ${args.start_date} to ${args.end_date}`);
      usedKeys.add('start_date');
      usedKeys.add('end_date');
    }

    // Append any remaining args not explicitly handled
    const remainingArgs = Object.entries(args)
      .filter(([key]) => !usedKeys.has(key))
      .map(([key, value]) => `${key}=${value}`);

    if (remainingArgs.length > 0) {
      parts.push(`[${remainingArgs.join(', ')}]`);
    }

    return parts.join(' ');
  }

  /**
   * Save a tool result to disk and return a lightweight summary for the agent loop.
   * This enables context compaction - full data on disk, summaries in memory.
   */
  saveAndGetSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: string
  ): ToolSummary {
    // Save full result to disk (existing logic)
    this.saveToolResult(toolName, args, result);

    // Generate filepath for reference
    const filename = this.generateFilename(toolName, args);
    const filepath = join(this.contextDir, filename);

    // Generate lightweight summary
    const summary = this.getToolDescription(toolName, args);

    return {
      id: filepath,
      toolName,
      args,
      summary,
    };
  }

  /**
   * Load full context data from disk for final answer generation.
   * Takes an array of filepaths (from ToolSummary.id) and returns full stored contexts.
   */
  loadFullContexts(filepaths: string[]): StoredContext[] {
    const contexts: StoredContext[] = [];

    for (const filepath of filepaths) {
      if (!existsSync(filepath)) {
        continue;
      }

      try {
        const content = readFileSync(filepath, 'utf-8');
        contexts.push(JSON.parse(content) as StoredContext);
      } catch {
        // Skip failed files silently
      }
    }

    return contexts;
  }
}
