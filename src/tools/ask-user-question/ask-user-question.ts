import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import type { Question, QuestionAnswer, RequestUserInput, UserAnswers } from './types.js';

/**
 * Rich description for the ask_user_question tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const ASK_USER_QUESTION_DESCRIPTION = `
Ask the user one to four multiple-choice questions and pause until they answer.

## When to Use

- A request is genuinely ambiguous and the answer materially changes your approach
  (e.g. which ticker/entity is meant, what timeframe, which valuation method, how much detail).
- You hit a fork with a few discrete, well-defined options and need the user to choose.

## When NOT to Use

- When you can reasonably infer the answer or proceed under a stated assumption — prefer acting.
- For open-ended information you could gather yourself with another tool (search, financials, filings).
- More than once for the same decision. Do not re-ask after the user has answered or dismissed.

## Schema

- **questions** (required): 1-4 questions. Each has:
  - **question**: the full question text.
  - **header**: a short chip/tab label, max 12 characters (e.g. "Timeframe").
  - **multiSelect**: true to let the user pick multiple options, false for a single choice.
  - **options**: 2-4 options, each with a **label** and a **description**.

## Usage Notes

- An "Other" free-text choice is added to every question automatically — do NOT include your own.
- The user may also attach free-text notes to any answer.
- If you have a recommended option, put it FIRST and add "(Recommended)" to its label.
- Make options mutually exclusive (unless multiSelect) and labels concise.

## Returns

For each question: the header, the selected option label(s), any "Other" free text, and any
notes. Treat these as the user's decision and continue the task with them in mind.
`.trim();

const QuestionOptionSchema = z.object({
  label: z.string().describe('Short selectable label. Put the recommended option first and mark it "(Recommended)".'),
  description: z.string().describe('One-line explanation of what choosing this option means.'),
});

const QuestionSchema = z.object({
  question: z.string().describe('The full question to ask the user.'),
  header: z.string().max(12).describe('Short chip/tab label, max 12 chars (e.g. "Timeframe").'),
  multiSelect: z.boolean().describe('Whether the user may select multiple options.'),
  options: z.array(QuestionOptionSchema).min(2).max(4).describe('2-4 mutually exclusive options.'),
});

export const AskUserQuestionSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(4).describe('1-4 questions to ask the user.'),
});

/** Message returned when no interactive user is available (gateway/subagent/headless). */
const UNAVAILABLE_MESSAGE =
  'The ask_user_question tool is unavailable here (no interactive user). Proceed using your ' +
  'best judgment and reasonable default assumptions, and state the assumptions you made.';

/** Message returned when the user dismisses the prompt without answering. */
const DECLINED_MESSAGE =
  'The user dismissed the question prompt without answering. Do not ask again; proceed with ' +
  'reasonable defaults and note the assumptions you made.';

/**
 * Format the collected answers into the string handed back to the model.
 * Pure function, exported for unit testing — this is the tool's output contract.
 */
export function formatAnswers(answers: QuestionAnswer[]): string {
  if (answers.length === 0) {
    return 'The user submitted no answers.';
  }
  return answers
    .map((a) => {
      const picks = [...a.selected];
      if (a.otherText) {
        picks.push(`Other: ${a.otherText}`);
      }
      const selected = picks.length ? picks.join(', ') : '(no selection)';
      const notes = a.notes ? `\n  Notes: ${a.notes}` : '';
      return `Q (${a.header}): ${a.question}\n  Answer: ${selected}${notes}`;
    })
    .join('\n\n');
}

/**
 * Build the ask_user_question tool.
 *
 * The tool reads the `onUserInput` callback the CLI injects via `config.metadata`
 * (the same channel `onProgress` uses), awaits the user's answers, and returns
 * them formatted for the model. When the callback is absent it degrades gracefully
 * so non-interactive surfaces never hang.
 */
export function createAskUserQuestion(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'ask_user_question',
    description: 'Ask the user 1-4 multiple-choice questions and wait for their answers. Returns the selected options.',
    schema: AskUserQuestionSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const requestUserInput = config?.metadata?.onUserInput as RequestUserInput | undefined;

      if (!requestUserInput) {
        return UNAVAILABLE_MESSAGE;
      }

      const result: UserAnswers = await requestUserInput({ questions: input.questions as Question[] });

      if (result.declined) {
        return DECLINED_MESSAGE;
      }
      return formatAnswers(result.answers);
    },
  });
}
