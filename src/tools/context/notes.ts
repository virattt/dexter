import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SessionStore } from '../../context/session-store.js';
import { formatToolResult } from '../types.js';

export const NOTES_DESCRIPTION = `
Read and maintain notes that survive context-window resets within this session.

## When to Use

- As you work: save durable facts (tickers, figures with dates and units, sources, decisions, open questions, your plan)
- When warned that the context window is nearly full: save everything you need to continue
- After a reset: read or search notes to recover state

## When NOT to Use

- For long-term memory across sessions (use \`memory_update\`)
- For workspace project files (use \`write_file\` / \`edit_file\`)

## Actions

- **write**: create or replace a file. Requires \`path\` and \`text\`.
- **append**: add text to a file. Requires \`path\` and \`text\`.
- **read**: read a file, optionally a line range. Requires \`path\`. Negative \`start_line\`/\`stop_line\` count from the end.
- **list**: list note paths, optionally filtered by \`prefix\`.
- **search**: find lines containing \`query\` (case-insensitive substring).

Paths are virtual (e.g. \`aapl/financials.md\`), not filesystem paths. Each file must stay at or below 1,000,000 bytes; create another file before that.
`.trim();

const notesSchema = z.object({
  action: z.enum(['write', 'append', 'read', 'list', 'search']),
  path: z.string().optional().describe('Note path. Required for write, append, read.'),
  text: z.string().optional().describe('Text to write or append.'),
  query: z.string().optional().describe('Substring to search for. Required for search.'),
  prefix: z.string().optional().describe('Path prefix filter for list.'),
  start_line: z.number().int().optional().describe('First line to read (1-based, negative counts from end).'),
  stop_line: z.number().int().optional().describe('Last line to read (1-based, negative counts from end).'),
});

export const notesTool = new DynamicStructuredTool({
  name: 'notes',
  description: 'Write, append, read, list, or search session notes that persist across context-window resets.',
  schema: notesSchema,
  func: async (input) => {
    const store = SessionStore.get();
    try {
      switch (input.action) {
        case 'write':
        case 'append': {
          if (!input.path || input.text === undefined) {
            return formatToolResult({ success: false, error: '"path" and "text" are required.' });
          }
          if (input.action === 'write') await store.writeNote(input.path, input.text);
          else await store.appendNote(input.path, input.text);
          return formatToolResult({ success: true, path: input.path, bytes: Buffer.byteLength(input.text, 'utf8') });
        }
        case 'read': {
          if (!input.path) return formatToolResult({ success: false, error: '"path" is required.' });
          const text = await store.readNote(input.path, input.start_line, input.stop_line);
          return formatToolResult({ success: true, path: input.path, text });
        }
        case 'list': {
          const paths = await store.listNotes(input.prefix);
          return formatToolResult({ success: true, paths });
        }
        case 'search': {
          if (!input.query) return formatToolResult({ success: false, error: '"query" is required.' });
          const matches = await store.searchNotes(input.query);
          return formatToolResult({ success: true, matches });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ success: false, error: message });
    }
  },
});

/** Context tools are bookkeeping, not research: the chat log shows no row for them. */
const HIDDEN_CONTEXT_TOOLS = new Set(['notes', 'history', 'get_context_remaining', 'new_context_window']);

export function isHiddenContextTool(tool: string): boolean {
  return HIDDEN_CONTEXT_TOOLS.has(tool);
}
