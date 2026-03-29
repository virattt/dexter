import { appendFileSync } from 'node:fs';
import { runAgentForMessage } from '../gateway/agent-runner.js';
import {
  evaluateSuppression,
  HEARTBEAT_OK_TOKEN,
  type SuppressionState,
} from '../gateway/heartbeat/suppression.js';
import { assertOutboundAllowed, sendMessageWhatsApp } from '../gateway/channels/whatsapp/index.js';
import { resolveSessionStorePath, loadSessionStore, type SessionEntry } from '../gateway/sessions/store.js';
import { cleanMarkdownForWhatsApp } from '../gateway/utils.js';
import { getSetting } from '../utils/config.js';
import { dexterPath } from '../utils/paths.js';
import { saveCronStore } from './store.js';
import { computeNextRunAtMs } from './schedule.js';
import type { ActiveHours, CronJob, CronStore } from './types.js';
import { loadPortfolioConfig, getPortfolioById } from '../portfolio/config.js';
import { resolveEffectiveModel } from '../portfolio/model-resolution.js';
import { runPortfolioAnalysis } from '../portfolio/runner.js';

const LOG_PATH = dexterPath('gateway-debug.log');

function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

// Per-job suppression state (in memory, resets on process restart)
const suppressionStates = new Map<string, SuppressionState>();

const BACKOFF_SCHEDULE_MS = [
  30_000,      // 1st error → 30s
  60_000,      // 2nd → 1 min
  5 * 60_000,  // 3rd → 5 min
  15 * 60_000, // 4th → 15 min
  60 * 60_000, // 5th+ → 60 min
];

const MAX_AT_RETRIES = 3;
const SCHEDULE_ERROR_DISABLE_THRESHOLD = 3;

function getSuppressionState(jobId: string): SuppressionState {
  let state = suppressionStates.get(jobId);
  if (!state) {
    state = { lastMessageText: null, lastMessageAt: null };
    suppressionStates.set(jobId, state);
  }
  return state;
}

/**
 * Check if the current time is within configured active hours and days.
 */
function isWithinActiveHours(activeHours?: ActiveHours): boolean {
  if (!activeHours) return true;

  const tz = activeHours.timezone ?? 'America/New_York';
  const now = new Date();

  const allowedDays = activeHours.daysOfWeek ?? [1, 2, 3, 4, 5];
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const dayStr = dayFormatter.format(now);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentDay = dayMap[dayStr] ?? now.getDay();
  if (!allowedDays.includes(currentDay)) return false;

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTime = timeFormatter.format(now);
  return currentTime >= activeHours.start && currentTime <= activeHours.end;
}

function errorBackoffMs(consecutiveErrors: number): number {
  const idx = Math.min(consecutiveErrors - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[Math.max(0, idx)];
}

/**
 * Find the most recently updated session with a delivery target.
 * Same pattern as heartbeat runner.
 */
function findTargetSession(): SessionEntry | null {
  const storePath = resolveSessionStorePath('default');
  const store = loadSessionStore(storePath);
  const entries = Object.values(store).filter((e) => e.lastTo);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  return entries[0];
}

/**
 * Execute a single cron job: run isolated agent, evaluate suppression,
 * deliver via WhatsApp, apply fulfillment mode, update state.
 */
export async function executeCronJob(
  job: CronJob,
  store: CronStore,
  _params: { configPath?: string },
): Promise<void> {
  const startedAt = Date.now();

  // 0. Check active hours
  if (!isWithinActiveHours(job.activeHours)) {
    debugLog(`[cron] job ${job.id}: outside active hours, skipping`);
    scheduleNextRun(job, store);
    return;
  }

  debugLog(`[cron] executing job "${job.name}" (${job.id})`);

  if (job.payload.kind === 'portfolio' && job.payload.portfolioId) {
    try {
      const config = loadPortfolioConfig();
      const portfolio = getPortfolioById(config, job.payload.portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio "${job.payload.portfolioId}" not found.`);
      }

      const modelConfig = resolveEffectiveModel({
        cliModel: job.payload.model,
        cliProvider: job.payload.modelProvider,
        portfolio,
        sourceOverride: 'cron',
      });

      const result = await runPortfolioAnalysis({
        portfolio,
        modelConfig,
        trigger: 'scheduled',
      });

      if (!result.ok) {
        throw new Error(
          result.diagnostics.errors.join('; ') || 'Portfolio analysis returned an unsuccessful result.',
        );
      }

      job.state.lastRunAtMs = startedAt;
      job.state.lastDurationMs = Date.now() - startedAt;
      job.state.consecutiveErrors = 0;
      job.state.lastRunStatus = 'ok';
      job.state.lastError = undefined;

      if (job.fulfillment === 'once') {
        job.enabled = false;
        job.state.nextRunAtMs = undefined;
        job.updatedAtMs = Date.now();
        saveCronStore(store);
        return;
      }

      scheduleNextRun(job, store);
      return;
    } catch (err) {
      handleJobError(job, store, err, startedAt);
      return;
    }
  }

  // 1. Find WhatsApp delivery target
  const session = findTargetSession();
  if (!session?.lastTo || !session?.lastAccountId) {
    debugLog(`[cron] job ${job.id}: no delivery target, skipping`);
    scheduleNextRun(job, store);
    return;
  }

  // 2. Verify outbound allowed
  try {
    assertOutboundAllowed({ to: session.lastTo, accountId: session.lastAccountId });
  } catch {
    debugLog(`[cron] job ${job.id}: outbound blocked, skipping`);
    scheduleNextRun(job, store);
    return;
  }

  // 3. Resolve model
  const model = job.payload.model ?? (getSetting('modelId', 'gpt-5.4') as string);
  const modelProvider = job.payload.modelProvider ?? (getSetting('provider', 'openai') as string);

  // 4. Build query
  const baseMessage = job.payload.message ?? '';
  let query = `[CRON JOB: ${job.name}]\n\n${baseMessage}`;
  if (job.fulfillment === 'ask') {
    query += '\n\nIf you find something noteworthy, also ask the user if they want to continue monitoring this.';
  }
  query += `\n\n## Instructions\n- If nothing noteworthy, respond with exactly: ${HEARTBEAT_OK_TOKEN}\n- Do NOT send a message just to say "everything is fine"\n- Keep alerts brief and focused — lead with the key finding`;

  // 5. Run agent
  let answer: string;
  try {
    answer = await runAgentForMessage({
      sessionKey: `cron:${job.id}`,
      query,
      model,
      modelProvider,
      maxIterations: 6,
      isolatedSession: true,
      channel: 'whatsapp',
    });
  } catch (err) {
    handleJobError(job, store, err, startedAt);
    return;
  }

  const durationMs = Date.now() - startedAt;

  // 6. Evaluate suppression
  const suppState = getSuppressionState(job.id);
  const suppResult = evaluateSuppression(answer, suppState);

  // 7. Update job state
  job.state.lastRunAtMs = startedAt;
  job.state.lastDurationMs = durationMs;
  job.state.consecutiveErrors = 0;

  if (suppResult.shouldSuppress) {
    job.state.lastRunStatus = 'suppressed';
    debugLog(`[cron] job ${job.id}: suppressed (${suppResult.reason})`);
  } else {
    job.state.lastRunStatus = 'ok';

    // Deliver via WhatsApp
    const cleaned = cleanMarkdownForWhatsApp(suppResult.cleanedText);
    await sendMessageWhatsApp({
      to: session.lastTo,
      body: cleaned,
      accountId: session.lastAccountId,
    });
    debugLog(`[cron] job ${job.id}: delivered to ${session.lastTo}`);

    // Update suppression state for duplicate detection
    suppState.lastMessageText = suppResult.cleanedText;
    suppState.lastMessageAt = Date.now();

    // Apply fulfillment mode
    if (job.fulfillment === 'once') {
      job.enabled = false;
      job.state.nextRunAtMs = undefined;
      debugLog(`[cron] job ${job.id}: auto-disabled (fulfillment=once)`);
      job.updatedAtMs = Date.now();
      saveCronStore(store);
      return;
    }
  }

  scheduleNextRun(job, store);
}

function scheduleNextRun(job: CronJob, store: CronStore): void {
  const now = Date.now();

  try {
    const nextRun = computeNextRunAtMs(job.schedule, now);
    if (nextRun === undefined) {
      // One-shot expired or invalid schedule
      job.enabled = false;
      job.state.nextRunAtMs = undefined;
    } else {
      job.state.nextRunAtMs = nextRun;
    }
    job.state.scheduleErrorCount = 0;
  } catch {
    job.state.scheduleErrorCount += 1;
    if (job.state.scheduleErrorCount >= SCHEDULE_ERROR_DISABLE_THRESHOLD) {
      job.enabled = false;
      job.state.nextRunAtMs = undefined;
      debugLog(`[cron] job ${job.id}: disabled after ${SCHEDULE_ERROR_DISABLE_THRESHOLD} schedule errors`);
    }
  }

  job.updatedAtMs = Date.now();
  saveCronStore(store);
}

function handleJobError(job: CronJob, store: CronStore, err: unknown, startedAt: number): void {
  const errorMsg = err instanceof Error ? err.message : String(err);
  job.state.lastRunAtMs = startedAt;
  job.state.lastDurationMs = Date.now() - startedAt;
  job.state.lastRunStatus = 'error';
  job.state.lastError = errorMsg;
  job.state.consecutiveErrors += 1;

  debugLog(`[cron] job ${job.id}: error #${job.state.consecutiveErrors}: ${errorMsg}`);

  const now = Date.now();

  if (job.schedule.kind === 'at') {
    // One-shot: retry up to MAX_AT_RETRIES, then disable
    if (job.state.consecutiveErrors >= MAX_AT_RETRIES) {
      job.enabled = false;
      job.state.nextRunAtMs = undefined;
      debugLog(`[cron] job ${job.id}: disabled after ${MAX_AT_RETRIES} retries (at job)`);
    } else {
      job.state.nextRunAtMs = now + errorBackoffMs(job.state.consecutiveErrors);
    }
  } else {
    // Recurring: apply exponential backoff
    const normalNext = computeNextRunAtMs(job.schedule, now);
    const backoff = now + errorBackoffMs(job.state.consecutiveErrors);
    job.state.nextRunAtMs = normalNext ? Math.max(normalNext, backoff) : backoff;
  }

  job.updatedAtMs = Date.now();
  saveCronStore(store);
}
