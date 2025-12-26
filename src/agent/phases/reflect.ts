import { callLlm } from '../../model/llm.js';
import { ReflectionSchema, type ReflectionOutput } from '../schemas.js';
import { getReflectSystemPrompt, buildReflectUserPrompt } from '../prompts.js';
import type { ReflectInput, ReflectionResult, Plan, TaskResult } from '../state.js';

// ============================================================================
// Reflect Phase Options
// ============================================================================

export interface ReflectPhaseOptions {
  model: string;
  maxIterations?: number;
}

// ============================================================================
// Reflect Phase
// ============================================================================

/**
 * Evaluates whether gathered data is sufficient to answer the query,
 * or if additional work is needed.
 */
export class ReflectPhase {
  private readonly model: string;
  private readonly maxIterations: number;

  constructor(options: ReflectPhaseOptions) {
    this.model = options.model;
    this.maxIterations = options.maxIterations ?? 3;
  }

  /**
   * Runs reflection to determine if we should continue or finish.
   */
  async run(input: ReflectInput): Promise<ReflectionResult> {
    // Force completion on max iterations
    if (input.iteration >= this.maxIterations) {
      return {
        isComplete: true,
        reasoning: `Reached maximum iterations (${this.maxIterations}). Proceeding with available data.`,
        missingInfo: [],
        suggestedNextSteps: '',
      };
    }

    const completedWork = this.formatCompletedWork(input.completedPlans, input.taskResults);

    const systemPrompt = getReflectSystemPrompt();
    const userPrompt = buildReflectUserPrompt(
      input.query,
      input.understanding.intent,
      completedWork,
      input.iteration,
      this.maxIterations
    );

    const response = await callLlm(userPrompt, {
      systemPrompt,
      model: this.model,
      outputSchema: ReflectionSchema,
    });

    const result = response as ReflectionOutput;

    return {
      isComplete: result.isComplete,
      reasoning: result.reasoning,
      missingInfo: result.missingInfo,
      suggestedNextSteps: result.suggestedNextSteps,
    };
  }

  /**
   * Builds guidance string from reflection result for the next planning iteration.
   */
  buildPlanningGuidance(reflection: ReflectionResult): string {
    const parts: string[] = [reflection.reasoning];
    
    if (reflection.missingInfo.length > 0) {
      parts.push(`Missing information: ${reflection.missingInfo.join(', ')}`);
    }
    
    if (reflection.suggestedNextSteps.length > 0) {
      parts.push(`Suggested next steps: ${reflection.suggestedNextSteps}`);
    }

    return parts.join('\n');
  }

  /**
   * Formats all completed work from prior plans for LLM context.
   */
  private formatCompletedWork(plans: Plan[], taskResults: Map<string, TaskResult>): string {
    const parts: string[] = [];

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      parts.push(`--- Pass ${i + 1}: ${plan.summary} ---`);
      
      for (const task of plan.tasks) {
        const result = taskResults.get(task.id);
        const output = result?.output ?? 'No output';
        const status = result ? '✓' : '✗';
        parts.push(`${status} ${task.description}: ${output}`);
      }
    }

    return parts.join('\n');
  }
}

