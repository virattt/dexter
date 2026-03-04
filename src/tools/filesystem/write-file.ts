import { DynamicStructuredTool } from '@langchain/core/tools';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { assertSandboxPath } from './sandbox.js';

export const WRITE_FILE_DESCRIPTION = `
Create or overwrite files in the local workspace.

## When to Use

- Creating a new file with full contents
- Replacing an existing file entirely
- Writing generated output to disk

## When NOT to Use

- Small surgical updates in an existing file (use \`edit_file\`)
- Reading file contents (use \`read_file\`)

## Usage Notes

- The system will prompt the user for confirmation automatically; just call the tool directly
- Accepts \`path\` and full \`content\`
- Creates parent directories when they do not exist
- Overwrites existing file content completely
`.trim();

const writeFileSchema = z.object({
  path: z.string().describe('Path to the file to write (relative or absolute).'),
  content: z.string().describe('Content to write to the file.'),
});

export const writeFileTool = new DynamicStructuredTool({
  name: 'write_file',
  description:
    'Create or overwrite a file inside the workspace. Automatically creates parent directories when needed.',
  schema: writeFileSchema,
  func: async (input) => {
    const cwd = process.cwd();
    const { resolved } = await assertSandboxPath({
      filePath: input.path,
      cwd,
      root: cwd,
    });
    const dir = dirname(resolved);
    await mkdir(dir, { recursive: true });
    await writeFile(resolved, input.content, 'utf-8');

    return formatToolResult({
      path: input.path,
      bytesWritten: Buffer.byteLength(input.content, 'utf-8'),
      message: `Successfully wrote ${input.content.length} characters to ${input.path}`,
    });
  },
});
