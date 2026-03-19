/**
 * Tracks display names for group members across conversations.
 * Maps groupId -> { memberId -> displayName }
 */
const memberMap = new Map<string, Map<string, string>>();

/**
 * Record a group member's display name from an incoming message.
 */
export function noteGroupMember(groupId: string, memberId: string, displayName?: string): void {
  if (!displayName) return;
  if (!memberMap.has(groupId)) {
    memberMap.set(groupId, new Map());
  }
  memberMap.get(groupId)!.set(memberId, displayName);
}

/**
 * Format a roster of group members, merging observed display names with
 * the participant list provided by the WhatsApp API.
 */
export function formatGroupMembersList(
  groupId: string,
  apiParticipants?: string[]
): string {
  const knownNames = memberMap.get(groupId) ?? new Map<string, string>();
  const lines: string[] = [];
  const seen = new Set<string>();

  // First: members with known display names
  for (const [id, name] of knownNames) {
    lines.push(`- ${name} (${id})`);
    seen.add(id);
  }

  // Then: API participants without recorded names
  for (const id of apiParticipants ?? []) {
    if (!seen.has(id)) {
      lines.push(`- ${id}`);
      seen.add(id);
    }
  }

  return lines.join('\n');
}
