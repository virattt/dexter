const RECENT_MESSAGE_TTL_MS = 20 * 60_000; // 20 minutes
const RECENT_MESSAGE_MAX = 5000;

type CacheEntry = {
  key: string;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const insertionOrder: string[] = [];

function pruneExpired(): void {
  const now = Date.now();
  const cutoff = now - RECENT_MESSAGE_TTL_MS;

  // Remove expired entries from the front of insertion order
  while (insertionOrder.length > 0) {
    const oldestKey = insertionOrder[0];
    const entry = cache.get(oldestKey);
    if (entry && entry.timestamp < cutoff) {
      cache.delete(oldestKey);
      insertionOrder.shift();
    } else {
      break;
    }
  }

  // Enforce max size
  while (cache.size > RECENT_MESSAGE_MAX && insertionOrder.length > 0) {
    const oldestKey = insertionOrder.shift();
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

/**
 * Check if a message ID was recently seen.
 * Returns true if it's a duplicate (already seen), false if new.
 * Automatically adds the key to the cache if not seen before.
 */
export function isRecentInboundMessage(key: string): boolean {
  pruneExpired();

  if (cache.has(key)) {
    return true;
  }

  cache.set(key, { key, timestamp: Date.now() });
  insertionOrder.push(key);
  return false;
}

/**
 * Clear the deduplication cache (useful for testing).
 */
export function resetInboundDedupe(): void {
  cache.clear();
  insertionOrder.length = 0;
}
