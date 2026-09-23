import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SessionStore } from '../../context/session-store.js';
import { formatToolResult } from '../types.js';

export const GET_CONTEXT_REMAINING_DESCRIPTION = `
Get the remaining tokens in the current context window.

## When to Use

- Before a long series of tool calls, to decide whether to save notes first
- When unsure whether a reset is close

Returns \`tokens_left\`, or null when unknown (before the first model call in a window).
`.trim();

export const getContextRemainingTool = new DynamicStructuredTool({
  name: 'get_context_remaining',
  description: 'Get the remaining tokens in the current context window.',
  schema: z.object({}),
  func: async () => {
    const store = SessionStore.get();
    return formatToolResult({ tokens_left: store.tokensLeft, window_number: store.windowState.windowNumber });
  },
});
