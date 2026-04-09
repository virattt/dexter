import { appendFileSync } from 'node:fs';
import { dexterPath } from '../utils/paths.js';
import { loadCronStore, saveCronStore } from './store.js';
import { computeNextRunAtMs } from './schedule.js';
import { executeCronJob } from './executor.js';

const LOG_PATH = dexterPath('gateway-debug.log');

function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

const MAX_TIMER_DELAY_MS = 60_000; // Cap at 60s to pick up newly added jobs

export type CronRunner = {
  stop: () => void;
};

/**
 * Start the cron scheduler. Wakes at the earliest nextRunAtMs across all
 * enabled jobs, executes due jobs serially, then re-arms.
 * Re-reads jobs.json each tick so tool-driven changes take effect immediately.
 */
export function startCronRunner(params: { configPath?: string }): CronRunner {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  // On startup: ensure all enabled jobs have a nextRunAtMs
  function startup(): void {
    const store = loadCronStore();
    if (store.jobs.length === 0) {
      debugLog('[cron] runner started (no jobs)');
      scheduleNext();
      return;
    }

    const now = Date.now();
    let changed = false;
    for (const job of store.jobs) {
      if (!job.enabled) continue;
      if (job.state.nextRunAtMs === undefined) {
        job.state.nextRunAtMs = computeNextRunAtMs(job.schedule, now);
        changed = true;
      }
    }
    if (changed) saveCronStore(store);

    const enabledCount = store.jobs.filter((j) => j.enabled).length;
    debugLog(`[cron] runner started (${enabledCount} enabled job${enabledCount === 1 ? '' : 's'})`);
    scheduleNext();
  }

  async function tick(): Promise<void> {
    if (stopped || running) return;
    running = true;

    try {
      const store = loadCronStore();
      const now = Date.now();

      // Find due jobs: enabled with nextRunAtMs <= now
      const dueJobs = store.jobs.filter(
        (j) => j.enabled && j.state.nextRunAtMs !== undefined && j.state.nextRunAtMs <= now,
      );

      // Execute serially
      for (const job of dueJobs) {
        if (stopped) break;
        try {
          await executeCronJob(job, store, params);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debugLog(`[cron] job ${job.id} unhandled error: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`[cron] tick ERROR: ${msg}`);
    } finally {
      running = false;
      scheduleNext();
    }
  }

  function scheduleNext(): void {
    if (stopped) return;

    const store = loadCronStore();
    const now = Date.now();

    // Find earliest nextRunAtMs
    let earliest = Infinity;
    for (const job of store.jobs) {
      if (job.enabled && job.state.nextRunAtMs !== undefined) {
        earliest = Math.min(earliest, job.state.nextRunAtMs);
      }
    }

    // If no jobs, wake in MAX_TIMER_DELAY_MS to check for new ones
    const delayMs =
      earliest === Infinity
        ? MAX_TIMER_DELAY_MS
        : Math.min(Math.max(0, earliest - now), MAX_TIMER_DELAY_MS);

    timer = setTimeout(() => void tick(), delayMs);
    timer.unref();
  }

  startup();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      debugLog('[cron] runner stopped');
    },
  };
}
