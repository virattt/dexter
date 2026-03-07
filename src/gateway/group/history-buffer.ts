/**
 * In-memory buffer for group messages between bot replies.
 * Records messages in each group and provides them as context when the bot is mentioned.
 */

export type GroupHistoryEntry = {
  senderName: string;
  senderId: string;
  body: string;
  timestamp: number;
};

const MAX_ENTRIES_PER_GROUP = 50;
const MAX_GROUPS = 200;

const buffers = new Map<string, GroupHistoryEntry[]>();

/**
 * Record a group message into the history buffer.
 */
export function recordGroupMessage(groupId: string, entry: GroupHistoryEntry): void {
  let entries = buffers.get(groupId);
  if (!entries) {
    // LRU eviction: if at capacity, remove the oldest-accessed group
    if (buffers.size >= MAX_GROUPS) {
      const oldestKey = buffers.keys().next().value as string;
      buffers.delete(oldestKey);
    }
    entries = [];
    buffers.set(groupId, entries);
  }

  entries.push(entry);

  // Trim to max entries
  if (entries.length > MAX_ENTRIES_PER_GROUP) {
    entries.splice(0, entries.length - MAX_ENTRIES_PER_GROUP);
  }
}

/**
 * Get all buffered history for a group and clear it.
 */
export function getAndClearGroupHistory(groupId: string): GroupHistoryEntry[] {
  const entries = buffers.get(groupId) ?? [];
  buffers.delete(groupId);
  return entries;
}

/**
 * Format group history entries and the current message into a context block
 * for the agent's system prompt.
 */
export function formatGroupHistoryContext(params: {
  history: GroupHistoryEntry[];
  currentSenderName: string;
  currentSenderId: string;
  currentBody: string;
}): string {
  const { history, currentSenderName, currentSenderId, currentBody } = params;
  const parts: string[] = [];

  if (history.length > 0) {
    parts.push('[Group messages since your last reply - for context]');
    for (const entry of history) {
      parts.push(`${entry.senderName} (${entry.senderId}): ${entry.body}`);
    }
    parts.push('');
  }

  parts.push('[Current message - respond to this]');
  parts.push(`${currentSenderName} (${currentSenderId}): ${currentBody}`);

  return parts.join('\n');
}
