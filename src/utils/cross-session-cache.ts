import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDexterDir } from './paths.js';

export const CACHE_DIR = join(getDexterDir(), 'cache');

export interface DiskCacheEntry {
  key: string;
  value: string;
  expiresAt: number;
  toolName: string;
  savedAt: string;  // ISO date
}

const MAX_VALUE_SIZE = 50 * 1024; // 50 KB

/** Replaces characters that are illegal or problematic in filenames. */
function sanitizeKey(key: string): string {
  return key.replace(/[/:?&]/g, '_').slice(0, 100);
}

/** Load non-expired entries from disk. Returns map of key → value. */
export async function loadCacheFromDisk(): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    return result;
  }

  let files: string[];
  try {
    files = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return result;
  }

  const now = Date.now();

  for (const file of files) {
    try {
      const raw = readFileSync(join(CACHE_DIR, file), 'utf-8');
      const entry = JSON.parse(raw) as DiskCacheEntry;

      // Skip expired entries
      if (entry.expiresAt < now) continue;

      // Basic shape validation
      if (
        typeof entry.key !== 'string' ||
        typeof entry.value !== 'string' ||
        typeof entry.expiresAt !== 'number'
      ) {
        continue;
      }

      result.set(entry.key, entry.value);
    } catch {
      // Silently skip malformed files
    }
  }

  return result;
}

/** Persist a single cache entry to disk. Fire-and-forget; never throws. */
export function saveCacheToDisk(
  key: string,
  value: string,
  toolName: string,
  ttlMs: number,
): void {
  try {
    // Skip very large values to avoid bloating disk cache
    if (value.length > MAX_VALUE_SIZE) return;

    mkdirSync(CACHE_DIR, { recursive: true });

    const sanitizedKey = sanitizeKey(key);
    const filePath = join(CACHE_DIR, `${sanitizedKey}.json`);

    const entry: DiskCacheEntry = {
      key,
      value,
      expiresAt: Date.now() + ttlMs,
      toolName,
      savedAt: new Date().toISOString(),
    };

    writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  } catch {
    // Silently swallow write errors
  }
}
