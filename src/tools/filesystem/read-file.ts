import { DynamicStructuredTool } from '@langchain/core/tools';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { assertSandboxPath } from './sandbox.js';
import { resolveReadPath } from './utils/path-utils.js';
import { DEFAULT_MAX_BYTES, formatSize, truncateHead } from './utils/truncate.js';

export const READ_FILE_DESCRIPTION = `
Read file contents from the local workspace.

## When to Use

- Reading local project files before making edits
- Inspecting config/code/data files in the workspace
- Paginating large files with \`offset\` and \`limit\`

## When NOT to Use

- Fetching web URLs (use \`web_fetch\`)
- Looking up financial APIs (use \`financial_search\` / \`financial_metrics\`)
- Writing or changing files (use \`write_file\` / \`edit_file\`)

## Usage Notes

- Accepts \`path\` (absolute or relative to current workspace)
- Optional \`offset\` is 1-indexed line number
- Optional \`limit\` caps returned lines
- Large output is truncated with continuation hints
`.trim();

const readFileSchema = z.object({
  path: z.string().describe('Path to the file to read (relative or absolute).'),
  offset: z.number().optional().describe('1-indexed line offset to start reading from.'),
  limit: z.number().optional().describe('Maximum number of lines to read from the offset.'),
});

export const readFileTool = new DynamicStructuredTool({
  name: 'read_file',
  description:
    'Read text file contents safely from workspace paths. Supports offset/limit pagination for large files.',
  schema: readFileSchema,
  func: async (input) => {
    const cwd = process.cwd();
    const { resolved: sandboxPath } = await assertSandboxPath({
      filePath: input.path,
      cwd,
      root: cwd,
    });
    const absolutePath = resolveReadPath(sandboxPath, cwd);

    await access(absolutePath, constants.R_OK);

    const textContent = (await readFile(absolutePath)).toString('utf-8');
    const allLines = textContent.split('\n');
    const totalFileLines = allLines.length;

    const startLine = input.offset ? Math.max(0, input.offset - 1) : 0;
    const startLineDisplay = startLine + 1;

    if (startLine >= allLines.length) {
      throw new Error(`Offset ${input.offset} is beyond end of file (${allLines.length} lines total)`);
    }

    let selectedContent: string;
    let userLimitedLines: number | undefined;
    if (input.limit !== undefined) {
      const endLine = Math.min(startLine + input.limit, allLines.length);
      selectedContent = allLines.slice(startLine, endLine).join('\n');
      userLimitedLines = endLine - startLine;
    } else {
      selectedContent = allLines.slice(startLine).join('\n');
    }

    const truncation = truncateHead(selectedContent);
    let outputText: string;

    if (truncation.firstLineExceedsLimit) {
      const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine] ?? '', 'utf-8'));
      outputText =
        `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit.]` +
        ` [Use offset=${startLineDisplay} with a smaller limit to continue.]`;
    } else if (truncation.truncated) {
      const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
      const nextOffset = endLineDisplay + 1;
      outputText = truncation.content;
      if (truncation.truncatedBy === 'lines') {
        outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
      } else {
        outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
      }
    } else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
      const remaining = allLines.length - (startLine + userLimitedLines);
      const nextOffset = startLine + userLimitedLines + 1;
      outputText = truncation.content;
      outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
    } else {
      outputText = truncation.content;
    }

    return formatToolResult({
      path: input.path,
      content: outputText,
      truncated: truncation.truncated,
      totalLines: totalFileLines,
    });
  },
});
