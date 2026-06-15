/**
 * Shared types for the ask_user_question tool.
 *
 * These live in the tool directory (not src/agent) so the agent layer can import
 * them type-only without creating a runtime agent → tool dependency cycle.
 */

/** A single selectable option within a question. */
export interface QuestionOption {
  /** Short label shown in the list and echoed back as the answer. */
  label: string;
  /** One-line explanation of what choosing this option means. */
  description: string;
}

/** One question presented to the user. */
export interface Question {
  /** The full question text. */
  question: string;
  /** Short chip/tab label (<=12 chars), e.g. "Timeframe". */
  header: string;
  /** Whether the user may select more than one option. */
  multiSelect: boolean;
  /**
   * The model-supplied options (2-4). The interactive "Other" free-text choice
   * is appended by the UI at render time — it is never part of this array.
   */
  options: QuestionOption[];
}

/** The user's answer to a single question, positionally aligned to questions[]. */
export interface QuestionAnswer {
  /** Echo of the question's header chip. */
  header: string;
  /** Echo of the question text. */
  question: string;
  /** Chosen option label(s). One for single-select, one-or-more for multi-select. */
  selected: string[];
  /** Free text entered via the "Other" option, if chosen. */
  otherText?: string;
  /** Optional free-text notes the user attached to this answer. */
  notes?: string;
}

/** The full result returned from the interactive prompt. */
export interface UserAnswers {
  answers: QuestionAnswer[];
  /** True when the user dismissed the prompt without answering. */
  declined?: boolean;
}

/**
 * The callback the CLI provides to collect answers. Threaded from the controller
 * through AgentConfig and into the tool via `config.metadata.onUserInput`.
 */
export type RequestUserInput = (request: { questions: Question[] }) => Promise<UserAnswers>;
