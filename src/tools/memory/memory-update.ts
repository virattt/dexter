import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '../../memory/index.js';
import { formatToolResult } from '../types.js';

export const MEMORY_UPDATE_DESCRIPTION = `
Add, edit, or delete persistent memory entries.

## When to Use

- When the user says "remember", "note", "save", or asks you to store something for later
- When the user asks you to update, correct, or change an existing memory
- When the user asks to forget or remove something from memory
- To persist durable facts, preferences, or decisions across sessions

## When NOT to Use

- For workspace project files (use \`write_file\` / \`edit_file\`)
- For temporary scratchpad data that does not need to persist

## Actions

- **append**: Add new content to the end of a memory file. Requires \`content\`.
- **edit**: Find-and-replace text in a memory file. Requires \`old_text\` and \`new_text\`.
- **delete**: Remove specific text from a memory file. Requires \`old_text\`.

## File Aliases

- \`"long_term"\` -> MEMORY.md (durable facts, preferences)
- \`"daily"\` -> today's YYYY-MM-DD.md
- Or specify a filename directly (e.g. \`"2026-03-08.md"\`)
`.trim();

const memoryUpdateSchema = z.object({
  action: z
    .enum(['append', 'edit', 'delete'])
    .describe('The operation: "append" to add, "edit" to find-and-replace, "delete" to remove.'),
  file: z
    .string()
    .describe('Target file: "long_term" (MEMORY.md), "daily" (today\'s log), or a filename like "2026-03-08.md".'),
  content: z
    .string()
    .optional()
    .describe('Text to append. Required for "append" action.'),
  old_text: z
    .string()
    .optional()
    .describe('Existing text to find. Required for "edit" and "delete" actions.'),
  new_text: z
    .string()
    .optional()
    .describe('Replacement text. Required for "edit" action.'),
});

export const memoryUpdateTool = new DynamicStructuredTool({
  name: 'memory_update',
  description:
    'Add, edit, or delete persistent memory entries in MEMORY.md or daily logs.',
  schema: memoryUpdateSchema,
  func: async (input) => {
    const manager = await MemoryManager.get();
    const file = resolveDisplayName(input.file);

    switch (input.action) {
      case 'append': {
        if (!input.content) {
          return formatToolResult({ success: false, error: '"content" is required for append.' });
        }
        await manager.appendMemory(input.file, input.content);
        return formatToolResult({
          success: true,
          file,
          message: `Appended ${input.content.length} characters to ${file}`,
        });
      }

      case 'edit': {
        if (!input.old_text || !input.new_text) {
          return formatToolResult({
            success: false,
            error: '"old_text" and "new_text" are required for edit.',
          });
        }
        const edited = await manager.editMemory(input.file, input.old_text, input.new_text);
        if (!edited) {
          return formatToolResult({
            success: false,
            file,
            error: `Could not find the specified text in ${file}. Use memory_get to verify the exact content.`,
          });
        }
        return formatToolResult({ success: true, file, message: `Updated entry in ${file}` });
      }

      case 'delete': {
        if (!input.old_text) {
          return formatToolResult({
            success: false,
            error: '"old_text" is required for delete.',
          });
        }
        const deleted = await manager.deleteMemory(input.file, input.old_text);
        if (!deleted) {
          return formatToolResult({
            success: false,
            file,
            error: `Could not find the specified text in ${file}. Use memory_get to verify the exact content.`,
          });
        }
        return formatToolResult({ success: true, file, message: `Removed entry from ${file}` });
      }
    }
  },
});

function resolveDisplayName(file: string): string {
  if (file === 'long_term') return 'MEMORY.md';
  if (file === 'daily') return `${new Date().toISOString().slice(0, 10)}.md`;
  return file;
}
