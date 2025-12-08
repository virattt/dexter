import { callLlmStream } from '../model/llm.js';
import { getAnswerSystemPrompt } from './prompts.js';
import { ToolContextManager } from '../utils/context.js';
import { MessageHistory } from '../utils/message-history.js';

/**
 * Responsible for generating the final answer to the user's query.
 * Uses ToolContextManager to select and load relevant tool outputs at answer time.
 * Uses MessageHistory to include relevant conversation context.
 */
export class AnswerGenerator {
  constructor(
    private readonly toolContextManager: ToolContextManager,
    private readonly model: string | undefined
  ) {}

  /**
   * Generates a streaming answer by selecting relevant contexts and synthesizing data.
   * 
   * @param query - The user's query
   * @param queryId - Optional query ID to scope tool contexts
   * @param messageHistory - Optional message history for multi-turn context
   */
  async generateAnswer(query: string, queryId?: string, messageHistory?: MessageHistory): Promise<AsyncGenerator<string>> {
    const pointers = queryId
      ? this.toolContextManager.getPointersForQuery(queryId)
      : this.toolContextManager.getAllPointers();

    // Build conversation context from message history
    const conversationContext = await this.buildConversationContext(query, messageHistory);

    if (pointers.length === 0) {
      return this.generateNoDataAnswer(query, conversationContext);
    }

    // Select relevant contexts using LLM
    const selectedFilepaths = await this.toolContextManager.selectRelevantContexts(query, pointers);
    
    // Load the full context data
    const selectedContexts = this.toolContextManager.loadContexts(selectedFilepaths);

    if (selectedContexts.length === 0) {
      return this.generateNoDataAnswer(query, conversationContext);
    }

    // Format contexts for the prompt
    const formattedResults = selectedContexts.map(ctx => {
      const toolName = ctx.toolName || 'unknown';
      const args = ctx.args || {};
      const result = ctx.result;
      return `Output of ${toolName} with args ${JSON.stringify(args)}:\n${JSON.stringify(result, null, 2)}`;
    });

    const allResults = formattedResults.join('\n\n');

    const prompt = `${conversationContext}Original user query: "${query}"

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
   * Builds conversation context from message history for inclusion in prompts.
   */
  private async buildConversationContext(query: string, messageHistory?: MessageHistory): Promise<string> {
    if (!messageHistory || !messageHistory.hasMessages()) {
      return '';
    }

    const relevantMessages = await messageHistory.selectRelevantMessages(query);
    if (relevantMessages.length === 0) {
      return '';
    }

    const formattedHistory = messageHistory.formatForAnswerGeneration(relevantMessages);
    return `Previous conversation context (for reference):
${formattedHistory}

---

`;
  }

  /**
   * Generates a streaming answer when no data was collected.
   */
  private async generateNoDataAnswer(query: string, conversationContext: string = ''): Promise<AsyncGenerator<string>> {
    const prompt = `${conversationContext}Original user query: "${query}"

No data was collected from tools.`;

    return callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });
  }
}
