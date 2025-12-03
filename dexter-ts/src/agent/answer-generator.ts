import { callLlmStream } from '../model/llm.js';
import { getAnswerSystemPrompt } from './prompts.js';
import { SubTaskResult } from './schemas.js';

/**
 * Subtask output structure for answer generation
 */
interface SubTaskOutput {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

/**
 * Responsible for generating the final answer to the user's query.
 * Single Responsibility: Answer generation only.
 */
export class AnswerGenerator {
  constructor(private readonly model: string | undefined) {}

  /**
   * Generates a streaming answer based on subtask results.
   * This is the primary method for the execution flow.
   */
  async generateFromResults(query: string, subTaskResults: SubTaskResult[]): Promise<AsyncGenerator<string>> {
    // Extract successful subtask outputs
    const allOutputs = this.extractOutputs(subTaskResults);
    const prompt = this.buildPromptFromOutputs(query, allOutputs);

    return callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });
  }

  /**
   * Generates a streaming answer when no tasks were executed.
   * Used for queries that don't require tool calls.
   */
  async generateStream(query: string): Promise<AsyncGenerator<string>> {
    const prompt = this.buildNoDataPrompt(query);

    return callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });
  }

  /**
   * Extracts successful outputs from subtask results.
   */
  private extractOutputs(subTaskResults: SubTaskResult[]): SubTaskOutput[] {
    return subTaskResults
      .filter(result => result.success)
      .map(result => ({
        tool: result.tool,
        args: result.args,
        result: result.result,
      }));
  }

  /**
   * Builds the prompt from subtask outputs.
   */
  private buildPromptFromOutputs(query: string, outputs: SubTaskOutput[]): string {
    if (outputs.length === 0) {
      return this.buildNoDataPrompt(query);
    }

    const formattedResults = outputs.map((output) => {
      return `Output of ${output.tool} with args ${JSON.stringify(output.args)}:\n${output.result}`;
    });

    const allResults = formattedResults.join('\n\n');

    return `
Original user query: "${query}"

Data and results collected from tools:
${allResults}

Based on the data above, provide a comprehensive answer to the user's query.
Include specific numbers, calculations, and insights.`;
  }

  /**
   * Builds the prompt when no data was collected.
   */
  private buildNoDataPrompt(query: string): string {
    return `
Original user query: "${query}"

No data was collected from tools.`;
  }
}
