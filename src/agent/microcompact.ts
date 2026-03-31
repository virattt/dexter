/**
 * Microcompact: per-turn lightweight trimming of old ToolMessage content.
 *
 * Unlike full compaction (which calls an LLM to summarize), microcompact
 * simply replaces old ToolMessage content with a cleared marker. This
 * prevents context from growing to the full compaction threshold.
 *
 * Lightweight alternative to full compaction.
 */

import { ToolMessage, type BaseMessage } from '@langchain/core/messages';

/** Marker text replacing cleared tool results. */
export const MC_CLEARED_MESSAGE = '[Old tool result content cleared]';

/** Fire when compactable ToolMessages exceed this count. */
export const COUNT_TRIGGER_THRESHOLD = 8;

/** Keep this many most recent compactable ToolMessages. */
export const COUNT_KEEP_RECENT = 4;

/** Fire when total compactable ToolMessage content exceeds this many estimated tokens. */
export const TOKEN_TRIGGER_THRESHOLD = 80_000;

/** Tool names whose results can be safely cleared (read-only tools). */
const COMPACTABLE_TOOLS = new Set([
  'get_financials', 'get_market_data', 'read_filings', 'stock_screener',
  'web_fetch', 'web_search', 'x_search', 'browser', 'read_file',
  'memory_search', 'memory_get', 'heartbeat', 'cron',
]);

export interface MicrocompactResult {
  messages: BaseMessage[];
  /** Number of ToolMessages whose content was cleared. */
  cleared: number;
  /** Estimated tokens saved by clearing. */
  estimatedTokensSaved: number;
  /** Which trigger fired, or null if nothing was cleared. */
  trigger: 'count' | 'token' | null;
}

/**
 * Per-turn lightweight trimming of old ToolMessage content.
 *
 * Count-based: when total compactable ToolMessages exceed the threshold,
 * replace the oldest ones' content with a cleared marker, keeping the
 * most recent N.
 *
 * Returns a new array if changes were made; returns the original if not.
 */
export function microcompactMessages(messages: BaseMessage[]): MicrocompactResult {
  // Collect indices of compactable ToolMessages with real content
  const compactableIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (
      msg instanceof ToolMessage &&
      COMPACTABLE_TOOLS.has(msg.name ?? '') &&
      typeof msg.content === 'string' &&
      msg.content !== MC_CLEARED_MESSAGE
    ) {
      compactableIndices.push(i);
    }
  }

  // Check count-based trigger
  const countTriggered = compactableIndices.length > COUNT_TRIGGER_THRESHOLD;

  // Check token-based trigger (catches few-but-large results)
  let totalTokens = 0;
  if (!countTriggered) {
    for (const idx of compactableIndices) {
      const content = (messages[idx] as ToolMessage).content;
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      totalTokens += Math.ceil(text.length / 3.5);
    }
  }
  const tokenTriggered = !countTriggered && totalTokens > TOKEN_TRIGGER_THRESHOLD;

  if (!countTriggered && !tokenTriggered) {
    return { messages, cleared: 0, estimatedTokensSaved: 0, trigger: null };
  }

  // Keep last KEEP_RECENT, clear the rest
  const keepSet = new Set(compactableIndices.slice(-COUNT_KEEP_RECENT));
  const clearIndices = compactableIndices.filter(i => !keepSet.has(i));

  if (clearIndices.length === 0) {
    return { messages, cleared: 0, estimatedTokensSaved: 0, trigger: null };
  }

  let tokensSaved = 0;
  const clearSet = new Set(clearIndices);

  const newMessages = messages.map((msg, i) => {
    if (clearSet.has(i) && msg instanceof ToolMessage) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      tokensSaved += Math.ceil(content.length / 3.5);
      return new ToolMessage({
        content: MC_CLEARED_MESSAGE,
        tool_call_id: msg.tool_call_id,
        name: msg.name,
      });
    }
    return msg;
  });

  return {
    messages: newMessages,
    cleared: clearIndices.length,
    estimatedTokensSaved: tokensSaved,
    trigger: countTriggered ? 'count' : 'token',
  };
}
