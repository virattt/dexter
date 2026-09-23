import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SessionStore } from '../../context/session-store.js';
import { formatToolResult } from '../types.js';

export const HISTORY_DESCRIPTION = `
Recover messages from earlier context windows in this session after a reset.

## When to Use

- After a context-window reset, when notes do not have a detail you need
- To find an exact figure, tool result, or user instruction from earlier in the session

## When NOT to Use

- For the current window (those messages are already in context)
- For facts from past sessions (use \`memory_search\`)

## Actions

- **list_windows**: window IDs with item counts, oldest first (\`recent_first\` to flip).
- **list_items**: item previews. Filter by \`window_id\` and \`role\`. Use \`limit\`.
- **read_item**: full content of one item. Requires \`window_id\` and \`ordinal\`. Use \`offset_chars\`/\`limit_chars\` for long items.
- **search**: items whose content contains \`query\` (case-insensitive substring). Same filters as list_items.

Items are returned with the window ID and ordinal you need for read_item.
`.trim();

const historySchema = z.object({
  action: z.enum(['list_windows', 'list_items', 'read_item', 'search']),
  window_id: z.string().optional().describe('Restrict to one window.'),
  ordinal: z.number().int().optional().describe('Item ordinal within the window. Required for read_item.'),
  role: z.enum(['user', 'assistant', 'tool', 'system']).optional().describe('Filter by message role.'),
  query: z.string().optional().describe('Substring to search for. Required for search.'),
  limit: z.number().int().min(1).optional().describe('Maximum results to return.'),
  recent_first: z.boolean().optional().describe('Return newest first.'),
  offset_chars: z.number().int().min(0).optional().describe('read_item: start offset in characters.'),
  limit_chars: z.number().int().min(1).optional().describe('read_item: maximum characters to return.'),
});

export const historyTool = new DynamicStructuredTool({
  name: 'history',
  description: 'List, read, or search messages from earlier context windows in this session.',
  schema: historySchema,
  func: async (input) => {
    const store = SessionStore.get();
    try {
      switch (input.action) {
        case 'list_windows': {
          const windows = await store.listWindows(input.recent_first ?? false, input.limit);
          return formatToolResult({ success: true, windows });
        }
        case 'list_items': {
          const items = await store.listItems({
            windowId: input.window_id,
            role: input.role,
            limit: input.limit,
            recentFirst: input.recent_first,
          });
          return formatToolResult({ success: true, items });
        }
        case 'read_item': {
          if (!input.window_id || input.ordinal === undefined) {
            return formatToolResult({ success: false, error: '"window_id" and "ordinal" are required.' });
          }
          const item = await store.readItem(input.window_id, input.ordinal, input.offset_chars, input.limit_chars);
          if (!item) return formatToolResult({ success: false, error: 'Item not found.' });
          return formatToolResult({ success: true, item });
        }
        case 'search': {
          if (!input.query) return formatToolResult({ success: false, error: '"query" is required.' });
          const items = await store.searchHistory(input.query, {
            windowId: input.window_id,
            role: input.role,
            limit: input.limit,
            recentFirst: input.recent_first,
          });
          return formatToolResult({ success: true, items });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ success: false, error: message });
    }
  },
});
