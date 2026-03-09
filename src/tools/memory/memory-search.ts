import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '../../memory/index.js';
import { formatToolResult } from '../types.js';

export const MEMORY_SEARCH_DESCRIPTION = `
Semantic search over persistent memory files.

## When to Use

- Before answering questions about prior conversations, decisions, preferences, or facts the user previously shared
- To recall durable memory captured in \`MEMORY.md\` or daily memory logs

## When NOT to Use

- For current market/financial data (use financial tools)
- For reading arbitrary workspace files outside memory (use read_file)
`.trim();

const memorySearchSchema = z.object({
  query: z.string().describe('Natural language query for memory recall.'),
});

export const memorySearchTool = new DynamicStructuredTool({
  name: 'memory_search',
  description:
    'Search persistent memory (MEMORY.md + daily memory logs) with hybrid semantic + keyword retrieval.',
  schema: memorySearchSchema,
  func: async (input) => {
    const manager = await MemoryManager.get();
    if (!manager.isAvailable()) {
      return formatToolResult({
        results: [],
        disabled: true,
        error: manager.getUnavailableReason() ?? 'Memory search unavailable.',
      });
    }

    const results = await manager.search(input.query);
    return formatToolResult({
      results,
    });
  },
});
