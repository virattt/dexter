import { describe, expect, test } from 'bun:test';
import type { EvalExample } from './dataset.js';
import { buildJudgePrompt, scoreJudgeOutput } from './evaluator.js';

const example: EvalExample = {
  id: 'q1',
  inputs: { question: 'What was revenue and margin?' },
  outputs: { answer: 'Revenue was $10 million and margin was 20%.' },
  questionType: 'Numerical Reasoning',
  expertTimeMinutes: 5,
  rubric: [
    { id: 'c1', operator: 'correctness', criteria: 'Revenue was $10 million' },
    { id: 'c2', operator: 'correctness', criteria: 'Margin was 20%' },
    { id: 'c3', operator: 'contradiction', criteria: 'Revenue was materially below $10 million' },
  ],
};

describe('rubric evaluator', () => {
  test('builds a judge prompt with question, reference, actual answer, and rubric', () => {
    const prompt = buildJudgePrompt(example, 'Revenue was $10.0m.');

    expect(prompt).toContain('What was revenue and margin?');
    expect(prompt).toContain('Revenue was $10 million and margin was 20%.');
    expect(prompt).toContain('Revenue was $10.0m.');
    expect(prompt).toContain('c1: Revenue was $10 million');
    expect(prompt).toContain('c3: Revenue was materially below $10 million');
  });

  test('computes partial credit from correctness criteria', () => {
    const result = scoreJudgeOutput(example, {
      correctness: [
        { id: 'c1', passed: true, rationale: 'Revenue matches.' },
        { id: 'c2', passed: false, rationale: 'Margin missing.' },
      ],
      contradictions: [
        { id: 'c3', passed: false, rationale: 'No contradiction.' },
      ],
      comment: 'One of two criteria passed.',
    });

    expect(result.score).toBe(0.5);
    expect(result.passedCriteria).toBe(1);
    expect(result.totalCriteria).toBe(2);
    expect(result.contradictionDetected).toBe(false);
  });

  test('sets score to zero when a direct contradiction is detected', () => {
    const result = scoreJudgeOutput(example, {
      correctness: [
        { id: 'c1', passed: true, rationale: 'Revenue present.' },
        { id: 'c2', passed: true, rationale: 'Margin present.' },
      ],
      contradictions: [
        { id: 'c3', passed: true, rationale: 'Answer says revenue was $1 million.' },
      ],
      comment: 'Contradicts a core fact.',
    });

    expect(result.score).toBe(0);
    expect(result.passedCriteria).toBe(2);
    expect(result.contradictionDetected).toBe(true);
  });
});
