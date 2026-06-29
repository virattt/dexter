/**
 * Permission engine types.
 *
 * The engine generalizes Dexter's per-tool approval gate into a per-call decision:
 * given a tool + args, return whether to allow, ask, or deny. For most tools the
 * decision is trivial (read-only → allow, file writes → ask); the `bash` tool drives
 * the richer machinery (command classification + allow/ask/deny rules).
 */

export type PermissionMode = 'allow' | 'ask' | 'deny';

/** How a command was classified by the read-only analyzer (bash only). */
export type Classification = 'read-only' | 'mutating' | 'unknown';

/** The engine's verdict for a single tool call. */
export interface PermissionDecision {
  mode: PermissionMode;
  /** Human-readable explanation, shown in the approval prompt. */
  reason: string;
  /** For bash: the command being evaluated (shown in the prompt instead of a path). */
  command?: string;
  /** For bash: read-only vs mutating vs unknown. */
  classification?: Classification;
  /** The rule string that matched (if any), e.g. "Bash(git status)". */
  matchedRule?: string;
  /** A conservative rule the user could choose to persist via "always allow". */
  proposedRule?: string;
  /** Active sandbox level at decision time (Phase 3), surfaced in the prompt. */
  sandboxLevel?: string;
  /**
   * Whether an `allow-session` grant may be cached for this exact call. When false
   * (e.g. a bash command containing shell metacharacters or an interpreter), the
   * command always re-prompts and can never be silently skipped by a prior grant.
   * Undefined is treated as cacheable (legacy file-write tools).
   */
  sessionCacheable?: boolean;
}

/** Input to the engine. */
export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
}
