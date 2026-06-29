/**
 * Permission engine — decides allow / ask / deny for a tool call.
 *
 * Phase 0: behavior-preserving generalization of the previous per-tool gate.
 *   - write_file / edit_file → ask (unchanged)
 *   - everything else        → allow (unchanged)
 *
 * Later phases extend `evaluatePermission` with the `bash` command gate
 * (strict-syntax in Phase 1; full rule engine + classifier in Phase 2).
 */
import type { PermissionDecision, PermissionRequest } from './types.js';

/** Tools that have always required explicit user approval before running. */
const LEGACY_APPROVAL_TOOLS = new Set<string>(['write_file', 'edit_file']);

/**
 * Shared session-approval key for the file-writing tools. Using one key for both
 * preserves the legacy behavior where approving "allow all edits this session" on
 * one of write_file/edit_file also covers the other.
 */
const FILE_WRITE_SESSION_KEY = 'file:write';

/**
 * Evaluate whether a tool call may proceed.
 */
export function evaluatePermission(req: PermissionRequest): PermissionDecision {
  if (LEGACY_APPROVAL_TOOLS.has(req.tool)) {
    return { mode: 'ask', reason: 'This tool modifies files and needs your approval.' };
  }
  return { mode: 'allow', reason: 'Auto-approved.' };
}

/**
 * The key under which an `allow-session` grant is remembered. Approving the same
 * key again within the session skips the prompt.
 *
 * For the legacy file-write tools this is a shared key (legacy parity). For other
 * ask-gated tools it is the tool name; Phase 2 refines bash to key on the exact
 * matched rule so a session grant doesn't over-approve unrelated commands.
 */
export function sessionKey(tool: string, _decision: PermissionDecision): string {
  if (LEGACY_APPROVAL_TOOLS.has(tool)) {
    return FILE_WRITE_SESSION_KEY;
  }
  return tool;
}
