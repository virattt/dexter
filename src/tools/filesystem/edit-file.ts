import { DynamicStructuredTool } from '@langchain/core/tools';
import { constants } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { assertSandboxPath } from './sandbox.js';
import {
  detectLineEnding,
  fuzzyFindText,
  generateDiffString,
  normalizeForFuzzyMatch,
  normalizeToLF,
  restoreLineEndings,
  stripBom,
} from './utils/edit-diff.js';

export const EDIT_FILE_DESCRIPTION = `
Perform precise in-place text edits in a local workspace file.

## When to Use

- Replacing a specific block/string in an existing file
- Making surgical code/config edits without rewriting full file

## When NOT to Use

- Creating or overwriting entire files (use \`write_file\`)
- Reading file contents (use \`read_file\`)

## Usage Notes

- The system will prompt the user for confirmation automatically; just call the tool directly
- Accepts \`path\`, \`old_text\`, and \`new_text\`
- \`old_text\` must be unique in the file; ambiguous matches are rejected
- Preserves BOM and line ending style where possible
- Returns a unified diff summary of the change
`.trim();

const editFileSchema = z.object({
  path: z.string().describe('Path to the file to edit (relative or absolute).'),
  old_text: z.string().describe('Exact text to find and replace.'),
  new_text: z.string().describe('New text to replace old_text with.'),
});

export const editFileTool = new DynamicStructuredTool({
  name: 'edit_file',
  description:
    'Make precise text replacements in a file. The target text must be unique in the file to avoid ambiguous edits.',
  schema: editFileSchema,
  func: async (input) => {
    const cwd = process.cwd();
    const { resolved } = await assertSandboxPath({
      filePath: input.path,
      cwd,
      root: cwd,
    });

    try {
      await access(resolved, constants.R_OK | constants.W_OK);
    } catch {
      throw new Error(`File not found or not writable: ${input.path}`);
    }

    const rawContent = (await readFile(resolved)).toString('utf-8');
    const { bom, text: content } = stripBom(rawContent);

    const originalEnding = detectLineEnding(content);
    const normalizedContent = normalizeToLF(content);
    const normalizedOldText = normalizeToLF(input.old_text);
    const normalizedNewText = normalizeToLF(input.new_text);

    const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);
    if (!matchResult.found) {
      throw new Error(
        `Could not find the exact text in ${input.path}. The old_text must match exactly including whitespace/newlines.`,
      );
    }

    const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
    const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
    const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;
    if (occurrences > 1) {
      throw new Error(
        `Found ${occurrences} occurrences of old_text in ${input.path}. Provide more context so it is unique.`,
      );
    }

    const baseContent = matchResult.contentForReplacement;
    const newContent =
      baseContent.substring(0, matchResult.index) +
      normalizedNewText +
      baseContent.substring(matchResult.index + matchResult.matchLength);

    if (baseContent === newContent) {
      throw new Error(`No changes made to ${input.path}. Replacement produced identical content.`);
    }

    const finalContent = bom + restoreLineEndings(newContent, originalEnding);
    await writeFile(resolved, finalContent, 'utf-8');

    const diffResult = generateDiffString(baseContent, newContent);
    return formatToolResult({
      path: input.path,
      message: `Successfully replaced text in ${input.path}.`,
      diff: diffResult.diff,
      firstChangedLine: diffResult.firstChangedLine,
    });
  },
});
