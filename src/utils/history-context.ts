export const HISTORY_CONTEXT_MARKER = '[Chat history for context]';
export const CURRENT_MESSAGE_MARKER = '[Current message - respond to this]';
export const DEFAULT_HISTORY_LIMIT = 10;
export const FULL_ANSWER_TURNS = 3;

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export function buildHistoryContext(params: {
  entries: HistoryEntry[];
  currentMessage: string;
  lineBreak?: string;
}): string {
  const lineBreak = params.lineBreak ?? '\n';
  if (params.entries.length === 0) {
    return params.currentMessage;
  }

  const historyText = params.entries
    .map(entry => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
    .join(`${lineBreak}${lineBreak}`);

  return [
    HISTORY_CONTEXT_MARKER,
    historyText,
    '',
    CURRENT_MESSAGE_MARKER,
    params.currentMessage,
  ].join(lineBreak);
}
