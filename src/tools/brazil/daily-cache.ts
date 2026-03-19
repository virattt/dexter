/**
 * Daily TTL cache for Brazilian financial data.
 *
 * Stores fundamental data (DRE, Balanço, indicadores) keyed by ticker + date.
 * Cache files live in ~/.dexter/cache/br/{YYYY-MM-DD}/{TICKER}.json
 *
 * Rationale: CVM and Fundamentus data is published quarterly/annually.
 * Re-fetching on every query is wasteful. A daily cache reduces requests
 * without serving stale fundamental data (prices are NOT cached here).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../../utils/logger.js';

const CACHE_BASE = join(homedir(), '.dexter', 'cache', 'br');

function todayString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function cacheDir(date: string): string {
  return join(CACHE_BASE, date);
}

function cachePath(ticker: string, date: string): string {
  return join(cacheDir(date), `${ticker.toUpperCase()}.json`);
}

/**
 * Read today's cached fundamental data for a ticker.
 * Returns null on cache miss, corruption, or any read error.
 */
export function readDailyCache(ticker: string): Record<string, unknown> | null {
  const today = todayString();
  const filepath = cachePath(ticker, today);

  if (!existsSync(filepath)) return null;

  try {
    const content = readFileSync(filepath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) return null;
    logger.debug(`[daily-cache] HIT ${ticker} (${today})`);
    return parsed as Record<string, unknown>;
  } catch {
    logger.warn(`[daily-cache] Corrompido para ${ticker}, ignorando.`);
    return null;
  }
}

/**
 * Write fundamental data to today's cache for a ticker.
 * Never throws — cache writes must not break the application.
 */
export function writeDailyCache(ticker: string, data: Record<string, unknown>): void {
  const today = todayString();
  const dir = cacheDir(today);
  const filepath = cachePath(ticker, today);

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug(`[daily-cache] WRITE ${ticker} (${today})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[daily-cache] Falha ao gravar cache para ${ticker}: ${msg}`);
  }
}
