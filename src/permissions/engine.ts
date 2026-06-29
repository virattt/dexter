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
 * Phase-1 bash gate. The OS sandbox does not exist yet, so every command is
 * human-approved. This helper only decides whether an approval may be remembered
 * for the session (`allow-session`): a command is "simple" — and therefore
 * cacheable — only if it has no shell metacharacters / dynamic constructs AND its
 * first word is not an interpreter or code-generator. Anything else always
 * re-prompts, so the model can't prime a session grant on a deceptive command.
 *
 * Conservative by design (errs toward not-cacheable). Phase 2 replaces this with
 * the full command parser + classifier.
 */
const SHELL_METACHARACTERS = /[`$|;&<>(){}\\#]|\n/;
const INTERPRETER_DENYLIST = new Set<string>([
  'python', 'python3', 'node', 'bun', 'ruby', 'perl', 'sh', 'bash', 'zsh', 'ksh',
  'eval', 'exec', 'source', 'env', 'xargs', 'find', 'tee', 'awk', 'sed',
]);

function isSimpleBashCommand(command: string): boolean {
  const cmd = command.trim();
  if (!cmd) return false;
  if (SHELL_METACHARACTERS.test(cmd)) return false;
  // Strip leading `VAR=value` environment assignments before reading the command word.
  const tokens = cmd.split(/[ \t]+/);
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  const first = tokens[i];
  if (!first) return false;
  const base = first.split('/').pop() ?? first; // basename, so /usr/bin/python is caught
  return !INTERPRETER_DENYLIST.has(base);
}

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
  if (req.tool === 'bash') {
    const command = typeof req.args.command === 'string' ? req.args.command : '';
    // Phase 1: every command asks (no sandbox yet). Only the session-cache
    // eligibility varies — simple commands may be remembered, complex ones never.
    return {
      mode: 'ask',
      reason: 'Running a shell command needs your approval.',
      command,
      sessionCacheable: isSimpleBashCommand(command),
    };
  }
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
export function sessionKey(tool: string, decision: PermissionDecision): string {
  if (LEGACY_APPROVAL_TOOLS.has(tool)) {
    return FILE_WRITE_SESSION_KEY;
  }
  if (tool === 'bash') {
    // Key on the exact (trimmed) command, so a session grant never covers a different command.
    return `bash:${(decision.command ?? '').trim()}`;
  }
  return tool;
}
