import { DynamicStructuredTool } from '@langchain/core/tools';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { MAX_TOOL_RESULT_CHARS } from '../../utils/tool-result-storage.js';
import { assertSandboxPath } from './sandbox.js';
import { resolveReadPath } from './utils/path-utils.js';
import { DEFAULT_MAX_BYTES, formatSize, truncateHead } from './utils/truncate.js';

/** Keep byte-range reads below the agent's large-result persistence threshold. */
const MAX_BYTE_RANGE_BYTES = 32 * 1024;

export const READ_FILE_DESCRIPTION = `
Read file contents from the local workspace.

## When to Use

- Reading local project files before making edits
- Inspecting config/code/data files in the workspace
- Paginating large files with \`offset\` and \`limit\`

## When NOT to Use

- Fetching web URLs (use \`web_fetch\`)
- Looking up financial APIs (use \`get_financials\`)
- Writing or changing files (use \`write_file\` / \`edit_file\`)

## Usage Notes

- Accepts \`path\` (absolute or relative to current workspace)
- Optional \`offset\` is 1-indexed line number
- Optional \`limit\` caps returned lines
- Use \`byteOffset\` to continue through minified JSON or another oversized single line
- Large output is truncated with continuation hints
`.trim();

const readFileSchema = z.object({
  path: z.string().describe('Path to the file to read (relative or absolute).'),
  offset: z.number().optional().describe('1-indexed line offset to start reading from.'),
  limit: z.number().optional().describe('Maximum number of lines to read from the offset.'),
  byteOffset: z.number().int().nonnegative().optional()
    .describe('0-indexed byte offset for continuing an oversized single-line file.'),
  byteLimit: z.number().int().min(4).max(MAX_BYTE_RANGE_BYTES).optional()
    .describe(`Maximum bytes to return with byteOffset (up to ${MAX_BYTE_RANGE_BYTES}).`),
});

function readUtf8ByteRange(
  fileBuffer: Buffer,
  requestedOffset: number,
  requestedLimit: number = MAX_BYTE_RANGE_BYTES,
): { content: string; start: number; end: number } {
  let start = Math.min(requestedOffset, fileBuffer.length);
  while (start < fileBuffer.length && start > 0 && (fileBuffer[start] & 0xc0) === 0x80) {
    start++;
  }

  let end = Math.min(start + requestedLimit, fileBuffer.length);
  while (end < fileBuffer.length && end > start && (fileBuffer[end] & 0xc0) === 0x80) {
    end--;
  }

  return {
    content: fileBuffer.subarray(start, end).toString('utf-8'),
    start,
    end,
  };
}

function formatByteRangeResult(params: {
  path: string;
  fileBuffer: Buffer;
  totalLines: number;
  byteOffset: number;
  byteLimit?: number;
}): string {
  let byteLimit = params.byteLimit ?? MAX_BYTE_RANGE_BYTES;

  while (true) {
    const { content, start, end } = readUtf8ByteRange(
      params.fileBuffer,
      params.byteOffset,
      byteLimit,
    );
    const truncated = end < params.fileBuffer.length;
    const formatted = formatToolResult({
      path: params.path,
      content,
      truncated,
      totalLines: params.totalLines,
      totalBytes: params.fileBuffer.length,
      byteRange: { start, endExclusive: end },
      ...(truncated && {
        nextByteOffset: end,
        continuation: `Use byteOffset=${end} to continue.`,
      }),
    });

    if (formatted.length <= MAX_TOOL_RESULT_CHARS || byteLimit <= 4) {
      return formatted;
    }

    // JSON escaping can expand some text considerably. Shrink until the
    // complete tool response remains in context instead of being persisted again.
    byteLimit = Math.max(4, Math.floor(byteLimit / 2));
  }
}

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

    const fileBuffer = await readFile(absolutePath);
    const textContent = fileBuffer.toString('utf-8');
    const allLines = textContent.split('\n');
    const totalFileLines = allLines.length;

    if (input.byteOffset !== undefined) {
      if (input.offset !== undefined || input.limit !== undefined) {
        throw new Error('byteOffset cannot be combined with line-based offset or limit');
      }
      if (input.byteOffset >= fileBuffer.length) {
        throw new Error(`Byte offset ${input.byteOffset} is beyond end of file (${fileBuffer.length} bytes total)`);
      }
      return formatByteRangeResult({
        path: input.path,
        fileBuffer,
        totalLines: totalFileLines,
        byteOffset: input.byteOffset,
        byteLimit: input.byteLimit,
      });
    }

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
      const precedingText = allLines.slice(0, startLine).join('\n');
      const lineStartByte = Buffer.byteLength(precedingText, 'utf-8') + (startLine > 0 ? 1 : 0);
      return formatByteRangeResult({
        path: input.path,
        fileBuffer,
        totalLines: totalFileLines,
        byteOffset: lineStartByte,
      });
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
