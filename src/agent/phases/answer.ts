import { callLlmStream } from '../../model/llm.js';
import { getFinalAnswerSystemPrompt, buildFinalAnswerUserPrompt } from '../prompts.js';
import type { AnswerInput } from '../state.js';
import type { ToolContextManager } from '../../utils/context.js';

// ============================================================================
// Answer Phase Options
// ============================================================================

export interface AnswerPhaseOptions {
  model: string;
  contextManager: ToolContextManager;
}

// ============================================================================
// Answer Phase
// ============================================================================

/**
 * Generates the final answer from all task results across all iterations.
 */
export class AnswerPhase {
  private readonly model: string;
  private readonly contextManager: ToolContextManager;

  constructor(options: AnswerPhaseOptions) {
    this.model = options.model;
    this.contextManager = options.contextManager;
  }

  /**
   * Runs answer generation and returns a stream for the response.
   */
  run(input: AnswerInput): AsyncGenerator<string> {
    // Format task outputs from ALL plans
    const taskOutputs = input.completedPlans
      .flatMap(plan => plan.tasks)
      .map(task => {
        const result = input.taskResults.get(task.id);
        const output = result?.output ?? 'No output';
        return `Task: ${task.description}\nOutput: ${output}`;
      })
      .join('\n\n---\n\n');

    // Collect sources from context manager
    const queryId = this.contextManager.hashQuery(input.query);
    const pointers = this.contextManager.getPointersForQuery(queryId);
    
    const sources = pointers
      .filter(p => p.sourceUrls && p.sourceUrls.length > 0)
      .map(p => ({
        description: p.toolDescription,
        urls: p.sourceUrls!,
      }));

    const sourcesStr = sources.length > 0
      ? sources.map(s => `${s.description}: ${s.urls.join(', ')}`).join('\n')
      : '';

    // Build the final answer prompt
    const systemPrompt = getFinalAnswerSystemPrompt();
    const userPrompt = buildFinalAnswerUserPrompt(input.query, taskOutputs, sourcesStr);

    // Return the stream
    return callLlmStream(userPrompt, {
      systemPrompt,
      model: this.model,
    });
  }
}

