/**
 * Per-turn tool result budget enforcement.
 *
 * Caps the total tool result content per turn. When parallel tool calls
 * return large results that exceed the budget, the largest results are
 * persisted to disk first.
 */

import { ToolMessage } from '@langchain/core/messages';
import { persistLargeResult, buildPersistedContent } from './tool-result-storage.js';

/** Maximum total characters across all tool results in a single turn. */
export const MAX_TURN_RESULT_CHARS = 200_000;

/**
 * Enforce per-turn budget on tool results. Persists the largest results
 * to disk until the total fits under the budget.
 *
 * Returns the original array if already under budget.
 */
export function enforceResultBudget(toolMessages: ToolMessage[]): ToolMessage[] {
  const totalChars = toolMessages.reduce((sum, tm) => {
    const content = typeof tm.content === 'string' ? tm.content : JSON.stringify(tm.content);
    return sum + content.length;
  }, 0);

  if (totalChars <= MAX_TURN_RESULT_CHARS) {
    return toolMessages;
  }

  // Build index with content lengths, sort largest first
  const indexed = toolMessages.map((tm, i) => ({
    index: i,
    tm,
    content: typeof tm.content === 'string' ? tm.content : JSON.stringify(tm.content),
  }));
  const bySize = [...indexed].sort((a, b) => b.content.length - a.content.length);

  let remaining = totalChars;
  const toPersist = new Set<number>();

  for (const entry of bySize) {
    if (remaining <= MAX_TURN_RESULT_CHARS) break;
    toPersist.add(entry.index);
    remaining -= entry.content.length;
    // Add back the preview size (~2KB)
    remaining += 2_500;
  }

  if (toPersist.size === 0) return toolMessages;

  return toolMessages.map((tm, i) => {
    if (!toPersist.has(i)) return tm;

    const content = typeof tm.content === 'string' ? tm.content : JSON.stringify(tm.content);
    const { preview, filePath } = persistLargeResult(
      tm.name ?? 'unknown',
      tm.tool_call_id,
      content,
    );
    return new ToolMessage({
      content: buildPersistedContent(filePath, preview, content.length),
      tool_call_id: tm.tool_call_id,
      name: tm.name,
    });
  });
}
