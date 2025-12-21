import { callLlm } from '../../model/llm.js';
import { PlanSchema, type PlanOutput } from '../schemas.js';
import { getPlanSystemPrompt, buildPlanUserPrompt } from '../prompts.js';
import type { PlanInput, Plan, Task, TaskType } from '../state.js';

// ============================================================================
// Plan Phase
// ============================================================================

export interface PlanPhaseOptions {
  model: string;
}

/**
 * Creates a task list with taskType and dependencies.
 * Tool selection happens at execution time, not during planning.
 */
export class PlanPhase {
  private readonly model: string;

  constructor(options: PlanPhaseOptions) {
    this.model = options.model;
  }

  /**
   * Runs planning to create a task list with types and dependencies.
   */
  async run(input: PlanInput): Promise<Plan> {
    const entitiesStr = input.understanding.entities.length > 0
      ? input.understanding.entities
          .map(e => `${e.type}: ${e.value}`)
          .join(', ')
      : 'None identified';

    const systemPrompt = getPlanSystemPrompt();
    const userPrompt = buildPlanUserPrompt(
      input.query,
      input.understanding.intent,
      entitiesStr
    );

    const response = await callLlm(userPrompt, {
      systemPrompt,
      model: this.model,
      outputSchema: PlanSchema,
    });

    const result = response as PlanOutput;

    // Map to Task type with taskType and dependencies
    const tasks: Task[] = result.tasks.map(t => ({
      id: t.id,
      description: t.description,
      status: 'pending' as const,
      taskType: t.taskType as TaskType,
      dependsOn: t.dependsOn,
    }));

    return {
      summary: result.summary,
      tasks,
    };
  }
}
