import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { checkPermission, grantPermission } from '../../utils/permissions.js';
import { formatToolResult } from '../types.js';

const ReadFileInputSchema = z.object({
  path: z.string().describe('Path to the file to read (absolute or relative to current directory)'),
});

/**
 * Request permission from the user via the progress channel
 */
async function requestPermission(
  path: string,
  config?: RunnableConfig
): Promise<boolean> {
  const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
  const onPermissionRequest = config?.metadata?.onPermissionRequest as 
    ((path: string, operation: 'read' | 'write') => Promise<boolean>) | undefined;

  if (!onPermissionRequest) {
    // No permission handler available - deny by default
    onProgress?.('Permission system not available');
    return false;
  }

  // Request permission through the handler
  return await onPermissionRequest(path, 'read');
}

export const readFileTool = new DynamicStructuredTool({
  name: 'read_file',
  description: `Read the contents of a file from the local filesystem. Use this to:
- Read configuration files, data files, or documents
- Analyze code files or scripts
- Access any text-based file content

The tool will request permission from the user before reading files.`,
  schema: ReadFileInputSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

    try {
      // Resolve to absolute path
      const absolutePath = resolve(input.path);

      // Check if file exists
      if (!existsSync(absolutePath)) {
        return formatToolResult({
          error: `File not found: ${absolutePath}`,
          path: absolutePath,
        });
      }

      // Check if it's actually a file (not a directory)
      const stats = statSync(absolutePath);
      if (!stats.isFile()) {
        return formatToolResult({
          error: `Path is not a file: ${absolutePath}`,
          path: absolutePath,
        });
      }

      // Check existing permission
      const hasPermission = checkPermission(absolutePath, 'read');

      if (!hasPermission) {
        // Request permission from user
        onProgress?.(`Requesting permission to read: ${absolutePath}`);
        const granted = await requestPermission(absolutePath, config);

        if (!granted) {
          return formatToolResult({
            error: 'Permission denied by user',
            path: absolutePath,
          });
        }

        // Save the granted permission
        grantPermission(absolutePath, 'file', 'read');
      }

      // Read the file
      onProgress?.(`Reading file: ${absolutePath}`);
      const content = readFileSync(absolutePath, 'utf-8');

      // Get file size for metadata
      const sizeInBytes = stats.size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);

      return formatToolResult({
        path: absolutePath,
        content,
        size: `${sizeInKB} KB`,
        lines: content.split('\n').length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return formatToolResult({
        error: `Failed to read file: ${errorMessage}`,
        path: input.path,
      });
    }
  },
});
