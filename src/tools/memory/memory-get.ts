import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '../../memory/index.js';
import { formatToolResult } from '../types.js';

export const MEMORY_GET_DESCRIPTION = `
Read specific memory file content from persistent memory storage.

## When to Use

- After \`memory_search\` to fetch exact lines needed for verification
- To retrieve a specific path in memory storage (\`MEMORY.md\` or \`YYYY-MM-DD.md\`)

## When NOT to Use

- For broad semantic recall (use \`memory_search\`)
- For non-memory project files (use \`read_file\`)
`.trim();

const memoryGetSchema = z.object({
  path: z.string().describe('Memory file path (e.g., MEMORY.md or 2026-03-08.md).'),
  from: z.number().optional().describe('1-indexed line offset.'),
  lines: z.number().optional().describe('Maximum number of lines to read.'),
});

export const memoryGetTool = new DynamicStructuredTool({
  name: 'memory_get',
  description:
    'Read a specific memory file segment from persistent memory storage for precise citation-backed recall.',
  schema: memoryGetSchema,
  func: async (input) => {
    const manager = await MemoryManager.get();
    const result = await manager.get({
      path: input.path,
      from: input.from,
      lines: input.lines,
    });
    return formatToolResult(result);
  },
});
