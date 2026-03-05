import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadGatewayConfig } from '../config.js';
import { runAgentForMessage } from '../agent-runner.js';
import { assertOutboundAllowed, sendMessageWhatsApp } from '../channels/whatsapp/index.js';
import { resolveSessionStorePath, loadSessionStore, type SessionEntry } from '../sessions/store.js';
import { cleanMarkdownForWhatsApp } from '../utils.js';
import { buildHeartbeatQuery } from './prompt.js';
import { evaluateSuppression, type SuppressionState } from './suppression.js';

const LOG_PATH = join(homedir(), '.dexter', 'gateway-debug.log');

function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

/**
 * Check if the current time is within the configured active hours and days.
 * Defaults to NYSE market hours: 9:30 AM - 4:00 PM ET, Mon-Fri.
 */
function isWithinActiveHours(activeHours?: {
  start: string;
  end: string;
  timezone?: string;
  daysOfWeek?: number[];
}): boolean {
  if (!activeHours) return true;

  const tz = activeHours.timezone ?? 'America/New_York';
  const now = new Date();

  // Check day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const allowedDays = activeHours.daysOfWeek ?? [1, 2, 3, 4, 5];
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const dayStr = dayFormatter.format(now);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentDay = dayMap[dayStr] ?? new Date().getDay();
  if (!allowedDays.includes(currentDay)) {
    return false;
  }

  // Check time window
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTime = timeFormatter.format(now); // "HH:MM"

  return currentTime >= activeHours.start && currentTime <= activeHours.end;
}

/**
 * Find the most recently updated session that has a delivery target (lastTo).
 */
function findTargetSession(): SessionEntry | null {
  const storePath = resolveSessionStorePath('default');
  const store = loadSessionStore(storePath);
  const entries = Object.values(store).filter((e) => e.lastTo);

  if (entries.length === 0) return null;

  // Sort by updatedAt descending, return the most recent
  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  return entries[0];
}

export type HeartbeatRunner = {
  stop: () => void;
};

/**
 * Start the heartbeat runner. Schedules periodic heartbeat checks using setTimeout.
 * Re-reads config each cycle so changes take effect without restart.
 * First tick fires after one full interval (no startup burst).
 */
export function startHeartbeatRunner(params: { configPath?: string }): HeartbeatRunner {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  const suppressionState: SuppressionState = {
    lastMessageText: null,
    lastMessageAt: null,
  };

  async function tick(): Promise<void> {
    if (stopped || running) return;
    running = true;

    try {
      const cfg = loadGatewayConfig(params.configPath);
      const heartbeatCfg = cfg.gateway.heartbeat;

      // Check if enabled
      if (!heartbeatCfg?.enabled) {
        debugLog('[heartbeat] disabled in config, skipping');
        return;
      }

      // Check active hours
      if (!isWithinActiveHours(heartbeatCfg.activeHours)) {
        debugLog('[heartbeat] outside active hours, skipping');
        return;
      }

      // Find target session
      const session = findTargetSession();
      if (!session || !session.lastTo || !session.lastAccountId) {
        debugLog('[heartbeat] no target session found (user has not messaged yet), skipping');
        return;
      }

      // Verify outbound is allowed
      try {
        assertOutboundAllowed({ to: session.lastTo, accountId: session.lastAccountId });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        debugLog(`[heartbeat] outbound BLOCKED: ${msg}`);
        return;
      }

      // Build heartbeat query
      const query = await buildHeartbeatQuery();
      if (query === null) {
        debugLog('[heartbeat] HEARTBEAT.md exists but is empty, skipping');
        return;
      }

      // Run agent
      debugLog(`[heartbeat] running agent for session=${session.sessionKey}`);
      const model = heartbeatCfg.model ?? 'gpt-5.4';
      const modelProvider = heartbeatCfg.modelProvider ?? 'openai';
      const answer = await runAgentForMessage({
        sessionKey: session.sessionKey,
        query,
        model,
        modelProvider,
        maxIterations: heartbeatCfg.maxIterations,
        isHeartbeat: true,
        channel: 'whatsapp',
      });
      debugLog(`[heartbeat] agent answer length=${answer.length}`);

      // Evaluate suppression
      const result = evaluateSuppression(answer, suppressionState);
      debugLog(`[heartbeat] suppression: shouldSuppress=${result.shouldSuppress} reason=${result.reason}`);

      if (!result.shouldSuppress) {
        const cleaned = cleanMarkdownForWhatsApp(result.cleanedText);
        await sendMessageWhatsApp({
          to: session.lastTo,
          body: cleaned,
          accountId: session.lastAccountId,
        });
        debugLog(`[heartbeat] sent message to ${session.lastTo}`);

        // Update suppression state for duplicate detection
        suppressionState.lastMessageText = result.cleanedText;
        suppressionState.lastMessageAt = Date.now();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`[heartbeat] ERROR: ${msg}`);
    } finally {
      running = false;
      scheduleNext();
    }
  }

  function scheduleNext(): void {
    if (stopped) return;

    // Re-read config for interval (may have changed)
    const cfg = loadGatewayConfig(params.configPath);
    const intervalMs = (cfg.gateway.heartbeat?.intervalMinutes ?? 30) * 60 * 1000;

    timer = setTimeout(() => void tick(), intervalMs);
    timer.unref(); // Don't block shutdown
  }

  // Schedule first tick after one full interval (no startup burst)
  debugLog('[heartbeat] runner started');
  scheduleNext();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      debugLog('[heartbeat] runner stopped');
    },
  };
}
