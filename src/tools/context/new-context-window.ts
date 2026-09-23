import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SessionStore } from '../../context/session-store.js';
import { formatToolResult } from '../types.js';

export const NEW_CONTEXT_WINDOW_DESCRIPTION = `
Start a new context window after this turn. Current messages are archived to history; notes persist.

## When to Use

- When the window is cluttered with tool results you no longer need
- After saving notes, when you want a clean slate before the next phase of research

## When NOT to Use

- Before saving important state to notes. Save first, then call this.

Does not clear or reset the environment, notes, or memory.
`.trim();

export const newContextWindowTool = new DynamicStructuredTool({
  name: 'new_context_window',
  description: 'Start a new context window after this turn. Notes and history persist.',
  schema: z.object({}),
  func: async () => {
    SessionStore.get().requestNewWindow();
    return formatToolResult({ success: true, message: 'A new context window will start after this turn.' });
  },
});
