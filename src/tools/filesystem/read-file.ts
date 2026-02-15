/**
 * read_file tool — reads a file from the local file system.
 *
 * Returns file content with line numbers. Checks permissions before reading.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { formatToolResult } from '../types.js';
import { requestPermission } from '../../utils/permissions.js';

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

/**
 * Format file content with line numbers (cat -n style).
 */
function formatWithLineNumbers(content: string, offset: number, limit: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, offset);
  const end = Math.min(lines.length, start + limit);
  const selected = lines.slice(start, end);

  // Determine padding width for line numbers
  const maxLineNum = start + selected.length;
  const padWidth = String(maxLineNum).length;

  return selected
    .map((line, i) => {
      const lineNum = String(start + i + 1).padStart(padWidth, ' ');
      const truncated = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) + '...' : line;
      return `${lineNum}\t${truncated}`;
    })
    .join('\n');
}

export const readFileTool = new DynamicStructuredTool({
  name: 'read_file',
  description: 'Read a file from the local file system. Returns content with line numbers.',
  schema: z.object({
    file_path: z.string().describe('Absolute or relative path to the file to read.'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Line number to start reading from (0-based). Defaults to 0.'),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(`Maximum number of lines to read. Defaults to ${DEFAULT_LINE_LIMIT}.`),
  }),
  func: async (input) => {
    const filePath = resolve(input.file_path);

    // Check permissions
    const perm = requestPermission('read_file', filePath);
    if (!perm.allowed) {
      return perm.message!;
    }

    // Validate file exists
    if (!existsSync(filePath)) {
      return `Error: File not found: ${filePath}`;
    }

    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return `Error: "${filePath}" is a directory, not a file. Use a shell command to list directory contents.`;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const offset = input.offset ?? 0;
      const limit = input.limit ?? DEFAULT_LINE_LIMIT;
      const totalLines = content.split('\n').length;
      const formatted = formatWithLineNumbers(content, offset, limit);

      const truncated = offset + limit < totalLines;
      const meta: Record<string, unknown> = {
        file_path: filePath,
        total_lines: totalLines,
        offset,
        lines_returned: Math.min(limit, Math.max(0, totalLines - offset)),
      };
      if (truncated) {
        meta.truncated = true;
        meta.hint = `File has ${totalLines} lines. Use offset=${offset + limit} to read more.`;
      }

      return formatToolResult({ ...meta, content: formatted });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error reading file: ${message}`;
    }
  },
});
