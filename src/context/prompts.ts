export const CONTEXT_WINDOW_GUIDANCE = `<context_window_guidance>
Your context window has a fixed token budget. When it fills, it is reset: all messages in the current window are cleared. Notes and history persist across resets.

Save durable facts to notes as you work, not only when warned: tickers, figures with dates and units, sources, decisions, open questions, and your current plan. Use the \`notes\` tool. Read them back with \`notes\` (read/search) and recover old messages with \`history\` (search/read_item). Check remaining budget with \`get_context_remaining\`. Start a fresh window yourself with \`new_context_window\` when the current one is cluttered.

Before you give a final answer, update notes with the key facts from this query. Do this for every query, including follow-ups. Append to an existing note file when the topic is the same; otherwise write a new one.
</context_window_guidance>`;

export interface ContextWindowBlockParams {
  windowNumber: number;
  currentWindowId: string;
  previousWindowId: string | null;
  tokensLeft: number | null;
  hint: string | null;
}

export function buildContextWindowBlock(params: ContextWindowBlockParams): string {
  const lines = [
    `Window number: ${params.windowNumber}`,
    `Current context window id: ${params.currentWindowId}`,
  ];
  if (params.previousWindowId) {
    lines.push(`Previous context window id: ${params.previousWindowId}`);
  }
  lines.push(
    params.tokensLeft === null
      ? 'You have unknown tokens left in this context window.'
      : `You have ${params.tokensLeft} tokens left in this context window.`,
  );
  if (params.hint) {
    lines.push('', 'Notes from previous windows:', params.hint);
  }
  return `<context_window>\n${lines.join('\n')}\n</context_window>`;
}

export function buildReminder(tokensLeft: number): string {
  return `Your context window is nearly exhausted (only ${tokensLeft} tokens remaining) and will be automatically reset for you soon. Once reset, message items in current context window will be cleared in the new window, but notes and history items will be persistent across windows.`;
}

export const FALLBACK_PROMPT =
  'Your context window is full. Save the important state to notes now: key figures, sources, decisions, and what to do next. The window will be reset after this turn.';

export function buildThreadHintCondensePrompt(notes: string, maxBytes: number): string {
  return `Condense the notes below to at most ${maxBytes} bytes. Keep every number, ticker, date, source, decision, and open question. Drop prose and repetition. Output plain text only.

${notes}`;
}
