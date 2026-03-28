import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getDexterDir } from './paths.js';

const DAILY_LIMIT = 250;
const WARN_THRESHOLD = 0.8; // 80%

interface QuotaData {
  date: string; // YYYY-MM-DD UTC
  count: number;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  usedPct: number;    // 0.0 – 1.0
  remaining: number;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultQuotaPath(): string {
  return join(getDexterDir(), 'fmp-quota.json');
}

function readQuota(path: string): QuotaData {
  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as QuotaData;
    if (data.date === todayUTC()) return data;
  } catch {
    // File not found or malformed — treat as zero
  }
  return { date: todayUTC(), count: 0 };
}

function writeQuota(path: string, data: QuotaData): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data));
  } catch {
    // Non-fatal: quota tracking is best-effort
  }
}

/**
 * Increments the daily FMP API call counter and returns the updated quota status.
 * The counter persists across process restarts and resets at midnight UTC.
 *
 * @param quotaPath - Override path for the quota file (useful in tests).
 */
export function trackFmpCall(quotaPath?: string): QuotaStatus {
  const path = quotaPath ?? defaultQuotaPath();
  const data = readQuota(path);
  data.count++;
  writeQuota(path, data);
  return statusFrom(data);
}

/**
 * Returns the current quota status without incrementing the counter.
 *
 * @param quotaPath - Override path for the quota file (useful in tests).
 */
export function getQuotaStatus(quotaPath?: string): QuotaStatus {
  const path = quotaPath ?? defaultQuotaPath();
  const data = readQuota(path);
  return statusFrom(data);
}

/**
 * Returns a warning string when >80% of the daily FMP quota has been used,
 * or null when usage is below the warning threshold.
 *
 * @param quotaPath - Override path for the quota file (useful in tests).
 */
export function getQuotaWarning(quotaPath?: string): string | null {
  const status = getQuotaStatus(quotaPath);
  if (status.usedPct < WARN_THRESHOLD) return null;
  if (status.remaining === 0) {
    return (
      `⚠️  FMP daily quota exhausted (${status.used}/${status.limit} calls used). ` +
      'Financial data tools may fail until midnight UTC.'
    );
  }
  return (
    `⚠️  FMP quota at ${Math.round(status.usedPct * 100)}% ` +
    `(${status.used}/${status.limit} calls, ${status.remaining} remaining today).`
  );
}

function statusFrom(data: QuotaData): QuotaStatus {
  return {
    used: data.count,
    limit: DAILY_LIMIT,
    usedPct: data.count / DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - data.count),
  };
}
