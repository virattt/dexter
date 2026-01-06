import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { callLlm, DEFAULT_MODEL } from '../model/llm.js';
import { CONTEXT_SELECTION_SYSTEM_PROMPT } from '../agent/prompts.js';
import { SelectedContextsSchema } from '../agent/schemas.js';
import type { ToolSummary } from '../agent/schemas.js';

interface ContextPointer {
  filepath: string;
  filename: string;
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  taskId?: number;
  queryId?: string;
  sourceUrls?: string[];
}

interface ContextData {
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  timestamp: string;
  taskId?: number;
  queryId?: string;
  sourceUrls?: string[];
  result: unknown;
}

export class ToolContextManager {
  private contextDir: string;
  private model: string;
  private pointers: Map<string, ContextPointer> = new Map();
  private pointersByQuery: Map<string, Set<string>> = new Map();

  constructor(contextDir: string = '.dexter/context', model: string = DEFAULT_MODEL) {
    this.contextDir = contextDir;
    this.model = model;
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true });
    }
  }

  private hashArgs(args: Record<string, unknown>): string {
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    return createHash('md5').update(argsStr).digest('hex').slice(0, 12);
  }

  hashQuery(query: string): string {
    return createHash('md5').update(query).digest('hex').slice(0, 12);
  }

  private generateFilename(toolName: string, args: Record<string, unknown>): string {
    const argsHash = this.hashArgs(args);
    const ticker = typeof args.ticker === 'string' ? args.ticker.toUpperCase() : null;
    return ticker 
      ? `${ticker}_${toolName}_${argsHash}.json`
      : `${toolName}_${argsHash}.json`;
  }

  getToolDescription(toolName: string, args: Record<string, unknown>): string {
    const parts: string[] = [];
    const usedKeys = new Set<string>();

    if (args.ticker) {
      parts.push(String(args.ticker).toUpperCase());
      usedKeys.add('ticker');
    }

    if (args.query) {
      parts.push(`"${args.query}"`);
      usedKeys.add('query');
    }

    const formattedToolName = toolName
      .replace(/^get_/, '')
      .replace(/^search_/, '')
      .replace(/_/g, ' ');
    parts.push(formattedToolName);

    if (args.period) {
      parts.push(`(${args.period})`);
      usedKeys.add('period');
    }

    if (args.limit && typeof args.limit === 'number') {
      parts.push(`- ${args.limit} periods`);
      usedKeys.add('limit');
    }

    if (args.start_date && args.end_date) {
      parts.push(`from ${args.start_date} to ${args.end_date}`);
      usedKeys.add('start_date');
      usedKeys.add('end_date');
    }

    const remainingArgs = Object.entries(args)
      .filter(([key]) => !usedKeys.has(key))
      .map(([key, value]) => `${key}=${value}`);

    if (remainingArgs.length > 0) {
      parts.push(`[${remainingArgs.join(', ')}]`);
    }

    return parts.join(' ');
  }

  saveContext(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    taskId?: number,
    queryId?: string
  ): string {
    const filename = this.generateFilename(toolName, args);
    const filepath = join(this.contextDir, filename);

    const toolDescription = this.getToolDescription(toolName, args);

    let sourceUrls: string[] | undefined;
    let actualResult = result;

    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed.data !== undefined) {
          sourceUrls = parsed.sourceUrls;
          actualResult = parsed.data;
        }
      } catch {
        // Not JSON, use as-is
      }
    }

    const contextData: ContextData = {
      toolName,
      args,
      toolDescription,
      timestamp: new Date().toISOString(),
      taskId,
      queryId,
      sourceUrls,
      result: actualResult,
    };

    writeFileSync(filepath, JSON.stringify(contextData, null, 2));

    const pointer: ContextPointer = {
      filepath,
      filename,
      toolName,
      args,
      toolDescription,
      taskId,
      queryId,
      sourceUrls,
    };

    // Use filepath as Map key (stable ID)
    this.pointers.set(pointer.filepath, pointer);

    // Index by queryId for O(1) retrieval
    if (queryId) {
      if (!this.pointersByQuery.has(queryId)) {
        this.pointersByQuery.set(queryId, new Set());
      }
      this.pointersByQuery.get(queryId)!.add(pointer.filepath);
    }

    return filepath;
  }

  saveAndGetSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    queryId?: string
  ): ToolSummary {
    const filepath = this.saveContext(toolName, args, result, undefined, queryId);
    const summary = this.getToolDescription(toolName, args);
    
    return {
      id: filepath,
      toolName,
      args,
      summary,
    };
  }

  getAllPointers(): ContextPointer[] {
    return Array.from(this.pointers.values());
  }

  getPointersForQuery(queryId: string): ContextPointer[] {
    const ids = this.pointersByQuery.get(queryId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.pointers.get(id)!);
  }

  loadContexts(filepaths: string[]): ContextData[] {
    const contexts: ContextData[] = [];
    for (const filepath of filepaths) {
      try {
        const content = readFileSync(filepath, 'utf-8');
        contexts.push(JSON.parse(content));
      } catch (e) {
        console.warn(`Warning: Failed to load context file ${filepath}: ${e}`);
      }
    }
    return contexts;
  }

  async selectRelevantContexts(
    query: string,
    availablePointers: ContextPointer[]
  ): Promise<string[]> {
    if (availablePointers.length === 0) return [];

    // Use filepath as stable ID for the LLM
    const pointersInfo = availablePointers.map(ptr => ({
      id: ptr.filepath,
      toolName: ptr.toolName,
      toolDescription: ptr.toolDescription,
      args: ptr.args,
    }));

    const prompt = `
    Original user query: "${query}"
    
    Available tool outputs:
    ${JSON.stringify(pointersInfo, null, 2)}
    
    Select which tool outputs are relevant for answering the query.
    Return a JSON object with a "context_ids" field containing a list of IDs (filepaths) of the relevant outputs.
    Only select outputs that contain data directly relevant to answering the query.
    `;

    try {
      const response = await callLlm(prompt, {
        systemPrompt: CONTEXT_SELECTION_SYSTEM_PROMPT,
        model: this.model,
        outputSchema: SelectedContextsSchema,
      });

      const selectedIds = (response as { context_ids: string[] }).context_ids || [];

      return selectedIds
        .map(id => this.pointers.get(id))
        .filter(Boolean)
        .map(ptr => ptr!.filepath);
    } catch (e) {
      console.warn(`Warning: Context selection failed: ${e}, loading all contexts`);
      return availablePointers.map(ptr => ptr.filepath);
    }
  }
}
