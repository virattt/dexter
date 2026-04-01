/**
 * Temporal decay scoring for memory search results.
 *
 * Applies exponential decay based on memory age so that recent memories
 * rank higher than stale ones. "Evergreen" files (MEMORY.md, non-dated
 * topic files) are exempt from decay.
 *
 * Ported from Openclaw (MIT licensed).
 */

import type { MemorySearchResult, TemporalDecayConfig } from './types.js';

export const DEFAULT_TEMPORAL_DECAY: TemporalDecayConfig = {
  enabled: true,
  halfLifeDays: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATED_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.md$/;

export function toDecayLambda(halfLifeDays: number): number {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    return 0;
  }
  return Math.LN2 / halfLifeDays;
}

export function calculateTemporalDecayMultiplier(params: {
  ageInDays: number;
  halfLifeDays: number;
}): number {
  const lambda = toDecayLambda(params.halfLifeDays);
  const clampedAge = Math.max(0, params.ageInDays);
  if (lambda <= 0 || !Number.isFinite(clampedAge)) {
    return 1;
  }
  return Math.exp(-lambda * clampedAge);
}

function parseDateFromFileName(fileName: string): Date | null {
  const match = DATED_FILE_RE.exec(fileName);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function isEvergreenFile(fileName: string): boolean {
  if (fileName === 'MEMORY.md' || fileName === 'memory.md') {
    return true;
  }
  // Non-dated files in memory/ are evergreen topic files.
  return !DATED_FILE_RE.test(fileName);
}

/**
 * Determine the age timestamp for a search result.
 *
 * - Dated memory files (YYYY-MM-DD.md): date from filename
 * - MEMORY.md and other non-dated files: null (evergreen, no decay)
 * - Session chunks: use updatedAt from the DB
 */
function extractTimestampMs(result: MemorySearchResult): number | null {
  const path = result.path;

  // Session chunks use their indexed timestamp.
  if (path.startsWith('sessions/')) {
    return result.updatedAt ?? null;
  }

  // Try to parse date from filename.
  const dateFromName = parseDateFromFileName(path);
  if (dateFromName) {
    return dateFromName.getTime();
  }

  // Evergreen memory files do not decay.
  if (isEvergreenFile(path)) {
    return null;
  }

  // Fallback: use the chunk's updatedAt (indexing time).
  return result.updatedAt ?? null;
}

export function applyTemporalDecay(params: {
  results: MemorySearchResult[];
  config: TemporalDecayConfig;
  nowMs?: number;
}): MemorySearchResult[] {
  if (!params.config.enabled) {
    return params.results;
  }

  const nowMs = params.nowMs ?? Date.now();

  return params.results.map((entry) => {
    const timestampMs = extractTimestampMs(entry);
    if (timestampMs === null) {
      return entry;
    }

    const ageInDays = Math.max(0, nowMs - timestampMs) / DAY_MS;
    const multiplier = calculateTemporalDecayMultiplier({
      ageInDays,
      halfLifeDays: params.config.halfLifeDays,
    });

    return { ...entry, score: entry.score * multiplier };
  });
}
