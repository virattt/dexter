import { callLlmStream } from '../model/llm.js';
import { getAnswerSystemPrompt } from './prompts.js';
import { ContextManager } from '../utils/context.js';

/**
 * Responsible for generating the final answer to the user's query.
 * Uses ContextManager to select and load relevant tool outputs at answer time.
 */
export class AnswerGenerator {
  constructor(
    private readonly contextManager: ContextManager,
    private readonly model: string | undefined
  ) {}

  /**
   * Generates a streaming answer by selecting relevant contexts and synthesizing data.
   */
  async generateAnswer(query: string, queryId?: string): Promise<AsyncGenerator<string>> {
    const pointers = queryId
      ? this.contextManager.getPointersForQuery(queryId)
      : this.contextManager.getAllPointers();

    if (pointers.length === 0) {
      return this.generateNoDataAnswer(query);
    }

    // Select relevant contexts using LLM
    const selectedFilepaths = await this.contextManager.selectRelevantContexts(query, pointers);
    
    // Load the full context data
    const selectedContexts = this.contextManager.loadContexts(selectedFilepaths);

    if (selectedContexts.length === 0) {
      return this.generateNoDataAnswer(query);
    }

    // Format contexts for the prompt
    const formattedResults = selectedContexts.map(ctx => {
      const toolName = ctx.tool_name || 'unknown';
      const args = ctx.args || {};
      const result = ctx.result;
      return `Output of ${toolName} with args ${JSON.stringify(args)}:\n${JSON.stringify(result, null, 2)}`;
    });

    const allResults = formattedResults.join('\n\n');

    const prompt = `
Original user query: "${query}"

Data and results collected from tools:
${allResults}

Based on the data above, provide a comprehensive answer to the user's query.
Include specific numbers, calculations, and insights.`;

    return callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });
  }

  /**
   * Generates a streaming answer when no data was collected.
   */
  private async generateNoDataAnswer(query: string): Promise<AsyncGenerator<string>> {
    const prompt = `
Original user query: "${query}"

No data was collected from tools.`;

    return callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });
  }
}
