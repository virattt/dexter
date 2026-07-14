import { z } from 'zod';
import { getChatModel } from '../model/llm.js';
import type { EvalExample, RubricCriterion } from './dataset.js';

export interface CriterionJudgment {
  id: string;
  operator: 'correctness' | 'contradiction';
  criteria: string;
  passed: boolean;
  rationale: string;
}

export interface RubricEvaluationResult {
  key: 'rubric_correctness';
  score: number;
  comment: string;
  passedCriteria: number;
  totalCriteria: number;
  contradictionDetected: boolean;
  criteria: CriterionJudgment[];
}

const JudgeCriterionSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  rationale: z.string(),
});

const JudgeOutputSchema = z.object({
  correctness: z.array(JudgeCriterionSchema),
  contradictions: z.array(JudgeCriterionSchema),
  comment: z.string(),
});

type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

function formatCriteria(criteria: RubricCriterion[], operator: RubricCriterion['operator']): string {
  const matchingCriteria = criteria.filter((criterion) => criterion.operator === operator);
  if (matchingCriteria.length === 0) {
    return 'None';
  }

  return matchingCriteria
    .map((criterion) => `- ${criterion.id}: ${criterion.criteria}`)
    .join('\n');
}

export function buildJudgePrompt(example: EvalExample, actualAnswer: string): string {
  return `You are grading a financial research agent answer against an atomic rubric.

Question:
${example.inputs.question}

Reference Answer:
${example.outputs.answer}

Actual Answer:
${actualAnswer || '(empty answer)'}

Correctness criteria:
${formatCriteria(example.rubric, 'correctness')}

Contradiction criteria:
${formatCriteria(example.rubric, 'contradiction')}

Grade each criterion independently.

Rules:
- Mark a correctness criterion passed when the actual answer contains the fact or an equivalent formulation.
- Accept equivalent units, scale representations, and reasonable rounding unless exact formatting is required by the question or criterion.
- Mark a contradiction criterion passed only when the actual answer directly contradicts that criterion or a core reference fact.
- Do not penalize extra context unless it contradicts the reference answer.
- Return every criterion id exactly once in the matching array.`;
}

function judgmentById(judgments: z.infer<typeof JudgeCriterionSchema>[]): Map<string, z.infer<typeof JudgeCriterionSchema>> {
  return new Map(judgments.map((judgment) => [judgment.id, judgment]));
}

export function scoreJudgeOutput(example: EvalExample, judgeOutput: JudgeOutput): RubricEvaluationResult {
  const correctnessById = judgmentById(judgeOutput.correctness);
  const contradictionById = judgmentById(judgeOutput.contradictions);
  const correctnessCriteria = example.rubric.filter((criterion) => criterion.operator === 'correctness');
  const contradictionCriteria = example.rubric.filter((criterion) => criterion.operator === 'contradiction');

  const correctnessJudgments = correctnessCriteria.map((criterion): CriterionJudgment => {
    const judgment = correctnessById.get(criterion.id);
    return {
      id: criterion.id,
      operator: criterion.operator,
      criteria: criterion.criteria,
      passed: judgment?.passed ?? false,
      rationale: judgment?.rationale ?? 'Judge did not return this criterion.',
    };
  });

  const contradictionJudgments = contradictionCriteria.map((criterion): CriterionJudgment => {
    const judgment = contradictionById.get(criterion.id);
    return {
      id: criterion.id,
      operator: criterion.operator,
      criteria: criterion.criteria,
      passed: judgment?.passed ?? false,
      rationale: judgment?.rationale ?? 'Judge did not return this criterion.',
    };
  });

  const passedCriteria = correctnessJudgments.filter((judgment) => judgment.passed).length;
  const contradictionDetected = contradictionJudgments.some((judgment) => judgment.passed);
  const score = contradictionDetected
    ? 0
    : passedCriteria / Math.max(correctnessCriteria.length, 1);

  return {
    key: 'rubric_correctness',
    score,
    comment: judgeOutput.comment,
    passedCriteria,
    totalCriteria: correctnessCriteria.length,
    contradictionDetected,
    criteria: [...correctnessJudgments, ...contradictionJudgments],
  };
}

export function createRubricEvaluator(judgeModel: string) {
  const structuredLlm = getChatModel(judgeModel).withStructuredOutput(JudgeOutputSchema);

  return async function evaluateRubric(
    example: EvalExample,
    actualAnswer: string,
  ): Promise<RubricEvaluationResult> {
    const judgeOutput = await structuredLlm.invoke(buildJudgePrompt(example, actualAnswer));
    return scoreJudgeOutput(example, judgeOutput as JudgeOutput);
  };
}
