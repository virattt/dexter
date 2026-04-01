import { DynamicStructuredTool } from '@langchain/core/tools';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { loadCronStore, saveCronStore } from '../../cron/store.js';
import { computeNextRunAtMs } from '../../cron/schedule.js';
import { executeCronJob } from '../../cron/executor.js';
import type { CronJob, CronSchedule } from '../../cron/types.js';

export const CRON_TOOL_DESCRIPTION = `
Manage scheduled/recurring tasks (cron jobs) that run automatically.
Jobs run as isolated agent turns with full tool access, delivering results via WhatsApp.

## When to Use

- User asks to set a recurring check, alert, or reminder
- User says things like "watch AAPL and tell me when it hits $200", "check earnings every morning", "remind me about the Fed meeting"
- User asks to see, modify, or cancel scheduled tasks
- User wants a one-time alert at a specific time

## Actions

- **list**: Show all scheduled jobs (enabled and disabled)
- **add**: Create a new scheduled job
- **update**: Modify an existing job (change schedule, prompt, fulfillment, or enable/disable)
- **remove**: Permanently delete a job
- **run**: Trigger a job immediately (useful for testing)

## Schedule Types

- **at**: One-shot at a specific time. \`{{ "kind": "at", "at": "2026-04-01T14:00:00Z" }}\`
- **every**: Recurring interval in milliseconds. \`{{ "kind": "every", "everyMs": 3600000 }}\` (1 hour)
- **cron**: Cron expression with optional timezone. \`{{ "kind": "cron", "expr": "0 9 * * 1-5", "tz": "America/New_York" }}\`

## Fulfillment Modes

- **keep** (default): Job keeps running on schedule. For ongoing monitoring (e.g., "watch the market every hour").
- **once**: Auto-disables after the first alert is sent. For price targets and one-time notifications (e.g., "tell me when NVDA hits $150").
- **ask**: After alerting, asks the user if they want to continue watching.

## Message Prompt

The \`message\` field is the prompt the agent receives each time the job fires.
Write it as a clear instruction, e.g.: "Check the current price of AAPL. If it has moved more than 3% from $185, alert the user with the current price and percentage change."

## Tips

- Use \`list\` before modifying to see current job IDs
- For price watches, use fulfillment "once" so the user isn't spammed after the target is hit
- For daily/weekly checks, use cron expressions with the user's timezone
- The job prompt has full tool access (finance data, web search, etc.)
- Minimum interval for "every" schedules is 60 seconds
`.trim();

const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('at'),
    at: z.string().describe('ISO-8601 timestamp for one-shot execution'),
  }),
  z.object({
    kind: z.literal('every'),
    everyMs: z.number().min(60000).describe('Interval in milliseconds (minimum 60000 = 1 minute)'),
    anchorMs: z.number().optional().describe('Optional anchor timestamp in ms'),
  }),
  z.object({
    kind: z.literal('cron'),
    expr: z.string().describe('Cron expression (5 or 6 fields)'),
    tz: z.string().optional().describe('IANA timezone (default: system timezone)'),
  }),
]);

const cronToolSchema = z.object({
  action: z.enum(['list', 'add', 'update', 'remove', 'run']),
  name: z.string().optional().describe('Human-readable job name (required for add)'),
  description: z.string().optional().describe('Optional description'),
  schedule: scheduleSchema.optional().describe('Schedule configuration (required for add)'),
  message: z.string().optional().describe('Agent prompt for the job (required for add)'),
  model: z.string().optional().describe('Optional model override for job execution'),
  modelProvider: z.string().optional().describe('Optional model provider override'),
  fulfillment: z
    .enum(['keep', 'once', 'ask'])
    .optional()
    .describe('Fulfillment mode (default: keep)'),
  jobId: z.string().optional().describe('Job ID (required for update/remove/run)'),
  enabled: z.boolean().optional().describe('Enable/disable a job (for update)'),
});

export const cronTool = new DynamicStructuredTool({
  name: 'cron',
  description: 'Create, list, update, remove, or run scheduled jobs.',
  schema: cronToolSchema,
  func: async (input) => {
    switch (input.action) {
      case 'list': {
        const store = loadCronStore();
        if (store.jobs.length === 0) return 'No scheduled jobs.';
        return store.jobs.map(formatJobSummary).join('\n\n');
      }

      case 'add': {
        if (!input.name) return 'Error: name is required for add.';
        if (!input.schedule) return 'Error: schedule is required for add.';
        if (!input.message) return 'Error: message is required for add.';

        const store = loadCronStore();
        const now = Date.now();
        const id = randomBytes(8).toString('hex');
        const schedule = input.schedule as CronSchedule;

        const nextRunAtMs = computeNextRunAtMs(schedule, now);
        if (nextRunAtMs === undefined && schedule.kind === 'at') {
          return 'Error: the specified time is in the past.';
        }

        const job: CronJob = {
          id,
          name: input.name,
          description: input.description,
          enabled: true,
          createdAtMs: now,
          updatedAtMs: now,
          schedule,
          payload: {
            message: input.message,
            model: input.model,
            modelProvider: input.modelProvider,
          },
          fulfillment: input.fulfillment ?? 'keep',
          state: {
            nextRunAtMs,
            consecutiveErrors: 0,
            scheduleErrorCount: 0,
          },
        };

        store.jobs.push(job);
        saveCronStore(store);

        const nextStr = nextRunAtMs ? new Date(nextRunAtMs).toISOString() : 'pending';
        return `Created job "${job.name}" (id: ${job.id}, fulfillment: ${job.fulfillment}). Next run: ${nextStr}`;
      }

      case 'update': {
        if (!input.jobId) return 'Error: jobId is required for update.';

        const store = loadCronStore();
        const job = store.jobs.find((j) => j.id === input.jobId);
        if (!job) return `Error: job ${input.jobId} not found.`;

        if (input.name !== undefined) job.name = input.name;
        if (input.description !== undefined) job.description = input.description;
        if (input.schedule !== undefined) {
          job.schedule = input.schedule as CronSchedule;
          job.state.nextRunAtMs = computeNextRunAtMs(job.schedule, Date.now());
          job.state.scheduleErrorCount = 0;
        }
        if (input.message !== undefined) job.payload.message = input.message;
        if (input.model !== undefined) job.payload.model = input.model;
        if (input.modelProvider !== undefined) job.payload.modelProvider = input.modelProvider;
        if (input.fulfillment !== undefined) job.fulfillment = input.fulfillment;
        if (input.enabled !== undefined) {
          job.enabled = input.enabled;
          if (input.enabled && !job.state.nextRunAtMs) {
            job.state.nextRunAtMs = computeNextRunAtMs(job.schedule, Date.now());
          }
          if (input.enabled) {
            job.state.consecutiveErrors = 0;
            job.state.scheduleErrorCount = 0;
          }
        }

        job.updatedAtMs = Date.now();
        saveCronStore(store);
        return `Updated job "${job.name}" (id: ${job.id}).`;
      }

      case 'remove': {
        if (!input.jobId) return 'Error: jobId is required for remove.';

        const store = loadCronStore();
        const idx = store.jobs.findIndex((j) => j.id === input.jobId);
        if (idx === -1) return `Error: job ${input.jobId} not found.`;

        const removed = store.jobs.splice(idx, 1)[0];
        saveCronStore(store);
        return `Removed job "${removed.name}" (id: ${removed.id}).`;
      }

      case 'run': {
        if (!input.jobId) return 'Error: jobId is required for run.';

        const store = loadCronStore();
        const job = store.jobs.find((j) => j.id === input.jobId);
        if (!job) return `Error: job ${input.jobId} not found.`;

        await executeCronJob(job, store, {});
        return `Job "${job.name}" executed. Status: ${job.state.lastRunStatus ?? 'unknown'}`;
      }

      default:
        return 'Unknown action. Use list, add, update, remove, or run.';
    }
  },
});

function formatSchedule(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case 'at':
      return `one-shot at ${schedule.at}`;
    case 'every': {
      const secs = Math.round(schedule.everyMs / 1000);
      if (secs >= 3600) return `every ${Math.round(secs / 3600)}h`;
      if (secs >= 60) return `every ${Math.round(secs / 60)}m`;
      return `every ${secs}s`;
    }
    case 'cron':
      return `${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ''}`;
  }
}

function formatJobSummary(job: CronJob): string {
  const status = job.enabled ? 'enabled' : 'DISABLED';
  const nextRun = job.state.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : 'none';
  const lastRun = job.state.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : 'never';
  const lines = [
    `**${job.name}** (${job.id}) [${status}]`,
    `  Schedule: ${formatSchedule(job.schedule)}`,
    `  Fulfillment: ${job.fulfillment}`,
    `  Next run: ${nextRun}`,
    `  Last run: ${lastRun} (${job.state.lastRunStatus ?? 'never'})`,
  ];
  if (job.state.consecutiveErrors > 0) {
    lines.push(`  Errors: ${job.state.consecutiveErrors} consecutive`);
  }
  if (job.description) {
    lines.push(`  Description: ${job.description}`);
  }
  return lines.join('\n');
}
