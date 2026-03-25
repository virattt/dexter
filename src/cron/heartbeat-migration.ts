import { randomBytes } from 'node:crypto';
import { loadGatewayConfig } from '../gateway/config.js';
import { buildHeartbeatQuery } from '../gateway/heartbeat/prompt.js';
import { loadCronStore, saveCronStore } from './store.js';
import { computeNextRunAtMs } from './schedule.js';
import type { CronJob } from './types.js';

const HEARTBEAT_JOB_NAME = 'Heartbeat';

/**
 * Ensure a cron job exists for the heartbeat config.
 * Called once at gateway startup. If heartbeat is enabled in gateway.json
 * and no cron job named "Heartbeat" exists, creates one.
 * If the heartbeat config changed (interval, active hours, model),
 * updates the existing job.
 */
export async function ensureHeartbeatCronJob(configPath?: string): Promise<void> {
  const cfg = loadGatewayConfig(configPath);
  const hb = cfg.gateway.heartbeat;

  if (!hb?.enabled) return;

  const store = loadCronStore();
  const existing = store.jobs.find((j) => j.name === HEARTBEAT_JOB_NAME);

  // Build the heartbeat query from HEARTBEAT.md (or defaults)
  const query = await buildHeartbeatQuery();
  if (query === null) return; // HEARTBEAT.md exists but is empty

  const everyMs = (hb.intervalMinutes ?? 30) * 60 * 1000;

  if (existing) {
    // Update existing job to match current config
    existing.schedule = { kind: 'every', everyMs };
    existing.payload.message = query;
    existing.payload.model = hb.model;
    existing.payload.modelProvider = hb.modelProvider;
    existing.activeHours = hb.activeHours
      ? {
          start: hb.activeHours.start ?? '09:30',
          end: hb.activeHours.end ?? '16:00',
          timezone: hb.activeHours.timezone,
          daysOfWeek: hb.activeHours.daysOfWeek,
        }
      : undefined;
    if (!existing.enabled) {
      existing.enabled = true;
      existing.state.consecutiveErrors = 0;
      existing.state.scheduleErrorCount = 0;
    }
    if (!existing.state.nextRunAtMs) {
      existing.state.nextRunAtMs = computeNextRunAtMs(existing.schedule, Date.now());
    }
    existing.updatedAtMs = Date.now();
    saveCronStore(store);
    return;
  }

  // Create new heartbeat cron job
  const now = Date.now();
  const job: CronJob = {
    id: randomBytes(8).toString('hex'),
    name: HEARTBEAT_JOB_NAME,
    description: 'Periodic heartbeat check from HEARTBEAT.md',
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: 'every', everyMs },
    payload: {
      message: query,
      model: hb.model,
      modelProvider: hb.modelProvider,
    },
    fulfillment: 'keep',
    activeHours: hb.activeHours
      ? {
          start: hb.activeHours.start ?? '09:30',
          end: hb.activeHours.end ?? '16:00',
          timezone: hb.activeHours.timezone,
          daysOfWeek: hb.activeHours.daysOfWeek,
        }
      : undefined,
    state: {
      nextRunAtMs: computeNextRunAtMs({ kind: 'every', everyMs }, now),
      consecutiveErrors: 0,
      scheduleErrorCount: 0,
    },
  };

  store.jobs.push(job);
  saveCronStore(store);
}
