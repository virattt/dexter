import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { callLlm, DEFAULT_MODEL } from '../model/llm.js';
import { DEFAULT_SYSTEM_PROMPT, CONTEXT_SELECTION_SYSTEM_PROMPT } from '../agent/prompts.js';
import { SelectedContextsSchema } from '../agent/schemas.js';

interface ContextPointer {
  filepath: string;
  filename: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  taskId?: number;
  queryId?: string;
}

interface ContextData {
  tool_name: string;
  args: Record<string, unknown>;
  summary: string;
  timestamp: string;
  task_id?: number;
  query_id?: string;
  result: unknown;
}

export class ContextManager {
  private contextDir: string;
  private model: string;
  public pointers: ContextPointer[] = [];

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

  private async generateSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown
  ): Promise<string> {
    const resultStr = JSON.stringify(result).slice(0, 1000);

    const prompt = `
    Tool: ${toolName}
    Arguments: ${JSON.stringify(args, null, 2)}
    Output preview: ${resultStr}
    
    Generate a brief one-sentence summary describing what data this tool output contains.
    Focus on the key information (e.g., "Apple's last 4 quarterly income statements from Q1 2023 to Q4 2023").
    `;

    try {
      const response = await callLlm(prompt, {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: this.model,
      });
      return typeof response === 'string' ? response.trim() : String(response).trim();
    } catch {
      return `${toolName} output with args ${JSON.stringify(args)}`;
    }
  }

  async saveContext(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    taskId?: number,
    queryId?: string
  ): Promise<string> {
    const filename = this.generateFilename(toolName, args);
    const filepath = join(this.contextDir, filename);

    const summary = await this.generateSummary(toolName, args, result);

    const contextData: ContextData = {
      tool_name: toolName,
      args: args,
      summary: summary,
      timestamp: new Date().toISOString(),
      task_id: taskId,
      query_id: queryId,
      result: result,
    };

    writeFileSync(filepath, JSON.stringify(contextData, null, 2));

    const pointer: ContextPointer = {
      filepath,
      filename,
      toolName,
      args,
      summary,
      taskId,
      queryId,
    };

    this.pointers.push(pointer);

    return filepath;
  }

  getAllPointers(): ContextPointer[] {
    return [...this.pointers];
  }

  getPointersForQuery(queryId: string): ContextPointer[] {
    return this.pointers.filter(p => p.queryId === queryId);
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
    if (availablePointers.length === 0) {
      return [];
    }

    const pointersInfo = availablePointers.map((ptr, i) => ({
      id: i,
      tool_name: ptr.toolName,
      args: ptr.args,
      summary: ptr.summary,
    }));

    const prompt = `
    Original user query: "${query}"
    
    Available tool outputs:
    ${JSON.stringify(pointersInfo, null, 2)}
    
    Select which tool outputs are relevant for answering the query.
    Return a JSON object with a "context_ids" field containing a list of IDs (0-indexed) of the relevant outputs.
    Only select outputs that contain data directly relevant to answering the query.
    `;

    try {
      const response = await callLlm(prompt, {
        systemPrompt: CONTEXT_SELECTION_SYSTEM_PROMPT,
        model: this.model,
        outputSchema: SelectedContextsSchema,
      });

      const selectedIds = (response as { context_ids: number[] }).context_ids || [];

      return selectedIds
        .filter((idx) => idx >= 0 && idx < availablePointers.length)
        .map((idx) => availablePointers[idx].filepath);
    } catch (e) {
      console.warn(`Warning: Context selection failed: ${e}, loading all contexts`);
      return availablePointers.map((ptr) => ptr.filepath);
    }
  }
}

