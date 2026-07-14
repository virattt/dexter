import { describe, expect, test } from 'bun:test';
import type { EvalExample } from './dataset.js';
import { selectEvalExamples, selectQuickExamples, selectStratifiedSample } from './sampling.js';

function example(id: string, questionType: string): EvalExample {
  return {
    id,
    inputs: { question: id },
    outputs: { answer: id },
    questionType,
    expertTimeMinutes: 1,
    rubric: [{ id: 'c1', operator: 'correctness', criteria: id }],
  };
}

const examples = [
  example('q1', 'A'),
  example('q2', 'A'),
  example('q3', 'B'),
  example('q4', 'B'),
  example('q5', 'C'),
  example('q6', 'C'),
];

describe('eval sampling', () => {
  test('quick mode selects a fixed stratified subset', () => {
    expect(selectQuickExamples(examples).map((item) => item.id)).toEqual(['q1', 'q3', 'q5']);
  });

  test('seeded samples are deterministic and preserve dataset order', () => {
    const first = selectStratifiedSample(examples, 4, 'seed-a').map((item) => item.id);
    const second = selectStratifiedSample(examples, 4, 'seed-a').map((item) => item.id);

    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
  });

  test('selectEvalExamples applies quick and sample modes', () => {
    expect(selectEvalExamples(examples, { quick: true, seed: 'x' }).length).toBe(3);
    expect(selectEvalExamples(examples, { quick: false, sampleSize: 2, seed: 'x' }).length).toBe(2);
    expect(selectEvalExamples(examples, { quick: false, seed: 'x' }).length).toBe(examples.length);
  });
});
