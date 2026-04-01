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

## Usage

For the common case (remembering something), just pass \`content\`. Action defaults to "append" and file defaults to long-term memory (MEMORY.md). Only pass \`action\` and \`file\` when you need something other than the defaults.

- **append** (default): Add new content. Requires \`content\`.
- **edit**: Find-and-replace text. Requires \`old_text\` and \`new_text\`.
- **delete**: Remove specific text. Requires \`old_text\`.

## File Aliases

- \`"long_term"\` (default) -> MEMORY.md (durable facts, preferences)
- \`"daily"\` -> today's YYYY-MM-DD.md
- Or specify a filename directly (e.g. \`"2026-03-08.md"\`)
`.trim();

const memoryUpdateSchema = z.object({
  content: z
    .string()
    .optional()
    .describe('Text to append. Required for "append" action.'),
  action: z
    .enum(['append', 'edit', 'delete'])
    .default('append')
    .describe('The operation. Defaults to "append". Only pass for "edit" or "delete".'),
  file: z
    .string()
    .default('long_term')
    .describe('Target file. Defaults to "long_term" (MEMORY.md). Only pass for "daily" or a specific filename.'),
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
