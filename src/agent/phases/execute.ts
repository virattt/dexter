import { callLlm } from '../../model/llm.js';
import { getExecuteSystemPrompt, buildExecuteUserPrompt } from '../prompts.js';
import type { ExecuteInput, TaskResult } from '../state.js';

// ============================================================================
// Execute Phase (For Reason Tasks Only)
// ============================================================================

export interface ExecutePhaseOptions {
  model: string;
}

/**
 * Executes a "reason" task using the LLM.
 * Called only for tasks that require analysis, comparison, or synthesis.
 * Data has already been gathered and is passed in as contextData.
 */
export class ExecutePhase {
  private readonly model: string;

  constructor(options: ExecutePhaseOptions) {
    this.model = options.model;
  }

  /**
   * Runs the LLM to complete a reasoning task.
   */
  async run(input: ExecuteInput): Promise<TaskResult> {
    const systemPrompt = getExecuteSystemPrompt();
    const userPrompt = buildExecuteUserPrompt(
      input.query,
      input.task.description,
      input.contextData
    );

    const response = await callLlm(userPrompt, {
      systemPrompt,
      model: this.model,
    });

    const output = typeof response === 'string' 
      ? response 
      : String(response);

    return {
      taskId: input.task.id,
      output,
    };
  }
}
