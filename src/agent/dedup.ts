// ============================================================================
// Executed Tool Registry - Tracks tool calls to prevent duplicate execution
// ============================================================================

/**
 * Registry that tracks executed tool calls to prevent redundant execution
 * across iterations of the reflection loop.
 */
export class ExecutedToolRegistry {
  private readonly executed: Map<string, unknown> = new Map();

  /**
   * Creates a unique key for a tool call based on name and args.
   */
  private createKey(toolName: string, args: Record<string, unknown>): string {
    const sortedArgs = JSON.stringify(args, Object.keys(args).sort());
    return `${toolName}:${sortedArgs}`;
  }

  /**
   * Checks if a tool with the given args has already been executed.
   */
  hasExecuted(toolName: string, args: Record<string, unknown>): boolean {
    const key = this.createKey(toolName, args);
    return this.executed.has(key);
  }

  /**
   * Registers a tool call as executed, storing its result.
   */
  register(toolName: string, args: Record<string, unknown>, result?: unknown): void {
    const key = this.createKey(toolName, args);
    this.executed.set(key, result);
  }

  /**
   * Gets the cached result of a previously executed tool call.
   */
  getCachedResult(toolName: string, args: Record<string, unknown>): unknown | undefined {
    const key = this.createKey(toolName, args);
    return this.executed.get(key);
  }

  /**
   * Returns a formatted summary of all executed tools for planner context.
   */
  getExecutedSummary(): string {
    if (this.executed.size === 0) {
      return '';
    }

    const lines: string[] = ['Previously executed tools (do not repeat):'];
    
    for (const key of this.executed.keys()) {
      const [toolName, argsJson] = key.split(':');
      const args = JSON.parse(argsJson);
      const argsStr = Object.entries(args)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      lines.push(`- ${toolName}(${argsStr})`);
    }

    return lines.join('\n');
  }

  /**
   * Returns the count of executed tools.
   */
  get size(): number {
    return this.executed.size;
  }

  /**
   * Clears all tracked executions.
   */
  clear(): void {
    this.executed.clear();
  }
}

