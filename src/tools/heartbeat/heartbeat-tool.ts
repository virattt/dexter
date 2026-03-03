import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const HEARTBEAT_MD_PATH = join(homedir(), '.dexter', 'HEARTBEAT.md');

export const HEARTBEAT_TOOL_DESCRIPTION = `
Manage your periodic heartbeat checklist (~/.dexter/HEARTBEAT.md).
The heartbeat runs on a schedule and uses this checklist to decide what to check.

## When to Use

- User asks to add, remove, or change what the heartbeat monitors
- User asks "what's my heartbeat checking?" or similar
- User says things like "watch NVDA", "stop checking TSLA", "add a market check"

## Actions

- view: Show the current heartbeat checklist
- update: Replace the checklist with new content (provide full markdown)

## Update Tips

- Always \`view\` first before \`update\` to see current content
- Preserve existing items the user didn't ask to change
- Use markdown checklist format (- item) for clarity
`.trim();

const heartbeatSchema = z.object({
  action: z.enum(['view', 'update']),
  content: z
    .string()
    .optional()
    .describe('New HEARTBEAT.md content (required for update)'),
});

export const heartbeatTool = new DynamicStructuredTool({
  name: 'heartbeat',
  description:
    'View or update the heartbeat checklist (~/.dexter/HEARTBEAT.md) that controls periodic monitoring.',
  schema: heartbeatSchema,
  func: async (input) => {
    if (input.action === 'view') {
      if (!existsSync(HEARTBEAT_MD_PATH)) {
        return 'No heartbeat checklist configured yet. The heartbeat will use a default checklist (major index moves + breaking financial news). Use the update action to customize what gets checked.';
      }
      const content = readFileSync(HEARTBEAT_MD_PATH, 'utf-8');
      return `Current heartbeat checklist:\n\n${content}`;
    }

    if (input.action === 'update') {
      if (!input.content) {
        return 'Error: content is required for the update action.';
      }
      const dir = dirname(HEARTBEAT_MD_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(HEARTBEAT_MD_PATH, input.content, 'utf-8');

      const lines = input.content.split('\n').filter((l) => l.trim().startsWith('-'));
      const summary = lines.length > 0
        ? `Updated heartbeat checklist (${lines.length} item${lines.length === 1 ? '' : 's'}).`
        : 'Updated heartbeat checklist.';
      return summary;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
