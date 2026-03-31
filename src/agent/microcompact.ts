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
export const COUNT_TRIGGER_THRESHOLD = 15;

/** Keep this many most recent compactable ToolMessages. */
export const COUNT_KEEP_RECENT = 5;

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
  trigger: 'count' | null;
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

  if (compactableIndices.length <= COUNT_TRIGGER_THRESHOLD) {
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
    trigger: 'count',
  };
}
