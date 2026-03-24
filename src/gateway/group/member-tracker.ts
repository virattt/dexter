/**
 * Track group member display names from messages.
 * Maps e164 phone numbers to display names per group.
 */

// groupId → Map<e164, displayName>
const rosters = new Map<string, Map<string, string>>();

/**
 * Record a group member's display name from an incoming message.
 */
export function noteGroupMember(groupId: string, senderId: string, displayName?: string): void {
  if (!displayName) return;

  let roster = rosters.get(groupId);
  if (!roster) {
    roster = new Map();
    rosters.set(groupId, roster);
  }
  roster.set(senderId, displayName);
}

/**
 * Format a human-readable list of group members.
 * Combines API-provided participants with observed display names from the roster.
 */
export function formatGroupMembersList(params: {
  groupId: string;
  participants?: string[];
}): string {
  const { groupId, participants } = params;
  const roster = rosters.get(groupId);

  if (!participants?.length && !roster?.size) {
    return '';
  }

  const lines: string[] = [];
  const seen = new Set<string>();

  // Roster entries (have display names)
  if (roster) {
    for (const [id, name] of roster) {
      lines.push(`- ${name} (${id})`);
      seen.add(id);
    }
  }

  // Participants from group metadata (fill in any not already in roster)
  if (participants) {
    for (const p of participants) {
      if (p && !seen.has(p)) {
        lines.push(`- ${p}`);
        seen.add(p);
      }
    }
  }

  return lines.join('\n');
}
