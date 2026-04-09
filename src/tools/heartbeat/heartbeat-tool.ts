import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { dexterPath } from '../../utils/paths.js';
import { loadGatewayConfig, saveGatewayConfig } from '../../gateway/config.js';
import { buildHeartbeatQuery } from '../../gateway/heartbeat/prompt.js';
import { loadCronStore, saveCronStore } from '../../cron/store.js';

const HEARTBEAT_MD_PATH = dexterPath('HEARTBEAT.md');
const HEARTBEAT_JOB_NAME = 'Heartbeat';

export const HEARTBEAT_TOOL_DESCRIPTION = `
Manage your periodic heartbeat checklist (.dexter/HEARTBEAT.md).
The heartbeat runs on a schedule and uses this checklist to decide what to check.
When you add items, the heartbeat is automatically enabled in the gateway config.

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

/**
 * Ensure the heartbeat section exists and is enabled in gateway.json.
 * Preserves any existing heartbeat settings (interval, active hours, model, etc.).
 */
function ensureHeartbeatEnabled(): void {
  const cfg = loadGatewayConfig();
  if (cfg.gateway.heartbeat?.enabled) return;

  cfg.gateway.heartbeat = {
    enabled: true,
    intervalMinutes: cfg.gateway.heartbeat?.intervalMinutes ?? 10,
    activeHours: cfg.gateway.heartbeat?.activeHours,
    model: cfg.gateway.heartbeat?.model,
    modelProvider: cfg.gateway.heartbeat?.modelProvider,
    maxIterations: cfg.gateway.heartbeat?.maxIterations ?? 6,
  };
  saveGatewayConfig(cfg);
}

/**
 * Sync the heartbeat cron job's message with the current HEARTBEAT.md content.
 */
async function syncHeartbeatCronJob(): Promise<void> {
  const store = loadCronStore();
  const job = store.jobs.find((j) => j.name === HEARTBEAT_JOB_NAME);
  if (!job) return;

  const query = await buildHeartbeatQuery();
  if (query === null) {
    // HEARTBEAT.md is empty — disable the cron job
    job.enabled = false;
    job.updatedAtMs = Date.now();
  } else {
    job.payload.message = query;
    job.updatedAtMs = Date.now();
  }
  saveCronStore(store);
}

export const heartbeatTool = new DynamicStructuredTool({
  name: 'heartbeat',
  description:
    'View or update the heartbeat checklist (.dexter/HEARTBEAT.md) that controls periodic monitoring.',
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
      const hasItems = lines.length > 0;

      if (hasItems) {
        ensureHeartbeatEnabled();
      }

      // Sync the cron job with updated content
      await syncHeartbeatCronJob();

      const summary = hasItems
        ? `Updated heartbeat checklist (${lines.length} item${lines.length === 1 ? '' : 's'}).`
        : 'Updated heartbeat checklist.';
      return summary;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
