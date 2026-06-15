import { describe, test, expect } from 'bun:test';
import {
  AskUserQuestionSchema,
  createAskUserQuestion,
  formatAnswers,
} from './ask-user-question.js';
import type { Question, QuestionAnswer, UserAnswers } from './types.js';

// ---------------------------------------------------------------------------
// formatAnswers — the output contract handed back to the model
// ---------------------------------------------------------------------------

describe('formatAnswers', () => {
  test('single-select renders header, question, and chosen label', () => {
    const answers: QuestionAnswer[] = [
      { header: 'Timeframe', question: 'Which horizon?', selected: ['Long-term'] },
    ];
    expect(formatAnswers(answers)).toBe('Q (Timeframe): Which horizon?\n  Answer: Long-term');
  });

  test('multi-select joins multiple labels with commas', () => {
    const answers: QuestionAnswer[] = [
      { header: 'Metrics', question: 'Which metrics?', selected: ['Revenue', 'Margins', 'FCF'] },
    ];
    expect(formatAnswers(answers)).toContain('Answer: Revenue, Margins, FCF');
  });

  test('Other text is appended after selected labels', () => {
    const answers: QuestionAnswer[] = [
      { header: 'Method', question: 'Which method?', selected: ['DCF'], otherText: 'Sum-of-parts' },
    ];
    expect(formatAnswers(answers)).toContain('Answer: DCF, Other: Sum-of-parts');
  });

  test('Other-only answer (no selected labels) still renders the Other text', () => {
    const answers: QuestionAnswer[] = [
      { header: 'Ticker', question: 'Which ticker?', selected: [], otherText: 'PLTR' },
    ];
    expect(formatAnswers(answers)).toContain('Answer: Other: PLTR');
  });

  test('notes are rendered on their own line', () => {
    const answers: QuestionAnswer[] = [
      { header: 'Detail', question: 'How deep?', selected: ['Brief'], notes: 'one paragraph max' },
    ];
    expect(formatAnswers(answers)).toBe(
      'Q (Detail): How deep?\n  Answer: Brief\n  Notes: one paragraph max',
    );
  });

  test('empty selection without other text reports no selection', () => {
    const answers: QuestionAnswer[] = [
      { header: 'X', question: 'Q?', selected: [] },
    ];
    expect(formatAnswers(answers)).toContain('Answer: (no selection)');
  });

  test('multiple questions are separated by a blank line', () => {
    const answers: QuestionAnswer[] = [
      { header: 'A', question: 'Q1?', selected: ['one'] },
      { header: 'B', question: 'Q2?', selected: ['two'] },
    ];
    expect(formatAnswers(answers)).toBe(
      'Q (A): Q1?\n  Answer: one\n\nQ (B): Q2?\n  Answer: two',
    );
  });

  test('no answers reports an explicit empty message', () => {
    expect(formatAnswers([])).toBe('The user submitted no answers.');
  });
});

// ---------------------------------------------------------------------------
// Tool func — degradation and happy path via config.metadata.onUserInput
// ---------------------------------------------------------------------------

const SAMPLE_QUESTIONS: Question[] = [
  {
    question: 'Which valuation method?',
    header: 'Method',
    multiSelect: false,
    options: [
      { label: 'DCF', description: 'Discounted cash flow' },
      { label: 'Comps', description: 'Trading comparables' },
    ],
  },
];

describe('createAskUserQuestion tool', () => {
  test('returns the proceed-with-defaults message when no callback is provided', async () => {
    const tool = createAskUserQuestion();
    const result = await tool.invoke({ questions: SAMPLE_QUESTIONS });
    expect(result).toContain('unavailable here');
  });

  test('returns the dismissed message when the user declines', async () => {
    const tool = createAskUserQuestion();
    const onUserInput = async (): Promise<UserAnswers> => ({ answers: [], declined: true });
    const result = await tool.invoke({ questions: SAMPLE_QUESTIONS }, { metadata: { onUserInput } });
    expect(result).toContain('dismissed the question prompt');
  });

  test('formats and returns the collected answers on success', async () => {
    const tool = createAskUserQuestion();
    const onUserInput = async (): Promise<UserAnswers> => ({
      answers: [{ header: 'Method', question: 'Which valuation method?', selected: ['DCF'] }],
    });
    const result = await tool.invoke({ questions: SAMPLE_QUESTIONS }, { metadata: { onUserInput } });
    expect(result).toBe('Q (Method): Which valuation method?\n  Answer: DCF');
  });

  test('passes the questions through to the callback', async () => {
    const tool = createAskUserQuestion();
    let received: Question[] | null = null;
    const onUserInput = async (req: { questions: Question[] }): Promise<UserAnswers> => {
      received = req.questions;
      return { answers: [{ header: 'Method', question: 'Which valuation method?', selected: ['Comps'] }] };
    };
    await tool.invoke({ questions: SAMPLE_QUESTIONS }, { metadata: { onUserInput } });
    expect(received).not.toBeNull();
    expect(received![0].header).toBe('Method');
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('AskUserQuestionSchema', () => {
  const validQuestion = {
    question: 'Q?',
    header: 'H',
    multiSelect: false,
    options: [
      { label: 'A', description: 'a' },
      { label: 'B', description: 'b' },
    ],
  };

  test('accepts a well-formed single question', () => {
    expect(AskUserQuestionSchema.safeParse({ questions: [validQuestion] }).success).toBe(true);
  });

  test('rejects zero questions', () => {
    expect(AskUserQuestionSchema.safeParse({ questions: [] }).success).toBe(false);
  });

  test('rejects more than four questions', () => {
    const five = Array.from({ length: 5 }, () => validQuestion);
    expect(AskUserQuestionSchema.safeParse({ questions: five }).success).toBe(false);
  });

  test('rejects a question with fewer than two options', () => {
    const q = { ...validQuestion, options: [{ label: 'A', description: 'a' }] };
    expect(AskUserQuestionSchema.safeParse({ questions: [q] }).success).toBe(false);
  });

  test('rejects a question with more than four options', () => {
    const opts = Array.from({ length: 5 }, (_, i) => ({ label: `O${i}`, description: 'x' }));
    const q = { ...validQuestion, options: opts };
    expect(AskUserQuestionSchema.safeParse({ questions: [q] }).success).toBe(false);
  });

  test('rejects a header longer than 12 characters', () => {
    const q = { ...validQuestion, header: 'ThisHeaderIsWayTooLong' };
    expect(AskUserQuestionSchema.safeParse({ questions: [q] }).success).toBe(false);
  });
});
