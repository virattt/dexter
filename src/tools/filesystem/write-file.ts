/**
 * write_file tool — writes content to a file on the local file system.
 *
 * Creates parent directories if needed. Checks permissions before writing.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { formatToolResult } from '../types.js';
import { requestPermission } from '../../utils/permissions.js';

export const writeFileTool = new DynamicStructuredTool({
  name: 'write_file',
  description:
    'Write content to a file on the local file system. Creates the file if it does not exist, or overwrites it if it does. Creates parent directories as needed.',
  schema: z.object({
    file_path: z.string().describe('Absolute or relative path to the file to write.'),
    content: z.string().describe('The content to write to the file.'),
  }),
  func: async (input) => {
    const filePath = resolve(input.file_path);

    // Check permissions
    const perm = requestPermission('write_file', filePath);
    if (!perm.allowed) {
      return perm.message!;
    }

    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(filePath, input.content, 'utf-8');
      const bytes = Buffer.byteLength(input.content, 'utf-8');

      return formatToolResult({
        file_path: filePath,
        bytes_written: bytes,
        message: `Successfully wrote ${bytes} bytes to ${filePath}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error writing file: ${message}`;
    }
  },
});
