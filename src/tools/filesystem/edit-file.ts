/**
 * edit_file tool — performs exact string replacements in a file.
 *
 * Checks permissions before editing. Validates that old_string exists and
 * is unique (unless replace_all is true).
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { formatToolResult } from '../types.js';
import { requestPermission } from '../../utils/permissions.js';

export const editFileTool = new DynamicStructuredTool({
  name: 'edit_file',
  description:
    'Perform exact string replacement in a file. Finds old_string in the file and replaces it with new_string. By default, old_string must appear exactly once (use replace_all for multiple occurrences).',
  schema: z.object({
    file_path: z.string().describe('Absolute or relative path to the file to edit.'),
    old_string: z.string().describe('The exact text to find and replace.'),
    new_string: z.string().describe('The replacement text.'),
    replace_all: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, replace all occurrences. If false (default), old_string must be unique.'),
  }),
  func: async (input) => {
    const filePath = resolve(input.file_path);

    // Check permissions
    const perm = requestPermission('edit_file', filePath);
    if (!perm.allowed) {
      return perm.message!;
    }

    if (!existsSync(filePath)) {
      return `Error: File not found: ${filePath}`;
    }

    if (input.old_string === input.new_string) {
      return 'Error: old_string and new_string are identical. No changes needed.';
    }

    try {
      const content = readFileSync(filePath, 'utf-8');

      // Count occurrences
      let count = 0;
      let idx = 0;
      while ((idx = content.indexOf(input.old_string, idx)) !== -1) {
        count++;
        idx += input.old_string.length;
      }

      if (count === 0) {
        return `Error: old_string not found in ${filePath}. Make sure the string matches exactly (including whitespace and indentation).`;
      }

      if (count > 1 && !input.replace_all) {
        return (
          `Error: old_string appears ${count} times in ${filePath}. ` +
          `Provide more surrounding context to make it unique, or set replace_all to true.`
        );
      }

      // Perform replacement
      let newContent: string;
      if (input.replace_all) {
        newContent = content.split(input.old_string).join(input.new_string);
      } else {
        // Replace first (and only) occurrence
        const pos = content.indexOf(input.old_string);
        newContent =
          content.slice(0, pos) + input.new_string + content.slice(pos + input.old_string.length);
      }

      writeFileSync(filePath, newContent, 'utf-8');

      return formatToolResult({
        file_path: filePath,
        replacements: count,
        message: `Successfully replaced ${count} occurrence${count !== 1 ? 's' : ''} in ${filePath}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error editing file: ${message}`;
    }
  },
});
