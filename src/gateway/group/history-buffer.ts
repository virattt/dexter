/**
 * In-memory buffer for group chat history.
 * Stores up to MAX_MESSAGES_PER_GROUP per group, across MAX_GROUPS groups.
 * When capacity is reached, the oldest-accessed group is evicted (LRU).
 */

const MAX_MESSAGES_PER_GROUP = 50;
const MAX_GROUPS = 200;

export interface GroupHistoryEntry {
  senderName?: string;
  senderId: string;
  body: string;
  timestamp: number;
}

// Map from groupId -> { entries, lastAccessed }
const buffer = new Map<string, { entries: GroupHistoryEntry[]; lastAccessed: number }>();

function evictIfNeeded(): void {
  if (buffer.size < MAX_GROUPS) return;
  // Remove the oldest-accessed group
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, val] of buffer) {
    if (val.lastAccessed < oldestTime) {
      oldestTime = val.lastAccessed;
      oldestKey = key;
    }
  }
  if (oldestKey) buffer.delete(oldestKey);
}

/**
 * Record a new message into a group's history buffer.
 */
export function recordGroupMessage(groupId: string, entry: GroupHistoryEntry): void {
  evictIfNeeded();
  const existing = buffer.get(groupId);
  if (existing) {
    existing.entries.push(entry);
    if (existing.entries.length > MAX_MESSAGES_PER_GROUP) {
      existing.entries.shift();
    }
    existing.lastAccessed = Date.now();
  } else {
    buffer.set(groupId, { entries: [entry], lastAccessed: Date.now() });
  }
}

/**
 * Retrieve and clear the buffered messages for a group.
 * Returns an empty array if there is no history.
 */
export function getAndClearGroupHistory(groupId: string): GroupHistoryEntry[] {
  const existing = buffer.get(groupId);
  if (!existing) return [];
  const entries = [...existing.entries];
  buffer.delete(groupId);
  return entries;
}

/**
 * Format group history entries as a context block for the agent prompt.
 */
export function formatGroupHistoryContext(
  entries: GroupHistoryEntry[],
  currentMessage: string
): string {
  if (entries.length === 0) return currentMessage;

  const historyBlock = entries
    .map((e) => {
      const who = e.senderName ? `${e.senderName} (${e.senderId})` : e.senderId;
      return `[${new Date(e.timestamp).toISOString()}] ${who}: ${e.body}`;
    })
    .join('\n');

  return [
    '## Conversa anterior no grupo',
    historyBlock,
    '',
    '## Mensagem atual',
    currentMessage,
  ].join('\n');
}
