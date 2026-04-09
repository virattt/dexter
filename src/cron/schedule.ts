import { Cron } from 'croner';
import type { CronSchedule } from './types.js';

const MIN_REFIRE_GAP_MS = 2_000;

/**
 * Compute the next run time for a schedule.
 * Returns undefined if the schedule has expired (one-shot in the past) or is invalid.
 */
export function computeNextRunAtMs(schedule: CronSchedule, nowMs: number): number | undefined {
  switch (schedule.kind) {
    case 'at': {
      const targetMs = new Date(schedule.at).getTime();
      if (isNaN(targetMs)) return undefined;
      return targetMs > nowMs ? targetMs : undefined;
    }

    case 'every': {
      const anchor = schedule.anchorMs ?? nowMs;
      if (schedule.everyMs <= 0) return undefined;
      const elapsed = nowMs - anchor;
      const periods = Math.ceil(elapsed / schedule.everyMs);
      const next = anchor + periods * schedule.everyMs;
      // If next === nowMs (exactly on the interval), push to next period
      return next <= nowMs ? next + schedule.everyMs : next;
    }

    case 'cron': {
      try {
        const tz = schedule.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const cron = new Cron(schedule.expr, { timezone: tz });
        const now = new Date(nowMs);
        let next = cron.nextRun(now);

        // Workaround for croner year-rollback edge case:
        // If result is at or before now, try from the next second
        if (next && next.getTime() <= nowMs) {
          const nextSecond = new Date(nowMs + 1000);
          next = cron.nextRun(nextSecond);
        }

        if (!next) return undefined;
        const nextMs = next.getTime();
        // Ensure minimum gap to prevent spin-loops
        return nextMs > nowMs + MIN_REFIRE_GAP_MS ? nextMs : nowMs + MIN_REFIRE_GAP_MS;
      } catch {
        return undefined; // Invalid cron expression
      }
    }
  }
}
