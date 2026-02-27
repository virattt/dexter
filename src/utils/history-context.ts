export const HISTORY_CONTEXT_MARKER = '[Chat history for context]';
export const CURRENT_MESSAGE_MARKER = '[Current message - respond to this]';
export const DEFAULT_HISTORY_LIMIT = 10;
export const FULL_ANSWER_TURNS = 3;

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface BuildHistoryContextParams {
  entries: HistoryEntry[];
  currentMessage: string;
  /**
   * Line break separator to use between lines.
   * Defaults to '\n'.
   */
  lineBreak?: string;
  /**
   * Maximum number of history entries to include.
   * If omitted, DEFAULT_HISTORY_LIMIT is used.
   * If <= 0, all entries are included.
   */
  historyLimit?: number;
}

export function buildHistoryContext(params: BuildHistoryContextParams): string {
  const lineBreak = params.lineBreak ?? '\n';
  const effectiveLimit =
    typeof params.historyLimit === 'number' ? params.historyLimit : DEFAULT_HISTORY_LIMIT;

  const entriesToUse =
    effectiveLimit > 0 && params.entries.length > effectiveLimit
      ? params.entries.slice(-effectiveLimit)
      : params.entries;

  if (entriesToUse.length === 0) {
    return params.currentMessage;
  }

  const historyText = entriesToUse
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
    .join(`${lineBreak}${lineBreak}`);

  return [
    HISTORY_CONTEXT_MARKER,
    historyText,
    '',
    CURRENT_MESSAGE_MARKER,
    params.currentMessage,
  ].join(lineBreak);
}
