import { callLlm } from '../../model/llm.js';
import { PlanSchema, type PlanOutput } from '../schemas.js';
import { getPlanSystemPrompt, buildPlanUserPrompt } from '../prompts.js';
import type { PlanInput, Plan, Task, TaskType, TaskResult } from '../state.js';

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

    // Format prior work summary if available
    const priorWorkSummary = input.priorPlans && input.priorPlans.length > 0
      ? this.formatPriorWork(input.priorPlans, input.priorResults)
      : undefined;

    const systemPrompt = getPlanSystemPrompt();
    const userPrompt = buildPlanUserPrompt(
      input.query,
      input.understanding.intent,
      entitiesStr,
      priorWorkSummary,
      input.guidanceFromReflection
    );

    const response = await callLlm(userPrompt, {
      systemPrompt,
      model: this.model,
      outputSchema: PlanSchema,
    });

    const result = response as PlanOutput;

    // Generate unique task IDs that don't conflict with prior plans
    const iteration = input.priorPlans ? input.priorPlans.length + 1 : 1;
    const idPrefix = `iter${iteration}_`;

    // Map to Task type with taskType and dependencies
    const tasks: Task[] = result.tasks.map(t => ({
      id: idPrefix + t.id,
      description: t.description,
      status: 'pending' as const,
      taskType: t.taskType as TaskType,
      dependsOn: t.dependsOn.map(dep => idPrefix + dep),
    }));

    return {
      summary: result.summary,
      tasks,
    };
  }

  /**
   * Formats prior work from completed plans for context.
   */
  private formatPriorWork(
    plans: Plan[],
    taskResults?: Map<string, TaskResult>
  ): string {
    const parts: string[] = [];

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      parts.push(`Pass ${i + 1}: ${plan.summary}`);
      
      for (const task of plan.tasks) {
        const result = taskResults?.get(task.id);
        const status = result ? '✓' : '✗';
        parts.push(`  ${status} ${task.description}`);
      }
    }

    return parts.join('\n');
  }
}
